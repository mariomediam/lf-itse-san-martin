from django.contrib.auth import get_user_model

from rest_framework import serializers

from . import models

User = get_user_model()


class UnidadOrganicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.UnidadOrganica
        fields = '__all__'


class TipoProcedimientoTupaSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TipoProcedimientoTupa
        fields = '__all__'


class TipoProcedimientoTupaWriteSerializer(serializers.ModelSerializer):
    """
    Serializador de entrada para crear y actualizar TipoProcedimientoTupa.

    Excluye ``usuario`` y ``fecha_digitacion`` porque son asignados
    automáticamente en la capa de servicio.
    """

    class Meta:
        model = models.TipoProcedimientoTupa
        exclude = ('usuario', 'fecha_digitacion')


class TipoDocumentoIdentidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TipoDocumentoIdentidad
        fields = '__all__'


class EstadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Estado
        fields = '__all__'


class NivelRiesgoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.NivelRiesgo
        fields = '__all__'


class TipoLicenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TipoLicencia
        fields = '__all__'


class ZonificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Zonificacion
        fields = '__all__'


class ZonificacionWriteSerializer(serializers.Serializer):
    """Valida los datos de entrada para crear o actualizar una Zonificacion."""
    codigo      = serializers.CharField(max_length=30)
    nombre      = serializers.CharField(max_length=150)
    esta_activo = serializers.BooleanField(default=True)


class GiroSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Giro
        fields = '__all__'


class GiroWriteSerializer(serializers.Serializer):
    """Valida los datos de entrada para crear o actualizar un Giro."""
    ciiu_id     = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    nombre      = serializers.CharField(max_length=200)
    esta_activo = serializers.BooleanField(default=True)


class InspectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Inspector
        fields = '__all__'


class InspectorWriteSerializer(serializers.Serializer):
    """Valida los datos de entrada para crear o actualizar un Inspector."""
    apellido_paterno = serializers.CharField(max_length=50)
    apellido_materno = serializers.CharField(max_length=50)
    nombres          = serializers.CharField(max_length=50)


class PersonaDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PersonaDocumento
        fields = '__all__'


class PersonaDocumentoListSerializer(serializers.ModelSerializer):
    """
    Serializa los documentos de identidad de una persona incluyendo los datos
    del tipo de documento como campos planos (equivale al LEFT JOIN de la
    consulta original sobre personas_documentos y tipos_documento_identidad).
    """

    tipos_documento_identidad_codigo = serializers.CharField(
        source='tipo_documento_identidad.codigo',
        read_only=True,
    )
    tipos_documento_identidad_nombre = serializers.CharField(
        source='tipo_documento_identidad.nombre',
        read_only=True,
    )

    class Meta:
        model = models.PersonaDocumento
        fields = (
            'id',
            'persona_id',
            'tipo_documento_identidad_id',
            'numero_documento',
            'tipos_documento_identidad_codigo',
            'tipos_documento_identidad_nombre',
        )


class PersonaSerializer(serializers.ModelSerializer):
    documentos = PersonaDocumentoSerializer(many=True, read_only=True)

    class Meta:
        model = models.Persona
        fields = '__all__'


class PersonaDocumentoNestedSerializer(serializers.ModelSerializer):
    """Documento sin anidar persona (útil al crear persona y documentos en un paso)."""

    class Meta:
        model = models.PersonaDocumento
        exclude = ('persona',)


class ExpedienteArchivoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ExpedienteArchivo
        fields = '__all__'
        extra_kwargs = {'uuid': {'read_only': True}}


class AutorizacionImprocedenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.AutorizacionImprocedente
        fields = '__all__'


class ExpedienteSerializer(serializers.ModelSerializer):
    archivos = ExpedienteArchivoSerializer(many=True, read_only=True)
    autorizaciones_improcedentes = AutorizacionImprocedenteSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = models.Expediente
        fields = '__all__'
        extra_kwargs = {'uuid': {'read_only': True}}


class LicenciaFuncionamientoArchivoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.LicenciaFuncionamientoArchivo
        fields = '__all__'
        extra_kwargs = {'uuid': {'read_only': True}}


class LicenciaFuncionamientoEstadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.LicenciaFuncionamientoEstado
        fields = '__all__'


class LicenciaFuncionamientoGiroSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.LicenciaFuncionamientoGiro
        fields = '__all__'


class LicenciaFuncionamientoSerializer(serializers.ModelSerializer):
    archivos = LicenciaFuncionamientoArchivoSerializer(many=True, read_only=True)
    historial_estados = LicenciaFuncionamientoEstadoSerializer(many=True, read_only=True)
    giros = LicenciaFuncionamientoGiroSerializer(many=True, read_only=True)

    class Meta:
        model = models.LicenciaFuncionamiento
        fields = '__all__'
        extra_kwargs = {'uuid': {'read_only': True}}


class ItseArchivoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ItseArchivo
        fields = '__all__'
        extra_kwargs = {'uuid': {'read_only': True}}


class ItseEstadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ItseEstado
        fields = '__all__'


class ItseGiroSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ItseGiro
        fields = '__all__'


class ItseSerializer(serializers.ModelSerializer):
    archivos = ItseArchivoSerializer(many=True, read_only=True)
    historial_estados = ItseEstadoSerializer(many=True, read_only=True)
    giros = ItseGiroSerializer(many=True, read_only=True)

    class Meta:
        model = models.Itse
        fields = '__all__'
        extra_kwargs = {'uuid': {'read_only': True}}


# ---------------------------------------------------------------------------
# Persona — entrada (POST / PUT /personas/)
# ---------------------------------------------------------------------------

class PersonaDocumentoWriteSerializer(serializers.Serializer):
    """Un documento de identidad dentro del payload de crear/actualizar persona."""
    tipo_documento_identidad_id = serializers.IntegerField()
    numero_documento            = serializers.CharField(max_length=20)


class PersonaWriteSerializer(serializers.Serializer):
    """
    Valida los datos de entrada para crear o actualizar una Persona.

    Para tipo_persona = 'J' (jurídica):
      - nombres      → razón social  (obligatorio)
      - apellido_paterno / apellido_materno → se ignoran y quedan vacíos
    Para tipo_persona = 'N' (natural):
      - apellido_paterno es obligatorio
    """
    tipo_persona       = serializers.ChoiceField(choices=['N', 'J'])
    sexo               = serializers.ChoiceField(
                             choices=['M', 'F', 'X'],
                             required=False,
                             default='X',
                         )
    apellido_paterno   = serializers.CharField(max_length=50,  required=False, allow_blank=True, allow_null=True)
    apellido_materno   = serializers.CharField(max_length=50,  required=False, allow_blank=True, allow_null=True)
    nombres            = serializers.CharField(max_length=100)
    direccion          = serializers.CharField(max_length=250)
    distrito           = serializers.CharField(max_length=100)
    provincia          = serializers.CharField(max_length=100)
    departamento       = serializers.CharField(max_length=100)
    telefono           = serializers.CharField(max_length=30,  required=False, allow_blank=True, allow_null=True)
    correo_electronico = serializers.CharField(max_length=150, required=False, allow_blank=True, allow_null=True)
    documentos         = PersonaDocumentoWriteSerializer(many=True)

    def validate(self, data):
        if data.get('tipo_persona') == 'N' and not data.get('apellido_paterno'):
            raise serializers.ValidationError(
                {'apellido_paterno': 'Este campo es obligatorio para persona natural.'}
            )
        if not data.get('documentos'):
            raise serializers.ValidationError(
                {'documentos': 'Debe incluir al menos un documento de identidad.'}
            )
        return data


# ---------------------------------------------------------------------------
# Expediente — entrada (POST /expedientes/)
# ---------------------------------------------------------------------------

class ExpedienteCreateSerializer(serializers.Serializer):
    """
    Valida los datos de entrada para crear un expediente.

    numero_expediente  → opcional; si se omite o es nulo el sistema lo calcula.
    fecha_recepcion    → obligatorio; se usa para calcular plazos y correlativo.
    tipo_procedimiento_tupa_id → obligatorio; determina plazo y días de alerta.
    solicitante_id     → obligatorio.
    representante_id   → opcional.
    observaciones      → opcional.
    """

    numero_expediente = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=1,
    )
    fecha_recepcion = serializers.DateTimeField()
    tipo_procedimiento_tupa_id = serializers.IntegerField()
    solicitante_id = serializers.IntegerField()
    representante_id = serializers.IntegerField(required=False, allow_null=True)
    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=250,
    )


# ---------------------------------------------------------------------------
# Expediente — actualización (PUT /expedientes/<pk>/)
# ---------------------------------------------------------------------------

class ExpedienteUpdateSerializer(serializers.Serializer):
    """
    Valida los datos de entrada para modificar un expediente.

    tipo_procedimiento_tupa_id → obligatorio; puede cambiar el tipo de trámite,
                                  lo que fuerza el recálculo de plazos.
    numero_expediente          → obligatorio; número correlativo del expediente.
    fecha_recepcion            → obligatorio; se usa para recalcular plazos.
    solicitante_id             → obligatorio.
    representante_id           → opcional.
    observaciones              → opcional.

    Campos de auditoría (usuario, fecha_digitacion) y plazos calculados
    (fecha_vencimiento, fecha_alerta) se gestionan en la capa de servicio.
    """

    tipo_procedimiento_tupa_id = serializers.IntegerField()
    numero_expediente = serializers.IntegerField(min_value=1)
    fecha_recepcion = serializers.DateTimeField()
    solicitante_id = serializers.IntegerField()
    representante_id = serializers.IntegerField(required=False, allow_null=True)
    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=250,
    )


# ---------------------------------------------------------------------------
# Expediente — subida de archivos (POST /expedientes/<pk>/archivos/)
# ---------------------------------------------------------------------------

class ExpedienteArchivoUploadSerializer(serializers.Serializer):
    """
    Valida la subida de un archivo digital al expediente.

    El expediente_id viaja en la URL (pk).
    usuario y fecha_digitacion se obtienen del JWT y del servidor.
    """
    archivo = serializers.FileField()


class LicenciaFuncionamientoArchivoUploadSerializer(serializers.Serializer):
    """
    Valida la subida de un archivo digital a la licencia de funcionamiento.

    El ``licencia_funcionamiento_id`` viaja en la URL (pk).
    ``usuario`` y ``fecha_digitacion`` los asigna la capa de servicio.
    """
    archivo = serializers.FileField()


class ItseArchivoUploadSerializer(serializers.Serializer):
    """
    Valida la subida de un archivo digital al certificado ITSE.

    El ``itse_id`` viaja en la URL (pk).
    ``usuario`` y ``fecha_digitacion`` los asigna la capa de servicio.
    """
    archivo = serializers.FileField()


# ---------------------------------------------------------------------------
# Autorización improcedente — denegar licencia (POST /expedientes/<pk>/denegar-licencia/)
# ---------------------------------------------------------------------------

class DenegarLicenciaSerializer(serializers.Serializer):
    """
    Valida los datos de entrada para denegar la emisión de una licencia
    de funcionamiento.

    El expediente_id viaja en la URL (pk).
    tipo_autorizacion se fija en 'LF' en la capa de servicio.
    usuario y fecha_digitacion se obtienen del JWT y del servidor.
    """
    fecha_rechazo  = serializers.DateField()
    documento      = serializers.CharField(max_length=100)
    observaciones  = serializers.CharField(max_length=1000)


# ---------------------------------------------------------------------------
# Expediente — ampliación de plazo (POST /expedientes/<pk>/ampliacion-plazo/)
# ---------------------------------------------------------------------------

class AmpliacionPlazoSerializer(serializers.Serializer):
    """
    Valida los datos de entrada para registrar una ampliación de plazo.

    El id del expediente viaja en la URL (pk).
    La fecha de digitación y el usuario se obtienen del servidor y del JWT.
    """
    fecha_suspension  = serializers.DateField()
    dias_ampliacion   = serializers.IntegerField(min_value=1)
    motivo_ampliacion = serializers.CharField(max_length=250)


# ---------------------------------------------------------------------------
# Variantes ligeras (listados / exposición por UUID sin relaciones anidadas)
# ---------------------------------------------------------------------------


class ExpedienteListSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Expediente
        fields = (
            'id',
            'uuid',
            'numero_expediente',
            'fecha_recepcion',
            'fecha_vencimiento',
            'fecha_alerta',
            'tipo_procedimiento_tupa',
            'solicitante',
        )
        extra_kwargs = {'uuid': {'read_only': True}}


class LicenciaFuncionamientoListSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.LicenciaFuncionamiento
        fields = (
            'id',
            'uuid',
            'numero_licencia',
            'fecha_emision',
            'nombre_comercial',
            'titular',
            'expediente',
        )
        extra_kwargs = {'uuid': {'read_only': True}}


class ItseListSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Itse
        fields = (
            'id',
            'uuid',
            'numero_itse',
            'fecha_expedicion',
            'fecha_caducidad',
            'nombre_comercial',
            'titular',
            'expediente',
        )
        extra_kwargs = {'uuid': {'read_only': True}}


# ---------------------------------------------------------------------------
# Licencia de Funcionamiento — creación (POST /licencias-funcionamiento/)
# ---------------------------------------------------------------------------

class _GiroItemSerializer(serializers.Serializer):
    """Un ítem del listado de giros que se asocian a la licencia."""
    giro_id = serializers.IntegerField(min_value=1)


class ItseCreateSerializer(serializers.Serializer):
    """
    Valida el cuerpo para crear un ITSE (POST /itse/).

    ``usuario_id`` y ``fecha_digitacion`` no se aceptan del cliente: los asigna
    la capa de servicio con el usuario JWT y la hora del servidor.
    """

    TIPOS_ITSE_VALIDOS = {1, 2}  # 1 = ESTÁNDAR, 2 = RENOVACIÓN

    expediente_id = serializers.IntegerField(min_value=1)
    tipo_itse_id = serializers.IntegerField(min_value=1)
    numero_itse = serializers.IntegerField(min_value=1)
    fecha_expedicion = serializers.DateField()
    fecha_solicitud_renovacion = serializers.DateField()
    fecha_caducidad = serializers.DateField()
    titular_id = serializers.IntegerField(min_value=1)
    conductor_id = serializers.IntegerField(min_value=1)
    itse_principal_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    nombre_comercial = serializers.CharField(max_length=250)
    nivel_riesgo_id = serializers.IntegerField(min_value=1)
    direccion = serializers.CharField(max_length=250)
    resolucion_numero = serializers.CharField(max_length=50)
    area = serializers.DecimalField(max_digits=18, decimal_places=2)
    numero_recibo_pago = serializers.CharField(max_length=20)
    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    se_puede_publicar = serializers.BooleanField(default=False)
    capacidad_aforo = serializers.IntegerField(min_value=0)
    giros = _GiroItemSerializer(many=True, required=False, default=list)

    def validate_tipo_itse_id(self, value):
        if value not in self.TIPOS_ITSE_VALIDOS:
            raise serializers.ValidationError(
                'El tipo de ITSE no es válido. '
                'Los valores permitidos son: 1 (Estándar) y 2 (Renovación).'
            )
        return value


class ItseUpdateSerializer(ItseCreateSerializer):
    """
    Valida el cuerpo para modificar un ITSE (PUT ``/itse/<pk>/``).

    Mismos campos que ``ItseCreateSerializer``; el ``pk`` va en la URL.
    """


class LicenciaFuncionamientoCreateSerializer(serializers.Serializer):
    """
    Valida los datos de entrada para crear una licencia de funcionamiento.

    Reglas de validación cruzada
    ----------------------------
    - Si ``es_vigencia_indeterminada`` es ``True``, los campos
      ``fecha_inicio_vigencia`` y ``fecha_fin_vigencia`` se ignoran y se
      almacenan como ``None``.
    - Si ``es_vigencia_indeterminada`` es ``False``, ambas fechas son
      obligatorias y deben tener valores válidos.

    Campos de auditoría (``usuario``, ``fecha_digitacion``) se asignan
    automáticamente en la capa de servicio.
    """

    expediente_id            = serializers.IntegerField()
    tipo_licencia_id         = serializers.IntegerField()
    numero_licencia          = serializers.IntegerField(min_value=1)
    fecha_emision            = serializers.DateField()
    titular_id               = serializers.IntegerField()
    conductor_id             = serializers.IntegerField()
    licencia_principal_id    = serializers.IntegerField(required=False, allow_null=True)
    nombre_comercial         = serializers.CharField(max_length=250)
    es_vigencia_indeterminada = serializers.BooleanField()
    fecha_inicio_vigencia    = serializers.DateField(required=False, allow_null=True)
    fecha_fin_vigencia       = serializers.DateField(required=False, allow_null=True)
    nivel_riesgo_id          = serializers.IntegerField()
    actividad                = serializers.CharField(max_length=50)
    direccion                = serializers.CharField(max_length=250)
    hora_desde               = serializers.IntegerField()
    hora_hasta               = serializers.IntegerField()
    resolucion_numero        = serializers.CharField(max_length=50)
    zonificacion_id          = serializers.IntegerField()
    area                     = serializers.DecimalField(max_digits=18, decimal_places=2)
    numero_recibo_pago       = serializers.CharField(max_length=20)
    observaciones            = serializers.CharField(
                                   required=False,
                                   allow_blank=True,
                                   allow_null=True,
                               )
    se_puede_publicar        = serializers.BooleanField(default=False)
    giros                    = _GiroItemSerializer(many=True)

    def validate(self, data):
        if not data.get('es_vigencia_indeterminada'):
            if not data.get('fecha_inicio_vigencia'):
                raise serializers.ValidationError(
                    {'fecha_inicio_vigencia': 'Este campo es obligatorio cuando la vigencia no es indeterminada.'}
                )
            if not data.get('fecha_fin_vigencia'):
                raise serializers.ValidationError(
                    {'fecha_fin_vigencia': 'Este campo es obligatorio cuando la vigencia no es indeterminada.'}
                )
        return data


class LicenciaFuncionamientoUpdateSerializer(serializers.Serializer):
    """
    Valida los datos de entrada para modificar una licencia de funcionamiento.

    El ``licencia_funcionamiento_id`` se recibe en la URL (pk), no en el body.
    El ``expediente_id`` sí forma parte del body porque una licencia puede
    reasignarse a otro expediente.

    Reglas de validación cruzada
    ----------------------------
    Idénticas a ``LicenciaFuncionamientoCreateSerializer``:
    - Si ``es_vigencia_indeterminada`` es ``True``, las fechas de vigencia se
      anulan en la capa de servicio.
    - Si ``es_vigencia_indeterminada`` es ``False``, ambas fechas son
      obligatorias.

    Campos de auditoría (``usuario``, ``fecha_digitacion``) no se modifican.
    """

    expediente_id            = serializers.IntegerField()
    tipo_licencia_id         = serializers.IntegerField()
    numero_licencia          = serializers.IntegerField(min_value=1)
    fecha_emision            = serializers.DateField()
    titular_id               = serializers.IntegerField()
    conductor_id             = serializers.IntegerField()
    licencia_principal_id    = serializers.IntegerField(required=False, allow_null=True)
    nombre_comercial         = serializers.CharField(max_length=250)
    es_vigencia_indeterminada = serializers.BooleanField()
    fecha_inicio_vigencia    = serializers.DateField(required=False, allow_null=True)
    fecha_fin_vigencia       = serializers.DateField(required=False, allow_null=True)
    nivel_riesgo_id          = serializers.IntegerField()
    actividad                = serializers.CharField(max_length=50)
    direccion                = serializers.CharField(max_length=250)
    hora_desde               = serializers.IntegerField()
    hora_hasta               = serializers.IntegerField()
    resolucion_numero        = serializers.CharField(max_length=50)
    zonificacion_id          = serializers.IntegerField()
    area                     = serializers.DecimalField(max_digits=18, decimal_places=2)
    numero_recibo_pago       = serializers.CharField(max_length=20)
    observaciones            = serializers.CharField(
                                   required=False,
                                   allow_blank=True,
                                   allow_null=True,
                               )
    se_puede_publicar        = serializers.BooleanField(default=False)
    giros                    = _GiroItemSerializer(many=True)

    def validate(self, data):
        if not data.get('es_vigencia_indeterminada'):
            if not data.get('fecha_inicio_vigencia'):
                raise serializers.ValidationError(
                    {'fecha_inicio_vigencia': 'Este campo es obligatorio cuando la vigencia no es indeterminada.'}
                )
            if not data.get('fecha_fin_vigencia'):
                raise serializers.ValidationError(
                    {'fecha_fin_vigencia': 'Este campo es obligatorio cuando la vigencia no es indeterminada.'}
                )
        return data


class ItseNotificacionSerializer(serializers.Serializer):
    """
    Valida la fecha de notificación de entrega de un ITSE.

    El ``itse_id`` se recibe en la URL (pk), no en el body.
    """

    fecha_notificacion = serializers.DateTimeField()


class LicenciaFuncionamientoNotificacionSerializer(serializers.Serializer):
    """
    Valida la fecha de notificación de entrega de una licencia de funcionamiento.

    El ``licencia_funcionamiento_id`` se recibe en la URL (pk), no en el body.
    """

    fecha_notificacion = serializers.DateTimeField()


class ItseInactivarSerializer(serializers.Serializer):
    """
    Valida los datos para registrar la inactivación de un ITSE
    en ``itse_estados``.

    ``usuario_id`` y ``fecha_digitacion`` los asigna la capa de servicio.
    """

    itse_id       = serializers.IntegerField(min_value=1)
    estado_id     = serializers.IntegerField(min_value=1)
    fecha_estado  = serializers.DateField()
    documento     = serializers.CharField(max_length=100)
    observaciones = serializers.CharField(max_length=1000)


class LicenciaFuncionamientoInactivarSerializer(serializers.Serializer):
    """
    Valida los datos para registrar la inactivación de una licencia de
    funcionamiento en ``licencias_funcionamiento_estados``.

    ``usuario_id`` y ``fecha_digitacion`` los asigna la capa de servicio.
    """

    licencia_funcionamiento_id = serializers.IntegerField(min_value=1)
    estado_id                  = serializers.IntegerField(min_value=1)
    fecha_estado               = serializers.DateField()
    documento                  = serializers.CharField(max_length=100)
    observaciones              = serializers.CharField(max_length=1000)


class UsuarioPerfilSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.UsuarioPerfil
        fields = ['expedientes', 'licencias', 'itse', 'admin']


class UsuarioPerfilWriteSerializer(serializers.Serializer):
    """Permisos de acceso al sistema para un usuario."""

    expedientes = serializers.BooleanField(default=False)
    licencias   = serializers.BooleanField(default=False)
    itse        = serializers.BooleanField(default=False)
    admin       = serializers.BooleanField(default=False)


class UsuarioWriteSerializer(serializers.Serializer):
    """
    Serializer de entrada para crear y actualizar usuarios del sistema.

    - No expone ``is_superuser`` ni ``is_staff``.
    - ``password`` es obligatorio al crear; opcional al actualizar.
    - ``perfil`` (expedientes, licencias, itse, admin) se graba en UsuarioPerfil.
    """

    username   = serializers.CharField(max_length=150)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    last_name  = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    email      = serializers.EmailField(required=False, allow_blank=True, default='')
    is_active  = serializers.BooleanField(default=True)
    password   = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        min_length=6,
        style={'input_type': 'password'},
    )
    perfil = UsuarioPerfilWriteSerializer()

    def validate_username(self, value):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        instance_pk = self.context.get('instance_pk')
        qs = User.objects.filter(username=value)
        if instance_pk:
            qs = qs.exclude(pk=instance_pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un usuario con este nombre de usuario.')
        return value

    def validate(self, attrs):
        is_create = not self.context.get('instance_pk')
        password = attrs.get('password', '')
        if is_create and not password:
            raise serializers.ValidationError({'password': 'La contraseña es obligatoria al crear un usuario.'})
        return attrs


class CambiarPasswordSerializer(serializers.Serializer):
    """Valida los datos para cambiar la contraseña de un usuario."""

    password     = serializers.CharField(write_only=True, min_length=6, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, min_length=6, style={'input_type': 'password'})

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Las contraseñas no coinciden.'})
        return attrs


class LicenciasFuncionamientoReporteQuerySerializer(serializers.Serializer):
    """
    Valida los parámetros de consulta (query params) del reporte de licencias
    de funcionamiento.  Todos los campos son opcionales.

    Los rangos de fechas (emision, vigencia, fecha_notificacion) solo se aplican
    cuando ambos extremos están presentes.
    """
    numero_licencia              = serializers.IntegerField(required=False, min_value=1)
    numero_expediente            = serializers.IntegerField(required=False, min_value=1)
    anio_expediente              = serializers.IntegerField(required=False, min_value=1900)
    emision_desde                = serializers.DateField(required=False)
    emision_hasta                = serializers.DateField(required=False)
    titular_nombre               = serializers.CharField(required=False, max_length=100)
    titular_numero_documento     = serializers.CharField(required=False, max_length=20)
    conductor_nombre             = serializers.CharField(required=False, max_length=100)
    conductor_numero_documento   = serializers.CharField(required=False, max_length=20)
    nombre_comercial             = serializers.CharField(required=False, max_length=250)
    vigencia_desde               = serializers.DateField(required=False)
    vigencia_hasta               = serializers.DateField(required=False)
    nivel_riesgo_id              = serializers.IntegerField(required=False, min_value=1)
    direccion                    = serializers.CharField(required=False, max_length=250)
    zonificacion_id              = serializers.IntegerField(required=False, min_value=1)
    numero_recibo_pago           = serializers.CharField(required=False, max_length=20)
    fecha_notificacion_desde     = serializers.DateField(required=False)
    fecha_notificacion_hasta     = serializers.DateField(required=False)
    esta_activo                  = serializers.BooleanField(required=False, allow_null=True)
    giro_nombre                  = serializers.CharField(required=False, max_length=100)


class LicenciasFuncionamientoConsultaQuerySerializer(serializers.Serializer):
    """
    Valida los parámetros de consulta del endpoint de búsqueda de licencias
    de funcionamiento.

    Al menos uno de los campos debe estar presente.
    """

    titular_nombre             = serializers.CharField(required=False, max_length=200)
    numero_licencia            = serializers.IntegerField(required=False, min_value=1)
    anio_licencia              = serializers.IntegerField(required=False, min_value=1900)
    titular_numero_documento   = serializers.CharField(required=False, max_length=20)
    conductor_numero_documento = serializers.CharField(required=False, max_length=20)

    def validate(self, attrs):
        _FILTROS = [
            'titular_nombre',
            'numero_licencia',
            'anio_licencia',
            'titular_numero_documento',
            'conductor_numero_documento',
        ]
        if not any(attrs.get(f) for f in _FILTROS):
            raise serializers.ValidationError(
                'Debe proporcionar al menos un filtro de búsqueda.'
            )
        return attrs


class ExpedienteConsultaQuerySerializer(serializers.Serializer):
    """
    Valida los parámetros de consulta del endpoint de búsqueda de expedientes.

    Al menos uno de los campos debe estar presente.
    """

    solicitante_nombre             = serializers.CharField(required=False, max_length=200)
    numero_expediente              = serializers.IntegerField(required=False, min_value=1)
    anio_expediente                = serializers.IntegerField(required=False, min_value=1900)
    solicitante_numero_documento   = serializers.CharField(required=False, max_length=20)
    representante_numero_documento = serializers.CharField(required=False, max_length=20)

    def validate(self, attrs):
        _FILTROS = [
            'solicitante_nombre',
            'numero_expediente',
            'anio_expediente',
            'solicitante_numero_documento',
            'representante_numero_documento',
        ]
        if not any(attrs.get(f) for f in _FILTROS):
            raise serializers.ValidationError(
                'Debe proporcionar al menos un filtro de búsqueda.'
            )
        return attrs


class ItseConsultaQuerySerializer(serializers.Serializer):
    """
    Valida los parámetros de consulta del endpoint de búsqueda de ITSE.

    Al menos uno de los campos debe estar presente.
    """

    titular_nombre             = serializers.CharField(required=False, max_length=200)
    numero_itse                = serializers.IntegerField(required=False, min_value=1)
    anio_itse                  = serializers.IntegerField(required=False, min_value=1900)
    titular_numero_documento   = serializers.CharField(required=False, max_length=20)
    conductor_numero_documento = serializers.CharField(required=False, max_length=20)

    def validate(self, attrs):
        _FILTROS = [
            'titular_nombre',
            'numero_itse',
            'anio_itse',
            'titular_numero_documento',
            'conductor_numero_documento',
        ]
        if not any(attrs.get(f) for f in _FILTROS):
            raise serializers.ValidationError(
                'Debe proporcionar al menos un filtro de búsqueda.'
            )
        return attrs


class UsuarioSerializer(serializers.ModelSerializer):
    """
    Serializa la información del usuario autenticado excluyendo el password.
    Incluye el perfil de permisos del sistema (``UsuarioPerfil``).
    """

    nombre_completo = serializers.SerializerMethodField()
    perfil          = UsuarioPerfilSerializer(source='perfil_lf_itse', read_only=True)

    class Meta:
        model  = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'nombre_completo',
            'email',
            'is_active',
            'is_staff',
            'is_superuser',
            'date_joined',
            'last_login',
            'perfil',
        ]

    def get_nombre_completo(self, obj):
        return obj.get_full_name() or obj.username
