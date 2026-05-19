import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { licenciasApi } from '@api/licenciasApi'
import { personasApi } from '@api/personasApi'
import { expedientesApi } from '@api/expedientesApi'
import { usuariosApi } from '@api/usuariosApi'
import { formatFecha, formatFechaHora, formatSize } from '@utils/formatters'

const formatNumeroLicencia = (numero, fechaEmision) => {
  const anio = new Date(fechaEmision).getFullYear()
  return `${String(numero).padStart(6, '0')}-${anio}`
}

const formatVigencia = (licencia) => {
  if (licencia.es_vigencia_indeterminada) return 'INDETERMINADA'
  if (licencia.fecha_inicio_vigencia && licencia.fecha_fin_vigencia)
    return `${formatFecha(licencia.fecha_inicio_vigencia)} al ${formatFecha(licencia.fecha_fin_vigencia)}`
  return '-'
}

const formatHorario = (desde, hasta) => {
  if (desde == null && hasta == null) return '-'
  return `${desde} - ${hasta} horas`
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IconoDocumento = () => (
  <svg className="w-5 h-5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const IconoPersonas = () => (
  <svg className="w-5 h-5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const IconoEstablecimiento = () => (
  <svg className="w-5 h-5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)

const IconoGiros = () => (
  <svg className="w-5 h-5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

const IconoAdjuntos = () => (
  <svg className="w-5 h-5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
)

const IconoArchivo = () => (
  <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const IconoDescargar = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const IconoAlerta = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

// ── Campo genérico ────────────────────────────────────────────────────────────

function Campo({ etiqueta, valor, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-500 mb-0.5">{etiqueta}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{valor || '-'}</p>
    </div>
  )
}

// ── Card 1: Datos principales ─────────────────────────────────────────────────

function CardDatosPrincipales({ licencia }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <IconoDocumento />
        <h2 className="text-sm font-semibold text-gray-800">Datos principales</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Campo
          etiqueta="Número"
          valor={formatNumeroLicencia(licencia.numero_licencia, licencia.fecha_emision)}
        />
        <Campo etiqueta="Tipo"            valor={licencia.tipo_licencia_nombre} />
        <Campo etiqueta="Fecha de emisión" valor={formatFecha(licencia.fecha_emision)} />
        <Campo etiqueta="Vigencia"         valor={formatVigencia(licencia)} />
        <Campo etiqueta="Resolución"       valor={licencia.resolucion_numero} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
        <Campo etiqueta="Nivel de riesgo"   valor={licencia.nivel_riesgo_nombre} />
        <Campo etiqueta="Horario"           valor={formatHorario(licencia.hora_desde, licencia.hora_hasta)} />
        <Campo etiqueta="Número de recibo"  valor={licencia.numero_recibo_pago} />
      </div>

      {(licencia.observaciones || licencia.fecha_notificacion) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {licencia.fecha_notificacion && (
            <Campo
              etiqueta="Fecha de notificación"
              valor={formatFechaHora(licencia.fecha_notificacion)}
            />
          )}
          {licencia.observaciones && (
            <Campo etiqueta="Observaciones" valor={licencia.observaciones} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Card 2: Titular / Representante legal ─────────────────────────────────────

function FilaPersona({ rol, persona }) {
  if (!persona) return null
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-gray-500">{rol}</p>
      <p className="text-sm font-semibold text-primary">{persona.persona_nombre}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-600">
        {persona.documento_concatenado && <span>{persona.documento_concatenado}</span>}
        {persona.telefono && <span>Teléfono: <strong className="text-gray-800">{persona.telefono}</strong></span>}
        {persona.correo_electronico && <span>Correo: <strong className="text-gray-800">{persona.correo_electronico}</strong></span>}
      </div>
    </div>
  )
}

function CardTitularRepresentante({ titular, conductor }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <IconoPersonas />
        <h2 className="text-sm font-semibold text-gray-800">Datos del titular y representante legal</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <FilaPersona rol="Titular de la licencia" persona={titular} />
        <FilaPersona rol="Representante legal"    persona={conductor} />
      </div>
    </div>
  )
}

// ── Card 3: Información del establecimiento ───────────────────────────────────

function CardEstablecimiento({ licencia }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <IconoEstablecimiento />
        <h2 className="text-sm font-semibold text-gray-800">Información del establecimiento</h2>
      </div>

      <div className="space-y-4">
        <Campo etiqueta="Nombre comercial"    valor={licencia.nombre_comercial} />
        <Campo etiqueta="Actividad económica" valor={licencia.actividad_nombre} />
        <Campo etiqueta="Dirección del local" valor={licencia.direccion} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="Zonificación" valor={licencia.zonificacion_nombre} />
          <Campo
            etiqueta="Área"
            valor={licencia.area != null ? `${Number(licencia.area).toFixed(2)} m²` : '-'}
          />
        </div>
      </div>
    </div>
  )
}

// ── Card 4: Giros autorizados ─────────────────────────────────────────────────

function CardGiros({ giros }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <IconoGiros />
        <h2 className="text-sm font-semibold text-gray-800">Giros autorizados</h2>
      </div>

      {giros.length === 0 ? (
        <p className="text-sm text-gray-400">No hay giros registrados.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {giros.map((g) => (
            <span
              key={g.id}
              className="px-3 py-1 rounded-full border border-gray-300 text-xs text-gray-700"
            >
              {g.ciiu_id} – {g.nombre}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card 5: Documentos adjuntos ───────────────────────────────────────────────

function CardDocumentos({ archivos, descargandoUuid, onDescargar }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <IconoAdjuntos />
        <h2 className="text-sm font-semibold text-gray-800">Documentos adjuntos</h2>
      </div>

      {archivos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No hay documentos adjuntos.</p>
      ) : (
        <div className="space-y-2">
          {archivos.map((archivo) => (
            <div
              key={archivo.id}
              className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <IconoArchivo />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{archivo.nombre_original}</p>
                <p className="text-xs text-gray-400">{formatSize(archivo.tamanio_bytes)}</p>
              </div>
              <button
                type="button"
                onClick={() => onDescargar(archivo)}
                disabled={descargandoUuid === archivo.uuid}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600
                  rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors shrink-0
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <IconoDescargar />
                {descargandoUuid === archivo.uuid ? 'Descargando...' : 'Descargar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card 6: Estados inactivos ─────────────────────────────────────────────────

function CardEstadoInactivo({ estado }) {
  return (
    <div className="rounded-lg border border-danger bg-danger/5 p-5">
      <div className="flex items-center gap-2 mb-3 text-danger">
        <IconoAlerta />
        <h2 className="text-sm font-semibold">{estado.estado_nombre}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-danger/70 mb-0.5">Fecha</p>
          <p className="text-sm text-danger">{formatFecha(estado.fecha_estado)}</p>
        </div>
        <div>
          <p className="text-xs text-danger/70 mb-0.5">Documento</p>
          <p className="text-sm text-danger">{estado.documento || '-'}</p>
        </div>
        {estado.observaciones && (
          <div className="sm:col-span-2">
            <p className="text-xs text-danger/70 mb-0.5">Observaciones</p>
            <p className="text-sm text-danger whitespace-pre-wrap">{estado.observaciones}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card 7: Autorización improcedente (licencia denegada) ─────────────────────

function CardLicenciaDenegada({ autorizacion }) {
  return (
    <div className="rounded-lg border border-danger bg-danger/5 p-5">
      <div className="flex items-center gap-2 mb-3 text-danger">
        <IconoAlerta />
        <h2 className="text-sm font-semibold">Licencia denegada</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-danger/70 mb-0.5">Fecha de rechazo</p>
          <p className="text-sm text-danger">{formatFecha(autorizacion.fecha_rechazo)}</p>
        </div>
        <div>
          <p className="text-xs text-danger/70 mb-0.5">Documento</p>
          <p className="text-sm text-danger">{autorizacion.documento || '-'}</p>
        </div>
        {autorizacion.observaciones && (
          <div className="sm:col-span-2">
            <p className="text-xs text-danger/70 mb-0.5">Observaciones</p>
            <p className="text-sm text-danger whitespace-pre-wrap">{autorizacion.observaciones}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TabLicencia (componente principal exportado) ──────────────────────────────

export default function TabLicencia({ expediente }) {
  const [cargando,       setCargando]       = useState(true)
  const [licencia,       setLicencia]       = useState(null)
  const [titular,        setTitular]        = useState(null)
  const [conductor,      setConductor]      = useState(null)
  const [giros,          setGiros]          = useState([])
  const [archivos,       setArchivos]       = useState([])
  const [estados,        setEstados]        = useState([])
  const [autorizacion,   setAutorizacion]   = useState(null)
  const [usuarioDigitador, setUsuarioDigitador] = useState(null)
  const [descargandoUuid, setDescargandoUuid] = useState(null)

  // ── Carga de datos al montar ──────────────────────────────────────────────

  useEffect(() => {
    const cargar = async () => {
      try {
        // La autorizacion improcedente se consulta siempre con el id del expediente
        // padre, porque si la licencia fue denegada no habrá registro en la tabla
        // licencias_funcionamiento.
        const [licRes, autRes] = await Promise.all([
          licenciasApi.buscar('EXPEDIENTE_ID', expediente.id),
          expedientesApi.getAutorizacionImprocedente(expediente.id, 'LF'),
        ])

        setAutorizacion(autRes?.data ?? null)

        if (!licRes.data.length) {
          setCargando(false)
          return
        }

        const lic = licRes.data[0]
        setLicencia(lic)

        const [titRes, condRes, girosRes, archRes, estadosRes, usuRes] = await Promise.all([
          personasApi.buscar('ID', lic.titular_id),
          lic.conductor_id
            ? personasApi.buscar('ID', lic.conductor_id)
            : Promise.resolve(null),
          licenciasApi.getGiros(lic.id),
          licenciasApi.listarArchivos(lic.id),
          licenciasApi.listarEstados(lic.id),
          usuariosApi.obtener(lic.usuario_id),
        ])

        setTitular(titRes?.data?.[0] ?? null)
        setConductor(condRes?.data?.[0] ?? null)
        setGiros(girosRes.data)
        setArchivos(archRes.data)
        setEstados(estadosRes.data)
        setUsuarioDigitador(usuRes?.data ?? null)
      } catch {
        toast.error('Error al cargar la licencia de funcionamiento')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [expediente])

  // ── Descarga ──────────────────────────────────────────────────────────────

  const handleDescargar = async (archivo) => {
    setDescargandoUuid(archivo.uuid)
    try {
      const res = await licenciasApi.descargarArchivo(archivo.uuid)
      const contentType = res.headers['content-type'] || 'application/octet-stream'
      const blob = new Blob([res.data], { type: contentType })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = archivo.nombre_original
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar el archivo')
    } finally {
      setDescargandoUuid(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    )
  }

  if (!licencia) {
    return (
      <div className="space-y-4">
        {autorizacion ? (
          <CardLicenciaDenegada autorizacion={autorizacion} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-10 flex flex-col items-center justify-center text-center">
            <IconoDocumento />
            <p className="text-sm text-gray-400 mt-3">
              No hay licencia de funcionamiento registrada para este expediente.
            </p>
          </div>
        )}
      </div>
    )
  }

  // Estados cuyo tipo es inactivo (licencia anulada, revocada, etc.)
  const estadosInactivos = estados.filter((e) => !e.esta_activo)

  return (
    <div className="space-y-4">

      <CardDatosPrincipales licencia={licencia} />

      <CardTitularRepresentante titular={titular} conductor={conductor} />

      <CardEstablecimiento licencia={licencia} />

      <CardGiros giros={giros} />

      <CardDocumentos
        archivos={archivos}
        descargandoUuid={descargandoUuid}
        onDescargar={handleDescargar}
      />

      {/* Estados inactivos (rojo) */}
      {estadosInactivos.map((estado) => (
        <CardEstadoInactivo key={estado.id} estado={estado} />
      ))}

      {/* Licencia denegada (rojo) */}
      {autorizacion && <CardLicenciaDenegada autorizacion={autorizacion} />}

      {/* Auditoría */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo
            etiqueta="Digitado por"
            valor={usuarioDigitador?.nombre_completo ?? '-'}
          />
          <Campo
            etiqueta="Fecha de digitación"
            valor={formatFechaHora(licencia.fecha_digitacion)}
          />
        </div>
      </div>

    </div>
  )
}
