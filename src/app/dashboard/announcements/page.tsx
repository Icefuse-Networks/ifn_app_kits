"use client";
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Save, MessageSquare, Plus, Trash2, Edit2, Globe, Server, Bell, BellOff,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
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


const AnnouncementCard = ({ announcement, servers, onEdit, onDelete }: { announcement: Announcement; servers: ServerInfo[]; onEdit: (announcement: Announcement) => void; onDelete: (id: number) => void }) => {
  const isGlobal = announcement.isGlobal;
  const assignedServers = servers.filter((s) => announcement.serverAssignments.some((sa) => sa.serverId === s.id));

  return (
    <div className="anim-fade-scale rounded-xl p-6 transition-all group bg-white/[0.02] border border-white/5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isGlobal ? "bg-green-500/20" : "bg-purple-500/20"}`}>
            {isGlobal ? <Globe className="h-5 w-5 text-green-400" /> : <Server className="h-5 w-5 text-purple-400" />}
          </div>
          <div>
            <h4 className="text-white font-semibold group-hover:text-purple-400 transition-colors">{isGlobal ? "Global Announcement" : `${assignedServers.length} Server${assignedServers.length !== 1 ? "s" : ""}`}</h4>
            <div className="flex items-center space-x-2 mt-1">
              {announcement.showCardNotification ? (
                <Badge variant="success" size="sm" icon={<Bell className="h-3 w-3" />}>
                  Card: {announcement.delay}s delay, {announcement.cardDisplayDuration}s display
                </Badge>
              ) : (
                <Badge variant="secondary" size="sm" icon={<BellOff className="h-3 w-3" />}>
                  Text only
                </Badge>
              )}
            </div>
            {!isGlobal && assignedServers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {assignedServers.slice(0, 3).map((server) => (
                  <Badge key={server.id} variant="secondary" size="sm">{server.name}</Badge>
                ))}
                {assignedServers.length > 3 && <Badge variant="primary" size="sm">+{assignedServers.length - 3} more</Badge>}
              </div>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <IconButton icon={<Edit2 className="h-4 w-4" />} onClick={() => onEdit(announcement)} label="Edit" size="sm" />
          <IconButton icon={<Trash2 className="h-4 w-4" />} onClick={() => onDelete(announcement.id)} label="Delete" size="sm" />
        </div>
      </div>
      <div className="rounded-lg p-3 bg-purple-500/10 border-l-4 border-purple-500">
        <p className="text-white whitespace-pre-wrap">{announcement.text}</p>
      </div>
    </div>
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

  const serverOptions: MultiSelectOption[] = servers.map((s) => ({
    value: s.id,
    label: s.name,
    description: s.ip && s.port ? `${s.ip}:${s.port}` : undefined,
    icon: <Server className="h-4 w-4" />,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={announcement ? "Edit Announcement" : "Create Announcement"}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!text.trim() || (!isGlobal && selectedServerIds.length === 0) || (showCardNotification && cardDisplayDuration <= 0)}
             icon={<Save className="h-4 w-4" />}
          >
            {announcement ? "Update" : "Create"}
          </Button>
        </>
      }
    >
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
            <MultiSelect
              value={selectedServerIds}
              options={serverOptions}
              onChange={setSelectedServerIds}
              placeholder="Select servers..."
              showSelectAll
            />
            <p className="text-xs text-zinc-500 mt-1">Choose which servers should display this announcement</p>
          </div>
        )}

        <Textarea
          label="Announcement Text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter your announcement message..."
          rows={6}
          resize
        />

        <div className="rounded-lg p-4 bg-white/[0.02] border border-white/5">
          <Switch
            checked={showCardNotification}
            onChange={setShowCardNotification}
            label="Card Notification"
            description={showCardNotification ? "Show as a popup card with timing controls" : "Show as text message only"}
            icon={showCardNotification ? <Bell className="h-4 w-4 text-green-400" /> : <BellOff className="h-4 w-4" />}
          />
          {showCardNotification && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <NumberInput
                label="Delay Before Showing (seconds)"
                value={delay}
                onChange={setDelay}
                min={0}
                showControls={false}
              />
              <NumberInput
                label="Display Duration (seconds)"
                value={cardDisplayDuration}
                onChange={setCardDisplayDuration}
                min={1}
                showControls={false}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
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
      const [announcementsRes, serversRes] = await Promise.all([
        fetch("/api/announcements", { credentials: "include" }),
        fetch("/api/identifiers", { credentials: "include" }),
      ]);
      if (announcementsRes.ok) {
        const data = await announcementsRes.json();
        setAnnouncements(data.announcements || []);
      }
      console.log("identifiers status:", serversRes.status);
      if (serversRes.ok) {
        const serversData = await serversRes.json();
        console.log("identifiers data:", serversData);
        const list = Array.isArray(serversData) ? serversData : serversData.data || [];
        setServers(list.filter((s: ServerInfo) => s.id && s.name));
      } else {
        console.error("identifiers failed:", serversRes.status, await serversRes.text());
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
      <div className="anim-fade-slide-up">
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
          <div>
            <Button
              variant="primary"
               icon={<Plus className="h-4 w-4" />}
              onClick={openCreateModal}
              size="lg"
            >
              Add Announcement
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (<Skeleton key={i} height="10rem" variant="rectangular" />))}
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
              <EmptyState
                icon={<MessageSquare className="h-16 w-16" />}
                title="No announcements configured"
                description="Create your first announcement to get started"
                action={{
                  label: "Create Announcement",
                  onClick: openCreateModal,
                  icon: <Plus className="h-4 w-4" />,
                }}
              />
            )}
          </div>
        )}
      </div>

      {modalOpen && <AnnouncementModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveAnnouncement} announcement={editingAnnouncement} servers={servers} />}
    </div>
  );
}
