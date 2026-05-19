import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { itseApi } from '@api/itseApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

const UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
]
const DECENAS  = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

const numeroALetras = (n) => {
  if (n === null || n === undefined) return '-'
  const num = parseInt(n, 10)
  if (isNaN(num) || num < 0) return '-'
  if (num === 0) return 'CERO'
  if (num < 20) return UNIDADES[num]
  if (num < 30) return num === 20 ? 'VEINTE' : 'VEINTI' + UNIDADES[num - 20]
  if (num < 100) {
    const d = Math.floor(num / 10), u = num % 10
    return u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`
  }
  if (num === 100) return 'CIEN'
  const c = Math.floor(num / 100), r = num % 100
  return r === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${numeroALetras(r)}`
}

const getAnio = (fechaStr) => {
  if (!fechaStr) return '-'
  return new Date(fechaStr).getUTCFullYear()
}

const formatFecha = (fechaStr) => {
  if (!fechaStr) return '-'
  const d = new Date(fechaStr)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

const calcularVigencia = (fechaInicio, fechaFin) => {
  if (!fechaInicio || !fechaFin) return '-'
  const anios = Math.round((new Date(fechaFin) - new Date(fechaInicio)) / (365.25 * 24 * 60 * 60 * 1000))
  if (anios >= 1) return `${anios} ${anios === 1 ? 'AÑO' : 'AÑOS'}`
  const meses = Math.round((new Date(fechaFin) - new Date(fechaInicio)) / (30 * 24 * 60 * 60 * 1000))
  return `${meses} ${meses === 1 ? 'MES' : 'MESES'}`
}

// ── Estilos reutilizables ─────────────────────────────────────────────────────

const S = {
  label:  { fontWeight: 'bold', fontSize: '11px' },
  valor:  { borderBottom: '1px solid #000', display: 'inline-block', padding: '0 6px', fontSize: '11px', fontWeight: 'bold' },
  sub:    { fontSize: '8.5px', color: '#444', display: 'block', textAlign: 'center', marginTop: '1px' },
  linea:  { marginBottom: '8px' },
}

// ── Campo con línea subrayada ─────────────────────────────────────────────────

function CampoLinea({ label, valor, subtitulo, grow = false }) {
  return (
    <div style={{ ...S.linea, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
      <span style={S.label}>{label}</span>
      <span style={{ ...S.valor, flex: grow ? 1 : undefined, minWidth: grow ? undefined : '120px' }}>
        {valor || ''}
      </span>
      {subtitulo && <span style={{ fontSize: '8.5px', color: '#444', whiteSpace: 'nowrap' }}>{subtitulo}</span>}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

const ItseImprimirPage = () => {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [itse,     setItse]     = useState(null)
  const [giros,    setGiros]    = useState([])
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true)
        const [itseRes, girosRes] = await Promise.all([
          itseApi.buscar('ID', id),
          itseApi.getGiros(id),
        ])
        const item = itseRes.data[0]
        if (!item) { setError('Certificado ITSE no encontrado.'); return }
        setItse(item)
        setGiros(girosRes.data)
      } catch {
        setError('Error al cargar los datos del certificado ITSE.')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-600">Cargando certificado ITSE...</p>
        </div>
      </div>
    )
  }

  if (error || !itse) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error || 'Certificado ITSE no encontrado.'}</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700">
            Volver
          </button>
        </div>
      </div>
    )
  }

  // ── Datos calculados ────────────────────────────────────────────────────────
  const anioItse       = getAnio(itse.fecha_expedicion)
  const girosTexto     = giros.map((g) => g.nombre).join(', ')
  const expedienteNum  = itse.numero_expediente
    ? `${String(itse.numero_expediente).padStart(4, '0')}-${getAnio(itse.fecha_recepcion)}-OGRD y DC-MPR`
    : '-'
  const vigencia       = calcularVigencia(itse.fecha_expedicion, itse.fecha_caducidad)
  const aforo          = itse.capacidad_aforo
  const aforoLetras    = numeroALetras(aforo)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Barra de acciones */}
      <div className="no-print bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver
        </button>
        <span className="text-sm text-gray-500 ml-2">
          Vista previa — ITSE N° {itse.numero_itse} - {anioItse}
        </span>
      </div>

      {/* Fondo gris */}
      <div style={{ backgroundColor: '#d1d5db', minHeight: '100vh', paddingTop: '32px', paddingBottom: '32px' }}>

        {/* Hoja A4 */}
        <div style={{
          width: '210mm',
          minHeight: '297mm',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          padding: '10mm 14mm 10mm 14mm',
          boxSizing: 'border-box',
          fontFamily: 'Arial, sans-serif',
          color: '#000000',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* ── ENCABEZADO ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
            <img src="/images/escudo-muni.png" alt="Escudo"
              style={{ height: '85px', width: 'auto', flexShrink: 0 }}
              onError={(e) => { e.target.style.display = 'none' }} />
            <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '18px', textTransform: 'uppercase', margin: '0 0 3px 0', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                Municipalidad Provincial de San Martín
              </p>
              <p style={{ fontSize: '9px', fontStyle: 'italic', margin: 0, lineHeight: '1.3', color: '#333' }}>
                RIOJA CIUDAD DE LOS SOMBREROS Y CAPITAL DEL CARNAVAL<br />EN LA REGIÓN SAN MARTIN
              </p>
            </div>
            <img src="/images/cenepred.jpg" alt="CENEPRED"
              style={{ height: '85px', width: 'auto', maxWidth: '120px', flexShrink: 0 }}
              onError={(e) => { e.target.style.display = 'none' }} />
          </div>

          {/* ── TÍTULO CERTIFICADO ── */}
          <p style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '11.5px', textAlign: 'justify', margin: '0 0 10px 0', lineHeight: '1.5', textTransform: 'uppercase' }}>
            Certificado de Inspección Técnica de Seguridad en Edificaciones para Establecimientos
            Objeto de Inspección Clasificados con Nivel de{' '}
            <span style={{ textTransform: 'uppercase' }}>{itse.nivel_riesgo_nombre || 'RIESGO BAJO O RIESGO MEDIO'}</span>{' '}
            Según la Matriz de Riesgos
          </p>

          {/* ── N° ITSE ── */}
          <div style={{ textAlign: 'center', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '6px 0', margin: '0 0 10px 0' }}>
            <p style={{ fontWeight: 'bold', fontSize: '20px', margin: 0, letterSpacing: '2px' }}>
              N° {itse.numero_itse} - {anioItse}
            </p>
          </div>

          {/* ── PÁRRAFO INTRODUCTORIO ── */}
          <p style={{ fontSize: '11px', textAlign: 'justify', margin: '0 0 10px 0', lineHeight: '1.5' }}>
            El Órgano Ejecutante de la <strong>Municipalidad Provincial de San Martín</strong>, en cumplimiento de lo establecido en el
            D.S. Nº002-2018-PCM, ha realizado la Inspección Técnica de Seguridad en Edificaciones al Establecimiento
            Objeto de Inspección:
          </p>

          {/* ── NOMBRE COMERCIAL ── */}
          <div style={{ textAlign: 'center', borderBottom: '1.5px solid #000', margin: '0 0 4px 0', paddingBottom: '4px' }}>
            <p style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '17px', margin: 0, textTransform: 'uppercase' }}>
              "{itse.nombre_comercial || '-'}."
            </p>
          </div>
          <p style={{ fontSize: '9px', textAlign: 'center', margin: '0 0 10px 0', color: '#444' }}>
            (Nombre Comercial)
          </p>

          {/* ── UBICADO EN ── */}
          <div style={{ marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={S.label}>Ubicado en</span>
              <span style={{ ...S.valor, flex: 1 }}>{itse.direccion || ''}</span>
            </div>
            <p style={{ fontSize: '9px', color: '#444', textAlign: 'center', margin: '1px 0 8px 0' }}>
              (Calle, Av., Jr., Lote, Mz., Urb.)
            </p>
          </div>

          {/* ── DISTRITO / PROVINCIA / DEPARTAMENTO ── */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={S.label}>Distrito</span>
            <span style={{ ...S.valor, minWidth: '80px' }}>RIOJA</span>
            <span style={S.label}>, Provincia</span>
            <span style={{ ...S.valor, minWidth: '80px' }}>RIOJA</span>
            <span style={S.label}>, Departamento</span>
            <span style={{ ...S.valor, minWidth: '100px' }}>SAN MARTIN</span>
          </div>

          {/* ── SOLICITADO POR ── */}
          <div style={{ marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={S.label}>Solicitado por</span>
              <span style={{ ...S.valor, flex: 1 }}>{itse.conductor_nombre || ''}</span>
            </div>
            <p style={{ fontSize: '9px', color: '#444', textAlign: 'center', margin: '1px 0 8px 0' }}>
              (Nombre del propietario, representante legal, apoderado, conductor o administrador)
            </p>
          </div>

          {/* ── CERTIFICA ── */}
          <p style={{ fontSize: '11px', textAlign: 'justify', margin: '0 0 10px 0', lineHeight: '1.5' }}>
            El que suscribe <strong>CERTIFICA</strong> que el objeto de la Inspección antes señalado <strong>CUMPLE</strong> con
            la normativa en materia de seguridad en edificaciones vigente.
          </p>

          {/* ── CAPACIDAD ── */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={S.label}>Capacidad Máxima de la Edificación:</span>
            <span style={{ ...S.valor, minWidth: '50px', textAlign: 'center' }}>{aforo ?? ''}</span>
            <span style={S.label}>(</span>
            <span style={{ ...S.valor, minWidth: '150px', textAlign: 'center' }}>{aforoLetras}</span>
            <span style={S.label}>) personas</span>
          </div>

          {/* ── GIRO ── */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            <div style={{ flexShrink: 0 }}>
              <p style={{ ...S.label, margin: 0 }}>Giro o actividad</p>
              <p style={{ ...S.label, margin: 0 }}>de la Edificación:</p>
            </div>
            <span style={{ ...S.valor, flex: 1, alignSelf: 'center', textTransform: 'uppercase' }}>
              {girosTexto || ''}
            </span>
          </div>

          {/* ── ÁREA + EXPEDIENTE ── */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={S.label}>Área Ocupada de la Edificación:</span>
            <span style={{ ...S.valor, minWidth: '80px' }}>
              {itse.area != null ? `${itse.area} mt2` : ''}
            </span>
            <span style={{ ...S.label, marginLeft: '8px' }}>Expediente N°:</span>
            <span style={{ ...S.valor, flex: 1 }}>{expedienteNum}</span>
          </div>

          {/* ── RESOLUCIÓN ── */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '10px' }}>
            <span style={S.label}>Resolución N°</span>
            <span style={{ ...S.valor, flex: 1 }}>{itse.resolucion_numero || ''}</span>
          </div>

          {/* ── VIGENCIA + LUGAR ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0, textTransform: 'uppercase' }}>
              VIGENCIA {vigencia}
            </p>
            <p style={{ fontSize: '11px', fontWeight: 'bold', margin: 0 }}>
              LUGAR:&nbsp;&nbsp;RIOJA
            </p>
          </div>

          {/* ── FECHAS ── */}
          <div style={{ marginBottom: '12px' }}>

            {/* Fecha de expedición */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '6px', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '11px' }}>FECHA DE EXPEDICIÓN</span>
              <span style={{ fontWeight: 'bold', fontSize: '11px' }}>:</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '90px' }}>
                <span style={{ ...S.valor, width: '100%', textAlign: 'center' }}>{formatFecha(itse.fecha_expedicion)}</span>
                <span style={{ fontSize: '9px', color: '#555' }}>(DMA)</span>
              </div>
            </div>

            {/* Fecha de solicitud de renovación */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginBottom: '8px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '11px' }}>FECHA DE SOLICITUD DE RENOVACIÓN</span>
                <p style={{ fontSize: '9px', fontStyle: 'italic', color: '#c0392b', margin: '1px 0 0 0' }}>
                  Treinta días hábiles anteriores a la fecha de caducidad
                </p>
              </div>
              <span style={{ fontWeight: 'bold', fontSize: '11px', alignSelf: 'flex-start', paddingTop: '1px' }}>:</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '90px' }}>
                <span style={{ ...S.valor, width: '100%', textAlign: 'center' }}>{formatFecha(itse.fecha_solicitud_renovacion)}</span>
                <span style={{ fontSize: '9px', color: '#555' }}>(DMA)</span>
              </div>
            </div>

            {/* Fecha de caducidad */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '6px', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '11px' }}>FECHA DE CADUCIDAD</span>
              <span style={{ fontWeight: 'bold', fontSize: '11px' }}>:</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '90px' }}>
                <span style={{ ...S.valor, width: '100%', textAlign: 'center' }}>{formatFecha(itse.fecha_caducidad)}</span>
                <span style={{ fontSize: '9px', color: '#555' }}>(DMA)</span>
              </div>
            </div>

          </div>

          {/* ── MUNICIPALIDAD ── */}
          <p style={{ fontWeight: 'bold', fontSize: '12px', textAlign: 'center', textTransform: 'uppercase', margin: '12px 0 64px 0' }}>
            Municipalidad Provincial de San Martín
          </p>

          {/* ── FIRMA ── */}
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', margin: '0 0 2px 0', letterSpacing: '2px' }}>
              ………………………………………………………………….
            </p>
            <p style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '11px', margin: '0 0 1px 0' }}>
              T<sub>3</sub> A.P. (r). Eduardo M. Rojas Rojas
            </p>
            <p style={{ fontWeight: 'bold', fontSize: '10px', margin: 0, textTransform: 'uppercase' }}>
              Jefe de la Oficina de Gestión del Riesgo<br />de Desastres y Defensa Civil
            </p>
          </div>

          {/* Espaciador */}
          <div style={{ flex: 1 }} />

          {/* ── NOTA LEGAL ── */}
          <div style={{ borderTop: '1px solid #000', paddingTop: '6px' }}>
            <p style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '8.5px', textAlign: 'center', margin: '0 0 4px 0' }}>
              *EL PRESENTE CERTIFICADO DE ITSE NO CONSTITUYE AUTORIZACIÓN ALGUNA PARA EL FUNCIONAMIENTO DEL
              ESTABLECIMIENTO OBJETO DE INSPECCIÓN O PARA EL INICIO DE LA ACTIVIDAD
            </p>
            <p style={{ fontWeight: 'bold', fontSize: '9px', margin: '0 0 3px 0' }}>NOTA:</p>
            {[
              'DE ACUERDO A LO ESTABLECIDO EN EL REGLAMENTO DE INSPECCIONES TÉCNICAS DE SEGURIDAD EN EDIFICACIONES APROBADO POR DECRETO SUPREMO N° 002-2018 PCM, EL PRESENTE CERTIFICADO DEBERÁ SER FIRMADO POR EL RESPONSABLE DEL ÓRGANO EJECUTANTE.',
              'ESTE CERTIFICADO DEBERÁ COLOCARSE EN UN LUGAR VISIBLE DENTRO DEL ESTABLECIMIENTO OBJETO DE INSPECCIÓN.',
              'CUALQUIER TACHA O ENMENDADURA INVALIDA EL PRESENTE CERTIFICADO.',
            ].map((texto, i) => (
              <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                <span style={{ fontSize: '8.5px', flexShrink: 0 }}>-</span>
                <p style={{ margin: 0, fontSize: '8.5px', lineHeight: '1.4' }}>{texto}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}

export default ItseImprimirPage
