import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import useAuthStore from '@store/authStore'
import LoginPage from '@features/auth/pages/LoginPage'
import ProductsPage from '@features/products/pages/ProductsPage'
import DashboardPage from '@features/dashboard/pages/DashboardPage'
import ExpedientesPage from '@features/expedientes/pages/ExpedientesPage'
import NuevoExpedientePage from '@features/expedientes/pages/NuevoExpedientePage'
import ModificarExpedientePage from '@features/expedientes/pages/ModificarExpedientePage'
import VerExpedientePage from '@features/expedientes/pages/VerExpedientePage'
import LicenciasPage from '@features/licencias/pages/LicenciasPage'
import NuevaLicenciaPage from '@features/licencias/pages/NuevaLicenciaPage'
import ModificarLicenciaPage from '@features/licencias/pages/ModificarLicenciaPage'
import LicenciaImprimirPage from '@features/licencias/pages/LicenciaImprimirPage'
import ItsePage from '@features/itse/pages/ItsePage'
import NuevaItsePage from '@features/itse/pages/NuevaItsePage'
import ModificarItsePage from '@features/itse/pages/ModificarItsePage'
import ItseImprimirPage from '@features/itse/pages/ItseImprimirPage'
import ReporteLicenciasPage from '@features/reportes/pages/ReporteLicenciasPage'
import ReporteItsePage from '@features/reportes/pages/ReporteItsePage'
import ReporteExpedientesPage from '@features/reportes/pages/ReporteExpedientesPage'
import PersonasPage from '@features/personas/pages/PersonasPage'
import GirosPage from '@features/giros/pages/GirosPage'
import InspectoresPage from '@features/inspectores/pages/InspectoresPage'
import ZonificacionesPage from '@features/zonificaciones/pages/ZonificacionesPage'
import TiposProcedimientoTupaPage from '@features/tipos-procedimiento-tupa/pages/TiposProcedimientoTupaPage'
import UsuariosPage from '@features/usuarios/pages/UsuariosPage'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, checkAuth } = useAuthStore()

  // Verificación síncrona: si Zustand dice autenticado pero no hay tokens
  // reales en localStorage, redirigir inmediatamente sin esperar checkAuth.
  // Esto rompe el ciclo de parpadeo antes de que arranque cualquier llamada.
  const hasTokens = !!(
    localStorage.getItem('access_token') &&
    localStorage.getItem('refresh_token')
  )

  useEffect(() => {
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !hasTokens) {
    return <Navigate to="/login" replace />
  }

  return children
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, checkAuth } = useAuthStore()

  useEffect(() => {
    const verifyAuth = async () => {
      await checkAuth()
    }
    verifyAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children
}

function App() {
  return (
    <>
      <Toaster 
        position="top-right"
        richColors
        closeButton
        expand={false}
        duration={4000}
      />
      <Routes>
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expedientes"
          element={
            <ProtectedRoute>
              <ExpedientesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expedientes/nuevo"
          element={
            <ProtectedRoute>
              <NuevoExpedientePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expedientes/:id"
          element={
            <ProtectedRoute>
              <VerExpedientePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expedientes/:id/modificar"
          element={
            <ProtectedRoute>
              <ModificarExpedientePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/licencias-funcionamiento"
          element={
            <ProtectedRoute>
              <LicenciasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/licencias-funcionamiento/nueva"
          element={
            <ProtectedRoute>
              <NuevaLicenciaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/licencias-funcionamiento/:id/modificar"
          element={
            <ProtectedRoute>
              <ModificarLicenciaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/licencias-funcionamiento/:id/imprimir"
          element={
            <ProtectedRoute>
              <LicenciaImprimirPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/certificados-itse"
          element={
            <ProtectedRoute>
              <ItsePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/certificados-itse/nuevo"
          element={
            <ProtectedRoute>
              <NuevaItsePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/certificados-itse/:id/modificar"
          element={
            <ProtectedRoute>
              <ModificarItsePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/certificados-itse/:id/imprimir"
          element={
            <ProtectedRoute>
              <ItseImprimirPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes/licencias-funcionamiento"
          element={
            <ProtectedRoute>
              <ReporteLicenciasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes/certificados-itse"
          element={
            <ProtectedRoute>
              <ReporteItsePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes/expedientes"
          element={
            <ProtectedRoute>
              <ReporteExpedientesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogos/personas"
          element={
            <ProtectedRoute>
              <PersonasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogos/giros"
          element={
            <ProtectedRoute>
              <GirosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogos/inspectores"
          element={
            <ProtectedRoute>
              <InspectoresPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogos/zonificaciones"
          element={
            <ProtectedRoute>
              <ZonificacionesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogos/tipos-procedimiento-tupa"
          element={
            <ProtectedRoute>
              <TiposProcedimientoTupaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <UsuariosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route 
          path="*" 
          element={
            <div className="min-h-screen flex items-center justify-center">
              <h1 className="text-2xl">404 - Page Not Found</h1>
            </div>
          } 
        />
      </Routes>
    </>
  )
}

export default App