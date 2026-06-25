import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCode } from 'react-qr-code'
import { licenciasApi } from '@api/licenciasApi'
import { personasApi } from '@api/personasApi'
import { configPublicaApi } from '@api/configPublicaApi'
import bgImage from '@assets/images/bg-licencia-funcionamiento-final.png'

// ── Constantes ────────────────────────────────────────────────────────────────

const CODIGO_DNI = '01'
const CODIGO_CE  = '04'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const VERDE_TABLA = '#B0D9D0'
const VERDE_CLARO = '#c8dfd0'
const ROJO        = '#cc0000'
const VERDE_PIE   = '#D1E287'
const VERDE_PIE_TEXTO = '#378176'

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
      border: '1.5px solid #000',
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
      border: '1.5px solid #000',
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


// ── Página ────────────────────────────────────────────────────────────────────

const LicenciaImprimirPage = () => {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [licencia,     setLicencia]     = useState(null)
  const [giros,        setGiros]        = useState([])
  const [docIdentidad, setDocIdentidad] = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [error,        setError]        = useState(null)
  const [qrUrl,        setQrUrl]        = useState(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true)
        const [licRes, girosRes, configRes] = await Promise.all([
          licenciasApi.buscar('ID', id),
          licenciasApi.getGiros(id),
          configPublicaApi.getConfig().catch(() => ({ data: {} })),
        ])

        const lic = licRes.data[0]
        if (!lic) { setError('Licencia no encontrada.'); return }

        setLicencia(lic)
        setGiros(girosRes.data)

        const cfg = configRes.data
        if (cfg.qr_verificacion_habilitado && cfg.qr_url_verificar_licencia && lic.uuid) {
          const base = cfg.qr_url_verificar_licencia.replace(/\/+$/, '')
          setQrUrl(`${base}/${lic.uuid}`)
        }

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


  // Estilos compartidos para <th> de la tabla 2
  const thSt = {
    border: '1.5px solid #000',
    background: VERDE_CLARO,
    padding: '3px 6px',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: '9px',
    textTransform: 'uppercase',
  }

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
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', color: '#3C897A', letterSpacing: '2px', fontWeight: 'bold', marginTop: '-6px' }}>
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
                  <Td style={{ fontWeight: 'bold', fontSize: '14px' }}>{nroExpediente}</Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatFechaLarga(licencia.fecha_recepcion)}</Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatFechaLarga(licencia.fecha_emision)}</Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '16px', background: '#fff' }}>{nroLicencia}</Td>
                </tr>
              </tbody>
            </table>

            {/* Tabla 2: Resolución / Vigencia / Actividad Económica */}
            {/* colgroup es la única forma fiable de fijar anchos con tableLayout:fixed
                cuando hay colSpan en los encabezados. Los 9 valores deben sumar 100%. */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '20%' }} />{/* N° DE RESOLUCIÓN          */}
                <col style={{ width: '12%' }} />{/* Indeterminado             */}
                <col style={{ width: '3%'  }} />{/* X indeterminado           */}
                <col style={{ width: '12%' }} />{/* Temporal                  */}
                <col style={{ width: '3%'  }} />{/* X temporal                */}
                <col style={{ width: '20%' }} />{/* ACTIVIDAD ECONÓMICA       */}
                <col style={{ width: '10%' }} />{/* Comercio                  */}
                <col style={{ width: '10%' }} />{/* Servicio                  */}
                <col style={{ width: '10%' }} />{/* Industria                 */}
              </colgroup>
              <tbody>
                {/* ── Fila 1: encabezados ── */}
                <tr>
                  <th style={{ ...thSt, fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontStretch: 'condensed' }}>N° DE RESOLUCIÓN</th>
                  <th colSpan={4} style={{ ...thSt, fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontStretch: 'condensed' }}>VIGENCIA</th>
                  {/* rowSpan=2: cubre la celda vacía de la fila de datos */}
                  <th rowSpan={2} style={{ ...thSt, verticalAlign: 'middle', fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontStretch: 'condensed' }}>
                    ACTIVIDAD<br />ECONÓMICA
                  </th>
                  <th style={{ ...thSt, fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontStretch: 'condensed' }}>Comercio</th>
                  <th style={{ ...thSt, fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontStretch: 'condensed' }}>Servicio</th>
                  <th style={{ ...thSt, fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontStretch: 'condensed' }}>Industria</th>
                </tr>
                {/* ── Fila 2: valor resolución + sub-etiquetas VIGENCIA + checkboxes ── */}
                <tr>
                  <Td style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {licencia.resolucion_numero || '-'}
                  </Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '14px' }}>Indeterminado</Td>
                  <Td style={{ fontSize: '13px', fontWeight: 'bold' }}>
                    {licencia.es_vigencia_indeterminada ? 'X' : ''}
                  </Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '14px' }}>Temporal</Td>
                  <Td style={{ fontSize: '13px', fontWeight: 'bold' }}>
                    {!licencia.es_vigencia_indeterminada ? 'X' : ''}
                  </Td>
                  {/* Sin celda para ACTIVIDAD — cubierta por rowSpan=2 de la fila 1 */}
                  <Td style={{ fontWeight: 'bold', fontSize: '15px', background: '#fff' }}>{actividadId === 1 ? 'X' : ''}</Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '15px', background: '#fff' }}>{actividadId === 2 ? 'X' : ''}</Td>
                  <Td style={{ fontWeight: 'bold', fontSize: '15px', background: '#fff' }}>{actividadId === 3 ? 'X' : ''}</Td>
                </tr>
              </tbody>
            </table>

            {/* ── DATOS DEL NEGOCIO + SELLO ────────────────────────────────── */}
            {/* position:relative permite que el sello quede en la esquina inf-der
                sin afectar el ancho de la tabla de datos */}
            <div style={{ position: 'relative', flex: 1, marginTop: '2px' }}>

              {/* Tabla de datos: <table> real = width:100% garantizado */}
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 3px' }}>
                <colgroup>
                  {/* col 1: etiqueta fija */}
                  <col style={{ width: '185px' }} />
                  {/* col 2: dos puntos */}
                  <col style={{ width: '12px' }} />
                  {/* col 3: valor → toma todo el espacio restante */}
                  <col />
                </colgroup>
                <tbody>
                  {[
                    {
                      label: 'Razón Social / Nombre(s)',
                      value: licencia.titular_nombre || '-',
                      right: licencia.titular_ruc ? `RUC: ${licencia.titular_ruc}` : null,
                    },
                    {
                      label: 'Representante Legal',
                      value: licencia.conductor_nombre || '-',
                      right: docIdentidad
                        ? `${etiquetaDocumento(docIdentidad)}: ${docIdentidad.numero_documento}`
                        : null,
                    },
                    { label: 'Nombre Comercial',             value: licencia.nombre_comercial || '-' },
                    { label: 'Dirección del Establecimiento', value: licencia.direccion || '-' },
                    { label: 'Giro Comercial',               value: girosTexto || '-' },
                  ].map(({ label, value, right }) => (
                    <tr key={label}>
                      {/* Las tres celdas usan verticalAlign:'middle' para quedar
                          en la misma línea horizontal */}
                      <td style={{ fontSize: '14px', lineHeight: '1.3', verticalAlign: 'middle', padding: '7px 0', whiteSpace: 'nowrap' }}>
                        {label}
                      </td>
                      <td style={{ fontWeight: 'bold', fontSize: '10px', verticalAlign: 'middle', padding: '7px 2px' }}>:</td>
                      <td style={{ borderBottom: '1px solid #333', verticalAlign: 'middle', padding: '7px 8px 7px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '1.3', textTransform: 'uppercase' }}>
                            {value}
                          </span>
                          {right && (
                            <span style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                              {right}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Fila especial: Área del Establecimiento */}
                  <tr>
                    <td colSpan={3} style={{ paddingTop: '2px' }}>
                      <span style={{ fontSize: '14px' }}>
                        Área del Establecimiento (m²):
                      </span>
                      <span style={{
                        display: 'inline-block',
                        borderBottom: '1px solid #333',
                        minWidth: '80px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        paddingLeft: '4px',
                        marginLeft: '4px',
                        lineHeight: '1.4',
                      }}>
                        {licencia.area != null ? `${licencia.area}` : ''}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Sello: posicionado en la esquina inferior derecha */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '250px',
                textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '9px', lineHeight: '1.4', textTransform: 'uppercase' }}>
                  MUNICIPALIDAD PROVINCIAL DE SAN MARTÍN
                </p>
                <p style={{ margin: 0, fontSize: '8px', lineHeight: '1.4', textTransform: 'uppercase' }}>
                  SUB GERENCIA DE DESARROLLO ECONÓMICO LOCAL
                </p> <br /><br /> 
                <div style={{ borderBottom: '1px solid #000', margin: '4px 16px 2px 16px' }} />
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '8px', lineHeight: '1.5', textTransform: 'uppercase' }}>
                  C.P.C RUTH LEYDITH HUAMANJULCA JORDAN
                </p>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '9.5px', lineHeight: '1.3', textTransform: 'uppercase' }}>
                  SUB GERENTE
                </p>
              </div>

            </div>
          </div>{/* fin cuerpo principal */}

          {/* ── PIE DE PÁGINA ─────────────────────────────────────────────── */}
          <div style={{
            background: VERDE_PIE,
            color: VERDE_PIE_TEXTO,
            padding: '4px 24px',
            fontWeight: 'bold',            
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            lineHeight: '1',
            flexShrink: 0,
            fontFamily: "'Bebas Neue', sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '34px' }}>ES OBLIGATORIO QUE SE EXHIBA EN UN LUGAR VISIBLE.</div>
              <div style={{ fontSize: '28px' }}>NO AUTORIZA EL USO DE LA VÍA PÚBLICA NI EL RETIRO MUNICIPAL.</div>
            </div>
            {qrUrl && (
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <QRCode value={qrUrl} size={72} level="M" />
                <p style={{ fontSize: '7px', margin: '3px 0 0 0', textAlign: 'center', color: '#555', letterSpacing: '0', textTransform: 'none', fontFamily: 'Arial, sans-serif', fontWeight: 'normal' }}>
                  Verificar documento
                </p>
              </div>
            )}
          </div>
        </div>{/* fin certificado */}
      </div>{/* fin cert-wrapper */}
    </>
  )
}

export default LicenciaImprimirPage
