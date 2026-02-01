"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  X, Save, MessageSquare, Plus, Trash2, Edit2, Globe, Server, Bell, BellOff, ChevronDown, Check,
} from "lucide-react";

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
  id: number;
  name: string;
  ip: string;
  port: number;
  game: string;
  serverId?: string;
}

const MultiSelectDropdown = ({ servers, selectedServerIds, onSelectionChange, disabled }: { servers: ServerInfo[]; selectedServerIds: string[]; onSelectionChange: (serverIds: string[]) => void; disabled?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const toggleServer = (serverId: string) => {
    if (selectedServerIds.includes(serverId)) onSelectionChange(selectedServerIds.filter((id) => id !== serverId));
    else onSelectionChange([...selectedServerIds, serverId]);
  };

  const getDisplayText = () => {
    if (selectedServerIds.length === 0) return "Select servers...";
    if (selectedServerIds.length === 1) {
      const server = servers.find((s) => s.serverId === selectedServerIds[0]);
      return server ? server.name : "1 server selected";
    }
    return `${selectedServerIds.length} servers selected`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full rounded-lg px-4 py-3 text-white focus:outline-none transition-all flex items-center justify-between bg-white/[0.02] border border-white/5 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={selectedServerIds.length === 0 ? "text-zinc-500" : "text-white"}>{getDisplayText()}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-lg shadow-lg max-h-60 overflow-auto bg-zinc-900 border border-white/10" onClick={(e) => e.stopPropagation()}>
          <div className="p-2 border-b border-white/5">
            <button type="button" onClick={(e) => { e.stopPropagation(); onSelectionChange([]); }} className="w-full text-left px-3 py-2 text-sm text-zinc-500 hover:text-white rounded transition-colors">Clear all</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onSelectionChange(servers.map((s) => s.serverId!)); }} className="w-full text-left px-3 py-2 text-sm text-zinc-500 hover:text-white rounded transition-colors">Select all</button>
          </div>
          <div className="py-1">
            {servers.map((server) => (
              <button key={server.serverId} type="button" onClick={(e) => { e.stopPropagation(); toggleServer(server.serverId!); }} className="w-full text-left px-4 py-3 transition-colors flex items-center justify-between hover:bg-white/5">
                <div>
                  <div className="text-white font-medium">{server.name}</div>
                  <div className="text-xs text-zinc-500">{server.game} - {server.ip}:{server.port}</div>
                </div>
                {selectedServerIds.includes(server.serverId!) && <Check className="h-4 w-4 text-purple-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AnnouncementCard = ({ announcement, servers, onEdit, onDelete }: { announcement: Announcement; servers: ServerInfo[]; onEdit: (announcement: Announcement) => void; onDelete: (id: number) => void }) => {
  const isGlobal = announcement.isGlobal;
  const assignedServers = servers.filter((s) => announcement.serverAssignments.some((sa) => sa.serverId === s.serverId));

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="rounded-xl p-6 transition-all group bg-white/[0.02] border border-white/5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isGlobal ? "bg-green-500/20" : "bg-purple-500/20"}`}>
            {isGlobal ? <Globe className="h-5 w-5 text-green-400" /> : <Server className="h-5 w-5 text-purple-400" />}
          </div>
          <div>
            <h4 className="text-white font-semibold group-hover:text-purple-400 transition-colors">{isGlobal ? "Global Announcement" : `${assignedServers.length} Server${assignedServers.length !== 1 ? "s" : ""}`}</h4>
            <div className="flex items-center space-x-2 mt-1">
              {announcement.showCardNotification ? (
                <div className="flex items-center space-x-1 text-green-400 text-sm">
                  <Bell className="h-4 w-4" />
                  <span>Card: {announcement.delay}s delay, {announcement.cardDisplayDuration}s display</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-zinc-500 text-sm">
                  <BellOff className="h-4 w-4" />
                  <span>Text only</span>
                </div>
              )}
            </div>
            {!isGlobal && assignedServers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {assignedServers.slice(0, 3).map((server) => (
                  <span key={server.serverId} className="text-xs px-2 py-1 rounded bg-white/5">{server.name}</span>
                ))}
                {assignedServers.length > 3 && <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400">+{assignedServers.length - 3} more</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => onEdit(announcement)} className="text-purple-400 hover:text-purple-300 transition-colors p-1"><Edit2 className="h-4 w-4" /></button>
          <button onClick={() => onDelete(announcement.id)} className="text-red-400 hover:text-red-300 transition-colors p-1"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="rounded-lg p-3 bg-purple-500/10 border-l-4 border-purple-500">
        <p className="text-white whitespace-pre-wrap">{announcement.text}</p>
      </div>
    </motion.div>
  );
};

const AnnouncementModal = ({ isOpen, onClose, onSave, announcement, servers }: { isOpen: boolean; onClose: () => void; onSave: (announcement: Partial<Announcement> & { serverIds?: string[]; isGlobal?: boolean }) => void; announcement?: Announcement; servers: ServerInfo[] }) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="rounded-xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">{announcement ? "Edit Announcement" : "Create Announcement"}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-sm font-medium mb-2">Announcement Scope</label>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="radio" name="announcementScope" checked={isGlobal} onChange={() => { setIsGlobal(true); setSelectedServerIds([]); }} className="text-green-500" />
                <div className="flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-green-400" />
                  <span className="text-white">Global (All Servers)</span>
                </div>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="radio" name="announcementScope" checked={!isGlobal} onChange={() => setIsGlobal(false)} className="text-purple-500" />
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4 text-purple-400" />
                  <span className="text-white">Specific Servers</span>
                </div>
              </label>
            </div>
          </div>

          {!isGlobal && (
            <div>
              <label className="block text-zinc-400 text-sm font-medium mb-2">Select Servers</label>
              <MultiSelectDropdown servers={servers} selectedServerIds={selectedServerIds} onSelectionChange={setSelectedServerIds} />
              <p className="text-xs text-zinc-500 mt-1">Choose which servers should display this announcement</p>
            </div>
          )}

          <div>
            <label className="block text-zinc-400 text-sm font-medium mb-2">Announcement Text</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter your announcement message..." rows={6} className="w-full rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none transition-all resize-vertical bg-white/[0.02] border border-white/5" />
          </div>

          <div className="rounded-lg p-4 bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-white font-medium flex items-center">{showCardNotification ? <Bell className="h-4 w-4 mr-2 text-green-400" /> : <BellOff className="h-4 w-4 mr-2 text-zinc-500" />}Card Notification</h4>
                <p className="text-xs text-zinc-500 mt-1">{showCardNotification ? "Show as a popup card with timing controls" : "Show as text message only"}</p>
              </div>
              <button onClick={() => setShowCardNotification(!showCardNotification)} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors" style={{ background: showCardNotification ? "linear-gradient(135deg, #a855f7, #ec4899)" : "rgba(255,255,255,0.1)" }}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showCardNotification ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            {showCardNotification && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-zinc-400 text-sm font-medium mb-2">Delay Before Showing (seconds)</label>
                  <input type="number" value={delay} min={0} onChange={(e) => setDelay(parseInt(e.target.value) || 0)} className="w-full rounded-lg px-4 py-3 text-white focus:outline-none transition-all bg-white/[0.02] border border-white/5" />
                </div>
                <div>
                  <label className="block text-zinc-400 text-sm font-medium mb-2">Display Duration (seconds)</label>
                  <input type="number" value={cardDisplayDuration} min={1} onChange={(e) => setCardDisplayDuration(parseInt(e.target.value) || 1)} className="w-full rounded-lg px-4 py-3 text-white focus:outline-none transition-all bg-white/[0.02] border border-white/5" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-white rounded-lg transition-colors bg-white/5 border border-white/10">Cancel</button>
          <button onClick={handleSave} disabled={!text.trim() || (!isGlobal && selectedServerIds.length === 0) || (showCardNotification && cardDisplayDuration <= 0)} className="disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500">
            <Save className="h-4 w-4" />
            <span>{announcement ? "Update" : "Create"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | undefined>();

  const fetchData = useCallback(async () => {
    try {
      const [announcementsRes, serversRes] = await Promise.all([fetch("/api/announcements"), fetch("/api/servers")]);
      if (announcementsRes.ok) {
        const data = await announcementsRes.json();
        setAnnouncements(data.announcements || []);
      }
      if (serversRes.ok) {
        const serversData = await serversRes.json();
        const serversList = serversData.data || serversData;
        if (Array.isArray(serversList)) {
          setServers(serversList.map((s: ServerInfo) => ({ ...s, serverId: `${s.ip}:${s.port}` })));
        }
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
          toast.success("Announcement updated successfully!");
        } else {
          setAnnouncements((prev) => [...prev, data.announcement]);
          toast.success("Announcement created successfully!");
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to save announcement");
      }
    } catch (error) {
      console.error("Failed to save announcement:", error);
      toast.error("Network error while saving announcement");
    }
  }, []);

  const handleDeleteAnnouncement = useCallback(async (id: number) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const response = await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
        toast.success("Announcement deleted successfully!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to delete announcement");
      }
    } catch (error) {
      console.error("Failed to delete announcement:", error);
      toast.error("Network error while deleting announcement");
    }
  }, []);

  const openCreateModal = () => { setEditingAnnouncement(undefined); setModalOpen(true); };
  const openEditModal = (announcement: Announcement) => { setEditingAnnouncement(announcement); setModalOpen(true); };

  useEffect(() => { fetchData(); }, [fetchData]);

  const globalAnnouncements = announcements.filter((a) => a.isGlobal);
  const serverAnnouncements = announcements.filter((a) => !a.isGlobal);

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <MessageSquare className="h-6 w-6 text-purple-400" />
              </div>
              Announcements
            </h1>
            <p className="text-zinc-500 mt-2">Manage announcements for individual servers, multiple servers, or all servers globally</p>
          </div>
          <motion.button className="text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            <span>Add Announcement</span>
          </motion.button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (<div key={i} className="h-40 rounded-xl bg-white/5 animate-pulse" />))}
          </div>
        ) : (
          <div className="space-y-8">
            {globalAnnouncements.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center"><Globe className="h-5 w-5 mr-2 text-green-400" />Global Announcements</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {globalAnnouncements.map((announcement) => (
                    <AnnouncementCard key={announcement.id} announcement={announcement} servers={servers} onEdit={openEditModal} onDelete={handleDeleteAnnouncement} />
                  ))}
                </div>
              </div>
            )}
            {serverAnnouncements.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center"><Server className="h-5 w-5 mr-2 text-purple-400" />Server-Specific Announcements</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {serverAnnouncements.map((announcement) => (
                    <AnnouncementCard key={announcement.id} announcement={announcement} servers={servers} onEdit={openEditModal} onDelete={handleDeleteAnnouncement} />
                  ))}
                </div>
              </div>
            )}
            {announcements.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="h-16 w-16 text-zinc-600 mx-auto mb-4 opacity-30" />
                <h3 className="text-xl font-medium text-zinc-500 mb-2">No announcements configured</h3>
                <p className="text-zinc-600 mb-6">Create your first announcement to get started</p>
                <button onClick={openCreateModal} className="text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto bg-gradient-to-r from-purple-500 to-pink-500">
                  <Plus className="h-4 w-4" />
                  <span>Create Announcement</span>
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {modalOpen && <AnnouncementModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveAnnouncement} announcement={editingAnnouncement} servers={servers} />}
      </AnimatePresence>
    </div>
  );
}
