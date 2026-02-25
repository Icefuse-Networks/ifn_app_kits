'use client'

/**
 * API Reference Modal
 *
 * Full interactive documentation for every API endpoint in the system.
 * URLs are built dynamically from window.location.origin.
 * Each endpoint includes a copyable curl example.
 *
 * Endpoint data lives in src/lib/api-registry — add new sections there.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Copy,
  Check,
  ChevronDown,
  BookOpen,
  Terminal,
  Lock,
  Unlock,
  Key,
  Search,
} from 'lucide-react'
import { REGISTRY } from '@/lib/api-registry'
import type { HttpMethod, AuthType, EndpointDef } from '@/lib/api-registry'

// =============================================================================
// Curl Generator
// =============================================================================

function buildCurl(endpoint: EndpointDef, baseUrl: string): string {
  const url = `${baseUrl}${endpoint.path}`
  const hasBody = endpoint.bodyExample && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method)
  const needsAuth = endpoint.auth !== 'none'

  const lines: string[] = [`curl -X ${endpoint.method} "${url}"`]

  if (needsAuth && endpoint.auth === 'bearer') {
    lines.push('  -H "Authorization: Bearer YOUR_TOKEN"')
  }
  if (needsAuth && endpoint.auth === 'session') {
    lines.push('  -H "Cookie: next-auth.session-token=YOUR_SESSION"')
  }
  if (hasBody) {
    lines.push('  -H "Content-Type: application/json"')
    lines.push(`  -d '${endpoint.bodyExample}'`)
  }

  return lines.join(' \\\n')
}

// =============================================================================
// Method Badge
// =============================================================================

const METHOD_STYLES: Record<HttpMethod, { bg: string; text: string }> = {
  GET:    { bg: 'rgba(0,212,255,0.12)',  text: 'var(--accent-primary)' },
  POST:   { bg: 'rgba(0,200,100,0.12)', text: 'var(--status-success)' },
  PUT:    { bg: 'rgba(250,180,0,0.12)', text: '#f59e0b' },
  PATCH:  { bg: 'rgba(250,120,0,0.12)', text: '#f97316' },
  DELETE: { bg: 'rgba(255,50,50,0.12)', text: 'var(--status-error)' },
}

function MethodBadge({ method }: { method: HttpMethod }) {
  const s = METHOD_STYLES[method]
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center w-16 h-6 rounded text-xs font-bold font-mono tracking-wide"
      style={{ background: s.bg, color: s.text }}
    >
      {method}
    </span>
  )
}

// =============================================================================
// Auth Badge
// =============================================================================

function AuthBadge({ auth, scope }: { auth: AuthType; scope?: string }) {
  if (auth === 'none') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(0,200,100,0.1)', color: 'var(--status-success)', border: '1px solid rgba(0,200,100,0.2)' }}>
        <Unlock className="w-3 h-3" />
        Public
      </span>
    )
  }
  if (auth === 'session') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(250,180,0,0.1)', color: '#f59e0b', border: '1px solid rgba(250,180,0,0.2)' }}>
        <Lock className="w-3 h-3" />
        Admin Session
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-mono"
      style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.2)' }}>
      <Key className="w-3 h-3 shrink-0" />
      {scope ?? 'bearer'}
    </span>
  )
}

// =============================================================================
// Copy Button
// =============================================================================

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }, [text])

  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  return (
    <button
      onClick={copy}
      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
      style={{
        color: copied ? 'var(--status-success)' : 'var(--text-muted)',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
      }}
    >
      {copied ? <Check className={iconSize} /> : <Copy className={iconSize} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// =============================================================================
// Endpoint Card
// =============================================================================

function EndpointCard({ endpoint, baseUrl }: { endpoint: EndpointDef; baseUrl: string }) {
  const [expanded, setExpanded] = useState(false)
  const fullUrl = `${baseUrl}${endpoint.path}`
  const curl = buildCurl(endpoint, baseUrl)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header row — always visible */}
      <div className="flex items-start gap-3 px-4 py-3">
        <MethodBadge method={endpoint.method} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-[var(--text-primary)]">{endpoint.title}</span>
            <AuthBadge auth={endpoint.auth} scope={endpoint.scope} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-xs text-[var(--text-secondary)] font-mono truncate flex-1">{fullUrl}</code>
            <CopyButton text={fullUrl} size="xs" />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{endpoint.description}</p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`}
          />
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--glass-border)' }}>
          {/* Parameters */}
          {endpoint.params && endpoint.params.length > 0 && (
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Parameters
              </p>
              <div className="space-y-1.5">
                {endpoint.params.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-xs">
                    <code className="font-mono text-[var(--accent-primary)] shrink-0 w-28">{p.name}</code>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] shrink-0"
                      style={{ background: 'var(--glass-bg)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}
                    >
                      {p.in}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] shrink-0"
                      style={{ background: 'var(--glass-bg)', color: '#f59e0b', border: '1px solid rgba(250,180,0,0.2)' }}
                    >
                      {p.type}
                    </span>
                    {p.required && (
                      <span className="text-[10px] text-[var(--status-error)] shrink-0">required</span>
                    )}
                    <span className="text-[var(--text-muted)] leading-relaxed">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Curl example */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Example
                </p>
              </div>
              <CopyButton text={curl} />
            </div>
            <pre
              className="text-xs font-mono rounded-lg p-3 overflow-x-auto leading-relaxed"
              style={{
                background: 'rgba(0,0,0,0.4)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              {curl}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Modal
// =============================================================================

export function ApiReferenceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeSection, setActiveSection] = useState(REGISTRY[0].id)
  const [baseUrl, setBaseUrl] = useState('https://your-domain.com')
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])

  // Filter sections/endpoints by search query
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return REGISTRY
    return REGISTRY
      .map((section) => ({
        ...section,
        endpoints: section.endpoints.filter(
          (ep) =>
            ep.title.toLowerCase().includes(q) ||
            ep.path.toLowerCase().includes(q) ||
            ep.description.toLowerCase().includes(q) ||
            ep.method.toLowerCase().includes(q) ||
            (ep.scope && ep.scope.toLowerCase().includes(q))
        ),
      }))
      .filter((section) => section.endpoints.length > 0)
  }, [searchQuery])

  // Reset active section when filtered list changes and current section disappears
  useEffect(() => {
    if (filteredSections.length > 0 && !filteredSections.find((s) => s.id === activeSection)) {
      setActiveSection(filteredSections[0].id)
    }
  }, [filteredSections, activeSection])

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50)
    } else {
      setSearchQuery('')
    }
  }, [isOpen])

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    setActiveSection(sectionId)
    const el = sectionRefs.current[sectionId]
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' })
    }
  }, [])

  if (!isOpen) return null

  const totalEndpoints = REGISTRY.reduce((n, s) => n + s.endpoints.length, 0)
  const filteredEndpointCount = filteredSections.reduce((n, s) => n + s.endpoints.length, 0)
  const isSearching = searchQuery.trim().length > 0

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full rounded-2xl overflow-hidden flex flex-col"
        style={{
          maxWidth: '1200px',
          height: 'calc(100vh - 2rem)',
          background: 'linear-gradient(to bottom right, #0a0a0f 0%, #1a1a2e 50%, #0f1419 100%)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="shrink-0"
          style={{ borderBottom: '1px solid var(--glass-border)' }}
        >
          {/* Title row */}
          <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-[var(--accent-primary)]" />
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">API Reference</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {isSearching
                    ? <>{filteredEndpointCount} of {totalEndpoints} endpoints match</>
                    : <>{REGISTRY.length} sections · {totalEndpoints} endpoints · Base URL:{' '}
                        <span className="font-mono text-[var(--accent-primary)]">{baseUrl}</span>
                      </>
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
            >
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Search row */}
          <div className="px-6 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search endpoints by name, path, or description..."
                className="w-full pl-9 pr-9 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)' }}
              />
              {isSearching && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors hover:bg-[var(--bg-card-hover)]"
                >
                  <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body — sidebar + content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <nav
            className="w-52 shrink-0 overflow-y-auto py-3"
            style={{ borderRight: '1px solid var(--glass-border)' }}
          >
            {filteredSections.length === 0 ? (
              <p className="px-4 py-3 text-xs text-[var(--text-muted)]">No results</p>
            ) : (
              filteredSections.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left"
                    style={{
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(0,212,255,0.06)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{section.label}</span>
                    <span className="ml-auto text-xs text-[var(--text-muted)] shrink-0">
                      {section.endpoints.length}
                    </span>
                  </button>
                )
              })
            )}
          </nav>

          {/* Endpoint list */}
          <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-10">
            {filteredSections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Search className="w-10 h-10 text-[var(--text-muted)]" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">No endpoints found</p>
                <p className="text-xs text-[var(--text-muted)]">
                  No results for &ldquo;{searchQuery}&rdquo; — try a different search term
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-[var(--accent-primary)] hover:underline mt-1"
                >
                  Clear search
                </button>
              </div>
            ) : (
              filteredSections.map((section) => {
                const Icon = section.icon
                return (
                  <div
                    key={section.id}
                    ref={(el) => { sectionRefs.current[section.id] = el }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Icon className="w-5 h-5 text-[var(--accent-primary)]" />
                      <h3 className="text-base font-bold text-[var(--text-primary)]">{section.label}</h3>
                      <span className="text-xs text-[var(--text-muted)]">{section.endpoints.length} endpoints</span>
                    </div>
                    <div className="space-y-2">
                      {section.endpoints.map((ep, i) => (
                        <EndpointCard key={i} endpoint={ep} baseUrl={baseUrl} />
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(modal, document.body)
}
