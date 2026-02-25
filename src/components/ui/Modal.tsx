'use client'

import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button, IconButton } from './Button'

// =============================================================================
// Types
// =============================================================================

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  icon?: ReactNode
}

// =============================================================================
// Modal Component
// =============================================================================

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  icon,
}: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-6xl',
  }

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose()
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.75)' }}
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full ${sizeClasses[size]} rounded-2xl overflow-hidden`}
        style={{
          background: 'linear-gradient(to bottom right, #0a0a0f 0%, #1a1a2e 50%, #0f1419 100%)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          maxHeight: 'calc(100vh - 2rem)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div
            className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
            style={{ borderBottom: '1px solid var(--glass-border)' }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {icon && <span className="text-[var(--accent-primary)] shrink-0">{icon}</span>}
              <div className="flex-1 min-w-0">
                {title && (
                  <h2 className="text-lg font-bold text-[var(--text-primary)] truncate">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
                )}
              </div>
            </div>
            {showCloseButton && (
              <IconButton
                icon={<X className="w-5 h-5" />}
                onClick={onClose}
                label="Close"
                size="sm"
              />
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-5 py-4 shrink-0"
            style={{ borderTop: '1px solid var(--glass-border)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(modalContent, document.body)
}

// =============================================================================
// Confirm Modal Component
// =============================================================================

export interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'error' | 'warning'
  loading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant === 'primary' ? 'primary' : variant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
    </Modal>
  )
}
