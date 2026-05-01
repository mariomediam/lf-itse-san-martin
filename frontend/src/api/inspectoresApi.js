import api from './axios'

export const inspectoresApi = {
  buscar: (params = {}) =>
    api.get('/api/lf-itse/inspectores/buscar/', { params }),

  listar: () =>
    api.get('/api/lf-itse/inspectores/'),

  obtener: (id) =>
    api.get(`/api/lf-itse/inspectores/${id}/`),

  crear: (data) =>
    api.post('/api/lf-itse/inspectores/', data),

  actualizar: (id, data) =>
    api.put(`/api/lf-itse/inspectores/${id}/`, data),

  eliminar: (id) =>
    api.delete(`/api/lf-itse/inspectores/${id}/`),
}
