"""
Servicios de negocio para ITSE.
"""

from django.core.files.storage import default_storage
from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ..models import AutorizacionImprocedente, Expediente, Itse, ItseArchivo, ItseEstado, ItseGiro
from .autorizacion_improcedente import ItseYaEmitidaError
from .licencia_funcionamiento import ReciboPagoDuplicadoError


class ExpedienteNoExisteError(Exception):
    """El expediente indicado no existe en base de datos."""


class ItseDenegadaError(Exception):
    """El expediente tiene ITSE denegada (autorización improcedente)."""


class ItseNumeroDuplicadoError(Exception):
    """Ya existe un registro ITSE con el mismo número correlativo."""

# Consulta base: campos de ITSE + expediente, titular, conductor, RUC y actividad.
# esta_activo: TRUE si no hay ningún estado inactivo en el historial (estados.esta_activo = FALSE).
_SQL_BUSCAR_ITSE = """
SELECT
    i.id,
    i.expediente_id,
    i.tipo_itse_id,
    i.numero_itse,
    i.fecha_expedicion,
    i.fecha_solicitud_renovacion,
    i.fecha_caducidad,
    i.titular_id,
    i.conductor_id,
    i.itse_principal_id,
    i.nombre_comercial,
    i.nivel_riesgo_id,
    i.direccion,
    i.resolucion_numero,
    i.area,
    i.numero_recibo_pago,
    i.observaciones,
    i.se_puede_publicar,
    i.capacidad_aforo,
    i.fecha_notificacion,
    i.usuario_id,
    i.fecha_digitacion,
    e.numero_expediente,
    e.fecha_recepcion,
    TRIM(
        COALESCE(ttitular.apellido_paterno, '') || ' ' ||
        COALESCE(ttitular.apellido_materno, '') || ' ' ||
        COALESCE(ttitular.nombres, '')
    ) AS titular_nombre,
    truc.numero_documento AS titular_ruc,
    TRIM(
        COALESCE(tconductor.apellido_paterno, '') || ' ' ||
        COALESCE(tconductor.apellido_materno, '') || ' ' ||
        COALESCE(tconductor.nombres, '')
    ) AS conductor_nombre,
    CASE
        WHEN titse_inactivos.itse_id IS NULL THEN TRUE
        ELSE FALSE
    END AS esta_activo,
    CASE i.tipo_itse_id
        WHEN 1 THEN 'ESTÁNDAR'
        WHEN 2 THEN 'RENOVACIÓN'
        ELSE 'DESCONOCIDO'
    END AS tipo_itse_nombre,
    nr.nombre AS nivel_riesgo_nombre
FROM itse i
LEFT JOIN expedientes e
    ON i.expediente_id = e.id
LEFT JOIN personas AS ttitular
    ON i.titular_id = ttitular.id
LEFT JOIN personas AS tconductor
    ON i.conductor_id = tconductor.id
LEFT JOIN (
    SELECT
        pd.id,
        pd.persona_id,
        pd.numero_documento
    FROM personas_documentos pd
    INNER JOIN tipos_documento_identidad tdi
        ON pd.tipo_documento_identidad_id = tdi.id
    WHERE tdi.codigo = '06'
) AS truc
    ON i.titular_id = truc.persona_id
LEFT JOIN (
    SELECT DISTINCT ie.itse_id
    FROM itse_estados ie
    INNER JOIN estados est
        ON ie.estado_id = est.id
    WHERE est.esta_activo = FALSE
) AS titse_inactivos
    ON i.id = titse_inactivos.itse_id
LEFT JOIN niveles_riesgo nr
    ON i.nivel_riesgo_id = nr.id
{where}
ORDER BY i.numero_itse DESC
"""

_WHERE_FECHA_EXPEDICION = (
    'WHERE i.fecha_expedicion = %s',
    str,
)

_FILTROS_BUSQUEDA_ITSE: dict[str, tuple[str, callable]] = {
    'ID': (
        'WHERE i.id = %s',
        int,
    ),
    'NUMERO': (
        'WHERE i.numero_itse = %s',
        int,
    ),
    'EXPEDIENTE': (
        'WHERE e.numero_expediente = %s',
        int,
    ),
    'EXPEDIENTE_ID': (
        'WHERE e.id = %s',
        int,
    ),
    'NOMBRE_COMERCIAL': (
        'WHERE i.nombre_comercial ILIKE %s',
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'FECHA_EXPEDICION': _WHERE_FECHA_EXPEDICION,
    # Alias usado en algunos scripts legacy (misma columna fecha_expedicion).
    'FECHA_EMISION': _WHERE_FECHA_EXPEDICION,
    'NOMBRES_TITULAR': (
        "WHERE TRIM("
        "    COALESCE(ttitular.apellido_paterno, '') || ' ' ||"
        "    COALESCE(ttitular.apellido_materno, '') || ' ' ||"
        "    COALESCE(ttitular.nombres, '')"
        ") ILIKE %s",
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'RUC_TITULAR': (
        'WHERE truc.numero_documento = %s',
        str,
    ),
    'NOMBRES_CONDUCTOR': (
        "WHERE TRIM("
        "    COALESCE(tconductor.apellido_paterno, '') || ' ' ||"
        "    COALESCE(tconductor.apellido_materno, '') || ' ' ||"
        "    COALESCE(tconductor.nombres, '')"
        ") ILIKE %s",
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'DIRECCION': (
        'WHERE TRIM(i.direccion) ILIKE %s',
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'RECIBO_PAGO': (
        'WHERE TRIM(i.numero_recibo_pago) ILIKE %s',
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'RESOLUCION_NUMERO': (
        'WHERE TRIM(i.resolucion_numero) ILIKE %s',
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
}


def buscar_itse(filtro: str, valor: str) -> list[dict]:
    """
    Busca registros ITSE según filtro y valor (equivalente PostgreSQL del SQL Server original).

    Filtros válidos
    ---------------
    ID, NUMERO, EXPEDIENTE, NOMBRE_COMERCIAL, FECHA_EXPEDICION (o FECHA_EMISION),
    NOMBRES_TITULAR, RUC_TITULAR, NOMBRES_CONDUCTOR, DIRECCION, RECIBO_PAGO,
    RESOLUCION_NUMERO.
    """
    filtro = filtro.upper().strip()
    if filtro not in _FILTROS_BUSQUEDA_ITSE:
        raise ValueError(
            f"Filtro '{filtro}' no válido. "
            f"Opciones: {', '.join(sorted(set(_FILTROS_BUSQUEDA_ITSE)))}"
        )

    where_clause, transformar = _FILTROS_BUSQUEDA_ITSE[filtro]
    valor_param = transformar(valor)

    sql = _SQL_BUSCAR_ITSE.format(where=where_clause)

    with connection.cursor() as cursor:
        cursor.execute(sql, [valor_param])
        columnas = [col.name for col in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


# ── Estados de ITSE ────────────────────────────────────────────────────────────

_SQL_LISTAR_ESTADOS_ITSE = """
SELECT
    ie.id,
    ie.itse_id,
    ie.estado_id,
    ie.fecha_estado,
    ie.documento,
    ie.observaciones,
    ie.usuario_id,
    ie.fecha_digitacion,
    est.nombre  AS estado_nombre,
    est.es_para_lf,
    est.es_para_itse,
    est.esta_activo
FROM itse_estados ie
LEFT JOIN estados est
    ON ie.estado_id = est.id
WHERE ie.itse_id = %s
ORDER BY ie.fecha_digitacion DESC
"""


def listar_estados_itse(itse_id: int) -> list[dict]:
    """
    Lista el historial de estados de un ITSE.

    Parámetros
    ----------
    itse_id : int
        PK del ITSE.

    Retorna
    -------
    list[dict]
        Lista de estados ordenados por fecha de digitación descendente.
        Cada elemento incluye: id, itse_id, estado_id, fecha_estado,
        documento, observaciones, usuario_id, fecha_digitacion,
        estado_nombre, es_para_lf, es_para_itse, esta_activo.
    """
    with connection.cursor() as cursor:
        cursor.execute(_SQL_LISTAR_ESTADOS_ITSE, [itse_id])
        columnas = [col.name for col in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


def verificar_numero_expediente_para_itse(numero_expediente: int, anio: int) -> dict:
    """
    Verifica si un expediente (número y año de recepción) puede tener un ITSE emitido.

    Comprobaciones (en orden):
    1. Si no existe el expediente con ese número y año, no se puede emitir.
    2. Si hay autorización improcedente tipo ``ITSE``, el ITSE fue denegado.
    3. Si el expediente ya tiene un ITSE emitido, no se puede emitir otro.
    4. En caso contrario, se puede emitir.

    Retorna
    -------
    dict
        se_puede_emitir_itse : bool
        expediente_id        : int | None
        mensaje              : str
    """
    expediente = Expediente.objects.filter(
        numero_expediente=numero_expediente,
        fecha_recepcion__year=anio,
    ).first()

    if not expediente:
        return {
            'se_puede_emitir_itse': False,
            'expediente_id': None,
            'mensaje': 'El expediente no existe, primero debe ingresarlo.',
        }

    if AutorizacionImprocedente.objects.filter(
        expediente_id=expediente.id,
        tipo_autorizacion='ITSE',
    ).exists():
        return {
            'se_puede_emitir_itse': False,
            'expediente_id': expediente.id,
            'mensaje': 'El expediente registra ITSE denegado.',
        }

    itse = Itse.objects.filter(expediente_id=expediente.id).first()

    if itse:
        return {
            'se_puede_emitir_itse': False,
            'expediente_id': expediente.id,
            'mensaje': f'El expediente ya registra el ITSE número {itse.numero_itse}.',
        }

    return {
        'se_puede_emitir_itse': True,
        'expediente_id': expediente.id,
        'mensaje': '',
    }


# ── Creación de ITSE ────────────────────────────────────────────────────────────


def _validar_expediente_para_emision_itse(
    expediente_id: int,
    excluir_itse_id: int | None = None,
) -> None:
    """
    Reglas comunes al crear o modificar un ITSE respecto al expediente.

    ``excluir_itse_id`` permite ignorar el registro que se está editando al
    comprobar que el expediente no tenga ya otro ITSE.
    """
    if not Expediente.objects.filter(pk=expediente_id).exists():
        raise ExpedienteNoExisteError('El expediente indicado no existe.')

    if AutorizacionImprocedente.objects.filter(
        expediente_id=expediente_id,
        tipo_autorizacion='ITSE',
    ).exists():
        raise ItseDenegadaError(
            'El expediente tiene autorización improcedente para ITSE; no se puede emitir.'
        )

    qs = Itse.objects.filter(expediente_id=expediente_id)
    if excluir_itse_id is not None:
        qs = qs.exclude(pk=excluir_itse_id)
    existente = qs.first()
    if existente:
        raise ItseYaEmitidaError(
            f'El expediente ya registra el ITSE número {existente.numero_itse}.'
        )


def _validar_numero_itse_unico(numero_itse: int) -> None:
    if Itse.objects.filter(numero_itse=numero_itse).exists():
        raise ItseNumeroDuplicadoError('El número de la ITSE ya existe.')


def _validar_numero_itse_unico_para_update(numero_itse: int, itse_id: int) -> None:
    if Itse.objects.filter(numero_itse=numero_itse).exclude(pk=itse_id).exists():
        raise ItseNumeroDuplicadoError('El número de la ITSE ya existe.')


def _validar_recibo_pago_unico_para_itse(numero_recibo: str) -> None:
    """
    Solo exige unicidad del recibo dentro de ``itse``.
    El mismo número puede coexistir en ``licencias_funcionamiento``.
    """
    if Itse.objects.filter(numero_recibo_pago=numero_recibo).exists():
        raise ReciboPagoDuplicadoError(
            f'El número de recibo de pago "{numero_recibo}" ya se encuentra '
            'registrado en la tabla itse.'
        )


def _validar_recibo_pago_unico_para_itse_update(numero_recibo: str, itse_id: int) -> None:
    if Itse.objects.filter(numero_recibo_pago=numero_recibo).exclude(pk=itse_id).exists():
        raise ReciboPagoDuplicadoError(
            f'El número de recibo de pago "{numero_recibo}" ya se encuentra '
            'registrado en la tabla itse.'
        )


def crear_itse(data: dict, usuario) -> Itse:
    """
    Crea un ITSE y sus giros asociados.

    Validaciones
    ------------
    - El expediente debe existir.
    - Sin autorización improcedente tipo ``ITSE`` para el expediente.
    - El expediente no debe tener ya un ITSE emitido (misma regla que la verificación previa).
    - ``numero_itse`` único.
    - ``numero_recibo_pago`` único solo dentro de ``itse`` (puede repetirse en LF).

    ``usuario`` y ``fecha_digitacion`` se toman del usuario autenticado y del servidor,
    no del cuerpo de la petición.
    """
    _validar_expediente_para_emision_itse(data['expediente_id'])
    _validar_numero_itse_unico(data['numero_itse'])
    _validar_recibo_pago_unico_para_itse(data['numero_recibo_pago'])

    with transaction.atomic():
        itse = Itse.objects.create(
            expediente_id=data['expediente_id'],
            tipo_itse_id=data['tipo_itse_id'],
            numero_itse=data['numero_itse'],
            fecha_expedicion=data['fecha_expedicion'],
            fecha_solicitud_renovacion=data['fecha_solicitud_renovacion'],
            fecha_caducidad=data['fecha_caducidad'],
            titular_id=data['titular_id'],
            conductor_id=data['conductor_id'],
            itse_principal_id=data.get('itse_principal_id'),
            nombre_comercial=data['nombre_comercial'],
            nivel_riesgo_id=data['nivel_riesgo_id'],
            direccion=data['direccion'],
            resolucion_numero=data['resolucion_numero'],
            area=data['area'],
            numero_recibo_pago=data['numero_recibo_pago'],
            observaciones=data.get('observaciones') or '',
            se_puede_publicar=data.get('se_puede_publicar', False),
            capacidad_aforo=data['capacidad_aforo'],
            usuario=usuario,
            fecha_digitacion=timezone.now(),
        )

        giros = [
            ItseGiro(
                itse=itse,
                giro_id=item['giro_id'],
                usuario=usuario,
                fecha_digitacion=timezone.now(),
            )
            for item in data.get('giros', [])
        ]
        if giros:
            ItseGiro.objects.bulk_create(giros)

    return itse


# ── Registro de inactivación (historial en itse_estados) ───────────────────────


class EstadoInactivacionItseDuplicadoError(Exception):
    """Ya existe un registro con el mismo par itse + estado."""


def registrar_inactivacion_itse(
    itse_id: int,
    estado_id: int,
    fecha_estado,
    documento: str,
    observaciones: str,
    usuario,
) -> ItseEstado:
    """
    Inserta un registro en ``itse_estados``.

    Validaciones
    ------------
    1. El ITSE debe existir; si no, lanza ``Itse.DoesNotExist``.
    2. No puede existir ya un registro con el mismo ``itse_id`` y ``estado_id``;
       de lo contrario lanza ``EstadoInactivacionItseDuplicadoError``.

    Parámetros
    ----------
    itse_id, estado_id, fecha_estado, documento, observaciones
        Datos del historial de estado.
    usuario
        Usuario autenticado (``request.user``); se guarda en ``usuario_id``.
    """
    Itse.objects.get(pk=itse_id)

    if ItseEstado.objects.filter(
        itse_id=itse_id,
        estado_id=estado_id,
    ).exists():
        raise EstadoInactivacionItseDuplicadoError(
            'Ya existe un registro para este ITSE con el mismo estado.'
        )

    return ItseEstado.objects.create(
        itse_id=itse_id,
        estado_id=estado_id,
        fecha_estado=fecha_estado,
        documento=documento,
        observaciones=observaciones,
        usuario=usuario,
        fecha_digitacion=timezone.now(),
    )


# ── Registro de notificación de entrega ────────────────────────────────────────


class ItseNotificacionFechaInvalidaError(Exception):
    """Se lanza cuando la fecha de notificación es anterior a la fecha de expedición."""


def registrar_notificacion_itse(itse_id: int, fecha_notificacion) -> Itse:
    """
    Registra la fecha de notificación de entrega en un ITSE.

    Validaciones
    ------------
    1. El ITSE debe existir; si no, lanza ``Itse.DoesNotExist``.
    2. ``fecha_notificacion`` debe ser mayor o igual a ``fecha_expedicion``; de lo
       contrario lanza ``ItseNotificacionFechaInvalidaError``.

    Parámetros
    ----------
    itse_id : int
        PK del ITSE a actualizar.
    fecha_notificacion : date
        Fecha en que se entregó la notificación.

    Retorna
    -------
    Itse
        Instancia actualizada con ``fecha_notificacion`` guardada.
    """
    itse = Itse.objects.get(pk=itse_id)

    fecha_notificacion_date = (
        fecha_notificacion.date()
        if hasattr(fecha_notificacion, 'date')
        else fecha_notificacion
    )
    if fecha_notificacion_date < itse.fecha_expedicion:
        raise ItseNotificacionFechaInvalidaError(
            'La fecha de notificación no puede ser anterior a la fecha de expedición '
            f'({itse.fecha_expedicion}).'
        )

    itse.fecha_notificacion = fecha_notificacion
    itse.save(update_fields=['fecha_notificacion'])
    return itse


def modificar_itse(itse_id: int, data: dict) -> Itse:
    """
    Actualiza un ITSE y reemplaza por completo la lista de giros.

    Validaciones (mismas reglas que en creación, excluyendo el propio registro
    donde aplique): expediente, improcedente ITSE, un solo ITSE por expediente,
    ``numero_itse`` y ``numero_recibo_pago`` únicos en ``itse``.

    No modifica ``usuario`` ni ``fecha_digitacion`` del ITSE (auditoría del alta).
    Los giros nuevos se registran con el usuario digitador original del ITSE.
    """
    itse = Itse.objects.get(pk=itse_id)

    _validar_expediente_para_emision_itse(data['expediente_id'], excluir_itse_id=itse_id)
    _validar_numero_itse_unico_para_update(data['numero_itse'], itse_id)
    _validar_recibo_pago_unico_para_itse_update(data['numero_recibo_pago'], itse_id)

    with transaction.atomic():
        itse.expediente_id = data['expediente_id']
        itse.tipo_itse_id = data['tipo_itse_id']
        itse.numero_itse = data['numero_itse']
        itse.fecha_expedicion = data['fecha_expedicion']
        itse.fecha_solicitud_renovacion = data['fecha_solicitud_renovacion']
        itse.fecha_caducidad = data['fecha_caducidad']
        itse.titular_id = data['titular_id']
        itse.conductor_id = data['conductor_id']
        itse.itse_principal_id = data.get('itse_principal_id')
        itse.nombre_comercial = data['nombre_comercial']
        itse.nivel_riesgo_id = data['nivel_riesgo_id']
        itse.direccion = data['direccion']
        itse.resolucion_numero = data['resolucion_numero']
        itse.area = data['area']
        itse.numero_recibo_pago = data['numero_recibo_pago']
        itse.observaciones = data.get('observaciones') or ''
        itse.se_puede_publicar = data.get('se_puede_publicar', False)
        itse.capacidad_aforo = data['capacidad_aforo']
        itse.save()

        ItseGiro.objects.filter(itse=itse).delete()

        giros = [
            ItseGiro(
                itse=itse,
                giro_id=item['giro_id'],
                usuario=itse.usuario,
                fecha_digitacion=timezone.now(),
            )
            for item in data.get('giros', [])
        ]
        if giros:
            ItseGiro.objects.bulk_create(giros)

    return itse


# ── Eliminación de ITSE ────────────────────────────────────────────────────────

import logging as _logging
_logger_itse = _logging.getLogger(__name__)


class ItseTieneDependientesError(Exception):
    """Se lanza cuando la ITSE tiene ITSE dependientes que impiden su eliminación."""


def eliminar_itse(pk: int) -> None:
    """
    Elimina una ITSE y todos sus registros dependientes.

    Validaciones previas
    --------------------
    - Si la ITSE tiene ITSE dependientes (``itse_principal_id`` apuntando a ella),
      lanza ``ItseTieneDependientesError``.

    Eliminación dentro de transacción
    ----------------------------------
    1. Recopila las rutas de los archivos digitales antes de tocar la BD.
    2. Elimina la ITSE dentro de ``transaction.atomic()``.
       Django en cascada elimina:
         - ``itse_estados``   (on_delete=CASCADE)
         - ``itse_giros``     (on_delete=CASCADE)
         - ``itse_archivos``  (on_delete=CASCADE)
    3. Tras confirmar la transacción, elimina los archivos físicos del disco.
       Si algún borrado físico falla se registra un warning; la integridad de
       la BD ya está garantizada en ese punto.

    Parámetros
    ----------
    pk : int
        PK de la ITSE a eliminar.

    Lanza
    -----
    Http404
        Si la ITSE no existe.
    ItseTieneDependientesError
        Si la ITSE tiene ITSE dependientes asociadas.
    """
    itse = get_object_or_404(Itse, pk=pk)

    if itse.itse_dependientes.exists():
        raise ItseTieneDependientesError(
            'No se puede eliminar la ITSE: tiene ITSE dependientes asociadas. '
            'Primero debe eliminar las ITSE dependientes.'
        )

    rutas_archivos = list(
        ItseArchivo.objects.filter(itse_id=pk)
        .values_list('ruta_archivo', flat=True)
    )

    with transaction.atomic():
        itse.delete()

    for ruta in rutas_archivos:
        if default_storage.exists(ruta):
            try:
                default_storage.delete(ruta)
            except Exception:
                _logger_itse.warning(
                    'No se pudo eliminar el archivo físico "%s" de la ITSE pk=%s.',
                    ruta, pk,
                )


# ── Consulta de ITSE ────────────────────────────────────────────────────────────
#
# Se usa CTE para evitar el producto cartesiano que surgiría de unir
# personas_documentos (varios por persona) e itse_giros (varios por ITSE)
# en el mismo SELECT principal.

_SQL_CONSULTA_ITSE = """
WITH itse_filtradas AS (
    SELECT DISTINCT i.id
    FROM itse i
    LEFT JOIN expedientes e
        ON i.expediente_id = e.id
    LEFT JOIN personas AS ttitular
        ON i.titular_id = ttitular.id
    LEFT JOIN personas_documentos pd_titular
        ON i.titular_id = pd_titular.persona_id
    LEFT JOIN personas_documentos pd_conductor
        ON i.conductor_id = pd_conductor.persona_id
    {where}
),
titular_docs AS (
    SELECT
        i.id AS itse_id,
        STRING_AGG(
            tdi.nombre || ' ' || pd.numero_documento,
            ', '
            ORDER BY tdi.nombre || ' ' || pd.numero_documento
        ) AS titular_documentos
    FROM itse i
    JOIN itse_filtradas i_f ON i.id = i_f.id
    LEFT JOIN personas_documentos pd
        ON i.titular_id = pd.persona_id
    LEFT JOIN tipos_documento_identidad tdi
        ON pd.tipo_documento_identidad_id = tdi.id
    GROUP BY i.id
),
conductor_docs AS (
    SELECT
        i.id AS itse_id,
        STRING_AGG(
            tdi.nombre || ' ' || pd.numero_documento,
            ', '
            ORDER BY tdi.nombre || ' ' || pd.numero_documento
        ) AS conductor_documentos
    FROM itse i
    JOIN itse_filtradas i_f ON i.id = i_f.id
    LEFT JOIN personas_documentos pd
        ON i.conductor_id = pd.persona_id
    LEFT JOIN tipos_documento_identidad tdi
        ON pd.tipo_documento_identidad_id = tdi.id
    GROUP BY i.id
),
giros_concat AS (
    SELECT
        i.id AS itse_id,
        COALESCE(
            STRING_AGG(
                TRIM(g.nombre),
                ', '
                ORDER BY TRIM(g.nombre)
            ),
            ''
        ) AS giros
    FROM itse i
    JOIN itse_filtradas i_f ON i.id = i_f.id
    LEFT JOIN itse_giros ig
        ON i.id = ig.itse_id
    LEFT JOIN giros g
        ON ig.giro_id = g.id
    GROUP BY i.id
)
SELECT
    i.numero_itse,
    e.numero_expediente,
    TRIM(
        COALESCE(ttitular.apellido_paterno, '') || ' ' ||
        COALESCE(ttitular.apellido_materno, '') || ' ' ||
        COALESCE(ttitular.nombres, '')
    ) AS titular_nombre,
    COALESCE(td.titular_documentos, '')   AS titular_documentos,
    TRIM(
        COALESCE(tconductor.apellido_paterno, '') || ' ' ||
        COALESCE(tconductor.apellido_materno, '') || ' ' ||
        COALESCE(tconductor.nombres, '')
    ) AS conductor_nombre,
    COALESCE(cd.conductor_documentos, '') AS conductor_documentos,
    i.nombre_comercial,
    i.direccion,
    COALESCE(gc.giros, '')                AS giros,
    CASE
        WHEN tinactivos.itse_id IS NULL THEN TRUE
        ELSE FALSE
    END AS esta_activo
FROM itse i
JOIN  itse_filtradas i_f ON i.id = i_f.id
LEFT JOIN expedientes e
    ON i.expediente_id = e.id
LEFT JOIN personas AS ttitular
    ON i.titular_id = ttitular.id
LEFT JOIN personas AS tconductor
    ON i.conductor_id = tconductor.id
LEFT JOIN titular_docs  td ON i.id = td.itse_id
LEFT JOIN conductor_docs cd ON i.id = cd.itse_id
LEFT JOIN giros_concat   gc ON i.id = gc.itse_id
LEFT JOIN (
    SELECT DISTINCT ie.itse_id
    FROM itse_estados ie
    INNER JOIN estados est ON ie.estado_id = est.id
    WHERE est.esta_activo = FALSE
) AS tinactivos
    ON i.id = tinactivos.itse_id
ORDER BY i.numero_itse DESC
"""


def consultar_itse(filtros: dict) -> list[dict]:
    """
    Consulta registros ITSE aplicando filtros opcionales.

    Al menos uno de los filtros debe estar presente (validado en el serializer).

    Parámetros
    ----------
    filtros : dict
        Claves aceptadas (todas opcionales, pero al menos una requerida):

        titular_nombre             – str  búsqueda parcial en apellidos + nombres del titular
        numero_itse                – int  número de ITSE exacto
        anio_itse                  – int  año de la fecha de expedición del ITSE
        titular_numero_documento   – str  número de documento exacto del titular
        conductor_numero_documento – str  número de documento exacto del conductor

    Retorna
    -------
    list[dict]
        Una fila por ITSE.  Campos:
          numero_itse, numero_expediente,
          titular_nombre, titular_documentos,
          conductor_nombre, conductor_documentos,
          nombre_comercial, direccion, giros, esta_activo.
    """
    conditions: list[str] = []
    params: list = []

    titular_nombre = (filtros.get('titular_nombre') or '').strip()
    if titular_nombre:
        conditions.append(
            "TRIM("
            "    COALESCE(ttitular.apellido_paterno, '') || ' ' ||"
            "    COALESCE(ttitular.apellido_materno, '') || ' ' ||"
            "    COALESCE(ttitular.nombres, '')"
            ") ILIKE %s"
        )
        params.append('%' + titular_nombre.replace(' ', '%') + '%')

    numero_itse = filtros.get('numero_itse')
    if numero_itse is not None:
        conditions.append('i.numero_itse = %s')
        params.append(numero_itse)

    anio_itse = filtros.get('anio_itse')
    if anio_itse is not None:
        conditions.append('EXTRACT(YEAR FROM i.fecha_expedicion) = %s')
        params.append(anio_itse)

    titular_numero_documento = (filtros.get('titular_numero_documento') or '').strip()
    if titular_numero_documento:
        conditions.append('pd_titular.numero_documento = %s')
        params.append(titular_numero_documento)

    conductor_numero_documento = (filtros.get('conductor_numero_documento') or '').strip()
    if conductor_numero_documento:
        conditions.append('pd_conductor.numero_documento = %s')
        params.append(conductor_numero_documento)

    where = ('WHERE ' + ' AND '.join(conditions)) if conditions else ''

    sql = _SQL_CONSULTA_ITSE.format(where=where)

    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        columnas = [col.name for col in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
