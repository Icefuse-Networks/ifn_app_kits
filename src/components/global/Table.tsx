'use client'

import {
  forwardRef,
  type HTMLAttributes,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Table Components
// ============================================================================

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-x-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
)
Table.displayName = 'Table'

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('border-b border-white/[0.06]', className)}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

export const TableFooter = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-white/[0.06] bg-white/[0.02] font-medium',
      className
    )}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-white/[0.03] transition-colors',
        'hover:bg-white/[0.02]',
        'data-[state=selected]:bg-[var(--accent-primary)]/10',
        className
      )}
      {...props}
    />
  )
)
TableRow.displayName = 'TableRow'

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-12 px-4 text-left align-middle font-medium text-[var(--text-muted)]',
        '[&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  )
)
TableHead.displayName = 'TableHead'

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'p-4 align-middle text-[var(--text-secondary)]',
        '[&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  )
)
TableCell.displayName = 'TableCell'

export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-[var(--text-muted)]', className)}
    {...props}
  />
))
TableCaption.displayName = 'TableCaption'

// ============================================================================
// Empty State
// ============================================================================

export interface TableEmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export const TableEmptyState = forwardRef<HTMLDivElement, TableEmptyStateProps>(
  (
    {
      className,
      title = 'No data',
      description = 'There are no items to display.',
      icon,
      action,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
      {...props}
    >
      {icon && <div className="mb-4 text-[var(--text-muted)]">{icon}</div>}
      <h3 className="text-lg font-medium text-[var(--text-secondary)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
)
TableEmptyState.displayName = 'TableEmptyState'

// ============================================================================
// Pagination
// ============================================================================

export interface TablePaginationProps extends HTMLAttributes<HTMLDivElement> {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

export const TablePagination = forwardRef<HTMLDivElement, TablePaginationProps>(
  (
    {
      className,
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage,
      onPageChange,
      ...props
    },
    ref
  ) => {
    const startItem = (currentPage - 1) * itemsPerPage + 1
    const endItem = Math.min(currentPage * itemsPerPage, totalItems)

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between px-4 py-3 border-t border-white/[0.06]',
          className
        )}
        {...props}
      >
        <p className="text-sm text-[var(--text-muted)]">
          Showing <span className="font-medium text-[var(--text-secondary)]">{startItem}</span> to{' '}
          <span className="font-medium text-[var(--text-secondary)]">{endItem}</span> of{' '}
          <span className="font-medium text-[var(--text-secondary)]">{totalItems}</span> results
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium',
              'bg-[var(--bg-elevated)] border border-[var(--glass-border)]',
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--glass-border)]'
            )}
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    'w-8 h-8 rounded-md text-sm font-medium',
                    'transition-all duration-200',
                    pageNum === currentPage
                      ? 'bg-[var(--accent-primary)] text-[var(--text-primary)]'
                      : 'bg-[var(--bg-elevated)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium',
              'bg-[var(--bg-elevated)] border border-[var(--glass-border)]',
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--glass-border)]'
            )}
          >
            Next
          </button>
        </div>
      </div>
    )
  }
)
TablePagination.displayName = 'TablePagination'
