import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCode } from 'react-qr-code'
import { itseApi } from '@api/itseApi'
import { configPublicaApi } from '@api/configPublicaApi'

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
  return new Date(String(fechaStr).slice(0, 10) + 'T00:00:00').getFullYear()
}

const formatFecha = (fechaStr) => {
  if (!fechaStr) return '-'
  const d = new Date(String(fechaStr).slice(0, 10) + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const calcularVigencia = (fechaInicio, fechaFin) => {
  if (!fechaInicio || !fechaFin) return '-'
  const msAnio = 365.25 * 24 * 60 * 60 * 1000
  const anios  = Math.round((new Date(fechaFin) - new Date(fechaInicio)) / msAnio)
  if (anios >= 1) return `${anios} ${anios === 1 ? 'AÑO' : 'AÑOS'}`
  const meses = Math.round((new Date(fechaFin) - new Date(fechaInicio)) / (30 * 24 * 60 * 60 * 1000))
  return `${meses} ${meses === 1 ? 'MES' : 'MESES'}`
}

// ── Página principal ──────────────────────────────────────────────────────────

const ItseImprimirPage = () => {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [itse,     setItse]     = useState(null)
  const [giros,    setGiros]    = useState([])
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState(null)
  const [qrUrl,    setQrUrl]    = useState(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true)
        const [itseRes, girosRes, configRes] = await Promise.all([
          itseApi.buscar('ID', id),
          itseApi.getGiros(id),
          configPublicaApi.getConfig().catch(() => ({ data: {} })),
        ])
        const item = itseRes.data[0]
        if (!item) { setError('Certificado ITSE no encontrado.'); return }
        setItse(item)
        setGiros(girosRes.data)

        const cfg = configRes.data
        if (cfg.qr_verificacion_habilitado && cfg.qr_url_verificar_itse && item.uuid) {
          const base = cfg.qr_url_verificar_itse.replace(/\/+$/, '')
          setQrUrl(`${base}/${item.uuid}`)
        }
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

  // ── Datos calculados ────────────────────────────────────────────────────────

  const anioExpedicion  = getAnio(itse.fecha_expedicion)
  const nroCertificado  = `${String(itse.numero_itse ?? '').padStart(5, '0')}-${anioExpedicion}`
  const nroExpediente   = itse.numero_expediente
    ? `${itse.numero_expediente}-${getAnio(itse.fecha_recepcion)}`
    : '-'
  const girosTexto      = giros.map((g) => g.nombre).join(' / ')
  const vigencia        = calcularVigencia(itse.fecha_expedicion, itse.fecha_caducidad)
  const aforo           = itse.capacidad_aforo
  const aforoLetras     = numeroALetras(aforo)
  const nivelRiesgo     = (itse.nivel_riesgo_nombre || 'RIESGO BAJO').toUpperCase()
  const areaFormatted   = itse.area != null ? `${parseFloat(itse.area).toFixed(2)} m²` : '-'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
          .no-print    { display: none !important; }
          .cert-wrapper { background: none !important; padding: 0 !important; }
          .cert-page   { box-shadow: none !important; }
          .header-membrete { visibility: hidden; }
        }
        @media screen {
          .cert-wrapper {
            background: #d1d5db;
            min-height: 100vh;
            padding: 32px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .cert-page {
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
          }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Barra de acciones (solo pantalla) ─────────────────────────────── */}
      <div className="no-print" style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}>
        <button
          onClick={() => window.print()}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontSize: '14px', fontWeight: '600',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', background: '#f3f4f6', color: '#374151',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontSize: '14px', fontWeight: '600',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver
        </button>
        <span style={{ fontSize: '13px', color: '#6b7280', marginLeft: '8px' }}>
          Vista previa — ITSE N° {nroCertificado}
        </span>
      </div>

      {/* ── Wrapper ───────────────────────────────────────────────────────── */}
      <div className="cert-wrapper">

        {/* ── HOJA A4 VERTICAL ──────────────────────────────────────────── */}
        <div
          className="cert-page"
          style={{
            width: '210mm',
            minHeight: '297mm',
            backgroundColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            display: 'flex',
            flexDirection: 'column',
          }}
        >

          {/* ── ENCABEZADO (papel membretado) ─────────────────────────── */}
          {/* Espacio reservado para el membrete pre-impreso.              */}
          {/* En pantalla se muestra; al imprimir queda invisible pero     */}
          {/* el espacio se preserva gracias a visibility:hidden en CSS.   */}
          <div
            className="header-membrete"
            style={{
              height: '32mm',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4mm 14mm',              
              flexShrink: 0,
            }}
          >
           
          </div>

          {/* ── CONTENIDO DEL CERTIFICADO ─────────────────────────────── */}
          <div style={{ flex: 1, padding: '6mm 20mm 0mm 20mm', display: 'flex', flexDirection: 'column' }}>

            {/* Título */}
            <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
              <p style={{
                fontWeight: 'bold',
                fontSize: '24px',
                lineHeight: '1.15',
                textTransform: 'uppercase',
                margin: 0,
              }}>
                Certificado de Inspección Técnica de Seguridad en Edificaciones
                Clasificados con Nivel de {nivelRiesgo}
              </p>
              {/* N° Certificado */}
              <p style={{ fontWeight: 'bold', fontSize: '24px', margin: 0, letterSpacing: '1px', paddingTop: '5px' }}>
                N° {nroCertificado}
              </p>
            </div>

            
            {/* Párrafo introductorio */}
            <p style={{ fontSize: '15px', textAlign: 'justify', margin: '0 0 3mm 0', lineHeight: '1.55' }}>
              El Órgano Ejecutante de la <strong>Municipalidad Provincial de San Martín</strong>, en
              cumplimiento de lo establecido en el D.S. N° 002-2018-PCM, ha realizado la{' '}
              <strong>Inspección Técnica de Seguridad en Edificaciones Clasificados Con Nivel de {nivelRiesgo}</strong>{' '}
              a la edificación e instalaciones donde funciona:
            </p>

            {/* Nombre comercial */}
            <div style={{ textAlign: 'center', margin: '0 0 3mm 0' }}>
              <p style={{ fontWeight: 'bold', fontSize: '26px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {itse.nombre_comercial || '-'}
              </p>
            </div>

            {/* Campos de ubicación y titular */}
            <div style={{ marginBottom: '2mm', lineHeight: '1.7' }}>
              <p style={{ fontSize: '15px', margin: '0 0 1.5mm 0' }}>
                Ubicado en <strong>{itse.direccion || '-'}</strong>
              </p>
              <p style={{ fontSize: '15px', margin: '0 0 1.5mm 0' }}>
                Distrito <strong>Tarapoto</strong>, Provincia <strong>San Martín</strong>, Departamento <strong>San Martín</strong>
              </p>
              <p style={{ fontSize: '15px', margin: '0 0 1.5mm 0' }}>
                Propietario <strong>{itse.titular_nombre || '-'}</strong>
              </p>
            </div>

            {/* Párrafo de certificación */}
            <p style={{ fontSize: '15px', textAlign: 'justify', margin: '0 0 3mm 0', lineHeight: '1.55' }}>
              El que suscribe <strong>CERTIFICA</strong> que el objeto de la Inspección antes señalado{' '}
              <strong>CUMPLE</strong> con la normativa en materia de seguridad en edificaciones vigente.
            </p>

            {/* Capacidad */}
            <p style={{ fontSize: '15px', margin: '0 0 1.5mm 0', lineHeight: '1.5' }}>
              Capacidad Máxima de la Edificación:{' '}
              <strong>
                {aforo != null ? `${aforo} (${aforoLetras}) personas` : '-'}
              </strong>
            </p>

            {/* Actividad */}
            <p style={{ fontSize: '15px', margin: '0 0 1.5mm 0', lineHeight: '1.5' }}>
              Actividad de la Edificación: <strong>{girosTexto || '-'}</strong>
            </p>

            {/* Área */}
            <p style={{ fontSize: '15px', margin: '0 0 2mm 0', lineHeight: '1.5' }}>
              Área Ocupada de la Edificación: <strong>{areaFormatted}</strong>
            </p>
            <p style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 1.5mm 0' }}>
                  Expediente N° {nroExpediente}
                </p>

            {/* Expediente · Vigencia · Fechas */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5mm' }}>

              {/* Columna izquierda */}
              <div>
                
                <p style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>
                  VIGENCIA {vigencia}
                </p>
              </div>

              {/* Columna derecha */}
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 1.3mm 0' }}>
                  FECHA DE EXPEDICIÓN:&nbsp;&nbsp;{formatFecha(itse.fecha_expedicion)}
                </p>
                <p style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 1.3mm 0' }}>
                  FECHA DE RENOVACIÓN:&nbsp;&nbsp;{formatFecha(itse.fecha_solicitud_renovacion)}
                </p>
                <p style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, color: '#cc0000' }}>
                  FECHA DE CADUCIDAD:&nbsp;&nbsp;{formatFecha(itse.fecha_caducidad)}
                </p>
              </div>

            </div>

            {/* Espaciador flexible */}
            <div style={{ flex: 1 }} />

            {/* Firma y sello */}
            <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
              <div style={{
                borderBottom: '1px solid #000',
                width: '220px',
                margin: '0 auto 4px auto',
              }} />
              <p style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, letterSpacing: '3px', textTransform: 'uppercase' }}>
                Firma y Sello
              </p>
            </div>

          </div>{/* fin contenido */}

          {/* ── PIE DE PÁGINA ─────────────────────────────────────────── */}
          <div style={{            
            padding: '0mm 14mm 10mm 14mm',
            flexShrink: 0,
            display: 'flex',
            gap: '10px',
          }}>
            <div style={{ flex: 1 }}>
              <p style={{
                fontStyle: 'italic',
                fontSize: '12.5px',              
                fontWeight: 'bold',
                margin: '0 0 3mm 0',
                lineHeight: '1.4',
              }}>
                &ldquo;El presente Certificado de ITSE no constituye autorización alguna para el
                funcionamiento del objeto de la presente inspección&rdquo;.
              </p>

              <p style={{ fontWeight: 'bold', fontSize: '12px', margin: '0 0 2mm 0', textTransform: 'uppercase' }}>
                Nota
              </p>

              {[
                'DE ACUERDO A LAS NORMAS VIGENTES, EL PRESENTE CERTIFICADO DEBERÁ SER FIRMADO POR LA AUTORIDAD COMPETENTE.',
                'ESTE CERTIFICADO DEBERÁ COLOCARSE EN UN LUGAR VISIBLE DENTRO DE LA EDIFICACIÓN, LOCAL, ESTABLECIMIENTO O INSTALACIÓN.',
                'CUALQUIER TACHA O ENMENDADURA INVALIDA EL PRESENTE CERTIFICADO.',
                'VIGENCIA ESTABLECIDA EN EL ARTÍCULO ÚNICO DE LA LEY N° 30619',
              ].map((texto, i) => (
                <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '10px', flexShrink: 0 }}>•</span>
                  <p style={{ margin: 0, fontSize: '9px', lineHeight: '1.45' }}>{texto}</p>
                </div>
              ))}
            </div>
            {qrUrl && (
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <QRCode value={qrUrl} size={72} level="M" />
                <p style={{ fontSize: '7px', margin: '3px 0 0 0', textAlign: 'center', color: '#555' }}>
                  Verificar documento
                </p>
              </div>
            )}
          </div>

        </div>{/* fin cert-page */}
      </div>{/* fin cert-wrapper */}
    </>
  )
}

export default ItseImprimirPage
