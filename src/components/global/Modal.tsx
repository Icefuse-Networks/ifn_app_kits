'use client'

import {
  forwardRef,
  useState,
  useEffect,
  useCallback,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Button } from './Button'

// ============================================================================
// Modal Component
// ============================================================================

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full'

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-[90vw]',
}

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean
  isOpen?: boolean // Alias for open
  onClose: () => void
  size?: ModalSize
  closeOnOverlay?: boolean
  closeOnEscape?: boolean
  title?: string // Convenience prop - handled by ModalHeader
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      className,
      open,
      isOpen,
      onClose,
      size = 'md',
      closeOnOverlay = true,
      closeOnEscape = true,
      title: _title,
      children,
      ...props
    },
    ref
  ) => {
    const effectiveOpen = open ?? isOpen ?? false
    const [isClosing, setIsClosing] = useState(false)
    const [shouldRender, setShouldRender] = useState(false)
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Handle the close animation
    const handleClose = useCallback(() => {
      if (isClosing) return
      setIsClosing(true)
      closeTimeoutRef.current = setTimeout(() => {
        setIsClosing(false)
        onClose()
      }, 200) // Animation duration
    }, [isClosing, onClose])

    // Handle escape key
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === 'Escape' && closeOnEscape) {
          handleClose()
        }
      },
      [closeOnEscape, handleClose]
    )

    // Sync render state with open prop
    useEffect(() => {
      if (effectiveOpen) {
        setShouldRender(true)
        setIsClosing(false)
      }
    }, [effectiveOpen])

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current)
        }
      }
    }, [])

    useEffect(() => {
      if (shouldRender && !isClosing) {
        document.addEventListener('keydown', handleKeyDown)
        document.body.style.overflow = 'hidden'
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }, [shouldRender, isClosing, handleKeyDown])

    // Handle render state after close animation
    useEffect(() => {
      if (!effectiveOpen && !isClosing) {
        setShouldRender(false)
      }
    }, [effectiveOpen, isClosing])

    if (!shouldRender) return null

    const modalContent = (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        aria-modal="true"
        role="dialog"
      >
        {/* Overlay - PERF: Removed backdrop-blur-sm for GPU performance */}
        <div
          className={cn(
            'absolute inset-0 bg-black/80 transition-opacity duration-200',
            isClosing ? 'opacity-0' : 'opacity-100'
          )}
          onClick={closeOnOverlay ? handleClose : undefined}
        />

        {/* Modal Content */}
        <div
          ref={ref}
          className={cn(
            'relative w-full',
            sizeStyles[size],
            'bg-[var(--bg-secondary)] rounded-xl',
            'border border-[var(--glass-border)]',
            'shadow-2xl shadow-black/50',
            'transition-all duration-200',
            isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    )

    if (typeof window === 'undefined') return null
    return createPortal(modalContent, document.body)
  }
)

Modal.displayName = 'Modal'

// ============================================================================
// Modal Header
// ============================================================================

export interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  onClose?: () => void
  showCloseButton?: boolean
}

export const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className, title, description, onClose, showCloseButton = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start justify-between gap-4 p-6 border-b border-[var(--glass-border)]',
          className
        )}
        {...props}
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description && <p className="text-sm text-[var(--text-muted)]">{description}</p>}
        </div>
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all duration-150"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    )
  }
)

ModalHeader.displayName = 'ModalHeader'

// ============================================================================
// Modal Body
// ============================================================================

export const ModalBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('p-6', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

ModalBody.displayName = 'ModalBody'

// ============================================================================
// Modal Footer
// ============================================================================

export interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {
  align?: 'left' | 'center' | 'right' | 'between'
}

const alignStyles = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
  between: 'justify-between',
}

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, align = 'right', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-3 p-6 pt-0',
          alignStyles[align],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

ModalFooter.displayName = 'ModalFooter'

// ============================================================================
// Confirm Modal
// ============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ConfirmModalProps extends Omit<ModalProps, 'children'> {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: ButtonVariant
  loading?: boolean
  onConfirm: () => void
  icon?: ReactNode
}

export const ConfirmModal = forwardRef<HTMLDivElement, ConfirmModalProps>(
  (
    {
      title,
      description,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      confirmVariant = 'primary',
      loading = false,
      onConfirm,
      onClose,
      icon,
      ...props
    },
    ref
  ) => {
    return (
      <Modal ref={ref} onClose={onClose} size="sm" {...props}>
        <div className="p-6 text-center">
          {icon && (
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-[var(--bg-tertiary)]/50">{icon}</div>
            </div>
          )}
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          {description && <p className="text-sm text-[var(--text-muted)]">{description}</p>}
        </div>
        <ModalFooter align="center" className="pt-0">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} isLoading={loading}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </Modal>
    )
  }
)

ConfirmModal.displayName = 'ConfirmModal'
