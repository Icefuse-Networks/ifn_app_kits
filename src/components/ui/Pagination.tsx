'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  siblingCount?: number
  showFirstLast?: boolean
  className?: string
}

// =============================================================================
// Pagination Component
// =============================================================================

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showFirstLast = false,
  className = '',
}: PaginationProps) {
  const generatePageNumbers = () => {
    const pages: (number | string)[] = []
    const totalNumbers = siblingCount * 2 + 3 // siblings + current + first + last
    const totalBlocks = totalNumbers + 2 // + 2 ellipsis

    if (totalPages <= totalBlocks) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
      const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages)

      const showLeftEllipsis = leftSiblingIndex > 2
      const showRightEllipsis = rightSiblingIndex < totalPages - 1

      if (showFirstLast || !showLeftEllipsis) {
        pages.push(1)
      }

      if (showLeftEllipsis) {
        pages.push('...')
      }

      for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i)
        }
      }

      if (showRightEllipsis) {
        pages.push('...')
      }

      if (showFirstLast || !showRightEllipsis) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  const pages = generatePageNumbers()
  const canGoBack = currentPage > 1
  const canGoForward = currentPage < totalPages

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Previous Button */}
      <button
        onClick={() => canGoBack && onPageChange(currentPage - 1)}
        disabled={!canGoBack}
        className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-secondary)',
        }}
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Previous</span>
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {pages.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-sm text-[var(--text-muted)]"
              >
                ...
              </span>
            )
          }

          const pageNumber = page as number
          const isActive = pageNumber === currentPage

          return (
            <button
              key={pageNumber}
              onClick={() => onPageChange(pageNumber)}
              className={`min-w-[2.5rem] h-10 px-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
              }`}
              style={
                isActive
                  ? {
                      background: 'var(--accent-primary)',
                      border: '1px solid var(--accent-primary)',
                    }
                  : {
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                    }
              }
            >
              {pageNumber}
            </button>
          )
        })}
      </div>

      {/* Next Button */}
      <button
        onClick={() => canGoForward && onPageChange(currentPage + 1)}
        disabled={!canGoForward}
        className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-secondary)',
        }}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// =============================================================================
// Simple Pagination (Previous/Next only)
// =============================================================================

export interface SimplePaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showPageInfo?: boolean
  className?: string
}

export function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
  showPageInfo = true,
  className = '',
}: SimplePaginationProps) {
  const canGoBack = currentPage > 1
  const canGoForward = currentPage < totalPages

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <button
        onClick={() => canGoBack && onPageChange(currentPage - 1)}
        disabled={!canGoBack}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-secondary)',
        }}
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>

      {showPageInfo && (
        <span className="text-sm text-[var(--text-muted)]">
          Page {currentPage} of {totalPages}
        </span>
      )}

      <button
        onClick={() => canGoForward && onPageChange(currentPage + 1)}
        disabled={!canGoForward}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-secondary)',
        }}
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
