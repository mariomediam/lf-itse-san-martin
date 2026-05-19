import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import TopBar from '@components/layout/TopBar'
import SideMenu from '@components/layout/SideMenu'
import { dashboardApi } from '@api/dashboardApi'
import { licenciasApi } from '@api/licenciasApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatFecha = (v) => {
  if (!v) return '-'
  const d = new Date(String(v).slice(0, 10) + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const formatHora = (v) => {
  if (!v) return null
  return String(v).slice(0, 5)
}

const FILTROS_AVANZADOS_VACIO = {
  numero_expediente:         '',
  anio_expediente:           '',
  emision_desde:             '',
  emision_hasta:             '',
  titular_nombre:            '',
  titular_numero_documento:  '',
  conductor_nombre:          '',
  conductor_numero_documento:'',
  nombre_comercial:          '',
  nivel_riesgo_id:           '',
  direccion:                 '',
  zonificacion_id:           '',
  numero_recibo_pago:        '',
  fecha_notificacion_desde:  '',
  fecha_notificacion_hasta:  '',
  esta_activo:               '',
  giro_nombre:               '',
}

// ── EstadoBadge ───────────────────────────────────────────────────────────────

function EstadoBadge({ activo }) {
  return activo ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                     font-medium bg-green-100 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
      Activa
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                     font-medium bg-red-100 text-red-700">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
      Inactiva
    </span>
  )
}

// ── Campo auxiliar para la card ───────────────────────────────────────────────

function Campo({ label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-1 text-xs">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span className="text-gray-700">{value}</span>
    </div>
  )
}

// ── Card de licencia (layout horizontal) ─────────────────────────────────────

function LicenciaCard({ lic }) {
  const horario =
    formatHora(lic.hora_desde) && formatHora(lic.hora_hasta)
      ? `${formatHora(lic.hora_desde)} – ${formatHora(lic.hora_hasta)}`
      : null

  const vigencia = lic.es_vigencia_indeterminada
    ? 'Indeterminada'
    : lic.fecha_inicio_vigencia && lic.fecha_fin_vigencia
      ? `${formatFecha(lic.fecha_inicio_vigencia)} al ${formatFecha(lic.fecha_fin_vigencia)}`
      : null

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden print-card">

      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5
                      bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary">N.° {lic.numero_licencia}</span>
          <EstadoBadge activo={lic.esta_activo} />
          {lic.nivel_riesgo_nombre && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs
                             font-medium bg-orange-50 text-orange-700 border border-orange-200">
              {lic.nivel_riesgo_nombre}
            </span>
          )}
          {lic.zonificacion_nombre && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                             text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              {lic.zonificacion_codigo && <span className="font-bold">{lic.zonificacion_codigo}</span>}
              {lic.zonificacion_nombre}
            </span>
          )}
        </div>
        <div className="text-right shrink-0 text-xs text-gray-500">
          <span>Exp. {lic.numero_expediente}</span>
          {lic.fecha_recepcion && (
            <span className="ml-2 text-gray-400">{formatFecha(lic.fecha_recepcion)}</span>
          )}
        </div>
      </div>

      {/* ── Cuerpo en 3 columnas ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">

        {/* Columna 1 — Establecimiento */}
        <div className="px-4 py-3 flex flex-col gap-1.5">
          {lic.nombre_comercial && (
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {lic.nombre_comercial}
            </p>
          )}
          {lic.direccion && (
            <p className="text-xs text-gray-500">{lic.direccion}</p>
          )}
          {lic.giro_concatenado && (
            <div className="mt-1">
              <p className="text-xs font-medium text-gray-500 mb-0.5">Giros</p>
              <p className="text-xs text-gray-700 leading-snug">{lic.giro_concatenado}</p>
            </div>
          )}
          {
            lic.actividad_nombre && (
              <div className="mt-1">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Actividad</p>
                <p className="text-xs text-gray-700 leading-snug">{lic.actividad_nombre}</p>
              </div>
            )
          }
        </div>

        {/* Columna 2 — Titular y conductor */}
        <div className="px-4 py-3 flex flex-col gap-1.5">
          <Campo label="Titular"   value={lic.titular_nombre} />
          <Campo label="Doc."      value={lic.titular_documentos_concatenados} />
          {lic.conductor_nombre?.trim() && (
            <>
              <div className="mt-1 pt-1 border-t border-gray-100" />
              <Campo label="Conductor" value={lic.conductor_nombre} />
              <Campo label="Doc."      value={lic.conductor_documentos_concatenados} />
            </>
          )}
        </div>

        {/* Columna 3 — Detalles de la licencia */}
        <div className="px-4 py-3 flex flex-col gap-1">
          <Campo label="Emisión"    value={formatFecha(lic.fecha_emision)} />
          <Campo label="Vigencia"   value={vigencia} />
          <Campo label="Horario"    value={horario} />
          {lic.tipos_procedimiento_tupa_nombre && (
            <Campo label="TUPA"     value={lic.tipos_procedimiento_tupa_nombre} />
          )}
          <Campo label="Área"        value={lic.area} />
          <Campo label="Resolución" value={lic.resolucion_numero} />
          <Campo label="Recibo"     value={lic.numero_recibo_pago} />
          {lic.fecha_notificacion && (
            <Campo label="Notificación" value={formatFecha(lic.fecha_notificacion)} />
          )}
        </div>

      </div>
    </div>
  )
}

// ── Filtros avanzados agrupados ───────────────────────────────────────────────

function FiltrosAvanzados({ filtros, onChange, nivelesRiesgo, zonificaciones }) {
  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1'

  const grupos = [
    {
      titulo: 'Fechas de la licencia',
      campos: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Emisión desde</label>
            <input type="date" name="emision_desde" value={filtros.emision_desde}
              onChange={onChange} className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Emisión hasta</label>
            <input type="date" name="emision_hasta" value={filtros.emision_hasta}
              onChange={onChange} className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Notificación desde</label>
            <input type="date" name="fecha_notificacion_desde" value={filtros.fecha_notificacion_desde}
              onChange={onChange} className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Notificación hasta</label>
            <input type="date" name="fecha_notificacion_hasta" value={filtros.fecha_notificacion_hasta}
              onChange={onChange} className={inputCls} />
          </div>
        </div>
      ),
    },
    {
      titulo: 'Características de la licencia',
      campos: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Nivel de riesgo</label>
            <select name="nivel_riesgo_id" value={filtros.nivel_riesgo_id}
              onChange={onChange} className={inputCls}>
              <option value="">Todos</option>
              {nivelesRiesgo.map((n) => (
                <option key={n.id} value={n.id}>{n.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Zonificación</label>
            <select name="zonificacion_id" value={filtros.zonificacion_id}
              onChange={onChange} className={inputCls}>
              <option value="">Todas</option>
              {zonificaciones.map((z) => (
                <option key={z.id} value={z.id}>{z.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>N.° Recibo de pago</label>
            <input type="text" name="numero_recibo_pago" value={filtros.numero_recibo_pago}
              onChange={onChange} placeholder="Número exacto..." className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Estado</label>
            <select name="esta_activo" value={filtros.esta_activo}
              onChange={onChange} className={inputCls}>
              <option value="">Todas</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </select>
          </div>
        </div>
      ),
    },
    {
      titulo: 'Titular y conductor',
      campos: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Nombre del titular</label>
            <input type="text" name="titular_nombre" value={filtros.titular_nombre}
              onChange={onChange} placeholder="Apellidos o nombres..." className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Doc. del titular</label>
            <input type="text" name="titular_numero_documento" value={filtros.titular_numero_documento}
              onChange={onChange} placeholder="DNI, RUC u otro..." className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Nombre del conductor</label>
            <input type="text" name="conductor_nombre" value={filtros.conductor_nombre}
              onChange={onChange} placeholder="Apellidos o nombres..." className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Doc. del conductor</label>
            <input type="text" name="conductor_numero_documento" value={filtros.conductor_numero_documento}
              onChange={onChange} placeholder="DNI, RUC u otro..." className={inputCls} />
          </div>
        </div>
      ),
    },
    {
      titulo: 'Expediente y establecimiento',
      campos: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>N.° Expediente</label>
            <input type="number" name="numero_expediente" value={filtros.numero_expediente}
              onChange={onChange} placeholder="Ej. 47" min={1} className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Año del expediente</label>
            <input type="number" name="anio_expediente" value={filtros.anio_expediente}
              onChange={onChange} placeholder="Ej. 2024" min={1900} className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Dirección</label>
            <input type="text" name="direccion" value={filtros.direccion}
              onChange={onChange} placeholder="Jr., Av., calle..." className={inputCls} />
          </div>
          <div>
            <label className={lbl}>Giro</label>
            <input type="text" name="giro_nombre" value={filtros.giro_nombre}
              onChange={onChange} placeholder="Nombre del giro..." className={inputCls} />
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 items-start">
      {grupos.map((g) => (
        <div key={g.titulo} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            {g.titulo}
          </p>
          {g.campos}
        </div>
      ))}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function ReporteLicenciasPage() {
  const [sidebarOpen,           setSidebarOpen]           = useState(true)
  const [menus,                 setMenus]                 = useState([])
  const [busquedaRapida,        setBusquedaRapida]        = useState('')
  const [filtros,               setFiltros]               = useState(FILTROS_AVANZADOS_VACIO)
  const [mostrarAvanzados,      setMostrarAvanzados]      = useState(false)
  const [licencias,             setLicencias]             = useState([])
  const [loading,               setLoading]               = useState(false)
  const [buscado,               setBuscado]               = useState(false)
  const [nivelesRiesgo,         setNivelesRiesgo]         = useState([])
  const [zonificaciones,        setZonificaciones]        = useState([])

  useEffect(() => {
    dashboardApi.getMenusUsuario()
      .then((res) => setMenus(res.data))
      .catch(() => toast.error('Error al cargar el menú'))

    licenciasApi.getNivelesRiesgo()
      .then((res) => setNivelesRiesgo(res.data))
      .catch(() => {})

    licenciasApi.getZonificaciones()
      .then((res) => setZonificaciones(res.data))
      .catch(() => {})
  }, [])

  const handleChangeFiltros = (e) => {
    const { name, value } = e.target
    setFiltros((prev) => ({ ...prev, [name]: value }))
  }

  const buildParams = () => {
    const params = {}

    // Búsqueda rápida: número → numero_licencia, texto → nombre_comercial
    const q = busquedaRapida.trim()
    if (q) {
      if (/^\d+$/.test(q)) {
        params.numero_licencia = parseInt(q, 10)
      } else {
        params.nombre_comercial = q
      }
    }

    // Filtros avanzados (solo si tienen valor)
    if (filtros.numero_expediente)         params.numero_expediente         = parseInt(filtros.numero_expediente, 10)
    if (filtros.anio_expediente)           params.anio_expediente           = parseInt(filtros.anio_expediente, 10)
    if (filtros.emision_desde)             params.emision_desde             = filtros.emision_desde
    if (filtros.emision_hasta)             params.emision_hasta             = filtros.emision_hasta
    if (filtros.titular_nombre.trim())     params.titular_nombre            = filtros.titular_nombre.trim()
    if (filtros.titular_numero_documento.trim()) params.titular_numero_documento = filtros.titular_numero_documento.trim()
    if (filtros.conductor_nombre.trim())   params.conductor_nombre          = filtros.conductor_nombre.trim()
    if (filtros.conductor_numero_documento.trim()) params.conductor_numero_documento = filtros.conductor_numero_documento.trim()
    if (filtros.nombre_comercial.trim() && !params.nombre_comercial)
                                           params.nombre_comercial          = filtros.nombre_comercial.trim()
    if (filtros.nivel_riesgo_id)           params.nivel_riesgo_id           = parseInt(filtros.nivel_riesgo_id, 10)
    if (filtros.direccion.trim())          params.direccion                 = filtros.direccion.trim()
    if (filtros.zonificacion_id)           params.zonificacion_id           = parseInt(filtros.zonificacion_id, 10)
    if (filtros.numero_recibo_pago.trim()) params.numero_recibo_pago        = filtros.numero_recibo_pago.trim()
    if (filtros.fecha_notificacion_desde)  params.fecha_notificacion_desde  = filtros.fecha_notificacion_desde
    if (filtros.fecha_notificacion_hasta)  params.fecha_notificacion_hasta  = filtros.fecha_notificacion_hasta
    if (filtros.esta_activo !== '')        params.esta_activo               = filtros.esta_activo
    if (filtros.giro_nombre.trim())        params.giro_nombre               = filtros.giro_nombre.trim()

    return params
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const params = buildParams()

    setLoading(true)
    setBuscado(true)
    try {
      const res = await licenciasApi.consultar(params)
      setLicencias(res.data)
    } catch (error) {
      const msg = error.response?.data?.error || 'Error al consultar licencias'
      toast.error(msg)
      setLicencias([])
    } finally {
      setLoading(false)
    }
  }

  const handleLimpiar = () => {
    setBusquedaRapida('')
    setFiltros(FILTROS_AVANZADOS_VACIO)
    setLicencias([])
    setBuscado(false)
  }

  const handleImprimir = () => window.print()

  const handleExportarExcel = () => {
    if (licencias.length === 0) return

    const datos = licencias.map((lic) => ({
      'N.° Licencia':             lic.numero_licencia,
      'N.° Expediente':           lic.numero_expediente,
      'Fecha Emisión':            formatFecha(lic.fecha_emision),
      'TUPA':                     lic.tipos_procedimiento_tupa_nombre || '',
      'Nombre Comercial':         lic.nombre_comercial     || '',
      'Dirección':                lic.direccion            || '',
      'Nivel de riesgo':          lic.nivel_riesgo_nombre  || '',
      'Zonificación':             lic.zonificacion_nombre  || '',
      'Código zonificación':      lic.zonificacion_codigo  || '',
      'Giros':                    lic.giro_concatenado     || '',
      'Titular':                  lic.titular_nombre       || '',
      'Doc. Titular':             lic.titular_documentos_concatenados || '',
      'Conductor':                lic.conductor_nombre     || '',
      'Doc. Conductor':           lic.conductor_documentos_concatenados || '',
      'Área':                     lic.area                 || '',
      'N.° Resolución':           lic.resolucion_numero    || '',
      'N.° Recibo Pago':          lic.numero_recibo_pago   || '',
      'Fecha Notificación':       formatFecha(lic.fecha_notificacion),
      'Vigencia':                 lic.es_vigencia_indeterminada
                                    ? 'Indeterminada'
                                    : lic.fecha_inicio_vigencia
                                      ? `${formatFecha(lic.fecha_inicio_vigencia)} - ${formatFecha(lic.fecha_fin_vigencia)}`
                                      : '',
      'Actividad':                lic.actividad_nombre     || '',
      'Estado':                   lic.esta_activo ? 'Activa' : 'Inactiva',
    }))

    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Licencias')
    XLSX.writeFile(wb, 'reporte-licencias-funcionamiento.xlsx')
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .print-card { break-inside: avoid; font-size: 9px; padding: 6px !important; }
          .print-card p, .print-card span, .print-card div { font-size: 9px !important; }
        }
      `}</style>

      <div className="flex flex-col h-screen bg-neutral">
        <div className="no-print">
          <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="no-print">
            <SideMenu menus={menus} isOpen={sidebarOpen} />
          </div>

          <main className="flex-1 overflow-y-auto p-6">
            {/* Encabezado */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-800">
                    Reporte — Licencias de Funcionamiento
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Consulta y exporta licencias de funcionamiento por distintos criterios
                  </p>
                </div>

                {buscado && !loading && licencias.length > 0 && (
                  <div className="flex items-center gap-2 no-print shrink-0">
                    <button
                      onClick={handleImprimir}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm
                                 font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Imprimir
                    </button>
                    <button
                      onClick={handleExportarExcel}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm
                                 font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Exportar Excel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Panel de búsqueda */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 no-print">
              <form onSubmit={handleSubmit}>
                {/* Barra rápida */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={busquedaRapida}
                      onChange={(e) => setBusquedaRapida(e.target.value)}
                      placeholder="Buscar por número de licencia o nombre comercial..."
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>

                  {/* Filtros avanzados */}
                  <button
                    type="button"
                    onClick={() => setMostrarAvanzados((v) => !v)}
                    className={[
                      'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg',
                      'border transition-colors shrink-0',
                      mostrarAvanzados
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 6a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm4 6a1 1 0 011-1h2a1 1 0 010 2h-2a1 1 0 01-1-1z" />
                    </svg>
                    Filtros avanzados
                    {mostrarAvanzados && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>

                  {/* Buscar */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm
                               font-medium rounded-lg hover:bg-primary/90 transition-colors
                               disabled:opacity-50 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Buscar
                  </button>

                  {/* Limpiar */}
                  <button
                    type="button"
                    onClick={handleLimpiar}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm
                               font-medium rounded-lg hover:bg-gray-200 transition-colors
                               disabled:opacity-50 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Limpiar
                  </button>
                </div>

                {/* Filtros avanzados expandidos */}
                {mostrarAvanzados && (
                  <FiltrosAvanzados
                    filtros={filtros}
                    onChange={handleChangeFiltros}
                    nivelesRiesgo={nivelesRiesgo}
                    zonificaciones={zonificaciones}
                  />
                )}
              </form>
            </div>

            {/* Spinner */}
            {loading && (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            )}

            {/* Resultados */}
            {!loading && buscado && (
              <>
                <div className="flex items-center gap-2 mb-4 no-print">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-700">
                    {licencias.length}{' '}
                    {licencias.length === 1
                      ? 'licencia de funcionamiento encontrada'
                      : 'licencias de funcionamiento encontradas'}
                  </p>
                </div>

                {licencias.length > 0 ? (
                  <div className="flex flex-col gap-3 print-grid">
                    {licencias.map((lic) => (
                      <LicenciaCard key={lic.id} lic={lic} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 text-sm">
                    No se encontraron licencias con los criterios indicados.
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
