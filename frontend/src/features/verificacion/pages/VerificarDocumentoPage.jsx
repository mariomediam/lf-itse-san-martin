import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { configPublicaApi } from '@api/configPublicaApi'

const TIPOS = {
  licencia: {
    titulo: 'Licencia de Funcionamiento',
    fetcher: (uuid) => configPublicaApi.verificarLicencia(uuid),
  },
  itse: {
    titulo: 'Certificado ITSE',
    fetcher: (uuid) => configPublicaApi.verificarItse(uuid),
  },
}

const VerificarDocumentoPage = ({ tipo }) => {
  const { uuid } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  const config = TIPOS[tipo]

  useEffect(() => {
    const verificar = async () => {
      try {
        setCargando(true)
        const res = await config.fetcher(uuid)
        setData(res.data)
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Documento no encontrado o no disponible para consulta pública.')
        } else {
          setError('Error al verificar el documento. Intente nuevamente.')
        }
      } finally {
        setCargando(false)
      }
    }
    verificar()
  }, [uuid, tipo])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: '#fff',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        {/* Encabezado */}
        <div style={{
          background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
          padding: '24px 20px',
          textAlign: 'center',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <img
              src="/images/escudo-muni.png"
              alt="Escudo Municipal"
              style={{ height: '60px', width: 'auto' }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </div>
          <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
            Municipalidad Provincial de San Martín
          </p>
          <p style={{ fontSize: '13px', margin: 0, opacity: 0.9 }}>
            Verificación de {config.titulo}
          </p>
        </div>

        {/* Contenido */}
        <div style={{ padding: '24px 20px' }}>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #e5e7eb',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 12px',
              }} />
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Verificando documento...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p style={{ color: '#991b1b', fontSize: '14px', fontWeight: '600', margin: '0 0 4px 0' }}>
                No verificado
              </p>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
                {error}
              </p>
            </div>
          )}

          {data && (
            <>
              {/* Sello de estado */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 20px',
                  borderRadius: '24px',
                  backgroundColor: data.activa ? '#f0fdf4' : '#fef2f2',
                  border: `2px solid ${data.activa ? '#22c55e' : '#ef4444'}`,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke={data.activa ? '#22c55e' : '#ef4444'}
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {data.activa ? (
                      <><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
                    ) : (
                      <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
                    )}
                  </svg>
                  <span style={{
                    fontWeight: 'bold',
                    fontSize: '15px',
                    color: data.activa ? '#166534' : '#991b1b',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  }}>
                    {data.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>

              {/* Datos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <FilaVerificacion label="Tipo" valor={data.tipo === 'licencia_funcionamiento' ? 'Licencia de Funcionamiento' : 'Certificado ITSE'} />

                {data.tipo === 'licencia_funcionamiento' && (
                  <>
                    <FilaVerificacion label="N° Licencia" valor={data.numero_licencia} />
                    <FilaVerificacion label="Fecha Emisión" valor={data.fecha_emision} />
                    <FilaVerificacion label="Vigencia" valor={data.vigencia} />
                    <FilaVerificacion label="Nivel de Riesgo" valor={data.nivel_riesgo} />
                    <FilaVerificacion label="Horario" valor={data.horario} />
                    <FilaVerificacion label="Titular" valor={data.titular} />
                    <FilaVerificacion label="Nombre Comercial" valor={data.nombre_comercial} />
                    <FilaVerificacion label="Actividad Económica" valor={data.actividad_economica} />
                    <FilaVerificacion label="Dirección" valor={data.direccion} />
                    <FilaVerificacion label="Área" valor={data.area} />
                    {data.giros?.length > 0 && (
                      <div style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '6px' }}>
                          Giros Autorizados
                        </span>
                        {data.giros.map((g, i) => (
                          <p key={i} style={{ margin: '2px 0', fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                            {g.ciiu} - {g.nombre}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {data.tipo === 'certificado_itse' && (
                  <>
                    <FilaVerificacion label="N° ITSE" valor={data.numero_itse} />
                    <FilaVerificacion label="Fecha Expedición" valor={data.fecha_expedicion} />
                    <FilaVerificacion label="Fecha Solicitud Renovación" valor={data.fecha_solicitud_renovacion} />
                    <FilaVerificacion label="Fecha Caducidad" valor={data.fecha_caducidad} />
                    <FilaVerificacion label="Nivel de Riesgo" valor={data.nivel_riesgo} />
                    <FilaVerificacion label="Titular" valor={data.titular} />
                    <FilaVerificacion label="Nombre Comercial" valor={data.nombre_comercial} />
                    <FilaVerificacion label="Dirección" valor={data.direccion} />
                    <FilaVerificacion label="Área" valor={data.area} />
                    <FilaVerificacion label="Capacidad de Aforo" valor={data.capacidad_aforo} />
                    {data.giros?.length > 0 && (
                      <div style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '6px' }}>
                          Giros Autorizados
                        </span>
                        {data.giros.map((g, i) => (
                          <p key={i} style={{ margin: '2px 0', fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                            {g.ciiu} - {g.nombre}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Mensaje */}
              <div style={{
                marginTop: '20px',
                padding: '12px 16px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                borderLeft: '4px solid #3b82f6',
              }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                  {data.mensaje}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Pie */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          padding: '16px 20px',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
            Municipalidad Provincial de San Martín
          </p>
        </div>
      </div>
    </div>
  )
}

function FilaVerificacion({ label, valor }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '8px 0',
      borderBottom: '1px solid #f3f4f6',
    }}>
      <span style={{ fontSize: '13px', color: '#6b7280', flexShrink: 0, marginRight: '12px' }}>
        {label}
      </span>
      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827', textAlign: 'right' }}>
        {valor || '-'}
      </span>
    </div>
  )
}

export default VerificarDocumentoPage
