import { useState, useEffect } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react'
import { toast } from 'sonner'
import { inspectoresApi } from '@api/inspectoresApi'

// ── Estilos comunes ───────────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ' +
  'disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400'

const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

// ── Estado inicial ────────────────────────────────────────────────────────────

const estadoInicial = {
  apellido_paterno: '',
  apellido_materno: '',
  nombres:          '',
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IconoGuardar = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
)

const IconoCancelar = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

// ── Componente principal ──────────────────────────────────────────────────────

/**
 * Modal para agregar o modificar un inspector.
 *
 * Props
 * -----
 * isOpen     : bool
 * onClose    : () => void
 * onSuccess  : () => void
 * inspector  : object | null  — si se pasa, modo edición
 */
export default function InspectorFormModal({ isOpen, onClose, onSuccess, inspector = null }) {
  const esEdicion = !!inspector

  const [formData,     setFormData]     = useState(estadoInicial)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Poblar formulario al abrir en modo edición
  useEffect(() => {
    if (!isOpen) return
    if (inspector) {
      setFormData({
        apellido_paterno: inspector.apellido_paterno ?? '',
        apellido_materno: inspector.apellido_materno ?? '',
        nombres:          inspector.nombres          ?? '',
      })
    } else {
      setFormData(estadoInicial)
    }
  }, [isOpen, inspector])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleClose = () => {
    setFormData(estadoInicial)
    onClose()
  }

  const handleSubmit = async () => {
    if (!formData.apellido_paterno.trim()) {
      toast.error('El apellido paterno es obligatorio')
      return
    }
    if (!formData.apellido_materno.trim()) {
      toast.error('El apellido materno es obligatorio')
      return
    }
    if (!formData.nombres.trim()) {
      toast.error('Los nombres son obligatorios')
      return
    }

    const body = {
      apellido_paterno: formData.apellido_paterno.trim(),
      apellido_materno: formData.apellido_materno.trim(),
      nombres:          formData.nombres.trim(),
    }

    setIsSubmitting(true)
    try {
      if (esEdicion) {
        await inspectoresApi.actualizar(inspector.id, body)
      } else {
        await inspectoresApi.crear(body)
      }
      toast.success(esEdicion ? 'Inspector actualizado correctamente' : 'Inspector creado correctamente')
      onSuccess?.()
      handleClose()
    } catch (err) {
      const data = err.response?.data
      const detail =
        data?.error ||
        data?.detail ||
        data?.non_field_errors?.[0] ||
        (typeof data === 'string' ? data : null) ||
        'Error al guardar el inspector'
      toast.error(detail)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal show={isOpen} size="md" onClose={handleClose}>

      {/* ── Cabecera ── */}
      <ModalHeader className="bg-white border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <span className="text-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </span>
          <span className="text-base font-semibold text-gray-800">
            {esEdicion ? 'Modificar inspector' : 'Agregar inspector'}
          </span>
        </div>
      </ModalHeader>

      {/* ── Cuerpo ── */}
      <ModalBody className="bg-white px-6 py-5 space-y-5">

        {/* Apellido paterno */}
        <div>
          <label className={labelClass}>
            Apellido paterno <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            name="apellido_paterno"
            value={formData.apellido_paterno}
            onChange={handleChange}
            placeholder="Ej. GARCIA"
            className={inputClass}
            maxLength={50}
          />
        </div>

        {/* Apellido materno */}
        <div>
          <label className={labelClass}>
            Apellido materno <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            name="apellido_materno"
            value={formData.apellido_materno}
            onChange={handleChange}
            placeholder="Ej. LOPEZ"
            className={inputClass}
            maxLength={50}
          />
        </div>

        {/* Nombres */}
        <div>
          <label className={labelClass}>
            Nombres <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            name="nombres"
            value={formData.nombres}
            onChange={handleChange}
            placeholder="Ej. JUAN CARLOS"
            className={inputClass}
            maxLength={50}
          />
        </div>

      </ModalBody>

      {/* ── Pie ── */}
      <ModalFooter className="border-t border-gray-200 bg-white flex justify-end gap-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600
            rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconoCancelar />
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-white
            rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <IconoGuardar />
          )}
          {isSubmitting ? 'Guardando...' : 'Guardar inspector'}
        </button>
      </ModalFooter>
    </Modal>
  )
}
