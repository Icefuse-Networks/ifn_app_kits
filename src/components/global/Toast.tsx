'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ============================================================================
// Toast Types
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type?: ToastType
  variant?: ToastType // Alias for type
  title: string
  description?: string
  duration?: number
}

// Input type for addToast - requires either type or variant
export type ToastInput = Omit<Toast, 'id'> & ({ type: ToastType } | { variant: ToastType })

interface ToastFn {
  (options: ToastInput): void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

export interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: ToastInput) => void
  removeToast: (id: string) => void
  toast: ToastFn
}

// ============================================================================
// Toast Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// ============================================================================
// Toast Provider
// ============================================================================

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toastInput: ToastInput) => {
    const id = Math.random().toString(36).substring(2, 9)
    // Support both 'type' and 'variant' for backward compatibility
    const type = toastInput.type || toastInput.variant || 'info'
    const newToast = { ...toastInput, id, type }

    setToasts((prev) => [...prev, newToast])

    // Auto remove after duration
    const duration = toastInput.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Create the toast function with helper methods
  const toastFn = useMemo(() => {
    const fn = ((options: ToastInput) => addToast(options)) as ToastFn
    fn.success = (title: string, description?: string) =>
      addToast({ type: 'success', title, description })
    fn.error = (title: string, description?: string) =>
      addToast({ type: 'error', title, description })
    fn.warning = (title: string, description?: string) =>
      addToast({ type: 'warning', title, description })
    fn.info = (title: string, description?: string) =>
      addToast({ type: 'info', title, description })
    return fn
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast: toastFn }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// ============================================================================
// Toast Container
// ============================================================================

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (typeof window === 'undefined') return null
  if (toasts.length === 0) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 380,
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  )
}

// ============================================================================
// Toast Item
// ============================================================================

// Icon and color mappings for toast types
const toastConfig: Record<ToastType, { icon: typeof CheckCircle; color: string }> = {
  success: { icon: CheckCircle, color: 'var(--status-success)' },
  error: { icon: XCircle, color: 'var(--status-error)' },
  warning: { icon: AlertTriangle, color: 'var(--status-warning)' },
  info: { icon: Info, color: 'var(--accent-primary)' },
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const effectiveType = toast.type || toast.variant || 'info'
  const config = toastConfig[effectiveType]
  const Icon = config.icon

  return (
    <div
      style={{
        pointerEvents: 'auto',
        background: 'rgba(26, 26, 46, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        animation: 'toast-slide-in 200ms ease-out',
      }}
    >
      {/* Icon */}
      <Icon
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          marginTop: 1,
          color: config.color,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {toast.title}
        </div>
        {toast.description && (
          <div
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {toast.description}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          flexShrink: 0,
          padding: 4,
          borderRadius: '8px',
          color: 'var(--text-tertiary)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 150ms ease-out, background 150ms ease-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)'
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-tertiary)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <X style={{ width: 16, height: 16 }} />
      </button>

      <style jsx global>{`
        @keyframes toast-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

// ============================================================================
// Toast Helpers (standalone usage - warns if used outside provider)
// ============================================================================

export function toast(_options: Omit<Toast, 'id'>) {
  console.warn('Toast called outside of provider context. Use useToast hook instead.')
}

toast.success = (_title: string, _description?: string) => {
  console.warn('Toast called outside of provider context. Use useToast hook instead.')
}

toast.error = (_title: string, _description?: string) => {
  console.warn('Toast called outside of provider context. Use useToast hook instead.')
}

toast.warning = (_title: string, _description?: string) => {
  console.warn('Toast called outside of provider context. Use useToast hook instead.')
}

toast.info = (_title: string, _description?: string) => {
  console.warn('Toast called outside of provider context. Use useToast hook instead.')
}
