import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import RegistrarNotificacionModal from './RegistrarNotificacionModal'
import InactivarLicenciaModal from './InactivarLicenciaModal'
import DocumentosAdjuntosLicenciaModal from './DocumentosAdjuntosLicenciaModal'
import EliminarLicenciaModal from './EliminarLicenciaModal'
import { formatFecha } from '@utils/formatters'

const formatNumeroLicencia = (numero, fechaEmision) => {
  const anio = new Date(fechaEmision).getFullYear()
  return `${String(numero).padStart(4, '0')}-${anio}`
}

const formatVigencia = (licencia) => {
  if (licencia.es_vigencia_indeterminada) return 'INDETERMINADA'
  const inicio = formatFecha(licencia.fecha_inicio_vigencia)
  const fin    = formatFecha(licencia.fecha_fin_vigencia)
  return `${inicio} - ${fin}`
}

// ── Iconos del menú contextual ────────────────────────────────────────────────

const IconoVer        = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
const IconoModificar  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
const IconoImprimir   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
const IconoAdjuntos   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
const IconoNotif      = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
const IconoInactivar  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
const IconoEliminar   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>

// ── Menú contextual ───────────────────────────────────────────────────────────

function MenuContextual({
  licencia,
  onVer,
  onModificar,
  onImprimir,
  onDocumentosAdjuntos,
  onRegistrarNotificacion,
  onInactivar,
  onEliminar,
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  const opciones = [
    { label: 'Ver',                   icono: <IconoVer />,       onClick: onVer,                   danger: false },
    { label: 'Modificar',             icono: <IconoModificar />,  onClick: onModificar,             danger: false },
    { label: 'Imprimir',              icono: <IconoImprimir />,   onClick: onImprimir,              danger: false },
    { label: 'Documentos adjuntos',   icono: <IconoAdjuntos />,   onClick: onDocumentosAdjuntos,    danger: false },
    { label: 'Registrar notificación',icono: <IconoNotif />,      onClick: onRegistrarNotificacion, danger: false },
    { label: 'Inactivar',             icono: <IconoInactivar />,  onClick: onInactivar,             danger: true  },
    { label: 'Eliminar',              icono: <IconoEliminar />,   onClick: onEliminar,              danger: true  },
  ].filter((op) => {
    if (op.label === 'Inactivar' && licencia?.esta_activo === false) return false
    return true
  })

  const handleOpcion = (op) => {
    setAbierto(false)
    op.onClick?.()
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Opciones de la licencia"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {abierto && (
        <div className="absolute right-0 top-8 z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {opciones.map((op) => (
            <button
              key={op.label}
              type="button"
              onClick={() => handleOpcion(op)}
              className={[
                'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
                op.danger
                  ? 'text-danger hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {op.icono}
              {op.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

/**
 * Tarjeta de licencia de funcionamiento.
 *
 * Props
 * -----
 * licencia    : object   — fila del endpoint /api/lf-itse/licencias-funcionamiento/buscar/
 * onRefrescar : () => void — callback para refrescar la lista tras una acción
 */
export default function LicenciaCard({ licencia, onRefrescar }) {
  const navigate = useNavigate()
  const [modalNotifAbierto, setModalNotifAbierto] = useState(false)
  const [modalInactivarAbierto, setModalInactivarAbierto] = useState(false)
  const [modalDocumentosAbierto, setModalDocumentosAbierto] = useState(false)
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false)

  const handleVer       = () => navigate(`/expedientes/${licencia.expediente_id}?tab=licencia`)
  const handleModificar = () => navigate(`/licencias-funcionamiento/${licencia.id}/modificar`)
  const handleImprimir  = () => navigate(`/licencias-funcionamiento/${licencia.id}/imprimir`)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 relative sm:static">
      {/* En móvil: botón absoluto en esquina superior derecha */}
      <div className="absolute top-3 right-3 sm:hidden">
        <MenuContextual
          licencia={licencia}
          onVer={handleVer}
          onModificar={handleModificar}
          onImprimir={handleImprimir}
          onRegistrarNotificacion={() => setModalNotifAbierto(true)}
          onDocumentosAdjuntos={() => setModalDocumentosAbierto(true)}
          onInactivar={() => setModalInactivarAbierto(true)}
          onEliminar={() => setModalEliminarAbierto(true)}
        />
      </div>

      <div className="flex items-start justify-between gap-4">

        {/* Información */}
        <div className="flex-1 min-w-0 pr-8 sm:pr-0">

          {/* Cabecera: número + badge estado */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-800">
              Licencia de funcionamiento {formatNumeroLicencia(licencia.numero_licencia, licencia.fecha_emision)}
            </span>

            {!licencia.esta_activo && (
              <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-danger text-white">
                Inactiva
              </span>
            )}
            {licencia.requiere_auth_sectorial && (
              <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                Auth. sectorial
              </span>
            )}
          </div>

          {/* Nombre comercial */}
          <p className="text-sm text-gray-700 font-medium mb-1 line-clamp-1" title={licencia.nombre_comercial}>
            Nombre comercial: {licencia.nombre_comercial}
          </p>

          {/* Fecha de solicitud y vigencia */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-0.5 text-xs text-gray-500 mb-1">
            <span>
              Fecha de emisión:{' '}
              <strong className="text-gray-700">{formatFecha(licencia.fecha_emision)}</strong>
            </span>
            <span>
              Vigencia:{' '}
              <strong className="text-gray-700">{formatVigencia(licencia)}</strong>
            </span>
          </div>

          {/* Titular */}
          <p className="text-xs text-gray-500 mb-0.5">
            Titular:{' '}
            <strong className="text-gray-700">{licencia.titular_nombre || '-'}</strong>
          </p>

          {/* Dirección */}
          <p className="text-xs text-gray-500 mb-0.5">
            Dirección del local:{' '}
            <strong className="text-gray-700">{licencia.direccion}</strong>
          </p>

          {/* Actividad */}
          <p className="text-xs text-gray-500">
            Actividad económica:{' '}
            <strong className="text-gray-700">{licencia.actividad_nombre}</strong>
          </p>
        </div>

        {/* Menú de 3 puntos — solo visible en sm+ */}
        <div className="hidden sm:block shrink-0">
          <MenuContextual
            licencia={licencia}
            onVer={handleVer}
            onModificar={handleModificar}
            onImprimir={handleImprimir}
            onRegistrarNotificacion={() => setModalNotifAbierto(true)}
            onDocumentosAdjuntos={() => setModalDocumentosAbierto(true)}
            onInactivar={() => setModalInactivarAbierto(true)}
            onEliminar={() => setModalEliminarAbierto(true)}
          />
        </div>
      </div>

      {/* Modal de notificación */}
      <RegistrarNotificacionModal
        isOpen={modalNotifAbierto}
        onClose={() => setModalNotifAbierto(false)}
        licencia={licencia}
        onNotificado={onRefrescar}
      />

      <InactivarLicenciaModal
        isOpen={modalInactivarAbierto}
        onClose={() => setModalInactivarAbierto(false)}
        licencia={licencia}
        onInactivada={onRefrescar}
      />

      <DocumentosAdjuntosLicenciaModal
        isOpen={modalDocumentosAbierto}
        onClose={() => setModalDocumentosAbierto(false)}
        licencia={licencia}
      />

      <EliminarLicenciaModal
        isOpen={modalEliminarAbierto}
        onClose={() => setModalEliminarAbierto(false)}
        onSuccess={onRefrescar}
        licencia={licencia}
      />

    </div>
  )
}
