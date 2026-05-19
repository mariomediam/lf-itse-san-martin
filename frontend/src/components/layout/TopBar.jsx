import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '@store/authStore'
import CambiarPasswordModal from '@features/usuarios/components/CambiarPasswordModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

const getInitials = (user) => {
  const fn = user?.first_name?.trim()
  const ln = user?.last_name?.trim()
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase()
  if (fn) return fn.slice(0, 2).toUpperCase()
  if (user?.username) return user.username.slice(0, 2).toUpperCase()
  return '?'
}

const getDisplayName = (user) => {
  const fn = user?.first_name?.trim()
  const ln = user?.last_name?.trim()
  if (fn && ln) return `${fn} ${ln}`
  if (fn) return fn
  return user?.username || ''
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IconoPassword = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
)

const IconoLogout = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)

// ── Componente ────────────────────────────────────────────────────────────────

export default function TopBar({ onToggleSidebar }) {
  const { user, logout }  = useAuthStore()
  const navigate          = useNavigate()

  const [menuAbierto,        setMenuAbierto]        = useState(false)
  const [modalPassword,      setModalPassword]      = useState(false)
  const menuRef = useRef(null)

  // Cierra el menú al hacer clic fuera
  useEffect(() => {
    if (!menuAbierto) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAbierto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuAbierto])

  const handleLogout = () => {
    setMenuAbierto(false)
    logout()
    navigate('/login')
  }

  const handleCambiarPassword = () => {
    setMenuAbierto(false)
    setModalPassword(true)
  }

  return (
    <>
      <header className="bg-primary text-white flex items-center justify-between px-4 py-3 shrink-0 shadow-md z-20">
        {/* Lado izquierdo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            aria-label="Alternar menú lateral"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <p className="text-xs font-medium opacity-75 leading-none">
              Municipalidad Provincial de San Martín
            </p>
            <p className="text-sm font-semibold leading-tight mt-0.5">
              Sistema de Gestión de Licencias de Funcionamiento e ITSE
            </p>
          </div>
        </div>

        {/* Lado derecho: nombre + avatar con menú */}
        <div ref={menuRef} className="relative flex items-center gap-2.5">
          <span className="text-sm font-medium hidden sm:block">
            {getDisplayName(user)}
          </span>

          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            className="w-9 h-9 rounded-full bg-tertiary flex items-center justify-center
                       text-sm font-bold shrink-0 select-none
                       hover:ring-2 hover:ring-white/40 transition-all"
            aria-label="Menú de usuario"
          >
            {getInitials(user)}
          </button>

          {/* Menú desplegable */}
          {menuAbierto && (
            <div className="absolute right-0 top-11 z-50 w-52 bg-white rounded-lg shadow-lg
                            border border-gray-200 py-1 text-gray-700">

              {/* Cabecera del menú */}
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {getDisplayName(user) || user?.username}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.username}</p>
              </div>

              {/* Opción: cambiar contraseña */}
              <button
                type="button"
                onClick={handleCambiarPassword}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                           hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-gray-500"><IconoPassword /></span>
                Cambiar contraseña
              </button>

              {/* Divider */}
              <div className="border-t border-gray-100 my-1" />

              {/* Opción: cerrar sesión */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                           text-danger hover:bg-red-50 transition-colors text-left"
              >
                <IconoLogout />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Modal cambiar contraseña del usuario actual */}
      <CambiarPasswordModal
        isOpen={modalPassword}
        onClose={() => setModalPassword(false)}
        onSuccess={() => setModalPassword(false)}
        usuario={user}
      />
    </>
  )
}
