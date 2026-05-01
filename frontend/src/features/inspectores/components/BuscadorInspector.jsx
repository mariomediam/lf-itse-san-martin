import { useState } from 'react'

/**
 * Formulario de búsqueda de inspectores.
 *
 * Props
 * -----
 * onBuscar      : (params: object) => void
 * loading       : boolean
 * initialParams : object | null  — restaura los filtros previos
 */
export default function BuscadorInspector({ onBuscar, loading, initialParams }) {
  const [busqueda, setBusqueda] = useState(initialParams?.busqueda ?? '')

  const handleSubmit = (e) => {
    e.preventDefault()
    const params = {}
    if (busqueda.trim()) params.busqueda = busqueda.trim()
    onBuscar(params)
  }

  const inputClass =
    'flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
        {/* Texto libre */}
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre del inspector..."
          className={inputClass}
        />

        {/* Botón buscar */}
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white
                     text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors
                     disabled:opacity-50 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Buscar
        </button>
      </form>
    </div>
  )
}
