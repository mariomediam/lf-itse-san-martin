import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import TopBar from '@components/layout/TopBar'
import SideMenu from '@components/layout/SideMenu'
import ExpedienteHeader from '@features/expedientes/components/ExpedienteHeader'
import BuscadorInspector from '../components/BuscadorInspector'
import InspectorCard from '../components/InspectorCard'
import InspectorFormModal from '../components/InspectorFormModal'
import { dashboardApi } from '@api/dashboardApi'
import { inspectoresApi } from '@api/inspectoresApi'
import useInspectoresStore from '@store/inspectoresStore'

export default function InspectoresPage() {
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [menus,        setMenus]        = useState([])
  const [inspectores,  setInspectores]  = useState([])
  const [loading,      setLoading]      = useState(false)
  const [buscado,      setBuscado]      = useState(false)
  const [modalAgregar, setModalAgregar] = useState(false)

  const { busqueda, setBusqueda } = useInspectoresStore()

  const busquedaInicialRef = useRef(busqueda)

  useEffect(() => {
    dashboardApi.getMenusUsuario()
      .then((res) => setMenus(res.data))
      .catch(() => toast.error('Error al cargar el menú'))
  }, [])

  const ejecutarBusqueda = useCallback(async (params) => {
    setLoading(true)
    setBuscado(true)
    try {
      const res = await inspectoresApi.buscar(params)
      setInspectores(res.data)
    } catch (error) {
      const msg = error.response?.data?.error || 'Error al buscar inspectores'
      toast.error(msg)
      setInspectores([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Restaurar última búsqueda al montar
  useEffect(() => {
    if (busquedaInicialRef.current) {
      ejecutarBusqueda(busquedaInicialRef.current)
    }
  }, [ejecutarBusqueda])

  const handleBuscar = (params) => {
    setBusqueda(params)
    ejecutarBusqueda(params)
  }

  const handleActualizar = () => {
    const ultima = useInspectoresStore.getState().busqueda
    ejecutarBusqueda(ultima ?? {})
  }

  return (
    <div className="flex flex-col h-screen bg-neutral">
      <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1 overflow-hidden">
        <SideMenu menus={menus} isOpen={sidebarOpen} />

        <main className="flex-1 overflow-y-auto p-6">
          <ExpedienteHeader
            titulo="Inspectores"
            subtitulo="Gestione los inspectores registrados en el sistema"
            onActualizar={handleActualizar}
            onAgregar={() => setModalAgregar(true)}
            labelAgregar="Agregar inspector"
          />

          {/* Buscador */}
          <BuscadorInspector
            onBuscar={handleBuscar}
            loading={loading}
            initialParams={busquedaInicialRef.current}
          />

          {/* Spinner de carga */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {/* Resultados */}
          {!loading && buscado && (
            <>
              {/* Contador */}
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm font-medium text-gray-700">
                  {inspectores.length}{' '}
                  {inspectores.length === 1 ? 'inspector encontrado' : 'inspectores encontrados'}
                </p>
              </div>

              {/* Lista */}
              {inspectores.length > 0 ? (
                <div className="space-y-3">
                  {inspectores.map((i) => (
                    <InspectorCard key={i.id} inspector={i} onRefrescar={handleActualizar} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No se encontraron inspectores con los criterios indicados.
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal agregar inspector */}
      <InspectorFormModal
        isOpen={modalAgregar}
        onClose={() => setModalAgregar(false)}
        onSuccess={() => {
          setModalAgregar(false)
          handleActualizar()
        }}
      />
    </div>
  )
}
