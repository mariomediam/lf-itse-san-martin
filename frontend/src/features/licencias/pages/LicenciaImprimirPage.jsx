import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { licenciasApi } from '@api/licenciasApi'
import { personasApi } from '@api/personasApi'

// ── Constantes ────────────────────────────────────────────────────────────────

const CODIGO_DNI = '01'
const CODIGO_CE  = '04'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const PARRAFOS_LEGALES = [
  'Base Legal: Ley Orgánica de Municipalidades N°27972; Ley de Procedimiento Administrativo General N° 27444; Texto Único Ordenado de la Ley 27444, Ley Marco de Licencias de Funcionamiento N° 28976; Ordenanza Municipal Nº 013-2016-CM/MPR y demás normas y reglamentos.',
  'Licencia de Funcionamiento entregada a petición de administrado según solicitud.',
  'Cualquier modificación de las instalaciones del establecimiento, invalida automáticamente la presente autorización.',
  'La licencia de funcionamiento se invalida cuando cambia de dirección el establecimiento.',
  'Queda terminante prohibido el uso de la vía pública.',
  'El presente certificado solo esta validado para el titular y deberá ser colocado en un lugar visible del establecimiento.',
  'En caso de cese de actividades deberán comunicar por escrito a la Municipalidad, dejándose sin efecto la licencia de funcionamiento.',
  'De conformidad a las Leyes y demás disposiciones Municipales de renovación de Licencias de Funcionamiento solo procede cuando se produzca el cambio de nombre o de giro, ampliación, uso o zonificación en el área donde se encuentra el establecimiento.',
  'Deberán presentar la Declaración Jurada de permanencia en el Giro anualmente.',
  'El establecimiento se encuentra sujeto a la fiscalización posterior de acuerdo al artículo 13° de la Ley N° 28976, pudiendo imponer sanciones a que hubiera lugar en caso de incumplimiento.',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const getAnio = (fechaStr) => {
  if (!fechaStr) return '-'
  return new Date(fechaStr).getUTCFullYear()
}

const formatHora = (hora) => {
  if (hora === undefined || hora === null) return '-'
  const h = parseInt(hora, 10)
  const periodo = h < 12 ? 'a.m.' : 'p.m.'
  const h12 = h % 12 || 12
  return `${h12}:00${periodo}`
}

const formatFechaLarga = (fechaStr) => {
  if (!fechaStr) return '-'
  const d = new Date(fechaStr)
  return `${d.getUTCDate()} DE ${MESES[d.getUTCMonth()]} DEL ${d.getUTCFullYear()}`
}

const etiquetaDocumento = (doc) => {
  if (!doc) return 'D.N.I.'
  if (doc.tipos_documento_identidad_codigo === CODIGO_DNI) return 'D.N.I.'
  if (doc.tipos_documento_identidad_codigo === CODIGO_CE)  return 'C.E.'
  return doc.tipos_documento_identidad_nombre || 'D.N.I.'
}

// ── Fila del certificado ──────────────────────────────────────────────────────

function FilaCertificado({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '10px' }}>
      <div style={{
        width: '185px',
        flexShrink: 0,
        fontWeight: 'bold',
        fontSize: '12px',
        letterSpacing: '0.3px',
      }}>
        {label}
      </div>
      <div style={{ marginRight: '6px', fontWeight: 'bold', fontSize: '12px' }}>:</div>
      <div style={{ flex: 1, fontSize: '12px', lineHeight: '1.5' }}>{children}</div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

const LicenciaImprimirPage = () => {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [licencia,     setLicencia]     = useState(null)
  const [giros,        setGiros]        = useState([])
  const [docIdentidad, setDocIdentidad] = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [error,        setError]        = useState(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true)
        const [licRes, girosRes] = await Promise.all([
          licenciasApi.buscar('ID', id),
          licenciasApi.getGiros(id),
        ])

        const lic = licRes.data[0]
        if (!lic) { setError('Licencia no encontrada.'); return }

        setLicencia(lic)
        setGiros(girosRes.data)

        if (lic.conductor_id) {
          try {
            const docRes = await personasApi.getDocumentos(lic.conductor_id)
            const docs   = docRes.data
            const docDni = docs.find((d) => d.tipos_documento_identidad_codigo === CODIGO_DNI)
            const docCe  = docs.find((d) => d.tipos_documento_identidad_codigo === CODIGO_CE)
            setDocIdentidad(docDni || docCe || null)
          } catch { /* continuar sin documento */ }
        }
      } catch {
        setError('Error al cargar los datos de la licencia.')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  // ── Loading ───────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-600">Cargando licencia...</p>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error || !licencia) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error || 'Licencia no encontrada.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  // ── Datos calculados ──────────────────────────────────────────────────────

  const anioLicencia     = getAnio(licencia.fecha_emision)
  const anioExpediente   = getAnio(licencia.fecha_recepcion)
  const giroPrincipal    = giros[0] ?? null
  const girosSecundarios = giros.slice(1)

  const horario = `${formatHora(licencia.hora_desde)} a ${formatHora(licencia.hora_hasta)}`

  const registroFolios = `${licencia.numero_expediente ?? ''} - ${anioExpediente}`

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Barra de acciones */}
      <div className="no-print bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver
        </button>
        <span className="text-sm text-gray-500 ml-2">
          Vista previa — LIC. N° {licencia.numero_licencia} - {anioLicencia}
        </span>
      </div>

      {/* Fondo gris */}
      <div style={{ backgroundColor: '#d1d5db', minHeight: '100vh', paddingTop: '32px', paddingBottom: '32px' }}>

        {/* Hoja A4 */}
        <div style={{
          width: '210mm',
          height: '297mm',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          padding: '10mm',
          boxSizing: 'border-box',
          fontFamily: 'Arial, sans-serif',
          color: '#000000',
        }}>
        {/* Contenido con borde interior */}
        <div style={{
          border: '3px solid #000000',
          height: '100%',
          padding: '0 0 8mm 0',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* ── ENCABEZADO — ocupa el ancho completo del borde ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <img
              src="/images/escudo-muni.png"
              alt="Escudo Municipal"
              style={{ height: '90px', width: 'auto', flexShrink: 0 }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <p style={{ fontWeight: 'bold', fontSize: '24px', textTransform: 'uppercase', letterSpacing: '-0.5px', margin: 0, lineHeight: '1.2', color: '#4a9e4a', whiteSpace: 'nowrap' }}>
                Municipalidad Provincial de San Martín
              </p>
            </div>
            <img
              src="/images/logo-lf.png"
              alt="Logo Licencias"
              style={{ height: '90px', width: 'auto', maxWidth: '140px', flexShrink: 0 }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </div>

          {/* Resto del contenido con padding horizontal */}
          <div style={{ flex: 1, padding: '0 10mm', display: 'flex', flexDirection: 'column' }}>

          {/* ── TÍTULO ── */}
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            <p style={{
              fontWeight: 'bold',
              fontSize: '20px',
              textDecoration: 'underline',
              textTransform: 'uppercase',
              margin: '0 0 4px 0',
              letterSpacing: '1px',
              color: '#808000',
            }}>
              Licencia de Funcionamiento
            </p>
            <p style={{ fontSize: '10px', margin: 0, letterSpacing: '0.5px' }}>
              ORDENANZA MUNICIPAL N° 013-2016-CM/MPR
            </p>
          </div>

          {/* ── N° LICENCIA (derecha) ── */}
          <div style={{ textAlign: 'right', margin: '14px 0 18px 0' }}>
            <span style={{ fontWeight: 'bold', fontSize: '24px', letterSpacing: '0.5px' }}>
              LIC.&nbsp;&nbsp;N° {licencia.numero_licencia} - {anioLicencia}
            </span>
          </div>

          {/* ── CERTIFICADO ── */}
          <p style={{
            fontWeight: 'bold',
            fontSize: '12px',
            margin: '0 0 18px 0',
            borderBottom: '1.5px solid #000',
            paddingBottom: '5px',
            color: '#333399',
          }}>
            EL PRESENTE CERTIFICADO DE AUTORIZACIÓN MUNICIPAL:
          </p>

          {/* OTORGA A */}
          <FilaCertificado label="OTORGA A">
            <p style={{ margin: 0, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '16px', letterSpacing: '0.5px' }}>
              {licencia.conductor_nombre || '-'}
            </p>
            {docIdentidad && (
              <p style={{ margin: '2px 0 0 0' }}>
                {etiquetaDocumento(docIdentidad)} N° {docIdentidad.numero_documento}
              </p>
            )}
          </FilaCertificado>

          {/* NOMBRE COMERCIAL */}
          <FilaCertificado label="NOMBRE COMERCIAL">
            <p style={{ margin: 0, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '18px', letterSpacing: '0.5px' }}>
              "{licencia.nombre_comercial || '-'}"
            </p>
            {licencia.titular_ruc && (
              <p style={{ margin: '2px 0 0 0' }}>
                R.U.C. N° {licencia.titular_ruc}
              </p>
            )}
          </FilaCertificado>

          {/* GIRO PRINCIPAL */}
          <FilaCertificado label="GIRO PRINCIPAL">
            <p style={{ margin: 0, textTransform: 'uppercase' }}>
              {giroPrincipal ? giroPrincipal.nombre : '-'}
            </p>
          </FilaCertificado>

          {/* GIRO SECUNDARIO */}
          <FilaCertificado label="GIRO SECUNDARIO">
            {girosSecundarios.length > 0 ? (
              girosSecundarios.map((g, i) => (
                <p key={g.id ?? i} style={{ margin: i > 0 ? '2px 0 0 0' : 0, textTransform: 'uppercase' }}>
                  {g.nombre}
                </p>
              ))
            ) : (
              <p style={{ margin: 0 }}>-</p>
            )}
          </FilaCertificado>

          {/* UBICADO EN */}
          <FilaCertificado label="UBICADO EN">
            <p style={{ margin: 0, textTransform: 'uppercase' }}>
              {licencia.direccion || '-'}
            </p>
          </FilaCertificado>

          {/* HORARIO */}
          <FilaCertificado label="HORARIO">
            <p style={{ margin: 0 }}>{horario || '-'}</p>
          </FilaCertificado>

          {/* AREA */}
          <FilaCertificado label="AREA">
            <p style={{ margin: 0 }}>
              {licencia.area != null ? `${licencia.area} m².` : '-'}
            </p>
          </FilaCertificado>

          {/* REGISTRO / FOLIOS */}
          <FilaCertificado label="REGISTRO / FOLIOS">
            <p style={{ margin: 0 }}>{registroFolios}</p>
          </FilaCertificado>

          {/* APROBADO CON */}
          <FilaCertificado label="APROBADO CON">
            <p style={{ margin: 0 }}>
              Resolución Gerencial N° {licencia.resolucion_numero || '-'}
            </p>
          </FilaCertificado>

          {/* LUGAR Y FECHA */}
          <div style={{ textAlign: 'right', margin: '22px 0 0 0', fontSize: '12px', fontWeight: 'bold' }}>
            RIOJA, {formatFechaLarga(licencia.fecha_emision)}
          </div>

          {/* Espaciador: empuja los párrafos al fondo */}
          <div style={{ flex: 1 }} />

          {/* ── PÁRRAFOS LEGALES ── */}
          <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>
            {PARRAFOS_LEGALES.map((texto, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '3px' }}>
                <span style={{ marginRight: '5px', fontSize: '9px', lineHeight: '1.5', flexShrink: 0 }}>❖</span>
                <p style={{ margin: 0, fontSize: '9px', lineHeight: '1.4' }}>{texto}</p>
              </div>
            ))}
          </div>

          </div>{/* fin contenido con padding */}
        </div>{/* fin borde interior */}
        </div>{/* fin hoja A4 */}
      </div>{/* fin fondo gris */}
    </>
  )
}

export default LicenciaImprimirPage
