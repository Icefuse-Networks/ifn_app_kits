"use client";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Server, Link2, Clock, Pencil } from "lucide-react";
import type { MappingRecord, ServerIdentifierRecord, SavedConfig } from "./types";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";

const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

interface ServerMappingEditorProps {
  mappings: MappingRecord[];
  servers: ServerIdentifierRecord[];
  savedConfigs: SavedConfig[];
  apiBasePath: string;
  onRefreshMappings: () => void;
  onRefreshConfigs: () => void;
  accentColor?: string;
}

export default function ServerMappingEditor({
  mappings,
  servers,
  savedConfigs,
  apiBasePath,
  onRefreshMappings,
  onRefreshConfigs,
  accentColor = "blue",
}: ServerMappingEditorProps) {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<number | null>(null);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const serverGroups = useMemo(() => {
    const groups: Record<string, MappingRecord[]> = {};
    for (const m of mappings) {
      const sid = m.serverIdentifierId;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(m);
    }
    return groups;
  }, [mappings]);

  const serversWithMappings = useMemo(() => {
    const serverIds = new Set(mappings.map(m => m.serverIdentifierId));
    return servers.filter(s => serverIds.has(s.id));
  }, [servers, mappings]);

  const serversWithoutMappings = useMemo(() => {
    const serverIds = new Set(mappings.map(m => m.serverIdentifierId));
    return servers.filter(s => !serverIds.has(s.id));
  }, [servers, mappings]);

  const selectedServerMappings = useMemo(() => {
    if (!selectedServerId) return [];
    return (serverGroups[selectedServerId] || []).sort((a, b) => (a.minutesAfterWipe ?? -1) - (b.minutesAfterWipe ?? -1));
  }, [selectedServerId, serverGroups]);

  const configOptions: DropdownOption[] = savedConfigs.map(c => ({
    value: String(c.id),
    label: c.name,
  }));

  const serverOptions: DropdownOption[] = servers.map(s => ({
    value: s.id,
    label: s.name,
  }));

  const handleAddMapping = async () => {
    if (!selectedConfig || !selectedServer) { toast.error("Select both config and server"); return; }
    const h = hours.trim() === "" ? 0 : parseInt(hours);
    const m = minutes.trim() === "" ? 0 : parseInt(minutes);
    if (isNaN(h) || h < 0 || isNaN(m) || m < 0 || m > 59) { toast.error("Invalid time values"); return; }
    const minutesAfterWipe = (hours.trim() === "" && minutes.trim() === "") ? null : (h * 60 + m);
    try {
      const res = await fetch(`${apiBasePath}/mappings`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId
          ? { id: editingId, configId: selectedConfig, minutesAfterWipe }
          : { configId: selectedConfig, serverIdentifierId: selectedServer, isLive: false, minutesAfterWipe }),
      });
      if (res.ok) {
        toast.success(editingId ? "Mapping updated" : "Mapping created");
        onRefreshMappings();
        closeModal();
      } else { const err = await res.json(); toast.error(err.error || "Failed to save mapping"); }
    } catch { toast.error("Failed to save mapping"); }
  };

  const handleDeleteMapping = async (id: number) => {
    if (!confirm("Remove this server assignment?")) return;
    try {
      const res = await fetch(`${apiBasePath}/mappings`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { toast.success("Mapping removed"); onRefreshMappings(); }
      else toast.error("Failed to remove mapping");
    } catch { toast.error("Failed to remove mapping"); }
  };

  const handleToggleLive = async (mapping: MappingRecord) => {
    try {
      const res = await fetch(`${apiBasePath}/mappings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mapping.id, isLive: !mapping.isLive }),
      });
      if (res.ok) {
        toast.success(mapping.isLive ? "Set to inactive" : "Set to live");
        onRefreshMappings();
      } else toast.error("Failed to update");
    } catch { toast.error("Failed to update"); }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setSelectedConfig(null);
    setSelectedServer(null);
    setHours("");
    setMinutes("");
    setEditingId(null);
  };

  const handleAddToRotation = (serverId: string) => {
    setSelectedServer(serverId);
    setSelectedConfig(null);
    setHours("");
    setMinutes("");
    setEditingId(null);
    setShowAddModal(true);
  };

  const handleEditMapping = (mapping: MappingRecord) => {
    setEditingId(mapping.id);
    setSelectedConfig(mapping.configId);
    setSelectedServer(mapping.serverIdentifierId);
    if (mapping.minutesAfterWipe !== null) {
      setHours(String(Math.floor(mapping.minutesAfterWipe / 60)));
      setMinutes(String(mapping.minutesAfterWipe % 60));
    } else {
      setHours("");
      setMinutes("");
    }
    setShowAddModal(true);
  };

  return (
    <div className="flex flex-1 min-h-0">
      {/* Server list sidebar */}
      <div className="w-64 border-r border-white/5 flex flex-col">
        <div className="p-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Servers</h3>
          <p className="text-xs text-zinc-500 mt-1">{servers.length} registered</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {serversWithMappings.map((server) => (
            <button
              key={server.id}
              onClick={() => setSelectedServerId(server.id)}
              className={`w-full text-left px-3 py-2 border-b border-white/5 transition-colors ${
                selectedServerId === server.id ? `bg-${accentColor}-500/10 border-l-2 border-l-${accentColor}-500` : "hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                <span className="text-sm text-white truncate">{server.name}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5 ml-5.5">
                {(serverGroups[server.id] || []).length} mapping(s)
              </div>
            </button>
          ))}
          {serversWithoutMappings.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs text-zinc-600 font-medium uppercase tracking-wider">Unassigned</div>
              {serversWithoutMappings.map((server) => (
                <button
                  key={server.id}
                  onClick={() => { setSelectedServerId(server.id); handleAddToRotation(server.id); }}
                  className="w-full text-left px-3 py-2 border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                    <span className="text-sm text-zinc-400 truncate">{server.name}</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Mapping details */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedServerId ? (
          <div className="flex-1 flex items-center justify-center text-zinc-600">
            <div className="text-center">
              <Link2 className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Select a server to manage mappings</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {servers.find(s => s.id === selectedServerId)?.name || selectedServerId}
              </h3>
              <Button
                onClick={() => handleAddToRotation(selectedServerId)}
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-3 w-3" />}
                className={`text-${accentColor}-400 bg-${accentColor}-500/10 border border-${accentColor}-500/20 hover:bg-${accentColor}-500/20`}
              >
                Add to Rotation
              </Button>
            </div>

            {selectedServerMappings.length === 0 ? (
              <div className="text-center py-12 text-zinc-600">
                <p className="text-sm">No mappings for this server</p>
                <p className="text-xs mt-1">Click &quot;Add to Rotation&quot; to assign a config</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedServerMappings.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <Switch
                      checked={m.isLive}
                      onChange={() => handleToggleLive(m)}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{m.config.name}</span>
                        {m.config.publishedVersion === null && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Unpublished</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {m.minutesAfterWipe !== null ? `After ${formatDuration(m.minutesAfterWipe)}` : "Wipe Day (default)"}
                      </div>
                    </div>
                    <IconButton
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => handleEditMapping(m)}
                      label="Edit mapping"
                      size="sm"
                      className="text-zinc-500 hover:text-white"
                    />
                    <IconButton
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => handleDeleteMapping(m.id)}
                      label="Delete mapping"
                      size="sm"
                      className="text-zinc-500 hover:text-red-400"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Timeline preview */}
            {selectedServerMappings.filter(m => m.isLive).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Timeline Preview</h3>
                <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                  <div className={`relative pl-4 border-l-2 border-${accentColor}-500/30 space-y-3`}>
                    {selectedServerMappings.filter(m => m.isLive).map((m) => (
                      <div key={m.id} className="relative">
                        <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-green-500 border-2 border-zinc-900" />
                        <div className="text-sm font-medium text-white">
                          {m.minutesAfterWipe !== null ? `${formatDuration(m.minutesAfterWipe)}+` : "Wipe Day"}
                        </div>
                        <div className="text-xs text-zinc-500">{m.config.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit mapping modal */}
      <Modal
        isOpen={showAddModal}
        onClose={closeModal}
        title={editingId ? "Edit Mapping" : "Add to Rotation"}
        size="md"
        footer={
          <>
            <Button onClick={closeModal} variant="secondary">Cancel</Button>
            <Button onClick={handleAddMapping} variant="primary">
              {editingId ? "Update" : "Add"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Dropdown
            value={selectedConfig ? String(selectedConfig) : null}
            options={configOptions}
            onChange={(value) => setSelectedConfig(value ? parseInt(value) : null)}
            placeholder="Select a config..."
          />
          {!editingId && (
            <Dropdown
              value={selectedServer}
              options={serverOptions}
              onChange={(value) => setSelectedServer(value)}
              placeholder="Select a server..."
            />
          )}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Time After Wipe (leave empty for default)</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                min={0}
                placeholder="Hours"
                size="sm"
              />
              <span className="text-zinc-500">h</span>
              <Input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                min={0}
                max={59}
                placeholder="Min"
                size="sm"
              />
              <span className="text-zinc-500">m</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
