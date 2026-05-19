import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { licenciasApi } from '@api/licenciasApi'
import { personasApi } from '@api/personasApi'
import bgImage from '@assets/images/bg-licencia-funcionamiento-final.png'

// ── Constantes ────────────────────────────────────────────────────────────────

const CODIGO_DNI = '01'
const CODIGO_CE  = '04'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const VERDE_TABLA = '#1a5a3e'
const VERDE_CLARO = '#c8dfd0'
const ROJO        = '#cc0000'
const VERDE_PIE   = '#8CC63F'

// ── Helpers ───────────────────────────────────────────────────────────────────

const getAnio = (fechaStr) => {
  if (!fechaStr) return ''
  return new Date(String(fechaStr).slice(0, 10) + 'T00:00:00').getFullYear()
}

const formatFechaLarga = (fechaStr) => {
  if (!fechaStr) return '-'
  const d = new Date(String(fechaStr).slice(0, 10) + 'T00:00:00')
  return `${d.getDate()} DE ${MESES[d.getMonth()]} DEL ${d.getFullYear()}`
}

const etiquetaDocumento = (doc) => {
  if (!doc) return 'DNI/CE'
  if (doc.tipos_documento_identidad_codigo === CODIGO_DNI) return 'DNI'
  if (doc.tipos_documento_identidad_codigo === CODIGO_CE)  return 'CE'
  return 'DNI/CE'
}

// ── Componentes de layout ─────────────────────────────────────────────────────

function Th({ children, style = {} }) {
  return (
    <th style={{
      border: `1.5px solid ${VERDE_TABLA}`,
      background: VERDE_CLARO,
      padding: '3px 6px',
      textAlign: 'center',
      fontWeight: 'bold',
      fontSize: '9px',
      textTransform: 'uppercase',
      ...style,
    }}>
      {children}
    </th>
  )
}

function Td({ children, style = {} }) {
  return (
    <td style={{
      border: `1.5px solid ${VERDE_TABLA}`,
      padding: '3px 6px',
      textAlign: 'center',
      verticalAlign: 'middle',
      fontSize: '11px',
      ...style,
    }}>
      {children}
    </td>
  )
}

function FilaData({ label, right, children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      marginBottom: '5px',
      borderBottom: '1px solid #333',
      paddingBottom: '2px',
      gap: '4px',
      minHeight: '18px',
    }}>
      <div style={{ width: '195px', flexShrink: 0, fontWeight: 'bold', fontSize: '9.5px', lineHeight: '1.3' }}>
        {label}
      </div>
      <div style={{ marginRight: '3px', fontWeight: 'bold', fontSize: '10px' }}>:</div>
      <div style={{ flex: 1, fontSize: '11px', fontWeight: 'bold', lineHeight: '1.3', textTransform: 'uppercase' }}>
        {children}
      </div>
      {right && (
        <div style={{ flexShrink: 0, fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {right}
        </div>
      )}
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

  // ── Loading ────────────────────────────────────────────────────────────────

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

  // ── Error ──────────────────────────────────────────────────────────────────

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

  // ── Datos calculados ───────────────────────────────────────────────────────

  const anioLicencia   = getAnio(licencia.fecha_emision)
  const anioExpediente = getAnio(licencia.fecha_recepcion)

  const nroLicencia   = `${String(licencia.numero_licencia ?? '').padStart(4, '0')}-${anioLicencia}`
  const nroExpediente = `${String(licencia.numero_expediente ?? '').padStart(7, '0')}-${anioExpediente}`

  const actividadId = licencia.actividad_id

  const girosTexto = giros.map((g) => g.nombre).join(' / ')

  const vigenciaTexto = !licencia.es_vigencia_indeterminada && licencia.fecha_inicio_vigencia && licencia.fecha_fin_vigencia
    ? `${formatFechaLarga(licencia.fecha_inicio_vigencia)} AL ${formatFechaLarga(licencia.fecha_fin_vigencia)}`
    : ''

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Fuentes Google */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
        rel="stylesheet"
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');

        @media print {
          @page { size: A4 landscape; margin: 0; }
          body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
          .no-print    { display: none !important; }
          .cert-wrapper { padding: 0 !important; background: none !important; min-height: unset !important; }
          .certificado  { width: 297mm !important; height: 210mm !important; margin: 0 !important; box-shadow: none !important; }
        }
        @media screen {
          .cert-wrapper {
            background: #ffffff;
            min-height: 100vh;
            padding: 32px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }
          .certificado {
            box-shadow: 0 4px 16px rgba(0,0,0,0.25);
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
          Vista previa — LIC. N° {nroLicencia}
        </span>
      </div>

      {/* ── Wrapper de pantalla / contenedor de impresión ─────────────────── */}
      <div className="cert-wrapper">

        {/* ── CERTIFICADO A4 HORIZONTAL ────────────────────────────────────── */}
        <div
          className="certificado"
          style={{
            width: '297mm',
            height: '210mm',
            backgroundImage: `url(${bgImage})`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            fontFamily: "'Inter', Arial, sans-serif",
            color: '#000',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >

          {/* ── CUERPO PRINCIPAL ──────────────────────────────────────────── */}
          {/* paddingTop: salta el encabezado verde que provee la imagen de fondo */}
          <div style={{ flex: 1, padding: '50mm 80px 2px 80px', display: 'flex', flexDirection: 'column', gap: '5px' }}>

            {/* Título */}
            <div style={{ textAlign: 'center', lineHeight: '1' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '48px', letterSpacing: '1px', color: '#000' }}>
                LICENCIA DE FUNCIONAMIENTO
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', color: VERDE_TABLA, letterSpacing: '2px', fontWeight: 'bold', marginTop: '-6px' }}>
                LEY 28976
              </div>
              <div style={{ fontFamily: "'Inter', Arial, sans-serif", fontWeight: '800', fontSize: '21px', letterSpacing: '0.1px', marginTop: '2px' }}>
                ORDENANZA MUNICIPAL Nº 027-2021-MPSM
              </div>
            </div>

            {/* Tabla 1: N° Expediente / Fechas / N° Licencia */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <Th style={{ width: '25%', fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontStretch: 'condensed' }}>N° DE EXPEDIENTE</Th>
                  <Th style={{ width: '25%', fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontStretch: 'condensed' }}>FECHA DE SOLICITUD</Th>
                  <Th style={{ width: '25%', fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontStretch: 'condensed' }}>FECHA DE EMISIÓN</Th>
                  <Th style={{ width: '25%', background: ROJO, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontStretch: 'condensed' }}>N° DE LICENCIA</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td style={{ fontWeight: 'bold', fontSize: '12px' }}>{nroExpediente}</Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '11px' }}>{formatFechaLarga(licencia.fecha_recepcion)}</Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '11px' }}>{formatFechaLarga(licencia.fecha_emision)}</Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '14px', background: '#fff5f5' }}>{nroLicencia}</Td>
                </tr>
              </tbody>
            </table>

            {/* Tabla 2: Resolución / Vigencia / Actividad Económica */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {/* Resolución */}
                  <Th style={{ width: '22%' }}>N° DE RESOLUCIÓN</Th>

                  {/* Vigencia — encabezado con sub-columnas */}
                  <th style={{
                    border: `1.5px solid ${VERDE_TABLA}`,
                    padding: 0,
                    width: '28%',
                    background: VERDE_CLARO,
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td colSpan={4} style={{
                            textAlign: 'center', fontWeight: 'bold', fontSize: '9px',
                            textTransform: 'uppercase', padding: '2px 4px',
                            borderBottom: `1px solid ${VERDE_TABLA}`,
                          }}>
                            VIGENCIA
                          </td>
                        </tr>
                        <tr>
                          <td style={{ textAlign: 'center', fontSize: '8.5px', fontWeight: 'bold', padding: '2px 3px', width: '40%', borderRight: `1px solid ${VERDE_TABLA}` }}>INDETERMINADO</td>
                          <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', padding: '2px', width: '10%', borderRight: `1px solid ${VERDE_TABLA}` }}>
                            {licencia.es_vigencia_indeterminada ? 'X' : ''}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '8.5px', fontWeight: 'bold', padding: '2px 3px', width: '35%', borderRight: `1px solid ${VERDE_TABLA}` }}>TEMPORAL</td>
                          <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', padding: '2px', width: '15%' }}>
                            {!licencia.es_vigencia_indeterminada ? 'X' : ''}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </th>

                  {/* Actividad económica + checkboxes */}
                  <Th style={{ width: '17%' }}>ACTIVIDAD<br />ECONÓMICA</Th>
                  <Th style={{ width: '11%' }}>Comercio</Th>
                  <Th style={{ width: '11%' }}>Servicio</Th>
                  <Th style={{ width: '11%' }}>Industria</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '8px', fontSize: '10px' }}>
                    {licencia.resolucion_numero || '-'}
                  </Td>
                  <Td style={{ fontSize: '8.5px', color: '#444' }}>
                    {vigenciaTexto}
                  </Td>
                  <Td />
                  <Td style={{ fontWeight: 'bold', fontSize: '15px' }}>{actividadId === 1 ? 'X' : ''}</Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '15px' }}>{actividadId === 2 ? 'X' : ''}</Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '15px' }}>{actividadId === 3 ? 'X' : ''}</Td>
                </tr>
              </tbody>
            </table>

            {/* Datos del negocio + sello */}
            <div style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'flex-start', marginTop: '2px' }}>

              {/* Datos (izquierda) */}
              <div style={{ flex: 1 }}>
                <FilaData
                  label="Razón Social / Nombre(s)"
                  right={licencia.titular_ruc ? `RUC: ${licencia.titular_ruc}` : undefined}
                >
                  {licencia.titular_nombre || '-'}
                </FilaData>

                <FilaData
                  label="Representante Legal"
                  right={docIdentidad ? `${etiquetaDocumento(docIdentidad)}: ${docIdentidad.numero_documento}` : undefined}
                >
                  {licencia.conductor_nombre || '-'}
                </FilaData>

                <FilaData label="Nombre Comercial">
                  {licencia.nombre_comercial || '-'}
                </FilaData>

                <FilaData label="Dirección del Establecimiento">
                  {licencia.direccion || '-'}
                </FilaData>

                <FilaData label="Giro Comercial">
                  {girosTexto || '-'}
                </FilaData>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginTop: '4px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '9.5px' }}>
                    Área del Establecimiento (m²):
                  </div>
                  <div style={{
                    borderBottom: '1px solid #333',
                    minWidth: '80px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    paddingLeft: '4px',
                    lineHeight: '1.4',
                  }}>
                    {licencia.area != null ? `${licencia.area}` : ''}
                  </div>
                </div>
              </div>

              {/* Sello (derecha) */}
              <div style={{
                width: '170px',
                flexShrink: 0,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                gap: '4px',
                paddingBottom: '2px',
                alignSelf: 'flex-end',
              }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '9px', lineHeight: '1.4', textTransform: 'uppercase' }}>
                    MUNICIPALIDAD PROVINCIAL DE SAN MARTÍN
                  </p>
                  <p style={{ margin: 0, fontSize: '8px', lineHeight: '1.4', textTransform: 'uppercase' }}>
                    SUB GERENCIA DE DESARROLLO ECONÓMICO LOCAL
                  </p>
                </div>
                <div style={{ borderBottom: '1px solid #000', margin: '4px 16px 2px 16px' }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '8px', lineHeight: '1.5', textTransform: 'uppercase' }}>
                    C.P.C RUTH LEYDITH HUAMANJULCA JORDAN
                  </p>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '9.5px', lineHeight: '1.3', textTransform: 'uppercase' }}>
                    SUB GERENTE
                  </p>
                </div>
              </div>

            </div>
          </div>{/* fin cuerpo principal */}

          {/* ── PIE DE PÁGINA ─────────────────────────────────────────────── */}
          <div style={{
            background: VERDE_PIE,
            color: '#fff',
            textAlign: 'center',
            padding: '7px 24px',
            fontWeight: 'bold',
            fontSize: '10.5px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            lineHeight: '1.7',
            flexShrink: 0,
          }}>
            <div>ES OBLIGATORIO QUE SE EXHIBA EN UN LUGAR VISIBLE.</div>
            <div>NO AUTORIZA EL USO DE LA VÍA PÚBLICA NI EL RETIRO MUNICIPAL.</div>
          </div>

        </div>{/* fin certificado */}
      </div>{/* fin cert-wrapper */}
    </>
  )
}

export default LicenciaImprimirPage
