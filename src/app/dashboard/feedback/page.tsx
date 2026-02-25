"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ArrowLeft, MessageCircle, RefreshCw, ChevronUp, ChevronDown,
  Clock, Server,
  Inbox, CheckCircle2, XCircle, Bug, MessageSquare,
  DollarSign, Trash2, EyeOff, Eye
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Loading } from "@/components/ui/Loading"
import { EmptyState } from "@/components/ui/EmptyState"
import { Alert } from "@/components/ui/Alert"
import { NumberInput } from "@/components/ui/Input"
import { SimplePagination } from "@/components/ui/Pagination"
import { GlassContainer } from "@/components/global/GlassContainer"
import { Dropdown } from "@/components/global/Dropdown"

interface FeedbackItem {
  id: string
  serverIdentifier: string
  steamId: string
  playerName: string
  category: string
  responses: { question: string; answer: string }[]
  status: string
  rewardAmount: number | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  reward?: { id: string; status: string; amount: number; processedAt: string | null } | null
}

interface ServerIdentifier {
  id: string
  name: string
  hashedId: string
  ip: string | null
  port: number | null
}

const CATEGORY_LABELS: Record<string, string> = {
  server_feedback: "Server Feedback",
  bug_report: "Bug Report",
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className="anim-fade-slide-up fixed bottom-4 right-4 z-[10000]"
    >
      <Alert
        variant={type === "success" ? "success" : "error"}
        dismissible
        onDismiss={onClose}
      >
        {message}
      </Alert>
    </div>
  )
}

export default function FeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState<ServerIdentifier[]>([])
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rewardAmounts, setRewardAmounts] = useState<Record<string, number>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [showDenied, setShowDenied] = useState(false)

  const limit = 20

  // Computed stats from current data
  const stats = {
    total,
    pending: feedbackList.filter(f => f.status === "pending").length,
    accepted: feedbackList.filter(f => f.status === "accepted").length,
    denied: feedbackList.filter(f => f.status === "denied").length,
  }

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/identifiers", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        const list = data.success ? data.data : (Array.isArray(data) ? data : [])
        setServers(list)
      }
    } catch {
      // silently fail
    }
  }, [])

  const isAllServers = selectedServer === null

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      if (!isAllServers) params.set("serverIdentifier", selectedServer)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (categoryFilter !== "all") params.set("category", categoryFilter)

      const res = await fetch(`/api/feedback?${params}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setFeedbackList(data.data)
          setTotal(data.pagination.total)
          setTotalPages(data.pagination.totalPages)
        } else {
          setFeedbackList([])
          setTotal(0)
          setTotalPages(0)
        }
      } else {
        setFeedbackList([])
        setTotal(0)
        setTotalPages(0)
      }
    } catch {
      setToast({ message: "Failed to fetch feedback data", type: "error" })
      setFeedbackList([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [selectedServer, isAllServers, statusFilter, categoryFilter, page])

  const handleReview = useCallback(async (id: string, action: "accept" | "deny") => {
    if (action === "deny") {
      const confirmed = window.confirm("Are you sure you want to deny this feedback?")
      if (!confirmed) return
    }

    setActionLoading(id)
    try {
      const body: Record<string, unknown> = { id, action }
      if (action === "accept") {
        body.rewardAmount = rewardAmounts[id] ?? 1000
      }

      const res = await fetch("/api/feedback", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setToast({ message: `Feedback ${action === "accept" ? "accepted" : "denied"} successfully`, type: "success" })
          fetchData()
        } else {
          setToast({ message: data.error || "Failed to update feedback", type: "error" })
        }
      } else {
        const errorData = await res.json().catch(() => null)
        setToast({ message: errorData?.error || "Failed to update feedback", type: "error" })
      }
    } catch {
      setToast({ message: "Network error while updating feedback", type: "error" })
    } finally {
      setActionLoading(null)
    }
  }, [rewardAmounts, fetchData])

  const handleDelete = useCallback(async (id: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this feedback? This action cannot be undone.")
    if (!confirmed) return

    setActionLoading(id)
    try {
      const res = await fetch(`/api/feedback?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setToast({ message: "Feedback deleted successfully", type: "success" })
          fetchData()
        } else {
          setToast({ message: data.error || "Failed to delete feedback", type: "error" })
        }
      } else {
        const errorData = await res.json().catch(() => null)
        setToast({ message: errorData?.error || "Failed to delete feedback", type: "error" })
      }
    } catch {
      setToast({ message: "Network error while deleting feedback", type: "error" })
    } finally {
      setActionLoading(null)
    }
  }, [fetchData])

  useEffect(() => { fetchServers() }, [fetchServers])
  useEffect(() => { fetchData() }, [fetchData])

  // Reset page on filter or server change
  useEffect(() => { setPage(1) }, [selectedServer, statusFilter, categoryFilter])

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="warning" size="sm" icon={<Clock className="w-3 h-3" />}>Pending</Badge>
      case "accepted":
        return <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>Accepted</Badge>
      case "denied":
        return <Badge variant="error" size="sm" icon={<XCircle className="w-3 h-3" />}>Denied</Badge>
      default:
        return <Badge variant="secondary" size="sm">{status}</Badge>
    }
  }

  const categoryBadge = (category: string) => {
    switch (category) {
      case "server_feedback":
        return <Badge variant="info" size="sm" icon={<MessageSquare className="w-3 h-3" />}>{CATEGORY_LABELS[category]}</Badge>
      case "bug_report":
        return <Badge variant="warning" size="sm" icon={<Bug className="w-3 h-3" />}>{CATEGORY_LABELS[category]}</Badge>
      default:
        return <Badge variant="secondary" size="sm">{category}</Badge>
    }
  }

  const renderFeedbackCard = (item: FeedbackItem, idx: number) => {
    const isExpanded = expandedId === item.id
    const isPending = item.status === "pending"
    const currentReward = rewardAmounts[item.id] ?? 1000

    return (
      <GlassContainer
        key={item.id}
        variant={isPending ? "default" : "static"}
        padding="none"
        radius="md"
        className="anim-stagger-item"
        style={{
          animationDelay: `${idx * 30}ms`,
          ...(isPending ? { borderColor: 'rgba(245, 158, 11, 0.2)' } : {}),
        }}
        features={{ hoverGlow: isPending, shadow: false }}
      >
        <div
          className="flex items-center gap-4 p-4 cursor-pointer"
          onClick={() => setExpandedId(isExpanded ? null : item.id)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.playerName}</span>
              <span className="text-xs font-mono text-[var(--text-muted)]">{item.steamId}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isAllServers && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
                  <Server className="w-3 h-3" />
                  {servers.find(s => s.hashedId === item.serverIdentifier)?.name || item.serverIdentifier}
                </span>
              )}
              {categoryBadge(item.category)}
              {statusBadge(item.status)}
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(item.createdAt)}
              </span>
              {item.rewardAmount != null && item.status === "accepted" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--status-success)]/15 text-[var(--status-success)] border border-[var(--status-success)]/20">
                  <DollarSign className="w-3 h-3" />{item.rewardAmount.toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isPending && (
              <>
                <Button
                  onClick={(e) => { e.stopPropagation(); handleReview(item.id, "accept") }}
                  disabled={actionLoading === item.id}
                  variant="success"
                  size="sm"
                >
                  Accept
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); handleReview(item.id, "deny") }}
                  disabled={actionLoading === item.id}
                  variant="error"
                  size="sm"
                >
                  Deny
                </Button>
              </>
            )}
            <Button
              onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
              disabled={actionLoading === item.id}
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
            />
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </div>
        </div>

        {isExpanded && (
            <div
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-0 border-t border-[var(--glass-border)]">
                <div className="mt-4 space-y-3">
                  {item.responses.map((r, rIdx) => (
                    <div key={rIdx} className="rounded-lg bg-black/10 p-3">
                      <p className="text-xs font-medium text-[var(--text-muted)] mb-1">{r.question}</p>
                      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{r.answer}</p>
                    </div>
                  ))}
                </div>

                {item.reviewedBy && (
                  <div className="mt-3 text-xs text-[var(--text-muted)]">
                    Reviewed by <span className="text-[var(--text-secondary)]">{item.reviewedBy}</span>
                    {item.reviewedAt && <> on {formatDateTime(item.reviewedAt)}</>}
                  </div>
                )}

                {item.reward && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <DollarSign className="w-3.5 h-3.5 text-[var(--status-success)]" />
                    Reward: <span className="text-[var(--status-success)] font-medium">${item.reward.amount.toLocaleString()}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      item.reward.status === "processed" ? "bg-[var(--status-success)]/15 text-[var(--status-success)]" : "bg-[var(--status-warning)]/15 text-[var(--status-warning)]"
                    }`}>
                      {item.reward.status}
                    </span>
                    {item.reward.processedAt && (
                      <span>- Processed {formatDateTime(item.reward.processedAt)}</span>
                    )}
                  </div>
                )}

                {isPending && (
                  <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-black/10">
                    <DollarSign className="w-4 h-4 text-[var(--status-success)] shrink-0" />
                    <label className="text-xs font-medium text-[var(--text-muted)] shrink-0">Reward on accept:</label>
                    <div className="w-40" onClick={(e) => e.stopPropagation()}>
                      <NumberInput
                        value={currentReward}
                        onChange={(val) => setRewardAmounts(prev => ({ ...prev, [item.id]: val }))}
                        min={0}
                        step={100}
                        size="sm"
                        showControls={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
      </GlassContainer>
    )
  }

  const pendingFeedback = feedbackList.filter(f => f.status === "pending")
  const acceptedFeedback = feedbackList.filter(f => f.status === "accepted")
  const deniedFeedback = feedbackList.filter(f => f.status === "denied")

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="anim-fade-slide-up">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <GlassContainer variant="default" padding="none" radius="md" interactive className="p-2.5" features={{ hoverGlow: true, hoverLift: false }}>
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </GlassContainer>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/20">
                <MessageCircle className="h-6 w-6 text-[var(--accent-primary)]" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Feedback</h1>
            </div>
            <p className="text-[var(--text-muted)] text-sm ml-[52px]">Review player feedback and bug reports</p>
          </div>
          <div className="flex items-center gap-3">
            <Dropdown
              options={servers.map((s) => ({
                value: s.hashedId,
                label: s.name,
                icon: <Server className="w-4 h-4" />,
              }))}
              value={selectedServer}
              onChange={setSelectedServer}
              emptyOption="All Servers"
              placeholder="Select server"
              searchable={servers.length > 5}
              className="min-w-[180px]"
            />
            <Button
              onClick={() => fetchData()}
              disabled={loading}
              variant="secondary"
              icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <GlassContainer variant="static" padding="md" radius="md" className="anim-stagger-item" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                <Inbox className="w-5 h-5 text-[var(--accent-primary)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Total</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
              </div>
            </div>
          </GlassContainer>
          <GlassContainer variant="static" padding="md" radius="md" className="anim-stagger-item" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--status-warning)]/10">
                <Clock className="w-5 h-5 text-[var(--status-warning)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Pending</p>
                <p className="text-2xl font-bold text-[var(--status-warning)]">{stats.pending}</p>
              </div>
            </div>
          </GlassContainer>
          <GlassContainer variant="static" padding="md" radius="md" className="anim-stagger-item" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--status-success)]/10">
                <CheckCircle2 className="w-5 h-5 text-[var(--status-success)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Accepted</p>
                <p className="text-2xl font-bold text-[var(--status-success)]">{stats.accepted}</p>
              </div>
            </div>
          </GlassContainer>
          <GlassContainer variant="static" padding="md" radius="md" className="anim-stagger-item" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--status-error)]/10">
                <XCircle className="w-5 h-5 text-[var(--status-error)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Denied</p>
                <p className="text-2xl font-bold text-[var(--status-error)]">{stats.denied}</p>
              </div>
            </div>
          </GlassContainer>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <GlassContainer variant="static" padding="none" radius="md" className="flex items-center gap-1 p-1" features={{ shadow: false }}>
            {(["all", "pending", "accepted", "denied"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  statusFilter === s
                    ? "bg-[var(--accent-primary)] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {s === "all" ? "All Status" : s}
              </button>
            ))}
          </GlassContainer>
          <GlassContainer variant="static" padding="none" radius="md" className="flex items-center gap-1 p-1" features={{ shadow: false }}>
            {([
              { key: "all", label: "All Types" },
              { key: "server_feedback", label: "Server Feedback" },
              { key: "bug_report", label: "Bug Report" },
            ] as const).map((c) => (
              <button
                key={c.key}
                onClick={() => setCategoryFilter(c.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  categoryFilter === c.key
                    ? "bg-[var(--accent-primary)] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </GlassContainer>
        </div>

        {/* Content */}
        {loading ? (
          <Loading size="lg" text="Loading feedback..." />
        ) : feedbackList.length === 0 ? (
          <div className="anim-fade-slide-up" style={{ animationDelay: '300ms' }}>
            <EmptyState
              icon={<MessageCircle className="w-12 h-12" />}
              title="No Feedback Found"
              description={
                statusFilter !== "all" || categoryFilter !== "all"
                  ? "No feedback matches your current filters. Try adjusting them."
                  : "No feedback has been submitted for this server yet."
              }
            />
          </div>
        ) : (
          <>
            {pendingFeedback.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-[var(--status-warning)] mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Unreviewed Feedback ({pendingFeedback.length})
                </h2>
                <div className="anim-fade-slide-up space-y-3" style={{ animationDelay: '300ms' }}>
                  {pendingFeedback.map((item, idx) => renderFeedbackCard(item, idx))}
                </div>
              </div>
            )}

            {acceptedFeedback.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-[var(--status-success)] mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Accepted Feedback ({acceptedFeedback.length})
                </h2>
                <div className="anim-fade-slide-up space-y-3" style={{ animationDelay: '350ms' }}>
                  {acceptedFeedback.map((item, idx) => renderFeedbackCard(item, idx))}
                </div>
              </div>
            )}

            {deniedFeedback.length > 0 && (
              <div className="mb-8">
                <button
                  onClick={() => setShowDenied(!showDenied)}
                  className="flex items-center gap-2 text-lg font-semibold text-[var(--status-error)] mb-3 hover:text-[var(--status-error)] transition-colors"
                >
                  {showDenied ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  Denied Feedback ({deniedFeedback.length})
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDenied ? "rotate-180" : ""}`} />
                </button>
                {showDenied && (
                    <div
                      className="space-y-3 overflow-hidden"
                    >
                      {deniedFeedback.map((item, idx) => renderFeedbackCard(item, idx))}
                    </div>
                  )}
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 pt-4">
            <SimplePagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              showPageInfo
            />
            <div className="text-center mt-2">
              <span className="text-sm text-[var(--text-muted)]">
                {total} total
              </span>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
