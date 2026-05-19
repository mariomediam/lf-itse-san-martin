import api from './axios'

export const licenciasApi = {
  buscar: (filtro, valor) =>
    api.get('/api/lf-itse/licencias-funcionamiento/buscar/', { params: { filtro, valor } }),

  crear: (data) =>
    api.post('/api/lf-itse/licencias-funcionamiento/', data),

  modificar: (id, data) =>
    api.put(`/api/lf-itse/licencias-funcionamiento/${id}/`, data),

  registrarNotificacion: (id, data) =>
    api.patch(`/api/lf-itse/licencias-funcionamiento/${id}/notificacion/`, data),

  getGiros: (licenciaId) =>
    api.get(`/api/lf-itse/licencias-funcionamiento/${licenciaId}/giros/`),

  verificarExpediente: (numero_expediente, anio) =>
    api.get('/api/lf-itse/licencias-funcionamiento/verificar-expediente/', {
      params: { numero_expediente, anio },
    }),

  getTiposLicencia: () =>
    api.get('/api/lf-itse/tipos-licencia/', { params: { esta_activo: 'true' } }),

  getNivelesRiesgo: () =>
    api.get('/api/lf-itse/niveles-riesgo/', { params: { esta_activo: 'true' } }),

  getZonificaciones: () =>
    api.get('/api/lf-itse/zonificaciones/', { params: { esta_activo: 'true' } }),

  getActividades: () =>
    api.get('/api/lf-itse/actividades/'),

  buscarGiros: (busqueda) =>
    api.get('/api/lf-itse/giros/buscar/', { params: { busqueda, esta_activo: 'true' } }),

  listarEstados: (licenciaId) =>
    api.get(`/api/lf-itse/licencias-funcionamiento/${licenciaId}/estados/`),

  getEstadosInactivosLf: () =>
    api.get('/api/lf-itse/estados/inactivos-lf/'),

  inactivarLicencia: (data) =>
    api.post('/api/lf-itse/licencias-funcionamiento/inactivar/', data),

  listarArchivos: (licenciaId) =>
    api.get(`/api/lf-itse/licencias-funcionamiento/${licenciaId}/archivos/`),

  subirArchivo: (licenciaId, formData) =>
    api.post(`/api/lf-itse/licencias-funcionamiento/${licenciaId}/archivos/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  eliminar: (id) =>
    api.delete(`/api/lf-itse/licencias-funcionamiento/${id}/`),

  eliminarArchivo: (archivoId) =>
    api.delete(`/api/lf-itse/licencias-funcionamiento/archivos/${archivoId}/`),

  descargarArchivo: (uuid) =>
    api.get(`/api/lf-itse/licencias-funcionamiento/archivos/${uuid}/descargar/`, {
      responseType: 'blob',
    }),

  consultar: (params) =>
    api.get('/api/lf-itse/licencias-funcionamiento/consulta/', { params }),
}
