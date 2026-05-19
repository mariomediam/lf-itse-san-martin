import uuid

from auditlog.registry import auditlog
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class UnidadOrganica(models.Model):
    codigo = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=200)
    sigla = models.CharField(max_length=50)
    esta_activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'unidades_organicas'

    def __str__(self):
        return self.nombre


class TipoProcedimientoTupa(models.Model):
    codigo = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=250)
    monto = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    plazo_atencion_dias = models.PositiveIntegerField(default=0)
    dias_alerta_vencimiento = models.PositiveIntegerField(default=0)
    esta_activo = models.BooleanField(default=True)
    unidad_organica = models.ForeignKey(
        UnidadOrganica,
        on_delete=models.PROTECT,
        db_column='unidad_organica_id',
    )
    requiere_lf = models.BooleanField(default=True)
    requiere_itse = models.BooleanField(default=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'tipos_procedimiento_tupa'

    def __str__(self):
        return f'tipos_procedimiento_tupa id:{self.id} {self.nombre[:30]}'


class TipoDocumentoIdentidad(models.Model):
    codigo           = models.CharField(max_length=20, unique=True)
    nombre           = models.CharField(max_length=100)
    esta_activo      = models.BooleanField(default=True)
    es_para_natural  = models.BooleanField(default=True)
    es_para_juridica = models.BooleanField(default=True)

    class Meta:
        db_table = 'tipos_documento_identidad'

    def __str__(self):
        return self.nombre


class Estado(models.Model):
    nombre = models.CharField(max_length=100)
    es_para_lf = models.BooleanField(default=True)
    es_para_itse = models.BooleanField(default=True)
    esta_activo = models.BooleanField(default=False)

    class Meta:
        db_table = 'estados'

    def __str__(self):
        return self.nombre


class NivelRiesgo(models.Model):
    codigo = models.CharField(max_length=10, unique=True)
    nombre = models.CharField(max_length=50)
    esta_activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'niveles_riesgo'

    def __str__(self):
        return self.nombre


class TipoLicencia(models.Model):
    codigo = models.CharField(max_length=20, unique=True)
    nombre = models.CharField(max_length=150)
    esta_activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'tipos_licencia'

    def __str__(self):
        return self.nombre


class Zonificacion(models.Model):
    codigo = models.CharField(max_length=30, unique=True)
    nombre = models.CharField(max_length=150)
    esta_activo = models.BooleanField(default=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'zonificaciones'

    def __str__(self):
        return self.nombre


class Giro(models.Model):
    ciiu_id = models.PositiveIntegerField(null=True, blank=True)
    nombre = models.CharField(max_length=200)
    esta_activo = models.BooleanField(default=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'giros'
        constraints = [
            models.UniqueConstraint(
                fields=['ciiu_id'],
                condition=models.Q(ciiu_id__isnull=False),
                name='uq_giros_ciiu_id',
            ),
        ]

    def __str__(self):
        return f'giros id:{self.id} {self.nombre[:30]}'


class Persona(models.Model):
    class TipoPersona(models.TextChoices):
        NATURAL  = 'N', 'Natural'
        JURIDICA = 'J', 'Jurídica'

    class Sexo(models.TextChoices):
        MASCULINO        = 'M', 'Masculino'
        FEMENINO         = 'F', 'Femenino'
        PREFIERO_NO_DECIR = 'X', 'Prefiero no decirlo'

    tipo_persona = models.CharField(max_length=1, choices=TipoPersona.choices)
    sexo = models.CharField(
        max_length=1,
        choices=Sexo.choices,
        default=Sexo.PREFIERO_NO_DECIR,
    )
    apellido_paterno = models.CharField(max_length=50, blank=True, null=True)
    apellido_materno = models.CharField(max_length=50, blank=True, null=True)
    nombres = models.CharField(max_length=100)
    direccion = models.CharField(max_length=250)
    distrito = models.CharField(max_length=100)
    provincia = models.CharField(max_length=100)
    departamento = models.CharField(max_length=100)
    telefono = models.CharField(max_length=30, blank=True, null=True)
    correo_electronico = models.CharField(max_length=150, blank=True, null=True)
    fecha_creacion = models.DateTimeField()
    fecha_actualizacion = models.DateTimeField()
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='user_id',
    )

    class Meta:
        db_table = 'personas'

    def __str__(self):
        return f'personas id:{self.id} {self.apellido_paterno} {self.apellido_materno} {self.nombres}'


class PersonaDocumento(models.Model):
    persona = models.ForeignKey(
        Persona,
        on_delete=models.CASCADE,
        db_column='persona_id',
        related_name='documentos',
    )
    tipo_documento_identidad = models.ForeignKey(
        TipoDocumentoIdentidad,
        on_delete=models.PROTECT,
        db_column='tipo_documento_identidad_id',
    )
    numero_documento = models.CharField(max_length=20)

    class Meta:
        db_table = 'personas_documentos'
        constraints = [
            models.UniqueConstraint(
                fields=['persona', 'tipo_documento_identidad'],
                name='uq_perdoc_per_tip',
            ),
        ]
        indexes = [
            models.Index(
                fields=['tipo_documento_identidad', 'numero_documento'],
                name='ix_perdoc_tiponum',
            ),
        ]

    def __str__(self):
        return f'personas_documentos persona_id:{self.persona_id}'


class Expediente(models.Model):
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
    )
    tipo_procedimiento_tupa = models.ForeignKey(
        TipoProcedimientoTupa,
        on_delete=models.PROTECT,
        db_column='tipo_procedimiento_tupa_id',
    )
    numero_expediente = models.PositiveIntegerField()
    fecha_recepcion = models.DateTimeField()
    solicitante = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        db_column='solicitante_id',
        related_name='expedientes_como_solicitante',
    )
    representante = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        db_column='representante_id',
        related_name='expedientes_como_representante',
        null=True,
        blank=True,
    )
    observaciones = models.CharField(max_length=250, blank=True, null=True)
    fecha_vencimiento = models.DateField()
    fecha_alerta = models.DateField()
    fecha_suspension = models.DateField(null=True, blank=True)
    dias_ampliacion = models.PositiveIntegerField(null=True, blank=True)
    motivo_ampliacion = models.CharField(max_length=250, null=True, blank=True)
    usuario_ampliacion = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_ampliacion',
        related_name='expedientes_ampliacion_digitadas',
        null=True,
        blank=True,
    )
    fecha_digitacion_ampliacion = models.DateTimeField(null=True, blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
        related_name='expedientes_digitados',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'expedientes'

    def __str__(self):
        return f'expedientes id:{self.id} Número:{self.numero_expediente} {self.fecha_recepcion.year}'


class ExpedienteArchivo(models.Model):
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
    )
    expediente = models.ForeignKey(
        Expediente,
        on_delete=models.CASCADE,
        db_column='expediente_id',
        related_name='archivos',
    )
    nombre_original = models.CharField(max_length=255)
    nombre_archivo = models.CharField(max_length=255)
    ruta_archivo = models.CharField(max_length=500)
    extension = models.CharField(max_length=20)
    tamanio_bytes = models.BigIntegerField()
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'expedientes_archivos'

    def __str__(self):
        return f'expedientes_archivos expediente_id:{self.expediente_id}'


class AutorizacionImprocedente(models.Model):
    expediente = models.ForeignKey(
        Expediente,
        on_delete=models.CASCADE,
        db_column='expediente_id',
        related_name='autorizaciones_improcedentes',
    )
    tipo_autorizacion = models.CharField(max_length=4)
    fecha_rechazo = models.DateField()
    documento = models.CharField(max_length=100)
    observaciones = models.CharField(max_length=1000)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'autorizaciones_improcedentes'
        indexes = [
            models.Index(
                fields=['expediente', 'tipo_autorizacion'],
                name='ix_aut_impr_exp_tp',
            ),
        ]

    def __str__(self):
        return f'autorizaciones_improcedentes expediente_id:{self.expediente_id} tipo:{self.tipo_autorizacion}'


class Actividad(models.Model):
    nombre = models.CharField(max_length=50)

    class Meta:
        db_table = 'actividades'

    def __str__(self):
        return self.nombre


class LicenciaFuncionamiento(models.Model):
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
    )
    expediente = models.ForeignKey(
        Expediente,
        on_delete=models.PROTECT,
        db_column='expediente_id',
        related_name='licencias_funcionamiento',
    )
    tipo_licencia = models.ForeignKey(
        TipoLicencia,
        on_delete=models.PROTECT,
        db_column='tipo_licencia_id',
    )
    numero_licencia = models.PositiveIntegerField(unique=True)
    fecha_emision = models.DateField()
    titular = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        db_column='titular_id',
        related_name='licencias_funcionamiento_titular',
    )
    conductor = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        db_column='conductor_id',
        related_name='licencias_funcionamiento_conductor',
    )
    licencia_principal = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        db_column='licencia_principal_id',
        null=True,
        blank=True,
        related_name='licencias_dependientes',
    )
    nombre_comercial = models.CharField(max_length=250)
    es_vigencia_indeterminada = models.BooleanField(default=True)
    fecha_inicio_vigencia = models.DateField(null=True, blank=True)
    fecha_fin_vigencia = models.DateField(null=True, blank=True)
    nivel_riesgo = models.ForeignKey(
        NivelRiesgo,
        on_delete=models.PROTECT,
        db_column='nivel_riesgo_id',
    )
    actividad = models.ForeignKey(
        Actividad,
        on_delete=models.PROTECT,
        db_column='actividad_id',
        default=1,
    )
    direccion = models.CharField(max_length=250)
    hora_desde = models.IntegerField()
    hora_hasta = models.IntegerField()
    resolucion_numero = models.CharField(max_length=50)
    zonificacion = models.ForeignKey(
        Zonificacion,
        on_delete=models.PROTECT,
        db_column='zonificacion_id',
    )
    area = models.DecimalField(max_digits=18, decimal_places=2)
    numero_recibo_pago = models.CharField(max_length=20)
    observaciones = models.TextField(blank=True, null=True)
    # dias_atencion = models.CharField(max_length=50, blank=True, null=True)
    # numero_folios = models.CharField(max_length=50, blank=True, null=True)
    se_puede_publicar = models.BooleanField(default=False)
    requiere_auth_sectorial = models.BooleanField(default=False)
    fecha_notificacion = models.DateTimeField(null=True, blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
        related_name='licencias_funcionamiento_digitadas',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'licencias_funcionamiento'

    def __str__(self):
        return f'licencias_funcionamiento id:{self.id} Numero:{self.numero_licencia} {self.fecha_emision.year}'


class LicenciaFuncionamientoArchivo(models.Model):
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
    )
    licencia_funcionamiento = models.ForeignKey(
        LicenciaFuncionamiento,
        on_delete=models.CASCADE,
        db_column='licencia_funcionamiento_id',
        related_name='archivos',
    )
    nombre_original = models.CharField(max_length=255)
    nombre_archivo = models.CharField(max_length=255)
    ruta_archivo = models.CharField(max_length=500)
    extension = models.CharField(max_length=20)
    tamanio_bytes = models.BigIntegerField()
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'licencias_funcionamiento_archivos'

    def __str__(self):
        return f'licencias_funcionamiento_archivos licencia_funcionamiento_id:{self.licencia_funcionamiento_id}'


class LicenciaFuncionamientoEstado(models.Model):
    licencia_funcionamiento = models.ForeignKey(
        LicenciaFuncionamiento,
        on_delete=models.CASCADE,
        db_column='licencia_funcionamiento_id',
        related_name='historial_estados',
    )
    estado = models.ForeignKey(
        Estado,
        on_delete=models.PROTECT,
        db_column='estado_id',
    )
    fecha_estado = models.DateField()
    documento = models.CharField(max_length=100)
    observaciones = models.CharField(max_length=1000)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'licencias_funcionamiento_estados'

    def __str__(self):
        return f'licencias_funcionamiento_estados licencia_funcionamiento_id:{self.licencia_funcionamiento_id}'


class LicenciaFuncionamientoGiro(models.Model):
    licencia_funcionamiento = models.ForeignKey(
        LicenciaFuncionamiento,
        on_delete=models.CASCADE,
        db_column='licencia_funcionamiento_id',
        related_name='giros',
    )
    giro = models.ForeignKey(
        Giro,
        on_delete=models.PROTECT,
        db_column='giro_id',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'licencias_funcionamiento_giros'

    def __str__(self):
        return f'licencias_funcionamiento_giros licencia_funcionamiento_id:{self.licencia_funcionamiento_id}'


class Itse(models.Model):
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
    )
    expediente = models.ForeignKey(
        Expediente,
        on_delete=models.PROTECT,
        db_column='expediente_id',
        related_name='itse',
    )
    tipo_itse_id = models.PositiveIntegerField()
    numero_itse = models.PositiveIntegerField(unique=True)
    fecha_expedicion = models.DateField()
    fecha_solicitud_renovacion = models.DateField()
    fecha_caducidad = models.DateField()
    titular = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        db_column='titular_id',
        related_name='itse_titular',
    )
    conductor = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        db_column='conductor_id',
        related_name='itse_conductor',
    )
    itse_principal = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        db_column='itse_principal_id',
        null=True,
        blank=True,
        related_name='itse_dependientes',
    )
    nombre_comercial = models.CharField(max_length=250)
    nivel_riesgo = models.ForeignKey(
        NivelRiesgo,
        on_delete=models.PROTECT,
        db_column='nivel_riesgo_id',
    )
    direccion = models.CharField(max_length=250)
    resolucion_numero = models.CharField(max_length=50)
    area = models.DecimalField(max_digits=18, decimal_places=2)
    numero_recibo_pago = models.CharField(max_length=20)
    observaciones = models.TextField()
    se_puede_publicar = models.BooleanField(default=False)
    capacidad_aforo = models.PositiveIntegerField()
    fecha_notificacion = models.DateTimeField(null=True, blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
        related_name='itse_digitados',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'itse'

    def __str__(self):
        return f'itse id:{self.id} Numero:{self.numero_itse} {self.fecha_expedicion.year}'


class ItseArchivo(models.Model):
    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
    )
    itse = models.ForeignKey(
        Itse,
        on_delete=models.CASCADE,
        db_column='itse_id',
        related_name='archivos',
    )
    nombre_original = models.CharField(max_length=255)
    nombre_archivo = models.CharField(max_length=255)
    ruta_archivo = models.CharField(max_length=500)
    extension = models.CharField(max_length=20)
    tamanio_bytes = models.BigIntegerField()
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'itse_archivos'

    def __str__(self):
        return f'itse_archivos itse_id:{self.itse_id}'


class ItseEstado(models.Model):
    itse = models.ForeignKey(
        Itse,
        on_delete=models.CASCADE,
        db_column='itse_id',
        related_name='historial_estados',
    )
    estado = models.ForeignKey(
        Estado,
        on_delete=models.PROTECT,
        db_column='estado_id',
    )
    fecha_estado = models.DateField()
    documento = models.CharField(max_length=100)
    observaciones = models.CharField(max_length=1000)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'itse_estados'

    def __str__(self):
        return f'itse_estados itse_id:{self.itse_id}'


class ItseGiro(models.Model):
    itse = models.ForeignKey(
        Itse,
        on_delete=models.CASCADE,
        db_column='itse_id',
        related_name='giros',
    )
    giro = models.ForeignKey(
        Giro,
        on_delete=models.PROTECT,
        db_column='giro_id',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'itse_giros'

    def __str__(self):
        return f'itse_giros itse_id:{self.itse_id}'


class Inspector(models.Model):
    apellido_paterno = models.CharField(max_length=50)
    apellido_materno = models.CharField(max_length=50)
    nombres          = models.CharField(max_length=50)
    usuario          = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
        related_name='inspectores_digitados',
    )
    fecha_creacion      = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = 'inspectores'

    def __str__(self):
        return f'{self.apellido_paterno} {self.apellido_materno}, {self.nombres}'


class ItseInspector(models.Model):
    itse = models.ForeignKey(
        Itse,
        on_delete=models.CASCADE,
        db_column='itse_id',
        related_name='inspectores',
    )
    inspector = models.ForeignKey(
        Inspector,
        on_delete=models.PROTECT,
        db_column='inspector_id',
        related_name='itse_asignadas',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_id',
        related_name='itse_inspectores_digitados',
    )
    fecha_creacion      = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = 'itse_inspectores'


class UsuarioPerfil(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column='user_id',
        related_name='perfil_lf_itse',
    )
    expedientes = models.BooleanField(default=False)
    licencias = models.BooleanField(default=False)
    itse = models.BooleanField(default=False)
    admin = models.BooleanField(default=False)
    user_digitador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='user_id_digitador',
        related_name='perfiles_digitados',
    )
    fecha_digitacion = models.DateTimeField()

    class Meta:
        db_table = 'usuarios_perfiles'

    def __str__(self):
        return f'usuarios_perfiles user_id:{self.user_id}'


class FeriadoAnual(models.Model):
    """Fechas feriadas específicas de un año calendario."""

    feriado = models.DateField(unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='user_id',
    )
    fecha_digitacion = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'feriados_anuales'
        ordering = ['feriado']

    def __str__(self):
        return str(self.feriado)


class FeriadoRecurrente(models.Model):

    """Días feriados que se repiten cada año (p. ej. 1 de enero, 25 de diciembre)."""

    dia = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)],
    )
    mes = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)],
    )

    class Meta:
        db_table = 'feriados_recurrentes'
        ordering = ['mes', 'dia']
        constraints = [
            models.UniqueConstraint(
                fields=['dia', 'mes'],
                name='uq_feriados_rec_dia_mes',
            ),
        ]

    def __str__(self):
        return f'{self.dia:02d}/{self.mes:02d}'


# ── Registro de auditoría ──────────────────────────────────────────────────────

auditlog.register(TipoProcedimientoTupa)
auditlog.register(Giro)
auditlog.register(Persona)
auditlog.register(PersonaDocumento)
auditlog.register(Expediente)
auditlog.register(ExpedienteArchivo)
auditlog.register(AutorizacionImprocedente)
auditlog.register(Actividad)
auditlog.register(LicenciaFuncionamiento)
auditlog.register(LicenciaFuncionamientoArchivo)
auditlog.register(LicenciaFuncionamientoEstado)
auditlog.register(LicenciaFuncionamientoGiro)
auditlog.register(Itse)
auditlog.register(ItseArchivo)
auditlog.register(ItseEstado)
auditlog.register(ItseGiro)
auditlog.register(UsuarioPerfil)
