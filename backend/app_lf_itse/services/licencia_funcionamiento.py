"""
Servicios de negocio para Licencias de Funcionamiento.

Centraliza la lógica del dominio separándola de la capa HTTP (views/serializers),
lo que facilita reutilización, pruebas unitarias y futuros cambios.
"""

import logging

from auditlog.context import set_actor
from django.core.files.storage import default_storage
from django.db import connection, transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ..models import (
    AutorizacionImprocedente,
    Expediente,
    LicenciaFuncionamiento,
    LicenciaFuncionamientoArchivo,
    LicenciaFuncionamientoEstado,
    LicenciaFuncionamientoGiro,
)

logger = logging.getLogger(__name__)


class LicenciaDuplicadaError(Exception):
    """Se lanza cuando ya existe una licencia con el mismo número."""


class ReciboPagoDuplicadoError(Exception):
    """Se lanza cuando el número de recibo ya está en otra licencia de funcionamiento."""


class LicenciaDenegadaError(Exception):
    """Se lanza cuando el expediente ya tiene una licencia de funcionamiento denegada."""


# ── Búsqueda de licencias de funcionamiento ────────────────────────────────────

# Consulta base: todos los campos de la licencia + datos del titular, conductor,
# expediente vinculado y estado de actividad calculado desde el historial de estados.
# El filtro WHERE se inyecta como string seguro; el valor viaja como parámetro.
#
# esta_activo: TRUE si la licencia NO tiene ningún estado inactivo registrado,
#              FALSE si tiene al menos un estado cuyo 'estados.esta_activo = FALSE'.
_SQL_BUSCAR_LF = """
SELECT
    lf.id,
    lf.uuid,
    lf.expediente_id,
    lf.tipo_licencia_id,
    lf.numero_licencia,
    lf.fecha_emision,
    lf.titular_id,
    lf.conductor_id,
    lf.licencia_principal_id,
    lf.nombre_comercial,
    lf.es_vigencia_indeterminada,
    lf.fecha_inicio_vigencia,
    lf.fecha_fin_vigencia,
    lf.nivel_riesgo_id,
    lf.actividad_id,
    lf.direccion,
    lf.hora_desde,
    lf.hora_hasta,
    lf.resolucion_numero,
    lf.zonificacion_id,
    lf.area,
    lf.numero_recibo_pago,
    lf.observaciones,
    lf.se_puede_publicar,
    lf.requiere_auth_sectorial,
    lf.fecha_notificacion,
    lf.usuario_id,
    lf.fecha_digitacion,
    e.numero_expediente,
    e.fecha_recepcion,
    TRIM(
        CONCAT(COALESCE(ttitular.apellido_paterno, ''), ' ',
        COALESCE(ttitular.apellido_materno, ''), ' ',
        COALESCE(ttitular.nombres, ''))
    ) AS titular_nombre,
    truc.numero_documento AS titular_ruc,
    TRIM(
        CONCAT(COALESCE(tconductor.apellido_paterno, ''), ' ',
        COALESCE(tconductor.apellido_materno, ''), ' ',
        COALESCE(tconductor.nombres, ''))
    ) AS conductor_nombre,
    CASE
        WHEN tlicencias_inactivas.licencia_funcionamiento_id IS NULL THEN TRUE
        ELSE FALSE
    END AS esta_activo,
    tl.nombre  AS tipo_licencia_nombre,
    z.nombre   AS zonificacion_nombre,
    nr.nombre  AS nivel_riesgo_nombre,
    a.nombre  AS actividad_nombre
FROM licencias_funcionamiento lf
LEFT JOIN tipos_licencia tl
    ON lf.tipo_licencia_id = tl.id
LEFT JOIN expedientes e
    ON lf.expediente_id = e.id
LEFT JOIN personas AS ttitular
    ON lf.titular_id = ttitular.id
LEFT JOIN personas AS tconductor
    ON lf.conductor_id = tconductor.id
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
    ON lf.titular_id = truc.persona_id
LEFT JOIN (
    SELECT DISTINCT lfe.licencia_funcionamiento_id
    FROM licencias_funcionamiento_estados lfe
    INNER JOIN estados est
        ON lfe.estado_id = est.id
    WHERE est.esta_activo = FALSE
) AS tlicencias_inactivas
    ON lf.id = tlicencias_inactivas.licencia_funcionamiento_id
LEFT JOIN zonificaciones z
    ON lf.zonificacion_id = z.id
LEFT JOIN niveles_riesgo nr
    ON lf.nivel_riesgo_id = nr.id
LEFT JOIN actividades a
    ON lf.actividad_id = a.id
{where}
ORDER BY lf.numero_licencia DESC
"""

# Mapa de filtros: nombre → (cláusula WHERE con %s, función de transformación del valor)
_FILTROS_BUSQUEDA: dict[str, tuple[str, callable]] = {
    'ID': (
        'WHERE lf.id = %s',
        int,
    ),
    'NUMERO': (
        'WHERE lf.numero_licencia = %s',
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
        'WHERE lf.nombre_comercial ILIKE %s',
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'FECHA_EMISION': (
        'WHERE lf.fecha_emision = %s',
        str,
    ),
    'NOMBRES_TITULAR': (
        "WHERE TRIM("
        "    CONCAT(COALESCE(ttitular.apellido_paterno, ''), ' ',"
        "    COALESCE(ttitular.apellido_materno, ''), ' ',"
        "    COALESCE(ttitular.nombres, ''))"
        ") ILIKE %s",
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'RUC_TITULAR': (
        'WHERE truc.numero_documento = %s',
        str,
    ),
    'NOMBRES_CONDUCTOR': (
        "WHERE TRIM("
        "    CONCAT(COALESCE(tconductor.apellido_paterno, ''), ' ',"
        "    COALESCE(tconductor.apellido_materno, ''), ' ',"
        "    COALESCE(tconductor.nombres, ''))"
        ") ILIKE %s",
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'DIRECCION': (
        'WHERE TRIM(lf.direccion) ILIKE %s',
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'RECIBO_PAGO': (
        'WHERE TRIM(lf.numero_recibo_pago) ILIKE %s',
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'RESOLUCION_NUMERO': (
        'WHERE TRIM(lf.resolucion_numero) ILIKE %s',
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
}


def buscar_licencias(filtro: str, valor: str) -> list[dict]:
    """
    Busca licencias de funcionamiento aplicando el filtro indicado sobre el valor recibido.

    Equivalente PostgreSQL del procedimiento dinámico SQL Server original.

    Parámetros
    ----------
    filtro : str
        Tipo de búsqueda.  Valores válidos:
          ─────────────────────────────────────────────────────────────────
          'ID'                → ID de la licencia (exacto)
          'NUMERO'            → Número de licencia (exacto)
          'EXPEDIENTE'        → Número de expediente (exacto)
          'NOMBRE_COMERCIAL'  → Nombre comercial (parcial, insensible a mayúsculas)
          'FECHA_EMISION'     → Fecha de emisión en formato 'YYYY-MM-DD' (exacto)
          'NOMBRES_TITULAR'   → Apellidos y nombres del titular (parcial)
          'RUC_TITULAR'       → RUC del titular (exacto)
          'NOMBRES_CONDUCTOR' → Apellidos y nombres del conductor (parcial)
          'DIRECCION'         → Dirección del establecimiento (parcial)
          'RECIBO_PAGO'       → Número de recibo de pago (parcial)
          'RESOLUCION_NUMERO' → Número de resolución (parcial)
          ─────────────────────────────────────────────────────────────────
    valor : str
        Valor a buscar según el filtro elegido.

    Retorna
    -------
    list[dict]
        Lista de licencias que coinciden con el filtro.  Cada diccionario
        incluye todos los campos de la licencia más:
          numero_expediente, fecha_recepcion,
          titular_nombre, titular_ruc, conductor_nombre, esta_activo.

    Lanza
    -----
    ValueError
        Si el filtro no es uno de los valores válidos.
    """
    filtro = filtro.upper().strip()
    if filtro not in _FILTROS_BUSQUEDA:
        raise ValueError(
            f"Filtro '{filtro}' no válido. "
            f"Opciones: {', '.join(_FILTROS_BUSQUEDA)}"
        )

    where_clause, transformar = _FILTROS_BUSQUEDA[filtro]
    valor_param = transformar(valor)

    sql = _SQL_BUSCAR_LF.format(where=where_clause)

    with connection.cursor() as cursor:
        cursor.execute(sql, [valor_param])
        columnas = [col[0] for col in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


# ── Estados de licencia de funcionamiento ──────────────────────────────────────

_SQL_LISTAR_ESTADOS_LF = """
SELECT
    lfe.id,
    lfe.licencia_funcionamiento_id,
    lfe.estado_id,
    lfe.fecha_estado,
    lfe.documento,
    lfe.observaciones,
    lfe.usuario_id,
    lfe.fecha_digitacion,
    est.nombre  AS estado_nombre,
    est.es_para_lf,
    est.es_para_itse,
    est.esta_activo
FROM licencias_funcionamiento_estados lfe
LEFT JOIN estados est
    ON lfe.estado_id = est.id
WHERE lfe.licencia_funcionamiento_id = %s
ORDER BY lfe.fecha_digitacion DESC
"""


def listar_estados_licencia(licencia_funcionamiento_id: int) -> list[dict]:
    """
    Lista el historial de estados de una licencia de funcionamiento.

    Parámetros
    ----------
    licencia_funcionamiento_id : int
        PK de la licencia de funcionamiento.

    Retorna
    -------
    list[dict]
        Lista de estados ordenados por fecha de digitación descendente.
        Cada elemento incluye: id, licencia_funcionamiento_id, estado_id,
        fecha_estado, documento, observaciones, usuario_id, fecha_digitacion,
        estado_nombre, es_para_lf, es_para_itse, esta_activo.
    """
    with connection.cursor() as cursor:
        cursor.execute(_SQL_LISTAR_ESTADOS_LF, [licencia_funcionamiento_id])
        columnas = [col[0] for col in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


# ── Creación de licencia de funcionamiento ─────────────────────────────────────

def _validar_licencia_no_denegada(expediente_id: int) -> None:
    """
    Verifica que el expediente no tenga una licencia de funcionamiento denegada
    en ``autorizaciones_improcedentes``.

    Lanza
    -----
    LicenciaDenegadaError
        Si el expediente ya fue declarado improcedente para LF.
    """
    if AutorizacionImprocedente.objects.filter(
        expediente_id=expediente_id,
        tipo_autorizacion='LF',
    ).exists():
        raise LicenciaDenegadaError(
            'La licencia de funcionamiento ha sido denegada para este expediente, '
            'por lo tanto no se puede emitir.'
        )


def _validar_numero_licencia_unico(numero: int) -> None:
    """
    Verifica que no exista ya una licencia con el mismo ``numero_licencia``.

    Lanza
    -----
    LicenciaDuplicadaError
        Si el número ya está registrado.
    """
    if LicenciaFuncionamiento.objects.filter(numero_licencia=numero).exists():
        raise LicenciaDuplicadaError(
            f'Ya existe una licencia de funcionamiento con el número {numero}.'
        )


def _validar_numero_licencia_unico_para_update(numero: int, licencia_id: int) -> None:
    """
    Igual que ``_validar_numero_licencia_unico`` pero excluye el registro
    que se está modificando (``licencia_id``).

    Lanza
    -----
    LicenciaDuplicadaError
        Si el número ya está registrado en otra licencia distinta.
    """
    if LicenciaFuncionamiento.objects.filter(
        numero_licencia=numero,
    ).exclude(pk=licencia_id).exists():
        raise LicenciaDuplicadaError(
            f'Ya existe una licencia de funcionamiento con el número {numero}.'
        )


def get_siguiente_numero_licencia(anio: int) -> int:  # noqa: ARG001
    """
    Retorna el siguiente número de licencia de funcionamiento disponible.

    Busca el mayor ``numero_licencia`` registrado en toda la tabla,
    sin importar el año, y devuelve ese valor + 1.
    Si no existe ninguna licencia registrada, retorna 1.

    Parámetros
    ----------
    anio : int
        Reservado para uso futuro (filtro por año de emisión).
        Actualmente no se aplica en la consulta.

    Retorna
    -------
    int
        Siguiente número de licencia disponible.
    """
    resultado = LicenciaFuncionamiento.objects.aggregate(
        maximo=Max('numero_licencia'),
    )

    maximo = resultado['maximo']
    return (maximo + 1) if maximo is not None else 1


def _validar_recibo_pago_unico(numero_recibo: str) -> None:
    """
    Verifica que el ``numero_recibo_pago`` no esté duplicado en
    ``licencias_funcionamiento``. El mismo valor puede usarse en ``itse``.

    Lanza
    -----
    ReciboPagoDuplicadoError
        Si el número de recibo ya existe en otra licencia.
    """
    if LicenciaFuncionamiento.objects.filter(numero_recibo_pago=numero_recibo).exists():
        raise ReciboPagoDuplicadoError(
            f'El número de recibo de pago "{numero_recibo}" ya se encuentra '
            'registrado en licencias de funcionamiento.'
        )


def _validar_recibo_pago_unico_para_update(numero_recibo: str, licencia_id: int) -> None:
    """
    Igual que ``_validar_recibo_pago_unico`` pero excluye el registro que se
    está modificando (``licencia_id``) al consultar ``licencias_funcionamiento``.

    Lanza
    -----
    ReciboPagoDuplicadoError
        Si el número de recibo ya existe en otra licencia.
    """
    if LicenciaFuncionamiento.objects.filter(
        numero_recibo_pago=numero_recibo,
    ).exclude(pk=licencia_id).exists():
        raise ReciboPagoDuplicadoError(
            f'El número de recibo de pago "{numero_recibo}" ya se encuentra '
            'registrado en licencias de funcionamiento.'
        )


def crear_licencia(data: dict, usuario) -> LicenciaFuncionamiento:
    """
    Crea y retorna una LicenciaFuncionamiento aplicando las reglas de negocio.

    Validaciones previas
    --------------------
    1. ``numero_licencia`` único en ``licencias_funcionamiento``.
    2. ``numero_recibo_pago`` único solo en ``licencias_funcionamiento`` (puede coincidir con ``itse``).
    3. Si ``es_vigencia_indeterminada`` es ``True``, las fechas de vigencia
       se fuerzan a ``None``.
    4. Si ``es_vigencia_indeterminada`` es ``False``, ambas fechas de vigencia
       deben estar presentes (validado previamente en el serializer).

    Parámetros
    ----------
    data : dict
        Datos validados por ``LicenciaFuncionamientoCreateSerializer``.
    usuario : AUTH_USER_MODEL instance
        Usuario autenticado obtenido del token JWT (request.user).

    Retorna
    -------
    LicenciaFuncionamiento
        Instancia recién creada con sus giros asociados.

    Lanza
    -----
    LicenciaDenegadaError
        Si el expediente tiene una autorización improcedente de tipo 'LF'.
    LicenciaDuplicadaError
        Si ``numero_licencia`` ya existe.
    ReciboPagoDuplicadoError
        Si ``numero_recibo_pago`` ya existe en otra licencia.
    """
    _validar_licencia_no_denegada(data['expediente_id'])

    # Si no se proporcionó número de licencia, el sistema lo determina
    numero_licencia = data.get('numero_licencia') or get_siguiente_numero_licencia(
        data['fecha_emision'].year,
    )

    _validar_numero_licencia_unico(numero_licencia)
    if data.get('numero_recibo_pago'):
        _validar_recibo_pago_unico(data['numero_recibo_pago'])

    # Si la vigencia es indeterminada, las fechas se anulan
    es_indeterminada = data['es_vigencia_indeterminada']
    fecha_inicio = None if es_indeterminada else data.get('fecha_inicio_vigencia')
    fecha_fin    = None if es_indeterminada else data.get('fecha_fin_vigencia')

    with set_actor(usuario), transaction.atomic():
        licencia = LicenciaFuncionamiento.objects.create(
            expediente_id         = data['expediente_id'],
            tipo_licencia_id      = data['tipo_licencia_id'],
            numero_licencia       = numero_licencia,
            fecha_emision         = data['fecha_emision'],
            titular_id            = data['titular_id'],
            conductor_id          = data['conductor_id'],
            licencia_principal_id = data.get('licencia_principal_id'),
            nombre_comercial      = data['nombre_comercial'],
            es_vigencia_indeterminada = es_indeterminada,
            fecha_inicio_vigencia = fecha_inicio,
            fecha_fin_vigencia    = fecha_fin,
            nivel_riesgo_id       = data['nivel_riesgo_id'],
            actividad_id          = data['actividad_id'],
            direccion             = data['direccion'],
            hora_desde            = data['hora_desde'],
            hora_hasta            = data['hora_hasta'],
            resolucion_numero     = data['resolucion_numero'],
            zonificacion_id       = data['zonificacion_id'],
            area                  = data['area'],
            numero_recibo_pago    = data['numero_recibo_pago'],
            observaciones             = data.get('observaciones'),
            se_puede_publicar         = data.get('se_puede_publicar', False),
            requiere_auth_sectorial   = data.get('requiere_auth_sectorial', False),
            usuario                   = usuario,
            fecha_digitacion      = timezone.now(),
        )

        giros = [
            LicenciaFuncionamientoGiro(
                licencia_funcionamiento=licencia,
                giro_id=item['giro_id'],
                usuario=usuario,
                fecha_digitacion=timezone.now(),
            )
            for item in data.get('giros', [])
        ]
        if giros:
            LicenciaFuncionamientoGiro.objects.bulk_create(giros)

    return licencia


# ── Modificación de licencia de funcionamiento ─────────────────────────────────

def modificar_licencia(licencia_id: int, data: dict, usuario=None) -> LicenciaFuncionamiento:
    """
    Actualiza y retorna una LicenciaFuncionamiento existente.

    Validaciones previas
    --------------------
    1. La licencia debe existir; si no, lanza ``LicenciaFuncionamiento.DoesNotExist``.
    2. El expediente no debe tener una autorización improcedente de tipo 'LF'.
    3. ``numero_licencia`` único (excluyendo el registro actual).
    4. ``numero_recibo_pago`` único en ``licencias_funcionamiento`` (excluyendo
       el registro actual); puede coincidir con un recibo en ``itse``.
    5. Si ``es_vigencia_indeterminada`` es ``True``, las fechas de vigencia se
       fuerzan a ``None``.
    6. Si ``es_vigencia_indeterminada`` es ``False``, ambas fechas deben estar
       presentes (validado previamente en el serializer).

    Los giros se reemplazan completamente: se eliminan los existentes y se
    insertan los nuevos en una sola transacción atómica.

    Parámetros
    ----------
    licencia_id : int
        PK de la licencia a modificar.
    data : dict
        Datos validados por ``LicenciaFuncionamientoUpdateSerializer``.

    Retorna
    -------
    LicenciaFuncionamiento
        Instancia actualizada.

    Lanza
    -----
    LicenciaFuncionamiento.DoesNotExist
        Si no existe una licencia con ``licencia_id``.
    LicenciaDenegadaError
        Si el expediente tiene una autorización improcedente de tipo 'LF'.
    LicenciaDuplicadaError
        Si ``numero_licencia`` ya existe en otra licencia.
    ReciboPagoDuplicadoError
        Si ``numero_recibo_pago`` ya existe en otra licencia.
    """
    licencia = LicenciaFuncionamiento.objects.get(pk=licencia_id)

    _validar_licencia_no_denegada(data['expediente_id'])
    _validar_numero_licencia_unico_para_update(data['numero_licencia'], licencia_id)
    if data.get('numero_recibo_pago'):
        _validar_recibo_pago_unico_para_update(data['numero_recibo_pago'], licencia_id)

    es_indeterminada = data['es_vigencia_indeterminada']
    fecha_inicio = None if es_indeterminada else data.get('fecha_inicio_vigencia')
    fecha_fin    = None if es_indeterminada else data.get('fecha_fin_vigencia')

    with set_actor(usuario), transaction.atomic():
        licencia.expediente_id          = data['expediente_id']
        licencia.tipo_licencia_id       = data['tipo_licencia_id']
        licencia.numero_licencia        = data['numero_licencia']
        licencia.fecha_emision          = data['fecha_emision']
        licencia.titular_id             = data['titular_id']
        licencia.conductor_id           = data['conductor_id']
        licencia.licencia_principal_id  = data.get('licencia_principal_id')
        licencia.nombre_comercial       = data['nombre_comercial']
        licencia.es_vigencia_indeterminada = es_indeterminada
        licencia.fecha_inicio_vigencia  = fecha_inicio
        licencia.fecha_fin_vigencia     = fecha_fin
        licencia.nivel_riesgo_id        = data['nivel_riesgo_id']
        licencia.actividad_id           = data['actividad_id']
        licencia.direccion              = data['direccion']
        licencia.hora_desde             = data['hora_desde']
        licencia.hora_hasta             = data['hora_hasta']
        licencia.resolucion_numero      = data['resolucion_numero']
        licencia.zonificacion_id        = data['zonificacion_id']
        licencia.area                   = data['area']
        licencia.numero_recibo_pago     = data['numero_recibo_pago']
        licencia.observaciones            = data.get('observaciones')
        licencia.se_puede_publicar        = data.get('se_puede_publicar', False)
        licencia.requiere_auth_sectorial  = data.get('requiere_auth_sectorial', False)
        licencia.save()

        # Reemplaza completamente los giros asociados
        LicenciaFuncionamientoGiro.objects.filter(
            licencia_funcionamiento=licencia,
        ).delete()

        nuevos_giros = [
            LicenciaFuncionamientoGiro(
                licencia_funcionamiento=licencia,
                giro_id=item['giro_id'],
                usuario=licencia.usuario,
                fecha_digitacion=timezone.now(),
            )
            for item in data.get('giros', [])
        ]
        if nuevos_giros:
            LicenciaFuncionamientoGiro.objects.bulk_create(nuevos_giros)

    return licencia


# ── Verificación de expediente para emisión de licencia ────────────────────────

def verificar_numero_expediente_para_licencia(numero_expediente: int, anio: int) -> dict:
    """
    Verifica si un expediente (identificado por número y año de recepción)
    puede tener una licencia de funcionamiento emitida.

    Comprobaciones (en orden):
    1. Si no existe ningún expediente con el ``numero_expediente`` y el ``anio``
       indicados, no se puede emitir.
    2. Si el expediente tiene una autorización improcedente de tipo 'LF',
       la licencia fue denegada y no se puede emitir.
    3. Si el expediente ya tiene una licencia de funcionamiento emitida,
       tampoco se puede emitir una nueva.
    4. En caso contrario, se puede emitir.

    Parámetros
    ----------
    numero_expediente : int
        Número correlativo del expediente.
    anio : int
        Año de recepción del expediente (se extrae de ``fecha_recepcion``).

    Retorna
    -------
    dict con las claves:
        se_puede_emitir_licencia : bool
        expediente_id            : int | None  — ID del expediente (si existe)
        mensaje                  : str
    """
    expediente = Expediente.objects.filter(
        numero_expediente=numero_expediente,
        fecha_recepcion__year=anio,
    ).first()

    if not expediente:
        return {
            'se_puede_emitir_licencia': False,
            'expediente_id': None,
            'mensaje': 'El expediente no existe, primero debe ingresarlo.',
        }

    if AutorizacionImprocedente.objects.filter(
        expediente_id=expediente.id,
        tipo_autorizacion='LF',
    ).exists():
        return {
            'se_puede_emitir_licencia': False,
            'expediente_id': expediente.id,
            'mensaje': 'El expediente registra licencia denegada.',
        }

    licencia = LicenciaFuncionamiento.objects.filter(
        expediente_id=expediente.id,
    ).first()

    if licencia:
        return {
            'se_puede_emitir_licencia': False,
            'expediente_id': expediente.id,
            'mensaje': f'El expediente ya registra la licencia número {licencia.numero_licencia}.',
        }

    return {
        'se_puede_emitir_licencia': True,
        'expediente_id': expediente.id,
        'mensaje': '',
    }


# ── Registro de notificación de entrega ────────────────────────────────────────

class NotificacionFechaInvalidaError(Exception):
    """Se lanza cuando la fecha de notificación es anterior a la fecha de emisión."""


class EstadoInactivacionDuplicadoError(Exception):
    """Ya existe un registro con el mismo par licencia + estado."""


def registrar_notificacion(licencia_id: int, fecha_notificacion, usuario=None) -> LicenciaFuncionamiento:
    """
    Registra la fecha de notificación de entrega en una licencia de funcionamiento.

    Validaciones
    ------------
    1. La licencia debe existir; si no, lanza ``LicenciaFuncionamiento.DoesNotExist``.
    2. ``fecha_notificacion`` debe ser mayor o igual a ``fecha_emision``; de lo
       contrario lanza ``NotificacionFechaInvalidaError``.

    Parámetros
    ----------
    licencia_id : int
        PK de la licencia a actualizar.
    fecha_notificacion : date
        Fecha en que se entregó la notificación.

    Retorna
    -------
    LicenciaFuncionamiento
        Instancia actualizada con ``fecha_notificacion`` guardada.
    """
    licencia = LicenciaFuncionamiento.objects.get(pk=licencia_id)

    fecha_notificacion_date = (
        fecha_notificacion.date()
        if hasattr(fecha_notificacion, 'date')
        else fecha_notificacion
    )
    if fecha_notificacion_date < licencia.fecha_emision:
        raise NotificacionFechaInvalidaError(
            'La fecha de notificación no puede ser anterior a la fecha de emisión '
            f'({licencia.fecha_emision}).'
        )

    with set_actor(usuario):
        licencia.fecha_notificacion = fecha_notificacion
        licencia.save(update_fields=['fecha_notificacion'])
    return licencia


# ── Eliminación de licencia de funcionamiento ─────────────────────────────────


class LicenciaTieneDependientesError(Exception):
    """Se lanza cuando la licencia tiene licencias dependientes que impiden su eliminación."""


def eliminar_licencia(pk: int, usuario=None) -> None:
    """
    Elimina una licencia de funcionamiento y todos sus registros dependientes.

    Validaciones previas
    --------------------
    - Si la licencia tiene licencias dependientes (``licencia_principal_id`` apuntando
      a ella), lanza ``LicenciaTieneDependientesError``.

    Eliminación dentro de transacción
    ----------------------------------
    1. Recopila las rutas de los archivos digitales antes de tocar la BD.
    2. Elimina la licencia dentro de ``transaction.atomic()``.
       Django en cascada elimina:
         - ``licencias_funcionamiento_estados``  (on_delete=CASCADE)
         - ``licencias_funcionamiento_giros``    (on_delete=CASCADE)
         - ``licencias_funcionamiento_archivos`` (on_delete=CASCADE)
    3. Tras confirmar la transacción, elimina los archivos físicos del disco.
       Si algún borrado físico falla se registra un warning; la integridad de
       la BD ya está garantizada en ese punto.

    Parámetros
    ----------
    pk : int
        PK de la licencia de funcionamiento a eliminar.

    Lanza
    -----
    Http404
        Si la licencia no existe.
    LicenciaTieneDependientesError
        Si la licencia tiene licencias dependientes asociadas.
    """
    licencia = get_object_or_404(LicenciaFuncionamiento, pk=pk)

    if licencia.licencias_dependientes.exists():
        raise LicenciaTieneDependientesError(
            'No se puede eliminar la licencia: tiene licencias dependientes asociadas. '
            'Primero debe eliminar las licencias dependientes.'
        )

    rutas_archivos = list(
        LicenciaFuncionamientoArchivo.objects.filter(licencia_funcionamiento_id=pk)
        .values_list('ruta_archivo', flat=True)
    )

    with set_actor(usuario), transaction.atomic():
        licencia.delete()

    for ruta in rutas_archivos:
        if default_storage.exists(ruta):
            try:
                default_storage.delete(ruta)
            except Exception:
                logger.warning(
                    'No se pudo eliminar el archivo físico "%s" de la licencia pk=%s.',
                    ruta, pk,
                )


# ── Consulta pública de licencias de funcionamiento ───────────────────────────
#
# Endpoint orientado a búsqueda rápida por cuatro filtros:
#   1. Nombre o razón social del titular   (parcial, insensible a mayúsculas)
#   2. Número de licencia                  (exacto)
#   3. Año de emisión de la licencia       (exacto, basado en fecha_emision)
#   4. Número de documento del titular     (exacto)
#   5. Número de documento del conductor   (exacto)
#
# El campo esta_activo es TRUE cuando la licencia NO tiene ningún registro en
# licencias_funcionamiento_estados cuyo estado relacionado tenga esta_activo = FALSE.
#
# Se usa CTE para evitar el producto cartesiano que surgiría de unir
# personas_documentos (varios por persona) y licencias_funcionamiento_giros
# (varios por licencia) en el mismo SELECT principal.

_SQL_CONSULTA_LF = """
SELECT
    lf.id,
    lf.uuid,
    lf.expediente_id,
    lf.tipo_licencia_id,
    lf.numero_licencia,
    lf.fecha_emision,
    lf.titular_id,
    lf.conductor_id,
    lf.licencia_principal_id,
    lf.nombre_comercial,
    lf.es_vigencia_indeterminada,
    lf.fecha_inicio_vigencia,
    lf.fecha_fin_vigencia,
    lf.nivel_riesgo_id,
    lf.actividad_id,
    lf.direccion,
    lf.hora_desde,
    lf.hora_hasta,
    lf.resolucion_numero,
    lf.zonificacion_id,
    lf.area,
    lf.numero_recibo_pago,
    lf.observaciones,
    lf.se_puede_publicar,
    lf.requiere_auth_sectorial,
    lf.fecha_notificacion,
    lf.usuario_id,
    lf.fecha_digitacion,

    td.titular_documentos_concatenados,
    cd.conductor_documentos_concatenados,
    gc.giro_concatenado,

    e.numero_expediente,
    e.fecha_recepcion,

    tpt.nombre AS tipos_procedimiento_tupa_nombre,

    TRIM(CONCAT(
        COALESCE(tt.apellido_paterno, ''), ' ',
        COALESCE(tt.apellido_materno, ''), ' ',
        COALESCE(tt.nombres, '')
    )) AS titular_nombre,

    tt.direccion AS titular_direccion,
    tt.distrito  AS titular_distrito,
    tt.provincia AS titular_provincia,
    tt.departamento AS titular_departamento,
    tt.telefono AS titular_telefono,
    tt.correo_electronico AS titular_correo_electronico,

    TRIM(CONCAT(
        COALESCE(tc.apellido_paterno, ''), ' ',
        COALESCE(tc.apellido_materno, ''), ' ',
        COALESCE(tc.nombres, '')
    )) AS conductor_nombre,

    tc.direccion AS conductor_direccion,
    tc.distrito  AS conductor_distrito,
    tc.provincia AS conductor_provincia,
    tc.departamento AS conductor_departamento,
    tc.telefono AS conductor_telefono,
    tc.correo_electronico AS conductor_correo_electronico,

    z.nombre AS zonificacion_nombre,
    z.codigo AS zonificacion_codigo,

    nr.nombre AS nivel_riesgo_nombre,

    CASE
        WHEN li.licencia_funcionamiento_id IS NULL THEN TRUE
        ELSE FALSE
    END AS esta_activo,

    a.nombre AS actividad_nombre

FROM licencias_funcionamiento lf

LEFT JOIN expedientes e
    ON lf.expediente_id = e.id

LEFT JOIN tipos_procedimiento_tupa tpt
    ON e.tipo_procedimiento_tupa_id = tpt.id

LEFT JOIN personas tt
    ON lf.titular_id = tt.id

LEFT JOIN personas tc
    ON lf.conductor_id = tc.id

LEFT JOIN zonificaciones z
    ON lf.zonificacion_id = z.id

LEFT JOIN niveles_riesgo nr
    ON lf.nivel_riesgo_id = nr.id

LEFT JOIN actividades a
    ON lf.actividad_id = a.id

LEFT JOIN (
    SELECT DISTINCT
        lfe.licencia_funcionamiento_id
    FROM licencias_funcionamiento_estados lfe
    INNER JOIN estados es
        ON lfe.estado_id = es.id
    WHERE es.esta_activo = FALSE
) li
    ON lf.id = li.licencia_funcionamiento_id

LEFT JOIN (
    SELECT
        lf2.id AS licencia_id,
        STRING_AGG(
            tdi.nombre || ' ' || pd.numero_documento,
            ', '
            ORDER BY tdi.nombre, pd.numero_documento
        ) AS titular_documentos_concatenados
    FROM licencias_funcionamiento lf2
    LEFT JOIN personas_documentos pd
        ON lf2.titular_id = pd.persona_id
    LEFT JOIN tipos_documento_identidad tdi
        ON pd.tipo_documento_identidad_id = tdi.id
    GROUP BY lf2.id
) td
    ON lf.id = td.licencia_id

LEFT JOIN (
    SELECT
        lf3.id AS licencia_id,
        STRING_AGG(
            tdi.nombre || ' ' || pd.numero_documento,
            ', '
            ORDER BY tdi.nombre, pd.numero_documento
        ) AS conductor_documentos_concatenados
    FROM licencias_funcionamiento lf3
    LEFT JOIN personas_documentos pd
        ON lf3.conductor_id = pd.persona_id
    LEFT JOIN tipos_documento_identidad tdi
        ON pd.tipo_documento_identidad_id = tdi.id
    GROUP BY lf3.id
) cd
    ON lf.id = cd.licencia_id

LEFT JOIN (
    SELECT
        lfg.licencia_funcionamiento_id AS licencia_id,
        STRING_AGG(
            CASE
                WHEN g.id IS NULL THEN NULL
                WHEN g.ciiu_id IS NULL THEN TRIM(g.nombre)
                ELSE LPAD(CAST(g.ciiu_id AS TEXT), 4, '0') || ' ' || TRIM(g.nombre)
            END,
            ', '
            ORDER BY g.nombre
        ) AS giro_concatenado
    FROM licencias_funcionamiento_giros lfg
    LEFT JOIN giros g
        ON lfg.giro_id = g.id
    GROUP BY lfg.licencia_funcionamiento_id
) gc
    ON lf.id = gc.licencia_id

{where}

ORDER BY lf.fecha_emision
"""


def consultar_licencias(filtros: dict) -> list[dict]:
    """
    Consulta licencias de funcionamiento aplicando filtros opcionales.

    Todos los filtros son opcionales. Si no se pasa ninguno, retorna todos los registros.

    Parámetros
    ----------
    filtros : dict
        Claves aceptadas (todas opcionales, pero al menos una requerida):

        numero_licencia              – int   número de licencia exacto
        numero_expediente            – int   número de expediente exacto
        anio_expediente              – int   año de recepción del expediente

        emision_desde                – date  inicio del rango de fecha de emisión
        emision_hasta                – date  fin del rango de fecha de emisión

        titular_nombre               – str   búsqueda parcial en apellidos + nombres del titular
        titular_numero_documento     – str   número de documento exacto del titular

        conductor_nombre             – str   búsqueda parcial en apellidos + nombres del conductor
        conductor_numero_documento   – str   número de documento exacto del conductor

        nombre_comercial             – str   búsqueda parcial en nombre comercial

        nivel_riesgo_id              – int   ID del nivel de riesgo
        direccion                    – str   búsqueda parcial en dirección
        zonificacion_id              – int   ID de la zonificación
        numero_recibo_pago           – str   número de recibo de pago exacto

        fecha_notificacion_desde     – date  inicio del rango de fecha de notificación
        fecha_notificacion_hasta     – date  fin del rango de fecha de notificación

        esta_activo                  – bool  True = activas, False = inactivas
        giro_nombre                  – str   búsqueda parcial en nombre de giro

    Retorna
    -------
    list[dict]
        Una fila por licencia con todos los campos del SELECT.
    """
    conditions: list[str] = []
    params: list = []

    numero_licencia = filtros.get('numero_licencia')
    if numero_licencia is not None:
        conditions.append('lf.numero_licencia = %s')
        params.append(int(numero_licencia))

    numero_expediente = filtros.get('numero_expediente')
    if numero_expediente is not None:
        conditions.append('e.numero_expediente = %s')
        params.append(int(numero_expediente))

    anio_expediente = filtros.get('anio_expediente')
    if anio_expediente is not None:
        conditions.append('EXTRACT(YEAR FROM e.fecha_recepcion) = %s')
        params.append(int(anio_expediente))

    emision_desde = filtros.get('emision_desde')
    emision_hasta = filtros.get('emision_hasta')
    if emision_desde and emision_hasta:
        conditions.append('lf.fecha_emision BETWEEN %s AND %s')
        params.extend([str(emision_desde), str(emision_hasta)])

    titular_nombre = (filtros.get('titular_nombre') or '').strip()
    if titular_nombre:
        conditions.append(
            "TRIM(CONCAT("
            "    COALESCE(tt.apellido_paterno, ''), ' ',"
            "    COALESCE(tt.apellido_materno, ''), ' ',"
            "    COALESCE(tt.nombres, '')"
            ")) ILIKE %s"
        )
        params.append('%' + titular_nombre.replace(' ', '%') + '%')

    titular_numero_documento = (filtros.get('titular_numero_documento') or '').strip()
    if titular_numero_documento:
        conditions.append(
            "EXISTS ("
            "    SELECT 1 FROM personas_documentos pd_titular"
            "    WHERE pd_titular.persona_id = lf.titular_id"
            "      AND pd_titular.numero_documento = %s"
            ")"
        )
        params.append(titular_numero_documento)

    conductor_nombre = (filtros.get('conductor_nombre') or '').strip()
    if conductor_nombre:
        conditions.append(
            "TRIM(CONCAT("
            "    COALESCE(tc.apellido_paterno, ''), ' ',"
            "    COALESCE(tc.apellido_materno, ''), ' ',"
            "    COALESCE(tc.nombres, '')"
            ")) ILIKE %s"
        )
        params.append('%' + conductor_nombre.replace(' ', '%') + '%')

    conductor_numero_documento = (filtros.get('conductor_numero_documento') or '').strip()
    if conductor_numero_documento:
        conditions.append(
            "EXISTS ("
            "    SELECT 1 FROM personas_documentos pd_conductor"
            "    WHERE pd_conductor.persona_id = lf.conductor_id"
            "      AND pd_conductor.numero_documento = %s"
            ")"
        )
        params.append(conductor_numero_documento)

    nombre_comercial = (filtros.get('nombre_comercial') or '').strip()
    if nombre_comercial:
        conditions.append("TRIM(lf.nombre_comercial) ILIKE %s")
        params.append('%' + nombre_comercial.replace(' ', '%') + '%')

    nivel_riesgo_id = filtros.get('nivel_riesgo_id')
    if nivel_riesgo_id is not None:
        conditions.append('lf.nivel_riesgo_id = %s')
        params.append(int(nivel_riesgo_id))

    direccion = (filtros.get('direccion') or '').strip()
    if direccion:
        conditions.append("TRIM(lf.direccion) ILIKE %s")
        params.append('%' + direccion.replace(' ', '%') + '%')

    zonificacion_id = filtros.get('zonificacion_id')
    if zonificacion_id is not None:
        conditions.append('lf.zonificacion_id = %s')
        params.append(int(zonificacion_id))

    numero_recibo_pago = (filtros.get('numero_recibo_pago') or '').strip()
    if numero_recibo_pago:
        conditions.append('lf.numero_recibo_pago = %s')
        params.append(numero_recibo_pago)

    fecha_notificacion_desde = filtros.get('fecha_notificacion_desde')
    fecha_notificacion_hasta = filtros.get('fecha_notificacion_hasta')
    if fecha_notificacion_desde and fecha_notificacion_hasta:
        conditions.append('lf.fecha_notificacion BETWEEN %s AND %s')
        params.extend([str(fecha_notificacion_desde), str(fecha_notificacion_hasta)])

    esta_activo = filtros.get('esta_activo')
    if esta_activo is True:
        conditions.append('li.licencia_funcionamiento_id IS NULL')
    elif esta_activo is False:
        conditions.append('li.licencia_funcionamiento_id IS NOT NULL')

    giro_nombre = (filtros.get('giro_nombre') or '').strip()
    if giro_nombre:
        conditions.append(
            "EXISTS ("
            "    SELECT 1"
            "    FROM licencias_funcionamiento_giros lfg_filtro"
            "    INNER JOIN giros g_filtro ON lfg_filtro.giro_id = g_filtro.id"
            "    WHERE lfg_filtro.licencia_funcionamiento_id = lf.id"
            "      AND TRIM(g_filtro.nombre) ILIKE %s"
            ")"
        )
        params.append('%' + giro_nombre.replace(' ', '%') + '%')

    where = ('WHERE ' + ' AND '.join(conditions)) if conditions else ''
    sql = _SQL_CONSULTA_LF.format(where=where)

    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        columnas = [col[0] for col in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


# ── Registro de inactivación (historial en licencias_funcionamiento_estados) ────


def registrar_inactivacion_licencia(
    licencia_funcionamiento_id: int,
    estado_id: int,
    fecha_estado,
    documento: str,
    observaciones: str,
    usuario,
) -> LicenciaFuncionamientoEstado:
    """
    Inserta un registro en ``licencias_funcionamiento_estados``.

    Validaciones
    ------------
    1. La licencia debe existir; si no, lanza ``LicenciaFuncionamiento.DoesNotExist``.
    2. No puede existir ya un registro con el mismo ``licencia_funcionamiento_id``
       y ``estado_id``; de lo contrario lanza ``EstadoInactivacionDuplicadoError``.

    Parámetros
    ----------
    licencia_funcionamiento_id, estado_id, fecha_estado, documento, observaciones
        Datos del historial de estado.
    usuario
        Usuario autenticado (``request.user``); se guarda en ``usuario_id``.
    """
    LicenciaFuncionamiento.objects.get(pk=licencia_funcionamiento_id)

    if LicenciaFuncionamientoEstado.objects.filter(
        licencia_funcionamiento_id=licencia_funcionamiento_id,
        estado_id=estado_id,
    ).exists():
        raise EstadoInactivacionDuplicadoError(
            'Ya existe un registro para esta licencia con el mismo estado.'
        )

    with set_actor(usuario):
        return LicenciaFuncionamientoEstado.objects.create(
            licencia_funcionamiento_id=licencia_funcionamiento_id,
            estado_id=estado_id,
            fecha_estado=fecha_estado,
            documento=documento,
            observaciones=observaciones,
            usuario=usuario,
            fecha_digitacion=timezone.now(),
        )


# ── Reporte de licencias de funcionamiento ─────────────────────────────────────
#
# Conversión fiel del procedimiento SQL Server al equivalente PostgreSQL.
# Se siguen los mismos pasos del original:
#
#   Paso 1 – Consulta dinámica de filtros → obtiene los IDs de las licencias
#            que coinciden (equivale al sp_executesql + #licencias_filtradas).
#   Paso 2 – Documentos del titular concatenados por licencia
#            (equivale a #TitularDocumentosFilas + CTE_Titular_Documentos +
#             #TitularDocumentosConcatenados).
#   Paso 3 – Documentos del conductor concatenados por licencia
#            (equivale a #ConductorDocumentosFilas + CTE_Conductor_Documentos +
#             #ConductorDocumentosConcatenados).
#   Paso 4 – Giros concatenados por licencia
#            (equivale a #GiroFilas + CTE_Giros + #GiroConcatenados).
#   Paso 5 – SELECT final que une todo.
#   Paso 6 – En Python se agregan las columnas concatenadas a cada fila,
#            simulando los LEFT JOINs sobre las tablas temporales del original.
#
# STRING_AGG reemplaza los CTE recursivos de SQL Server para concatenar filas.

# ── Paso 1: consulta dinámica de filtros ──────────────────────────────────────
# El marcador {where} se reemplaza en Python con la cláusula WHERE generada.
_SQL_REPORTE_LF_FILTRADAS = """
SELECT DISTINCT licencias_funcionamiento.id
FROM licencias_funcionamiento
LEFT JOIN personas AS TTitular
    ON licencias_funcionamiento.titular_id = TTitular.id
LEFT JOIN expedientes
    ON licencias_funcionamiento.expediente_id = expedientes.id
LEFT JOIN personas_documentos AS titular_documentos
    ON licencias_funcionamiento.titular_id = titular_documentos.persona_id
LEFT JOIN personas AS TConductor
    ON licencias_funcionamiento.conductor_id = TConductor.id
LEFT JOIN personas_documentos AS conductor_documentos
    ON licencias_funcionamiento.conductor_id = conductor_documentos.persona_id
LEFT JOIN (
    SELECT DISTINCT licencias_funcionamiento_estados.licencia_funcionamiento_id
    FROM licencias_funcionamiento_estados
    INNER JOIN estados
        ON licencias_funcionamiento_estados.estado_id = estados.id
    WHERE estados.esta_activo = FALSE
) AS TLicenciasInactivas
    ON licencias_funcionamiento.id = TLicenciasInactivas.licencia_funcionamiento_id
LEFT JOIN licencias_funcionamiento_giros
    ON licencias_funcionamiento.id = licencias_funcionamiento_giros.licencia_funcionamiento_id
LEFT JOIN giros
    ON licencias_funcionamiento_giros.giro_id = giros.id
{where}
"""

# ── Paso 2: documentos del titular concatenados ───────────────────────────────
# Equivalente a #TitularDocumentosFilas + CTE_Titular_Documentos + RANK=1.
# STRING_AGG reemplaza el CTE recursivo del SQL Server.
# El JOIN sigue el original: titular_id = personas_documentos.persona_id
_SQL_REPORTE_LF_TITULAR_DOCS = """
SELECT
    licencias_funcionamiento.id AS licencia_id,
    STRING_AGG(
        tipos_documento_identidad.nombre || ' ' || personas_documentos.numero_documento,
        ', '
        ORDER BY tipos_documento_identidad.nombre || ' ' || personas_documentos.numero_documento
    ) AS titular_documentos_concatenados
FROM licencias_funcionamiento
LEFT JOIN personas_documentos
    ON licencias_funcionamiento.titular_id = personas_documentos.persona_id
LEFT JOIN tipos_documento_identidad
    ON personas_documentos.tipo_documento_identidad_id = tipos_documento_identidad.id
WHERE licencias_funcionamiento.id = ANY(%s)
GROUP BY licencias_funcionamiento.id
"""

# ── Paso 3: documentos del conductor concatenados ─────────────────────────────
# Equivalente a #ConductorDocumentosFilas + CTE_Conductor_Documentos + RANK=1.
# La condición de JOIN sigue el original:
#   licencias_funcionamiento.conductor_id = personas_documentos.id
_SQL_REPORTE_LF_CONDUCTOR_DOCS = """
SELECT
    licencias_funcionamiento.id AS licencia_id,
    STRING_AGG(
        tipos_documento_identidad.nombre || ' ' || personas_documentos.numero_documento,
        ', '
        ORDER BY tipos_documento_identidad.nombre || ' ' || personas_documentos.numero_documento
    ) AS conductor_documentos_concatenados
FROM licencias_funcionamiento
LEFT JOIN personas_documentos
    ON licencias_funcionamiento.conductor_id = personas_documentos.persona_id
LEFT JOIN tipos_documento_identidad
    ON personas_documentos.tipo_documento_identidad_id = tipos_documento_identidad.id
WHERE licencias_funcionamiento.id = ANY(%s)
GROUP BY licencias_funcionamiento.id
"""

# ── Paso 4: giros concatenados ────────────────────────────────────────────────
# Equivalente a #GiroFilas + CTE_Giros + RANK=1.
# RIGHT('0000' + CAST(ciiu_id AS VARCHAR(4)), 4) → LPAD(CAST(ciiu_id AS VARCHAR), 4, '0')
# RTRIM → TRIM
_SQL_REPORTE_LF_GIROS = """
SELECT
    licencias_funcionamiento.id AS licencia_id,
    COALESCE(STRING_AGG(
        LPAD(COALESCE(CAST(giros.ciiu_id AS TEXT), ''), 4, '0') || ' ' || TRIM(giros.nombre),
        ', '
        ORDER BY LPAD(COALESCE(CAST(giros.ciiu_id AS TEXT), ''), 4, '0') || ' ' || TRIM(giros.nombre)
    ), '') AS giro_concatenado
FROM licencias_funcionamiento
LEFT JOIN licencias_funcionamiento_giros
    ON licencias_funcionamiento.id = licencias_funcionamiento_giros.licencia_funcionamiento_id
LEFT JOIN giros
    ON licencias_funcionamiento_giros.giro_id = giros.id
WHERE licencias_funcionamiento.id = ANY(%s)
GROUP BY licencias_funcionamiento.id
"""

# ── Paso 5: SELECT final ──────────────────────────────────────────────────────
# Equivalente al SELECT final del SQL Server que une #licencias_filtradas con
# licencias_funcionamiento y las tablas temporales de concatenados.
# Las columnas concatenadas se agregan en Python (paso 6).
# Incluye el campo esta_activo calculado desde TLicenciasInactivas, igual que
# el CASE del SELECT final del procedimiento original.
_SQL_REPORTE_LF_FINAL = """
SELECT
    licencias_funcionamiento.id,
    licencias_funcionamiento.expediente_id,
    licencias_funcionamiento.tipo_licencia_id,
    licencias_funcionamiento.numero_licencia,
    licencias_funcionamiento.fecha_emision,
    licencias_funcionamiento.titular_id,
    licencias_funcionamiento.conductor_id,
    licencias_funcionamiento.licencia_principal_id,
    licencias_funcionamiento.nombre_comercial,
    licencias_funcionamiento.es_vigencia_indeterminada,
    licencias_funcionamiento.fecha_inicio_vigencia,
    licencias_funcionamiento.fecha_fin_vigencia,
    licencias_funcionamiento.nivel_riesgo_id,
    licencias_funcionamiento.actividad_id,
    licencias_funcionamiento.direccion,
    licencias_funcionamiento.hora_desde,
    licencias_funcionamiento.hora_hasta,
    licencias_funcionamiento.resolucion_numero,
    licencias_funcionamiento.zonificacion_id,
    licencias_funcionamiento.area,
    licencias_funcionamiento.numero_recibo_pago,
    licencias_funcionamiento.observaciones,
    licencias_funcionamiento.se_puede_publicar,
    licencias_funcionamiento.requiere_auth_sectorial,
    licencias_funcionamiento.fecha_notificacion,
    licencias_funcionamiento.usuario_id,
    licencias_funcionamiento.fecha_digitacion,
    expedientes.numero_expediente,
    expedientes.fecha_recepcion,
    tipos_procedimiento_tupa.nombre AS tipos_procedimiento_tupa_nombre,
    TRIM(
        CONCAT(COALESCE(TTitular.apellido_paterno, ''), ' ',
        COALESCE(TTitular.apellido_materno, ''), ' ',
        COALESCE(TTitular.nombres, ''))
    ) AS titular_nombre,
    TTitular.direccion          AS titular_direccion,
    TTitular.distrito           AS titular_distrito,
    TTitular.provincia          AS titular_provincia,
    TTitular.departamento       AS titular_departamento,
    TTitular.telefono           AS titular_telefono,
    TTitular.correo_electronico AS titular_correo_electronico,
    TRIM(
        CONCAT(COALESCE(TConductor.apellido_paterno, ''), ' ',
        COALESCE(TConductor.apellido_materno, ''), ' ',
        COALESCE(TConductor.nombres, ''))
    ) AS conductor_nombre,
    TConductor.direccion          AS conductor_direccion,
    TConductor.distrito           AS conductor_distrito,
    TConductor.provincia          AS conductor_provincia,
    TConductor.departamento       AS conductor_departamento,
    TConductor.telefono           AS conductor_telefono,
    TConductor.correo_electronico AS conductor_correo_electronico,
    CASE
        WHEN TLicenciasInactivas.licencia_funcionamiento_id IS NULL THEN TRUE
        ELSE FALSE
    END AS esta_activo,
    a.nombre AS actividad_nombre
FROM licencias_funcionamiento
LEFT JOIN expedientes
    ON licencias_funcionamiento.expediente_id = expedientes.id
LEFT JOIN tipos_procedimiento_tupa
    ON expedientes.tipo_procedimiento_tupa_id = tipos_procedimiento_tupa.id
LEFT JOIN personas AS TTitular
    ON licencias_funcionamiento.titular_id = TTitular.id
LEFT JOIN personas AS TConductor
    ON licencias_funcionamiento.conductor_id = TConductor.id
LEFT JOIN (
    SELECT DISTINCT licencias_funcionamiento_estados.licencia_funcionamiento_id
    FROM licencias_funcionamiento_estados
    INNER JOIN estados
        ON licencias_funcionamiento_estados.estado_id = estados.id
    WHERE estados.esta_activo = FALSE
) AS TLicenciasInactivas
    ON licencias_funcionamiento.id = TLicenciasInactivas.licencia_funcionamiento_id
LEFT JOIN actividades a
    ON licencias_funcionamiento.actividad_id = a.id
WHERE licencias_funcionamiento.id = ANY(%s)
ORDER BY licencias_funcionamiento.fecha_emision
"""


def reporte_licencias(filtros: dict) -> list[dict]:
    """
    Genera el reporte de licencias de funcionamiento delegando toda la lógica
    a la función PostgreSQL ``reporte_licencias_funcionamiento``, que es una
    conversión fiel del procedimiento SQL Server original.

    Parámetros
    ----------
    filtros : dict
        Diccionario con los filtros opcionales.  Claves aceptadas (todas opcionales):

        numero_licencia            – int
        numero_expediente          – int
        anio_expediente            – int
        emision_desde              – date
        emision_hasta              – date  (se aplica solo junto con emision_desde)
        titular_nombre             – str   (búsqueda parcial, insensible a mayúsculas)
        titular_numero_documento   – str
        conductor_nombre           – str   (búsqueda parcial, insensible a mayúsculas)
        conductor_numero_documento – str
        nombre_comercial           – str   (búsqueda parcial, insensible a mayúsculas)
        vigencia_desde             – date
        vigencia_hasta             – date  (se aplica solo junto con vigencia_desde)
        nivel_riesgo_id            – int
        direccion                  – str   (búsqueda parcial, insensible a mayúsculas)
        zonificacion_id            – int
        numero_recibo_pago         – str
        fecha_notificacion_desde   – date
        fecha_notificacion_hasta   – date  (se aplica solo junto con fecha_notificacion_desde)
        esta_activo                – bool
        giro_nombre                – str   (búsqueda parcial, insensible a mayúsculas)

    Retorna
    -------
    list[dict]
        Lista de licencias que cumplen los filtros, una fila por licencia.
    """
    params = [
        filtros.get('numero_licencia'),
        filtros.get('numero_expediente'),
        filtros.get('anio_expediente'),
        filtros.get('emision_desde'),
        filtros.get('emision_hasta'),
        filtros.get('titular_nombre'),
        filtros.get('titular_numero_documento'),
        filtros.get('conductor_nombre'),
        filtros.get('conductor_numero_documento'),
        filtros.get('nombre_comercial'),
        filtros.get('vigencia_desde'),
        filtros.get('vigencia_hasta'),
        filtros.get('nivel_riesgo_id'),
        filtros.get('direccion'),
        filtros.get('zonificacion_id'),
        filtros.get('numero_recibo_pago'),
        filtros.get('fecha_notificacion_desde'),
        filtros.get('fecha_notificacion_hasta'),
        filtros.get('esta_activo'),
        filtros.get('giro_nombre'),
    ]

    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT * FROM reporte_licencias_funcionamiento('
            '%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,'
            '%s, %s, %s, %s, %s, %s, %s, %s, %s, %s'
            ')',
            params,
        )
        columnas  = [col[0] for col in cursor.description]
        resultados = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]

    return resultados
