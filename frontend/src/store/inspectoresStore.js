import { create } from 'zustand'

/**
 * Store global para persistir el estado de búsqueda de la página de inspectores.
 *
 * busqueda : { busqueda: string } | null
 */
const useInspectoresStore = create((set) => ({
  busqueda: null,
  setBusqueda: (params) => set({ busqueda: params }),
}))

export default useInspectoresStore
