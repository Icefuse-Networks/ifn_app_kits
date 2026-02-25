"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Save, MessageSquare, Plus, Trash2, Edit2, Globe, Server, Bell, BellOff,
} from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/global/Modal";
import { Textarea, NumberInput } from "@/components/ui/Input";
import { Button, IconButton } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Loading";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { MultiSelect, MultiSelectOption } from "@/components/ui/MultiSelect";

interface AnnouncementServer {
  id: number;
  announcementId: number;
  serverId: string;
}

interface Announcement {
  id: number;
  text: string;
  delay: number;
  isGlobal: boolean;
  isActive: boolean;
  showCardNotification: boolean;
  cardDisplayDuration: number | null;
  serverAssignments: AnnouncementServer[];
  createdAt: string;
  updatedAt: string;
}

interface ServerInfo {
  id: string;
  name: string;
  ip: string | null;
  port: number | null;
}

type ScopeFilter = 'all' | 'global' | 'server';
type NotifFilter = 'all' | 'card' | 'text';

// --- Rust/Unity rich text parser ---

function normalizeRustColor(color: string): string {
  const c = color.trim();
  if (c.startsWith('#')) return c;
  const named: Record<string, string> = {
    aqua: '#00FFFF', black: '#000000', blue: '#0000FF', brown: '#A52A2A',
    cyan: '#00FFFF', darkblue: '#0000A0', fuchsia: '#FF00FF', green: '#008000',
    grey: '#808080', gray: '#808080', lightblue: '#ADD8E6', lime: '#00FF00',
    magenta: '#FF00FF', maroon: '#800000', navy: '#000080', olive: '#808000',
    orange: '#FFA500', purple: '#800080', red: '#FF0000', silver: '#C0C0C0',
    teal: '#008080', white: '#FFFFFF', yellow: '#FFFF00',
  };
  return named[c.toLowerCase()] ?? c;
}

type ParsedNode =
  | { type: 'text'; content: string }
  | { type: 'color'; color: string; children: ParsedNode[] }
  | { type: 'bold'; children: ParsedNode[] }
  | { type: 'italic'; children: ParsedNode[] };

function parseRustRichText(input: string): ParsedNode[] {
  const nodes: ParsedNode[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] !== '<') {
      const start = i;
      while (i < input.length && input[i] !== '<') i++;
      nodes.push({ type: 'text', content: input.slice(start, i) });
      continue;
    }
    const colorOpen = /^<color=([^>]+)>/i.exec(input.slice(i));
    if (colorOpen) {
      const after = i + colorOpen[0].length;
      let depth = 1, j = after;
      while (j < input.length && depth > 0) {
        if (/^<color=/i.test(input.slice(j))) {
          const inner = /^<color=[^>]*>/i.exec(input.slice(j));
          if (inner) { depth++; j += inner[0].length; continue; }
        }
        if (/^<\/color>/i.test(input.slice(j))) {
          depth--;
          if (depth === 0) break;
          j += 8;
          continue;
        }
        j++;
      }
      nodes.push({ type: 'color', color: normalizeRustColor(colorOpen[1]), children: parseRustRichText(input.slice(after, j)) });
      i = /^<\/color>/i.test(input.slice(j)) ? j + 8 : j;
      continue;
    }
    if (/^<b>/i.test(input.slice(i))) {
      const end = input.toLowerCase().indexOf('</b>', i + 3);
      nodes.push({ type: 'bold', children: parseRustRichText(end >= 0 ? input.slice(i + 3, end) : '') });
      i = end >= 0 ? end + 4 : i + 3;
      continue;
    }
    if (/^<i>/i.test(input.slice(i))) {
      const end = input.toLowerCase().indexOf('</i>', i + 3);
      nodes.push({ type: 'italic', children: parseRustRichText(end >= 0 ? input.slice(i + 3, end) : '') });
      i = end >= 0 ? end + 4 : i + 3;
      continue;
    }
    const closeAngle = input.indexOf('>', i);
    i = closeAngle >= 0 ? closeAngle + 1 : i + 1;
  }
  return nodes;
}

function renderParsedNodes(nodes: ParsedNode[], prefix = ''): React.ReactNode[] {
  return nodes.map((node, idx) => {
    const key = `${prefix}${idx}`;
    switch (node.type) {
      case 'text':   return <React.Fragment key={key}>{node.content}</React.Fragment>;
      case 'color':  return <span key={key} style={{ color: node.color }}>{renderParsedNodes(node.children, `${key}-`)}</span>;
      case 'bold':   return <strong key={key}>{renderParsedNodes(node.children, `${key}-`)}</strong>;
      case 'italic': return <em key={key}>{renderParsedNodes(node.children, `${key}-`)}</em>;
    }
  });
}

// Converts literal \n sequences (Rust newline syntax) to real newlines for display only
function preprocessRustText(text: string): string {
  return text.replace(/\\n/g, '\n');
}

function RustText({ text, className }: { text: string; className?: string }) {
  const nodes = useMemo(() => parseRustRichText(preprocessRustText(text)), [text]);
  return <span className={className}>{renderParsedNodes(nodes)}</span>;
}

// --- End rich text parser ---

const AnnouncementRow = ({ announcement, servers, onEdit, onDelete }: {
  announcement: Announcement;
  servers: ServerInfo[];
  onEdit: (a: Announcement) => void;
  onDelete: (id: number) => void;
}) => {
  const isGlobal = announcement.isGlobal;
  const assignedServers = servers.filter((s) => announcement.serverAssignments.some((sa) => sa.serverId === s.id));
  const serverLabel = isGlobal
    ? "All servers"
    : assignedServers.length === 0
      ? "No servers"
      : assignedServers.slice(0, 2).map((s) => s.name).join(", ") + (assignedServers.length > 2 ? ` +${assignedServers.length - 2}` : "");

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
      <div className={`flex-shrink-0 p-1.5 rounded-md ${isGlobal ? "bg-[var(--status-success)]/15" : "bg-[var(--accent-primary)]/15"}`}>
        {isGlobal
          ? <Globe className="h-3.5 w-3.5 text-[var(--status-success)]" />
          : <Server className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="line-clamp-2">
          <RustText text={announcement.text} className="text-[var(--text-primary)] text-sm leading-5" />
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{serverLabel}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {announcement.showCardNotification ? (
          <Badge variant="success" size="sm" icon={<Bell className="h-3 w-3" />}>
            {announcement.delay}s · {announcement.cardDisplayDuration}s
          </Badge>
        ) : (
          <Badge variant="secondary" size="sm" icon={<BellOff className="h-3 w-3" />}>
            Text
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton icon={<Edit2 className="h-3.5 w-3.5" />} onClick={() => onEdit(announcement)} label="Edit" size="sm" />
        <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onDelete(announcement.id)} label="Delete" size="sm" />
      </div>
    </div>
  );
};

const SectionHeader = ({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) => (
  <div className="flex items-center justify-between px-4 py-2 bg-white/[0.01] border-b border-white/5">
    <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
      {icon}{label}
    </span>
    <span className="text-xs text-[var(--text-muted)]">{count}</span>
  </div>
);

const AnnouncementModal = ({ isOpen, onClose, onSave, announcement, servers }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (announcement: Partial<Announcement> & { serverIds?: string[]; isGlobal?: boolean }) => void;
  announcement?: Announcement;
  servers: ServerInfo[];
}) => {
  const [text, setText] = useState("");
  const [delay, setDelay] = useState(300);
  const [isGlobal, setIsGlobal] = useState(false);
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
  const [showCardNotification, setShowCardNotification] = useState(false);
  const [cardDisplayDuration, setCardDisplayDuration] = useState(10);

  useEffect(() => {
    if (announcement) {
      setText(announcement.text);
      setDelay(announcement.delay);
      setIsGlobal(announcement.isGlobal);
      setSelectedServerIds(announcement.serverAssignments.map((sa) => sa.serverId));
      setShowCardNotification(announcement.showCardNotification);
      setCardDisplayDuration(announcement.cardDisplayDuration || 10);
    } else {
      setText("");
      setDelay(300);
      setIsGlobal(false);
      setSelectedServerIds([]);
      setShowCardNotification(false);
      setCardDisplayDuration(10);
    }
  }, [announcement]);

  const handleSave = () => {
    if (text.trim() && (isGlobal || selectedServerIds.length > 0)) {
      onSave({
        ...(announcement && { id: announcement.id }),
        text: text.trim(),
        delay: showCardNotification ? delay : 0,
        isGlobal,
        serverIds: isGlobal ? [] : selectedServerIds,
        showCardNotification,
        cardDisplayDuration: showCardNotification ? cardDisplayDuration : null,
      });
      onClose();
    }
  };

  const serverOptions: MultiSelectOption[] = servers.map((s) => ({
    value: s.id,
    label: s.name,
    description: s.ip && s.port ? `${s.ip}:${s.port}` : undefined,
    icon: <Server className="h-4 w-4" />,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalHeader
        title={announcement ? "Edit Announcement" : "Create Announcement"}
        onClose={onClose}
      />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <label className="block text-[var(--text-muted)] text-sm font-medium mb-2">Scope</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-colors flex-1 justify-center
                border-[var(--border-secondary)] hover:border-[var(--status-success)]/50
                has-[:checked]:border-[var(--status-success)]/60 has-[:checked]:bg-[var(--status-success)]/5">
                <input type="radio" name="announcementScope" checked={isGlobal} onChange={() => { setIsGlobal(true); setSelectedServerIds([]); }} className="sr-only" />
                <Globe className="h-4 w-4 text-[var(--status-success)]" />
                <span className="text-sm text-white">Global</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-colors flex-1 justify-center
                border-[var(--border-secondary)] hover:border-[var(--accent-primary)]/50
                has-[:checked]:border-[var(--accent-primary)]/60 has-[:checked]:bg-[var(--accent-primary)]/5">
                <input type="radio" name="announcementScope" checked={!isGlobal} onChange={() => setIsGlobal(false)} className="sr-only" />
                <Server className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="text-sm text-white">Specific Servers</span>
              </label>
            </div>
          </div>

          {!isGlobal && (
            <MultiSelect
              value={selectedServerIds}
              options={serverOptions}
              onChange={setSelectedServerIds}
              placeholder="Select servers..."
              showSelectAll
            />
          )}

          <Textarea
            label="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Enter your announcement message...\nUse \\n for new lines, <color=#hex>text</color> for colors"}
            rows={5}
            resize
          />

          {text.trim() && (
            <div>
              <p className="text-[var(--text-muted)] text-xs font-medium mb-1.5">In-game preview</p>
              <div className="rounded-lg px-3 py-2.5 bg-[var(--accent-primary)]/10 border-l-4 border-[var(--accent-primary)]">
                <RustText text={text} className="text-white whitespace-pre-wrap text-sm" />
              </div>
            </div>
          )}

          <div className="rounded-lg p-3 bg-white/[0.02] border border-white/5">
            <Switch
              checked={showCardNotification}
              onChange={setShowCardNotification}
              label="Card Notification"
              description={showCardNotification ? "Show as a popup card with timing controls" : "Text message only"}
              icon={showCardNotification ? <Bell className="h-4 w-4 text-[var(--status-success)]" /> : <BellOff className="h-4 w-4" />}
            />
            {showCardNotification && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <NumberInput label="Delay (seconds)" value={delay} onChange={setDelay} min={0} showControls={false} />
                <NumberInput label="Duration (seconds)" value={cardDisplayDuration} onChange={setCardDisplayDuration} min={1} showControls={false} />
              </div>
            )}
          </div>
        </div>
      </ModalBody>
      <ModalFooter align="right">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!text.trim() || (!isGlobal && selectedServerIds.length === 0) || (showCardNotification && cardDisplayDuration <= 0)}
          icon={<Save className="h-4 w-4" />}
        >
          {announcement ? "Update" : "Create"}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

// Filter pill button
const FilterPill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      active
        ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/40"
        : "text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)] hover:bg-white/[0.04]"
    }`}
  >
    {children}
  </button>
);

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | undefined>();
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [notifFilter, setNotifFilter] = useState<NotifFilter>('all');

  const fetchData = useCallback(async () => {
    try {
      const [announcementsRes, serversRes] = await Promise.all([
        fetch("/api/announcements", { credentials: "include" }),
        fetch("/api/identifiers", { credentials: "include" }),
      ]);
      if (announcementsRes.ok) {
        const data = await announcementsRes.json();
        setAnnouncements(data.announcements || []);
      }
      if (serversRes.ok) {
        const serversData = await serversRes.json();
        const list = Array.isArray(serversData) ? serversData : serversData.data || [];
        setServers(list.filter((s: ServerInfo) => s.id && s.name));
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveAnnouncement = useCallback(async (announcementData: Partial<Announcement> & { serverIds?: string[]; isGlobal?: boolean }) => {
    try {
      const isEditing = !!announcementData.id;
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetch("/api/announcements", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(announcementData) });
      if (response.ok) {
        const data = await response.json();
        if (isEditing) {
          setAnnouncements((prev) => prev.map((a) => (a.id === data.announcement.id ? data.announcement : a)));
          toast.success("Announcement updated");
        } else {
          setAnnouncements((prev) => [...prev, data.announcement]);
          toast.success("Announcement created");
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to save announcement");
      }
    } catch (error) {
      console.error("Failed to save announcement:", error);
      toast.error("Network error while saving");
    }
  }, []);

  const handleDeleteAnnouncement = useCallback(async (id: number) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const response = await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
        toast.success("Announcement deleted");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to delete announcement");
      }
    } catch (error) {
      console.error("Failed to delete announcement:", error);
      toast.error("Network error while deleting");
    }
  }, []);

  const openCreateModal = () => { setEditingAnnouncement(undefined); setModalOpen(true); };
  const openEditModal = (announcement: Announcement) => { setEditingAnnouncement(announcement); setModalOpen(true); };

  useEffect(() => { fetchData(); }, [fetchData]);

  // Apply filters
  const filtered = useMemo(() => {
    return announcements.filter((a) => {
      if (scopeFilter === 'global' && !a.isGlobal) return false;
      if (scopeFilter === 'server' && a.isGlobal) return false;
      if (notifFilter === 'card' && !a.showCardNotification) return false;
      if (notifFilter === 'text' && a.showCardNotification) return false;
      return true;
    });
  }, [announcements, scopeFilter, notifFilter]);

  const globalAnnouncements = filtered.filter((a) => a.isGlobal);
  const serverAnnouncements = filtered.filter((a) => !a.isGlobal);
  const showSections = scopeFilter === 'all';

  return (
    <div className="p-6">
      <div className="anim-fade-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <MessageSquare className="h-5 w-5 text-[var(--accent-primary)]" />
              Announcements
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Broadcast messages to individual servers, groups, or all servers globally</p>
          </div>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
            Add Announcement
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-1.5 mb-4 p-1.5 rounded-xl bg-white/[0.02] border border-white/5 w-fit">
          <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            <FilterPill active={scopeFilter === 'all'} onClick={() => setScopeFilter('all')}>All</FilterPill>
            <FilterPill active={scopeFilter === 'global'} onClick={() => setScopeFilter('global')}>
              <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" />Global</span>
            </FilterPill>
            <FilterPill active={scopeFilter === 'server'} onClick={() => setScopeFilter('server')}>
              <span className="flex items-center gap-1.5"><Server className="h-3 w-3" />Servers</span>
            </FilterPill>
          </div>
          <div className="flex items-center gap-1 pl-0.5">
            <FilterPill active={notifFilter === 'all'} onClick={() => setNotifFilter('all')}>Any type</FilterPill>
            <FilterPill active={notifFilter === 'card'} onClick={() => setNotifFilter('card')}>
              <span className="flex items-center gap-1.5"><Bell className="h-3 w-3" />Card</span>
            </FilterPill>
            <FilterPill active={notifFilter === 'text'} onClick={() => setNotifFilter('text')}>
              <span className="flex items-center gap-1.5"><BellOff className="h-3 w-3" />Text</span>
            </FilterPill>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height="3.5rem" variant="rectangular" />)}
          </div>
        ) : filtered.length === 0 ? (
          announcements.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-12 w-12" />}
              title="No announcements configured"
              description="Create your first announcement to get started"
              action={{ label: "Create Announcement", onClick: openCreateModal, icon: <Plus className="h-4 w-4" /> }}
            />
          ) : (
            <EmptyState
              icon={<MessageSquare className="h-12 w-12" />}
              title="No results"
              description="No announcements match the current filters"
            />
          )
        ) : (
          <div className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.01]">
            {showSections ? (
              <>
                {globalAnnouncements.length > 0 && (
                  <>
                    <SectionHeader icon={<Globe className="h-3 w-3 text-[var(--status-success)]" />} label="Global" count={globalAnnouncements.length} />
                    {globalAnnouncements.map((a) => (
                      <AnnouncementRow key={a.id} announcement={a} servers={servers} onEdit={openEditModal} onDelete={handleDeleteAnnouncement} />
                    ))}
                  </>
                )}
                {serverAnnouncements.length > 0 && (
                  <>
                    <SectionHeader icon={<Server className="h-3 w-3 text-[var(--accent-primary)]" />} label="Server-Specific" count={serverAnnouncements.length} />
                    {serverAnnouncements.map((a) => (
                      <AnnouncementRow key={a.id} announcement={a} servers={servers} onEdit={openEditModal} onDelete={handleDeleteAnnouncement} />
                    ))}
                  </>
                )}
              </>
            ) : (
              filtered.map((a) => (
                <AnnouncementRow key={a.id} announcement={a} servers={servers} onEdit={openEditModal} onDelete={handleDeleteAnnouncement} />
              ))
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <AnnouncementModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveAnnouncement}
          announcement={editingAnnouncement}
          servers={servers}
        />
      )}
    </div>
  );
}
