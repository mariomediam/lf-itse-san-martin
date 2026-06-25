import api from './axios'

export const configPublicaApi = {
  getConfig: () => api.get('/api/lf-itse/config-publica/'),

  verificarLicencia: (uuid) =>
    api.get(`/api/lf-itse/verificar/licencia/${uuid}/`),

  verificarItse: (uuid) =>
    api.get(`/api/lf-itse/verificar/itse/${uuid}/`),
}
