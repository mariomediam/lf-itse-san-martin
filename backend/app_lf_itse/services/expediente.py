"""
Servicios de negocio para Expedientes.

Centraliza la lógica del dominio separándola de la capa HTTP (views/serializers),
lo que facilita reutilización, pruebas unitarias y futuros cambios.
"""

import logging
from datetime import date, datetime, timedelta

from django.core.files.storage import default_storage
from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ..models import Expediente, ExpedienteArchivo, Itse, LicenciaFuncionamiento, TipoProcedimientoTupa

logger = logging.getLogger(__name__)
from ..utils import (
    calcular_fecha_alerta,
    calcular_fecha_vencimiento,
    calcular_plazos_expediente,
    dias_habiles_entre,
    siguiente_numero_expediente,
)


class ExpedienteDuplicadoError(Exception):
    """Se lanza cuando ya existe un expediente con el mismo número y año de recepción."""


class ExpedienteConLicenciaError(Exception):
    """Se lanza al intentar eliminar un expediente que ya tiene una licencia de funcionamiento emitida."""


class ExpedienteConItseError(Exception):
    """Se lanza al intentar eliminar un expediente que ya tiene una ITSE emitida."""


def _validar_numero_unico(numero: int, fecha_recepcion, exclude_pk: int | None = None) -> None:
    """
    Verifica que no exista otro expediente con el mismo ``numero_expediente``
    para el mismo año de ``fecha_recepcion``.

    Parámetros
    ----------
    numero : int
        Número de expediente a validar.
    fecha_recepcion : date | datetime
        Fecha de recepción cuyo año se usa como parte de la clave única.
    exclude_pk : int | None
        PK del expediente a excluir de la búsqueda (útil al actualizar).

    Lanza
    -----
    ExpedienteDuplicadoError
        Si ya existe otro expediente con el mismo número y año.
    """
    if isinstance(fecha_recepcion, datetime):
        anio = fecha_recepcion.year
    else:
        anio = fecha_recepcion.year

    qs = Expediente.objects.filter(
        numero_expediente=numero,
        fecha_recepcion__year=anio,
    )
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)

    if qs.exists():
        raise ExpedienteDuplicadoError(
            f'Ya existe un expediente con el número {numero} para el año {anio}.'
        )


def obtener_tipo_procedimiento(tipo_id: int) -> TipoProcedimientoTupa:
    """
    Retorna el TipoProcedimientoTupa con la PK indicada.
    Lanza HTTP 404 si no existe.
    """
    return get_object_or_404(TipoProcedimientoTupa, pk=tipo_id)


def _normalizar_fecha(fecha) -> date:
    """Convierte datetime → date si es necesario."""
    if isinstance(fecha, datetime):
        return fecha.date()
    return fecha


def crear_expediente(data: dict, usuario) -> Expediente:
    """
    Crea y retorna un Expediente aplicando las reglas de negocio:

    1. Obtiene el TipoProcedimientoTupa (valida que exista y esté activo).
    2. Calcula el número de expediente si no fue enviado.
    3. Calcula fecha_vencimiento y fecha_alerta usando los plazos del tipo.
    4. Persiste el expediente con el usuario del JWT y la fecha del servidor.

    Parámetros
    ----------
    data : dict
        Datos validados por ExpedienteCreateSerializer.
        Claves esperadas:
          - tipo_procedimiento_tupa_id (int, obligatorio)
          - fecha_recepcion (date | datetime, obligatorio)
          - solicitante_id (int, obligatorio)
          - representante_id (int | None, opcional)
          - observaciones (str | None, opcional)
          - numero_expediente (int | None, opcional)
    usuario : AUTH_USER_MODEL instance
        Usuario autenticado obtenido del token JWT (request.user).

    Retorna
    -------
    Expediente
        Instancia recién creada con todos sus campos calculados.
    """
    tipo = obtener_tipo_procedimiento(data['tipo_procedimiento_tupa_id'])

    fecha_recepcion = data['fecha_recepcion']
    fecha_inicio = _normalizar_fecha(fecha_recepcion)

    numero = data.get('numero_expediente') or siguiente_numero_expediente(fecha_inicio)

    _validar_numero_unico(numero, fecha_recepcion)

    plazos = calcular_plazos_expediente(
        fecha_inicio=fecha_inicio,
        plazo_dias=tipo.plazo_atencion_dias,
        dias_alerta=tipo.dias_alerta_vencimiento,
    )

    expediente = Expediente.objects.create(
        tipo_procedimiento_tupa=tipo,
        numero_expediente=numero,
        fecha_recepcion=fecha_recepcion,
        solicitante_id=data['solicitante_id'],
        representante_id=data.get('representante_id'),
        observaciones=data.get('observaciones'),
        fecha_vencimiento=plazos['fecha_vencimiento'],
        fecha_alerta=plazos['fecha_alerta'],
        usuario=usuario,
        fecha_digitacion=timezone.now(),
    )

    return expediente


_SQL_EXPEDIENTES_PENDIENTES = """
SELECT
    e.id,
    e.numero_expediente,
    e.fecha_recepcion,
    tpt.nombre,
    e.fecha_vencimiento,
    e.fecha_alerta,
    TRIM(
        COALESCE(tsolicitante.apellido_paterno, '') || ' ' ||
        COALESCE(tsolicitante.apellido_materno, '') || ' ' ||
        COALESCE(tsolicitante.nombres, '')
    ) AS persona_nombre,
    texpedientes.licencia_pendiente,
    texpedientes.itse_pendiente,
    e.fecha_alerta <= CURRENT_DATE AS mostrar_alerta
FROM (
    SELECT
        e.id,
        CASE
            WHEN tpt.requiere_lf = FALSE THEN FALSE
            WHEN tpt.requiere_lf = TRUE AND lf.id IS NOT NULL THEN FALSE
            WHEN tpt.requiere_lf = TRUE AND t_lf_improcedentes.id IS NOT NULL THEN FALSE
            WHEN tpt.requiere_lf = TRUE AND t_itse_improcedentes.id IS NOT NULL THEN FALSE
            ELSE TRUE
        END AS licencia_pendiente,
        CASE
            WHEN tpt.requiere_itse = FALSE THEN FALSE
            WHEN tpt.requiere_itse = TRUE AND i.id IS NOT NULL THEN FALSE
            WHEN tpt.requiere_itse = TRUE AND t_itse_improcedentes.id IS NOT NULL THEN FALSE
            WHEN tpt.requiere_itse = TRUE AND t_lf_improcedentes.id IS NOT NULL THEN FALSE
            ELSE TRUE
        END AS itse_pendiente
    FROM expedientes e
    LEFT JOIN tipos_procedimiento_tupa tpt
        ON e.tipo_procedimiento_tupa_id = tpt.id
    LEFT JOIN licencias_funcionamiento lf
        ON e.id = lf.expediente_id
    LEFT JOIN itse i
        ON e.id = i.expediente_id
    LEFT JOIN (
        SELECT id, tipo_autorizacion, expediente_id
        FROM autorizaciones_improcedentes
        WHERE tipo_autorizacion = 'LF'
    ) AS t_lf_improcedentes
        ON e.id = t_lf_improcedentes.expediente_id
    LEFT JOIN (
        SELECT id, tipo_autorizacion, expediente_id
        FROM autorizaciones_improcedentes
        WHERE tipo_autorizacion = 'ITSE'
    ) AS t_itse_improcedentes
        ON e.id = t_itse_improcedentes.expediente_id
) AS texpedientes
INNER JOIN expedientes e
    ON texpedientes.id = e.id
LEFT JOIN tipos_procedimiento_tupa tpt
    ON e.tipo_procedimiento_tupa_id = tpt.id
LEFT JOIN personas tsolicitante
    ON e.solicitante_id = tsolicitante.id
WHERE texpedientes.licencia_pendiente = TRUE
   OR texpedientes.itse_pendiente = TRUE
ORDER BY e.fecha_alerta DESC
"""


def listar_expedientes_pendientes() -> list[dict]:
    """
    Retorna los expedientes que tienen al menos una autorización pendiente
    (licencia de funcionamiento o ITSE), ordenados por fecha de alerta descendente.

    Cada elemento del listado contiene:
      - id
      - numero_expediente
      - fecha_recepcion
      - nombre            (tipo de procedimiento)
      - fecha_vencimiento
      - fecha_alerta
      - persona_nombre    (apellidos + nombres del solicitante)
      - licencia_pendiente
      - itse_pendiente

    Retorna
    -------
    list[dict]
        Lista de diccionarios; cada diccionario corresponde a una fila del resultado.
    """
    with connection.cursor() as cursor:
        cursor.execute(_SQL_EXPEDIENTES_PENDIENTES)
        columnas = [col.name for col in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


# ── Búsqueda de expedientes ────────────────────────────────────────────────────

# Subconsulta interna: todos los campos del expediente + datos del solicitante.
# El filtro WHERE se inyecta como string seguro; el valor viaja como parámetro.
_SQL_BUSCAR_INTERNA = """
    SELECT
        expedientes.id,
        expedientes.tipo_procedimiento_tupa_id,
        expedientes.numero_expediente,
        expedientes.fecha_recepcion,
        expedientes.solicitante_id,
        expedientes.representante_id,
        expedientes.observaciones,
        expedientes.fecha_vencimiento,
        expedientes.fecha_alerta,
        expedientes.fecha_suspension,
        expedientes.dias_ampliacion,
        expedientes.motivo_ampliacion,
        expedientes.usuario_ampliacion,
        expedientes.fecha_digitacion_ampliacion,
        expedientes.usuario_id,
        expedientes.fecha_digitacion,
        tpt.nombre                    AS nombre_procedimiento,
        tpt.plazo_atencion_dias,
        tpt.dias_alerta_vencimiento,
        tpt.requiere_itse,
        tpt.requiere_lf,
        TRIM(
            COALESCE(tsolicitante.apellido_paterno, '') || ' ' ||
            COALESCE(tsolicitante.apellido_materno, '') || ' ' ||
            COALESCE(tsolicitante.nombres, '')
        )                             AS solicitante_nombre,
        tsolicitante_ruc.numero_documento AS solicitante_ruc
    FROM expedientes
    LEFT JOIN tipos_procedimiento_tupa tpt
        ON expedientes.tipo_procedimiento_tupa_id = tpt.id
    LEFT JOIN personas AS tsolicitante
        ON expedientes.solicitante_id = tsolicitante.id
    LEFT JOIN (
        SELECT pd.id, pd.persona_id, pd.numero_documento
        FROM personas_documentos pd
        INNER JOIN tipos_documento_identidad tdi
            ON pd.tipo_documento_identidad_id = tdi.id
        WHERE tdi.codigo = '06'
    ) AS tsolicitante_ruc
        ON expedientes.solicitante_id = tsolicitante_ruc.persona_id
    {where}
"""

# Consulta externa: envuelve la interna y calcula licencia_pendiente / itse_pendiente
_SQL_BUSCAR_EXTERNA = """
SELECT
    t.*,
    CASE
        WHEN t.requiere_lf = FALSE THEN FALSE
        WHEN t.requiere_lf = TRUE AND lf.id   IS NOT NULL THEN FALSE
        WHEN t.requiere_lf = TRUE AND tlf.id  IS NOT NULL THEN FALSE
        ELSE TRUE
    END AS licencia_pendiente,
    CASE
        WHEN t.requiere_itse = FALSE THEN FALSE
        WHEN t.requiere_itse = TRUE AND i.id    IS NOT NULL THEN FALSE
        WHEN t.requiere_itse = TRUE AND titse.id IS NOT NULL THEN FALSE
        ELSE TRUE
    END AS itse_pendiente,
    t.fecha_alerta <= CURRENT_DATE AS mostrar_alerta
FROM ({interna}) AS t
LEFT JOIN licencias_funcionamiento lf
    ON t.id = lf.expediente_id
LEFT JOIN itse i
    ON t.id = i.expediente_id
LEFT JOIN (
    SELECT id, expediente_id
    FROM autorizaciones_improcedentes
    WHERE tipo_autorizacion = 'LF'
) AS tlf ON t.id = tlf.expediente_id
LEFT JOIN (
    SELECT id, expediente_id
    FROM autorizaciones_improcedentes
    WHERE tipo_autorizacion = 'ITSE'
) AS titse ON t.id = titse.expediente_id
ORDER BY t.fecha_recepcion DESC
"""

# Mapa de filtros: nombre → (cláusula WHERE con %s, función de transformación del valor)
_FILTROS_BUSQUEDA: dict[str, tuple[str, callable]] = {
    'ID': (
        'WHERE expedientes.id = %s',
        int,
    ),
    'NUMERO': (
        'WHERE expedientes.numero_expediente = %s',
        int,
    ),
    'FECHA_RECEPCION': (
        "WHERE expedientes.fecha_recepcion::date = %s",
        str,
    ),
    'FECHA_VENCIMIENTO': (
        'WHERE expedientes.fecha_vencimiento = %s',
        str,
    ),
    'NOMBRE_SOLICITANTE': (
        "WHERE TRIM("
        "    COALESCE(tsolicitante.apellido_paterno, '') || ' ' ||"
        "    COALESCE(tsolicitante.apellido_materno, '') || ' ' ||"
        "    COALESCE(tsolicitante.nombres, '')"
        ") ILIKE %s",
        lambda v: '%' + v.replace(' ', '%') + '%',
    ),
    'RUC_SOLICITANTE': (
        'WHERE tsolicitante_ruc.numero_documento = %s',
        str,
    ),
}


def buscar_expedientes(filtro: str, valor: str) -> list[dict]:
    """
    Busca expedientes aplicando el filtro indicado sobre el valor recibido.

    Equivalente PostgreSQL del procedimiento dinámico SQL Server original.

    Parámetros
    ----------
    filtro : str
        Tipo de búsqueda.  Valores válidos (equivalencia con SQL Server):
          ─────────────────────────────────────────────────────────────────
          'ID'                 → ID del expediente
          'NUMERO'             → NUMERO
          'FECHA_RECEPCION'    → FECHA DE RECEPCION
          'FECHA_VENCIMIENTO'  → FECHA DE VENCIMIENTO
          'NOMBRE_SOLICITANTE' → NOMBRE / RAZON SOCIAL DEL SOLICITANTE
          'RUC_SOLICITANTE'    → RUC DEL SOLICITANTE
          ─────────────────────────────────────────────────────────────────
    valor : str
        Valor a buscar.
          - NUMERO:              número entero como cadena, ej. '42'
          - FECHA_RECEPCION:     fecha en formato 'YYYY-MM-DD'
          - FECHA_VENCIMIENTO:   fecha en formato 'YYYY-MM-DD'
          - NOMBRE_SOLICITANTE:  texto parcial, ej. 'MEDINA MA'
          - RUC_SOLICITANTE:     número de RUC exacto

    Retorna
    -------
    list[dict]
        Lista de expedientes que coinciden con el filtro.  Cada diccionario
        incluye todos los campos del expediente más:
          nombre_procedimiento, plazo_atencion_dias, dias_alerta_vencimiento,
          requiere_lf, requiere_itse, solicitante_nombre, solicitante_ruc,
          licencia_pendiente, itse_pendiente.

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

    sql_interna = _SQL_BUSCAR_INTERNA.format(where=where_clause)
    sql_final = _SQL_BUSCAR_EXTERNA.format(interna=sql_interna)

    with connection.cursor() as cursor:
        cursor.execute(sql_final, [valor_param])
        columnas = [col.name for col in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


def buscar_expedientes_con_plazo(
    filtro: str,
    valor: str,
    fecha_referencia: date | None = None,
) -> list[dict]:
    """
    Extiende ``buscar_expedientes`` añadiendo a cada fila el campo
    ``dias_habiles_restantes``: días hábiles que faltan desde ``fecha_referencia``
    hasta ``fecha_vencimiento``.

    Un valor negativo indica que el expediente ya venció.

    Parámetros
    ----------
    filtro : str
        Mismo que ``buscar_expedientes``.
    valor : str
        Mismo que ``buscar_expedientes``.
    fecha_referencia : date | None
        Fecha desde la que se calcula el plazo restante.
        Por defecto se usa la fecha del servidor (hoy).

    Retorna
    -------
    list[dict]
        Mismas columnas que ``buscar_expedientes`` más:
          - dias_habiles_restantes (int)
    """
    hoy = fecha_referencia or date.today()
    filas = buscar_expedientes(filtro, valor)

    for fila in filas:
        vencimiento = fila['fecha_vencimiento']
        if isinstance(vencimiento, datetime):
            vencimiento = vencimiento.date()
        fila['dias_habiles_restantes'] = dias_habiles_entre(hoy, vencimiento)

    return filas


def actualizar_expediente(pk: int, data: dict) -> Expediente:
    """
    Modifica los campos editables de un expediente y recalcula sus plazos.

    Lógica de recálculo
    -------------------
    1. Calcula la ``fecha_vencimiento`` base desde ``fecha_recepcion`` +
       ``tipo.plazo_atencion_dias`` (días hábiles).
    2. Si el expediente ya tiene una ampliación registrada (``dias_ampliacion``),
       suma esos días hábiles sobre la fecha_vencimiento base, replicando la
       misma operación que ``ampliar_plazo_expediente``.
    3. Calcula ``fecha_alerta`` retrocediendo ``dias_alerta_vencimiento`` días
       hábiles desde la nueva ``fecha_vencimiento``.

    Parámetros
    ----------
    pk : int
        PK del expediente a actualizar.
    data : dict
        Datos validados por ``ExpedienteUpdateSerializer``:
          - tipo_procedimiento_tupa_id (int)
          - numero_expediente          (int)
          - fecha_recepcion            (date | datetime)
          - solicitante_id             (int)
          - representante_id           (int | None)
          - observaciones              (str | None)

    Retorna
    -------
    Expediente
        Instancia actualizada con los plazos recalculados.

    Lanza
    -----
    Http404
        Si el expediente o el tipo de procedimiento no existen.
    """
    expediente = get_object_or_404(Expediente, pk=pk)
    tipo = obtener_tipo_procedimiento(data['tipo_procedimiento_tupa_id'])

    _validar_numero_unico(data['numero_expediente'], data['fecha_recepcion'], exclude_pk=pk)

    fecha_recepcion = _normalizar_fecha(data['fecha_recepcion'])

    # Cálculo base: desde fecha_recepcion
    fecha_vencimiento = calcular_fecha_vencimiento(fecha_recepcion, tipo.plazo_atencion_dias)

    # Si el expediente tiene ampliación registrada, aplicarla sobre la fecha base
    if expediente.dias_ampliacion:
        fecha_vencimiento = calcular_fecha_vencimiento(fecha_vencimiento, expediente.dias_ampliacion)

    fecha_alerta = calcular_fecha_alerta(fecha_vencimiento, tipo.dias_alerta_vencimiento)

    expediente.tipo_procedimiento_tupa = tipo
    expediente.numero_expediente       = data['numero_expediente']
    expediente.fecha_recepcion         = data['fecha_recepcion']
    expediente.solicitante_id          = data['solicitante_id']
    expediente.representante_id        = data.get('representante_id')
    expediente.observaciones           = data.get('observaciones')
    expediente.fecha_vencimiento       = fecha_vencimiento
    expediente.fecha_alerta            = fecha_alerta

    expediente.save(update_fields=[
        'tipo_procedimiento_tupa',
        'numero_expediente',
        'fecha_recepcion',
        'solicitante_id',
        'representante_id',
        'observaciones',
        'fecha_vencimiento',
        'fecha_alerta',
    ])

    return expediente


def eliminar_expediente(pk: int) -> None:
    """
    Elimina un expediente y todos sus registros dependientes.

    Validaciones previas
    --------------------
    - Si el expediente tiene una ``LicenciaFuncionamiento`` emitida, lanza
      ``ExpedienteConLicenciaError`` (el usuario debe eliminar la licencia primero).
    - Si el expediente tiene una ``Itse`` emitida, lanza ``ExpedienteConItseError``
      (el usuario debe eliminar la ITSE primero).

    Eliminación dentro de transacción
    ----------------------------------
    1. Recopila las rutas de los archivos digitales antes de tocar la BD.
    2. Elimina el expediente dentro de ``transaction.atomic()``.
       Django en cascada elimina:
         - ``autorizaciones_improcedentes``  (on_delete=CASCADE)
         - ``expedientes_archivos``          (on_delete=CASCADE)
    3. Tras confirmar la transacción, elimina los archivos físicos del disco.
       Si algún borrado físico falla se registra un warning; la integridad de
       la BD ya está garantizada en ese punto.

    Parámetros
    ----------
    pk : int
        PK del expediente a eliminar.

    Lanza
    -----
    Http404
        Si el expediente no existe.
    ExpedienteConLicenciaError
        Si el expediente tiene una licencia de funcionamiento emitida.
    ExpedienteConItseError
        Si el expediente tiene una ITSE emitida.
    """
    expediente = get_object_or_404(Expediente, pk=pk)

    if LicenciaFuncionamiento.objects.filter(expediente_id=pk).exists():
        raise ExpedienteConLicenciaError(
            'No se puede eliminar el expediente: tiene una licencia de funcionamiento emitida. '
            'Primero debe eliminar la licencia y luego el expediente.'
        )

    if Itse.objects.filter(expediente_id=pk).exists():
        raise ExpedienteConItseError(
            'No se puede eliminar el expediente: tiene una ITSE emitida. '
            'Primero debe eliminar la ITSE y luego el expediente.'
        )

    # Guardar rutas de archivos físicos ANTES de la transacción
    rutas_archivos = list(
        ExpedienteArchivo.objects.filter(expediente_id=pk)
        .values_list('ruta_archivo', flat=True)
    )

    with transaction.atomic():
        expediente.delete()

    # Eliminar archivos físicos fuera de la transacción
    for ruta in rutas_archivos:
        if default_storage.exists(ruta):
            try:
                default_storage.delete(ruta)
            except Exception:
                logger.warning(
                    'No se pudo eliminar el archivo físico "%s" del expediente pk=%s.',
                    ruta, pk,
                )


def ampliar_plazo_expediente(pk: int, data: dict, usuario) -> Expediente:
    """
    Registra la ampliación de plazo de un expediente y recalcula sus fechas.

    Lógica
    ------
    1. Obtiene el expediente (404 si no existe).
    2. Lee ``dias_alerta_vencimiento`` del tipo de procedimiento asociado.
    3. Calcula la nueva ``fecha_vencimiento`` avanzando ``dias_ampliacion``
       días hábiles desde la ``fecha_vencimiento`` actual.
    4. Calcula la nueva ``fecha_alerta`` retrocediendo ``dias_alerta_vencimiento``
       días hábiles desde la nueva ``fecha_vencimiento``.
    5. Actualiza el expediente y lo retorna.

    Parámetros
    ----------
    pk : int
        PK del expediente a ampliar.
    data : dict
        Datos validados por ``AmpliacionPlazoSerializer``:
          - fecha_suspension  (date)
          - dias_ampliacion   (int, ≥ 1)
          - motivo_ampliacion (str)
    usuario : AUTH_USER_MODEL instance
        Usuario autenticado obtenido del JWT.

    Retorna
    -------
    Expediente
        Instancia actualizada con todos sus campos recalculados.

    Lanza
    -----
    Http404
        Si el expediente no existe.
    """
    expediente = get_object_or_404(Expediente.objects.select_related('tipo_procedimiento_tupa'), pk=pk)

    dias_alerta = expediente.tipo_procedimiento_tupa.dias_alerta_vencimiento
    dias_ampliacion = data['dias_ampliacion']

    fecha_vencimiento_actual = _normalizar_fecha(expediente.fecha_vencimiento)
    nueva_fecha_vencimiento = calcular_fecha_vencimiento(fecha_vencimiento_actual, dias_ampliacion)
    nueva_fecha_alerta = calcular_fecha_alerta(nueva_fecha_vencimiento, dias_alerta)

    expediente.fecha_suspension = data['fecha_suspension']
    expediente.dias_ampliacion = dias_ampliacion
    expediente.motivo_ampliacion = data['motivo_ampliacion']
    expediente.fecha_digitacion_ampliacion = timezone.now()
    expediente.usuario_ampliacion = usuario
    expediente.fecha_vencimiento = nueva_fecha_vencimiento
    expediente.fecha_alerta = nueva_fecha_alerta

    expediente.save(update_fields=[
        'fecha_suspension',
        'dias_ampliacion',
        'motivo_ampliacion',
        'fecha_digitacion_ampliacion',
        'usuario_ampliacion',
        'fecha_vencimiento',
        'fecha_alerta',
    ])

    return expediente


# ── Consulta de expedientes ────────────────────────────────────────────────────
#
# CTE para evitar productos cartesianos al unir documentos del solicitante y del
# representante en el mismo SELECT principal.
# Los campos de licencia e ITSE muestran el número si existe, el texto especial
# si fue declarado improcedente/desfavorable, o cadena vacía en caso contrario.

_SQL_CONSULTA_EXPEDIENTES = """
WITH expedientes_filtrados AS (
    SELECT DISTINCT e.id
    FROM expedientes e
    LEFT JOIN personas AS tsolicitante
        ON e.solicitante_id = tsolicitante.id
    LEFT JOIN personas_documentos pd_solicitante
        ON e.solicitante_id = pd_solicitante.persona_id
    LEFT JOIN personas_documentos pd_representante
        ON e.representante_id = pd_representante.persona_id
    {where}
),
solicitante_docs AS (
    SELECT
        e.id AS expediente_id,
        STRING_AGG(
            tdi.nombre || ' ' || pd.numero_documento,
            ', '
            ORDER BY tdi.nombre || ' ' || pd.numero_documento
        ) AS solicitante_documentos
    FROM expedientes e
    JOIN expedientes_filtrados ef ON e.id = ef.id
    LEFT JOIN personas_documentos pd
        ON e.solicitante_id = pd.persona_id
    LEFT JOIN tipos_documento_identidad tdi
        ON pd.tipo_documento_identidad_id = tdi.id
    GROUP BY e.id
),
representante_docs AS (
    SELECT
        e.id AS expediente_id,
        STRING_AGG(
            tdi.nombre || ' ' || pd.numero_documento,
            ', '
            ORDER BY tdi.nombre || ' ' || pd.numero_documento
        ) AS representante_documentos
    FROM expedientes e
    JOIN expedientes_filtrados ef ON e.id = ef.id
    LEFT JOIN personas_documentos pd
        ON e.representante_id = pd.persona_id
    LEFT JOIN tipos_documento_identidad tdi
        ON pd.tipo_documento_identidad_id = tdi.id
    GROUP BY e.id
)
SELECT
    e.numero_expediente,
    tpt.nombre AS tipo_procedimiento_tupa_nombre,
    e.fecha_recepcion,
    TRIM(
        COALESCE(tsolicitante.apellido_paterno, '') || ' ' ||
        COALESCE(tsolicitante.apellido_materno, '') || ' ' ||
        COALESCE(tsolicitante.nombres, '')
    ) AS solicitante_nombre,
    COALESCE(sd.solicitante_documentos, '')       AS solicitante_documentos,
    TRIM(
        COALESCE(trepresentante.apellido_paterno, '') || ' ' ||
        COALESCE(trepresentante.apellido_materno, '') || ' ' ||
        COALESCE(trepresentante.nombres, '')
    ) AS representante_nombre,
    COALESCE(rd.representante_documentos, '')     AS representante_documentos,
    CASE
        WHEN lf.numero_licencia IS NOT NULL        THEN CAST(lf.numero_licencia AS TEXT)
        WHEN tlf_imp.expediente_id IS NOT NULL     THEN 'IMPROCEDENTE'
        ELSE ''
    END AS licencia_funcionamiento,
    CASE
        WHEN i.numero_itse IS NOT NULL             THEN CAST(i.numero_itse AS TEXT)
        WHEN titse_imp.expediente_id IS NOT NULL   THEN 'DESFAVORABLE'
        ELSE ''
    END AS itse
FROM expedientes e
JOIN  expedientes_filtrados ef ON e.id = ef.id
LEFT JOIN tipos_procedimiento_tupa tpt
    ON e.tipo_procedimiento_tupa_id = tpt.id
LEFT JOIN personas tsolicitante
    ON e.solicitante_id = tsolicitante.id
LEFT JOIN personas trepresentante
    ON e.representante_id = trepresentante.id
LEFT JOIN solicitante_docs  sd ON e.id = sd.expediente_id
LEFT JOIN representante_docs rd ON e.id = rd.expediente_id
LEFT JOIN licencias_funcionamiento lf
    ON e.id = lf.expediente_id
LEFT JOIN itse i
    ON e.id = i.expediente_id
LEFT JOIN (
    SELECT expediente_id
    FROM autorizaciones_improcedentes
    WHERE tipo_autorizacion = 'LF'
) AS tlf_imp
    ON e.id = tlf_imp.expediente_id
LEFT JOIN (
    SELECT expediente_id
    FROM autorizaciones_improcedentes
    WHERE tipo_autorizacion = 'ITSE'
) AS titse_imp
    ON e.id = titse_imp.expediente_id
ORDER BY e.fecha_recepcion DESC
"""


def consultar_expedientes(filtros: dict) -> list[dict]:
    """
    Consulta expedientes aplicando filtros opcionales.

    Al menos uno de los filtros debe estar presente (validado en el serializer).

    Parámetros
    ----------
    filtros : dict
        Claves aceptadas (todas opcionales, pero al menos una requerida):

        solicitante_nombre             – str  búsqueda parcial en apellidos + nombres
        numero_expediente              – int  número exacto del expediente
        anio_expediente                – int  año de la fecha de recepción
        solicitante_numero_documento   – str  número de documento exacto del solicitante
        representante_numero_documento – str  número de documento exacto del representante

    Retorna
    -------
    list[dict]
        Una fila por expediente.  Campos:
          numero_expediente, tipo_procedimiento_tupa_nombre, fecha_recepcion,
          solicitante_nombre, solicitante_documentos,
          representante_nombre, representante_documentos,
          licencia_funcionamiento, itse.
    """
    conditions: list[str] = []
    params: list = []

    solicitante_nombre = (filtros.get('solicitante_nombre') or '').strip()
    if solicitante_nombre:
        conditions.append(
            "TRIM("
            "    COALESCE(tsolicitante.apellido_paterno, '') || ' ' ||"
            "    COALESCE(tsolicitante.apellido_materno, '') || ' ' ||"
            "    COALESCE(tsolicitante.nombres, '')"
            ") ILIKE %s"
        )
        params.append('%' + solicitante_nombre.replace(' ', '%') + '%')

    numero_expediente = filtros.get('numero_expediente')
    if numero_expediente is not None:
        conditions.append('e.numero_expediente = %s')
        params.append(numero_expediente)

    anio_expediente = filtros.get('anio_expediente')
    if anio_expediente is not None:
        conditions.append('EXTRACT(YEAR FROM e.fecha_recepcion) = %s')
        params.append(anio_expediente)

    solicitante_numero_documento = (filtros.get('solicitante_numero_documento') or '').strip()
    if solicitante_numero_documento:
        conditions.append('pd_solicitante.numero_documento = %s')
        params.append(solicitante_numero_documento)

    representante_numero_documento = (filtros.get('representante_numero_documento') or '').strip()
    if representante_numero_documento:
        conditions.append('pd_representante.numero_documento = %s')
        params.append(representante_numero_documento)

    where = ('WHERE ' + ' AND '.join(conditions)) if conditions else ''

    sql = _SQL_CONSULTA_EXPEDIENTES.format(where=where)

    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        columnas = [col.name for col in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


def listar_expedientes_pendientes_con_plazo(
    fecha_referencia: date | None = None,
) -> list[dict]:
    """
    Extiende ``listar_expedientes_pendientes`` añadiendo a cada fila el campo
    ``dias_habiles_restantes``: días hábiles que faltan desde ``fecha_referencia``
    hasta ``fecha_vencimiento``.

    Un valor negativo indica que el expediente ya venció.

    Parámetros
    ----------
    fecha_referencia : date | None
        Fecha desde la que se calcula el plazo restante.
        Por defecto se usa la fecha del servidor (hoy).

    Retorna
    -------
    list[dict]
        Mismas columnas que ``listar_expedientes_pendientes`` más:
          - dias_habiles_restantes (int)
    """
    hoy = fecha_referencia or date.today()
    filas = listar_expedientes_pendientes()

    for fila in filas:
        vencimiento = fila['fecha_vencimiento']
        if isinstance(vencimiento, datetime):
            vencimiento = vencimiento.date()
        fila['dias_habiles_restantes'] = dias_habiles_entre(hoy, vencimiento)

    return filas
