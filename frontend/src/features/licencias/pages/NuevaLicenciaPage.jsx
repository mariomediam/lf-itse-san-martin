import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import TopBar from '@components/layout/TopBar'
import SideMenu from '@components/layout/SideMenu'
import SelectorPersona from '@features/expedientes/components/SelectorPersona'
import AgregarGiroModal from '../components/AgregarGiroModal'
import { dashboardApi } from '@api/dashboardApi'
import { licenciasApi } from '@api/licenciasApi'
import { itseApi } from '@api/itseApi'
import { personasApi } from '@api/personasApi'
import useLicenciasStore from '@store/licenciasStore'

// ── Clases reutilizables ───────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ' +
  'disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400'

const selectClass = inputClass

// ── Sección card ──────────────────────────────────────────────────────────────

function SeccionCard({ icono, titulo, children }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-primary">{icono}</span>
        <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IconoDocumento = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const IconoPersonas = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const IconoEstablecimiento = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)

const IconoGiros = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

const IconoTexto = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildPersonaOption = (persona) => ({
  value: persona.id,
  label: persona.persona_nombre,
  data:  persona,
})

// ── Página ────────────────────────────────────────────────────────────────────

export default function NuevaLicenciaPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { setBusqueda } = useLicenciasStore()

  // Datos del expediente recibidos del modal anterior
  const { expedienteId, numeroExpediente, anio } = location.state ?? {}

  // Redirigir si no hay expedienteId (acceso directo sin pasar por el modal)
  useEffect(() => {
    if (!expedienteId) navigate('/licencias-funcionamiento', { replace: true })
  }, [expedienteId, navigate])

  // Layout
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [menus,       setMenus]       = useState([])

  // Catálogos
  const [tiposLicencia,  setTiposLicencia]  = useState([])
  const [nivelesRiesgo,  setNivelesRiesgo]  = useState([])
  const [zonificaciones, setZonificaciones] = useState([])
  const [loadingCatalogos, setLoadingCatalogos] = useState(true)

  // Datos principales
  const [numeroLicencia,       setNumeroLicencia]       = useState('')
  const [fechaEmision,         setFechaEmision]         = useState('')
  const [esVigenciaIndeter,    setEsVigenciaIndeter]    = useState(true)
  const [fechaInicioVigencia,  setFechaInicioVigencia]  = useState('')
  const [fechaFinVigencia,     setFechaFinVigencia]     = useState('')
  const [tipoLicenciaId,       setTipoLicenciaId]       = useState('')
  const [resolucionNumero,     setResolucionNumero]      = useState('')
  const [nivelRiesgoId,        setNivelRiesgoId]        = useState('')
  const [horaDesde,            setHoraDesde]            = useState('')
  const [horaHasta,            setHoraHasta]            = useState('')
  const [numeroReciboPago,     setNumeroReciboPago]     = useState('')

  // Titular y representante legal
  const [titular,      setTitular]      = useState(null)
  const [representante, setRepresentante] = useState(null)

  // Establecimiento
  const [nombreComercial, setNombreComercial] = useState('')
  const [actividad,       setActividad]       = useState('')
  const [direccion,       setDireccion]       = useState('')
  const [zonificacionId,  setZonificacionId]  = useState('')
  const [area,            setArea]            = useState('')

  // Giros
  const [giros,            setGiros]            = useState([])
  const [modalGiroAbierto, setModalGiroAbierto] = useState(false)

  // Observaciones
  const [observaciones, setObservaciones] = useState('')

  // Submit
  const [submitting, setSubmitting] = useState(false)

  // Precarga desde ITSE
  const [loadingItse, setLoadingItse] = useState(false)

  // ── Carga inicial ────────────────────────────────────────────────────────────

  useEffect(() => {
    dashboardApi.getMenusUsuario()
      .then((res) => setMenus(res.data))
      .catch(() => toast.error('Error al cargar el menú'))
  }, [])

  useEffect(() => {
    setLoadingCatalogos(true)
    Promise.all([
      licenciasApi.getTiposLicencia(),
      licenciasApi.getNivelesRiesgo(),
      licenciasApi.getZonificaciones(),
    ])
      .then(([tipos, niveles, zonas]) => {
        setTiposLicencia(tipos.data)
        setNivelesRiesgo(niveles.data)
        setZonificaciones(zonas.data)
      })
      .catch(() => toast.error('Error al cargar los catálogos'))
      .finally(() => setLoadingCatalogos(false))
  }, [])

  // ── Precarga desde ITSE existente ────────────────────────────────────────────

  useEffect(() => {
    if (!expedienteId) return

    let active = true
    setLoadingItse(true)

    itseApi.buscar('EXPEDIENTE_ID', expedienteId)
      .then(async (res) => {
        if (!active) return
        if (!res.data || res.data.length === 0) return

        const itse = res.data[0]

        setNivelRiesgoId(String(itse.nivel_riesgo_id))
        setNumeroReciboPago(itse.numero_recibo_pago ?? '')
        setNombreComercial(itse.nombre_comercial ?? '')
        setDireccion(itse.direccion ?? '')
        setArea(itse.area != null ? String(itse.area) : '')

        const [resTitular, resRep, resGiros] = await Promise.all([
          personasApi.buscar('ID', itse.titular_id),
          itse.conductor_id
            ? personasApi.buscar('ID', itse.conductor_id)
            : Promise.resolve(null),
          itseApi.getGiros(itse.id),
        ])

        if (!active) return

        if (resTitular.data[0]) setTitular(buildPersonaOption(resTitular.data[0]))
        if (resRep?.data[0])    setRepresentante(buildPersonaOption(resRep.data[0]))

        if (resGiros.data.length > 0) {
          setGiros(resGiros.data.map((g) => ({
            id:      g.giro_id,
            ciiu_id: g.ciiu_id,
            nombre:  g.nombre,
          })))
        }

        toast.info('Se precargaron datos de la ITSE existente para este expediente')
      })
      .catch(() => {})
      .finally(() => { if (active) setLoadingItse(false) })

    return () => { active = false }
  }, [expedienteId])

  // ── Giros ────────────────────────────────────────────────────────────────────

  const handleAgregarGiro = (giro) => {
    if (giros.find((g) => g.id === giro.id)) return
    setGiros((prev) => [...prev, giro])
  }

  const handleEliminarGiro = (giroId) => {
    setGiros((prev) => prev.filter((g) => g.id !== giroId))
  }

  // ── Envío del formulario ─────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!numeroLicencia)   { toast.error('Ingrese el número de licencia');             return }
    if (!fechaEmision)     { toast.error('Ingrese la fecha de emisión');               return }
    if (!tipoLicenciaId)   { toast.error('Seleccione el tipo de licencia');            return }
    if (!resolucionNumero) { toast.error('Ingrese el número de resolución');           return }
    if (!nivelRiesgoId)    { toast.error('Seleccione el nivel de riesgo');             return }
    if (!horaDesde)        { toast.error('Ingrese la hora de inicio del horario');     return }
    if (!horaHasta)        { toast.error('Ingrese la hora de cierre del horario');     return }
    if (!numeroReciboPago) { toast.error('Ingrese el número de recibo de pago');       return }
    if (!titular)          { toast.error('Seleccione el titular de la licencia');      return }
    if (!representante)    { toast.error('Seleccione el representante legal');         return }
    if (!nombreComercial)  { toast.error('Ingrese el nombre comercial');               return }
    if (!actividad)        { toast.error('Ingrese la actividad económica');            return }
    if (!direccion)        { toast.error('Ingrese la dirección del local');            return }
    if (!zonificacionId)   { toast.error('Seleccione la zonificación');               return }
    if (!area)             { toast.error('Ingrese el área del establecimiento');       return }

    if (!esVigenciaIndeter) {
      if (!fechaInicioVigencia) { toast.error('Ingrese la fecha de inicio de vigencia'); return }
      if (!fechaFinVigencia)    { toast.error('Ingrese la fecha de fin de vigencia');    return }
    }

    if (giros.length === 0) {
      toast.error('Agregue al menos un giro autorizado')
      return
    }

    const payload = {
      expediente_id:           expedienteId,
      tipo_licencia_id:        Number(tipoLicenciaId),
      numero_licencia:         Number(numeroLicencia),
      fecha_emision:           fechaEmision,
      titular_id:              titular.data.id,
      conductor_id:            representante.data.id,
      licencia_principal_id:   null,
      nombre_comercial:        nombreComercial.trim(),
      es_vigencia_indeterminada: esVigenciaIndeter,
      fecha_inicio_vigencia:   esVigenciaIndeter ? null : fechaInicioVigencia,
      fecha_fin_vigencia:      esVigenciaIndeter ? null : fechaFinVigencia,
      nivel_riesgo_id:         Number(nivelRiesgoId),
      actividad:               actividad.trim(),
      direccion:               direccion.trim(),
      hora_desde:              Number(horaDesde),
      hora_hasta:              Number(horaHasta),
      resolucion_numero:       resolucionNumero.trim(),
      zonificacion_id:         Number(zonificacionId),
      area:                    area,
      numero_recibo_pago:      numeroReciboPago.trim(),
      observaciones:           observaciones.trim() || null,
      se_puede_publicar:       false,
      giros:                   giros.map((g) => ({ giro_id: g.id })),
    }

    setSubmitting(true)
    try {
      const res = await licenciasApi.crear(payload)
      setBusqueda('ID', String(res.data.id))
      toast.success('Licencia de funcionamiento creada correctamente')
      navigate('/licencias-funcionamiento')
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al crear la licencia'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!expedienteId) return null

  return (
    <div className="flex flex-col h-screen bg-neutral">
      <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1 overflow-hidden">
        <SideMenu menus={menus} isOpen={sidebarOpen} />

        <main className="flex-1 overflow-y-auto p-6">

          {/* Enlace de regreso */}
          <button
            type="button"
            onClick={() => navigate('/licencias-funcionamiento')}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al listado
          </button>

          {/* Título */}
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Registro de nueva licencia de funcionamiento
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Expediente N° {String(numeroExpediente).padStart(4, '0')}-{anio} — Continúa el proceso de emisión de Licencia de
            Funcionamiento completando los datos requeridos
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">

            {/* ── Datos principales ────────────────────────────────────── */}
            <SeccionCard icono={IconoDocumento} titulo="Datos principales">
              <div className="space-y-4">

                {/* Fila 1: Número, Fecha emisión, Vigencia */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Número de licencia <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={numeroLicencia}
                      onChange={(e) => setNumeroLicencia(e.target.value)}
                      placeholder="Ej. 275"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Fecha de emisión <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      value={fechaEmision}
                      onChange={(e) => setFechaEmision(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Vigencia
                    </label>
                    <div className="flex items-center gap-3 h-[38px]">
                      {/* Toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={esVigenciaIndeter}
                        onClick={() => {
                          setEsVigenciaIndeter((v) => !v)
                          setFechaInicioVigencia('')
                          setFechaFinVigencia('')
                        }}
                        className={[
                          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                          'transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30',
                          esVigenciaIndeter ? 'bg-primary' : 'bg-gray-300',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
                            'transform transition duration-200',
                            esVigenciaIndeter ? 'translate-x-5' : 'translate-x-0',
                          ].join(' ')}
                        />
                      </button>
                      <span className="text-sm font-medium text-gray-700">
                        {esVigenciaIndeter ? 'INDETERMINADA' : 'DETERMINADA'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fechas de vigencia (solo si es determinada) */}
                {!esVigenciaIndeter && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Fecha inicio vigencia <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        value={fechaInicioVigencia}
                        onChange={(e) => setFechaInicioVigencia(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Fecha fin vigencia <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        value={fechaFinVigencia}
                        onChange={(e) => setFechaFinVigencia(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                {/* Fila 2: Tipo, Resolución */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Tipo <span className="text-danger">*</span>
                    </label>
                    <select
                      value={tipoLicenciaId}
                      onChange={(e) => setTipoLicenciaId(e.target.value)}
                      disabled={loadingCatalogos}
                      className={selectClass}
                    >
                      <option value="">
                        {loadingCatalogos ? 'Cargando...' : 'Seleccione un tipo'}
                      </option>
                      {tiposLicencia.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Resolución <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={resolucionNumero}
                      onChange={(e) => setResolucionNumero(e.target.value)}
                      placeholder="Ej. 023-2026-RG/MDV"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Fila 3: Nivel riesgo, Horario, Recibo */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Nivel de riesgo <span className="text-danger">*</span>
                    </label>
                    <select
                      value={nivelRiesgoId}
                      onChange={(e) => setNivelRiesgoId(e.target.value)}
                      disabled={loadingCatalogos}
                      className={selectClass}
                    >
                      <option value="">
                        {loadingCatalogos ? 'Cargando...' : 'Seleccione'}
                      </option>
                      {nivelesRiesgo.map((n) => (
                        <option key={n.id} value={n.id}>{n.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Hora desde <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={horaDesde}
                      onChange={(e) => setHoraDesde(e.target.value)}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Hora hasta <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={horaHasta}
                      onChange={(e) => setHoraHasta(e.target.value)}
                      placeholder="23"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      N° de recibo de pago <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={numeroReciboPago}
                      onChange={(e) => setNumeroReciboPago(e.target.value)}
                      placeholder="Ej. 00567587"
                      className={inputClass}
                    />
                  </div>
                </div>

              </div>
            </SeccionCard>

            {/* ── Titular y representante legal ────────────────────────── */}
            <SeccionCard icono={IconoPersonas} titulo="Datos del titular y representante legal">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectorPersona
                  label="Titular de la licencia"
                  required
                  value={titular}
                  onChange={setTitular}
                />
                <SelectorPersona
                  label="Representante legal"
                  required
                  value={representante}
                  onChange={setRepresentante}
                />
              </div>
            </SeccionCard>

            {/* ── Información del establecimiento ──────────────────────── */}
            <SeccionCard icono={IconoEstablecimiento} titulo="Información del establecimiento">
              <div className="space-y-4">

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Nombre comercial <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={nombreComercial}
                    onChange={(e) => setNombreComercial(e.target.value)}
                    placeholder="Ej. CAFETERIA EL ARTESANO"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Actividad económica <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={actividad}
                    onChange={(e) => setActividad(e.target.value)}
                    placeholder="Ej. Servicio de expendio de comidas y bebidas"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Dirección del local <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Ej. Av. Las Camelias 782 - Oficina 402 - San Isidro - Lima"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Zonificación <span className="text-danger">*</span>
                    </label>
                    <select
                      value={zonificacionId}
                      onChange={(e) => setZonificacionId(e.target.value)}
                      disabled={loadingCatalogos}
                      className={selectClass}
                    >
                      <option value="">
                        {loadingCatalogos ? 'Cargando...' : 'Seleccione una zonificación'}
                      </option>
                      {zonificaciones.map((z) => (
                        <option key={z.id} value={z.id}>{z.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Área (M²) <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                </div>

              </div>
            </SeccionCard>

            {/* ── Giros autorizados ─────────────────────────────────────── */}
            <SeccionCard icono={IconoGiros} titulo="Giros autorizados">
              <div className="space-y-3">

                {/* Botón añadir */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setModalGiroAbierto(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white
                               text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Añadir giro
                  </button>
                </div>

                {/* Lista de giros seleccionados */}
                {giros.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {giros.map((g) => (
                      <span
                        key={g.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10
                                   text-primary text-xs font-medium rounded-full border border-primary/20"
                      >
                        {g.ciiu_id ? `${g.ciiu_id} - ` : ''}{g.nombre}
                        <button
                          type="button"
                          onClick={() => handleEliminarGiro(g.id)}
                          className="hover:text-danger transition-colors"
                          aria-label={`Quitar ${g.nombre}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
                    No se han agregado giros. Haga clic en "Añadir giro" para agregar.
                  </p>
                )}

              </div>
            </SeccionCard>

            {/* ── Observaciones ────────────────────────────────────────── */}
            <SeccionCard icono={IconoTexto} titulo="Observaciones">
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={4}
                placeholder="Ingrese observaciones (opcional)..."
                className={`${inputClass} resize-y`}
              />
            </SeccionCard>

            {/* ── Botones ──────────────────────────────────────────────── */}
            <div className="flex justify-end gap-3 pb-4">
              <button
                type="button"
                onClick={() => navigate('/licencias-funcionamiento')}
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg
                           text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg
                           text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {submitting ? 'Guardando...' : 'Crear licencia'}
              </button>
            </div>

          </form>

        </main>
      </div>

      {/* Modal para agregar giro */}
      <AgregarGiroModal
        isOpen={modalGiroAbierto}
        onClose={() => setModalGiroAbierto(false)}
        girosYaAgregados={giros.map((g) => g.id)}
        onAgregarGiro={handleAgregarGiro}
      />

    </div>
  )
}
