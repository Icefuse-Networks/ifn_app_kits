"use client";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Save, FolderOpen, CloudUpload, History, RotateCcw, FileText, Trash2, Check } from "lucide-react";
import type { SavedConfig, ConfigVersion } from "./types";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Loading } from "@/components/ui/Loading";

interface ConfigManagerProps {
  apiBasePath: string;
  currentConfigId: number | null;
  currentConfigName: string;
  currentVersion: number;
  publishedVersion: number | null;
  isSaving: boolean;
  hasData: boolean;
  onSave: (name: string, description: string | null) => void;
  onQuickSave: () => void;
  onLoad: (config: SavedConfig) => void;
  onDelete: (id: number) => void;
  onPublish: (id: number) => void;
  onRestoreVersion: (version: number) => void;
  onSetCurrentConfig: (id: number | null, name: string, version: number, publishedVersion: number | null) => void;
  accentColor?: string;
}

export default function ConfigManager({
  apiBasePath,
  currentConfigId,
  currentConfigName,
  currentVersion,
  publishedVersion,
  isSaving,
  hasData,
  onSave,
  onQuickSave,
  onLoad,
  onDelete,
  onPublish,
  onRestoreVersion,
  onSetCurrentConfig,
  accentColor = "purple",
}: ConfigManagerProps) {
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [unstagedConfigs, setUnstagedConfigs] = useState<SavedConfig[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showUnstagedModal, setShowUnstagedModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const fetchSavedConfigs = useCallback(async () => {
    try {
      const res = await fetch(apiBasePath);
      if (res.ok) setSavedConfigs(await res.json());
    } catch (error) { console.error("Failed to fetch configs:", error); }
  }, [apiBasePath]);

  const fetchUnstagedConfigs = useCallback(async () => {
    try {
      const res = await fetch(`${apiBasePath}?unstaged=true`);
      if (res.ok) setUnstagedConfigs(await res.json());
    } catch (error) { console.error("Failed to fetch unstaged:", error); }
  }, [apiBasePath]);

  useEffect(() => { fetchSavedConfigs(); fetchUnstagedConfigs(); }, [fetchSavedConfigs, fetchUnstagedConfigs]);

  const handleSave = () => {
    if (!saveName.trim()) { toast.error("Please enter a name"); return; }
    onSave(saveName, saveDescription || null);
    setShowSaveModal(false);
    setSaveName("");
    setSaveDescription("");
    setTimeout(() => { fetchSavedConfigs(); fetchUnstagedConfigs(); }, 500);
  };

  const handlePublish = async (configId: number) => {
    onPublish(configId);
    setTimeout(() => { fetchSavedConfigs(); fetchUnstagedConfigs(); }, 500);
  };

  const handlePublishAll = async () => {
    for (const config of unstagedConfigs) {
      onPublish(config.id);
    }
    setTimeout(() => { fetchSavedConfigs(); fetchUnstagedConfigs(); }, 500);
  };

  const handleDelete = (id: number) => {
    onDelete(id);
    setTimeout(() => { fetchSavedConfigs(); fetchUnstagedConfigs(); }, 500);
  };

  const fetchVersions = async (configId: number) => {
    setLoadingVersions(true);
    try {
      const res = await fetch(`${apiBasePath}/${configId}/versions`);
      if (res.ok) setVersions(await res.json());
    } catch (error) { console.error("Failed to fetch versions:", error); }
    finally { setLoadingVersions(false); }
  };

  const handleOpenVersionHistory = () => {
    if (!currentConfigId) return;
    fetchVersions(currentConfigId);
    setShowVersionModal(true);
  };

  return (
    <>
      {/* Current config info */}
      {currentConfigId && (
        <div className="px-3 py-2 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs text-white font-medium truncate">{currentConfigName}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
            <span>v{currentVersion}</span>
            {publishedVersion !== null && (
              <span className={publishedVersion === currentVersion ? "text-green-400" : "text-yellow-400"}>
                {publishedVersion === currentVersion ? "Published" : `Published v${publishedVersion}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="p-3 border-t border-white/5 space-y-2">
        {currentConfigId ? (
          <Button
            onClick={onQuickSave}
            disabled={isSaving}
            variant="success"
            size="sm"
            fullWidth
             icon={<Save className="h-3.5 w-3.5" />}
            loading={isSaving}
            className={`bg-${accentColor}-500 hover:bg-${accentColor}-600`}
          >
            Save
          </Button>
        ) : (
          <Button
            onClick={() => setShowSaveModal(true)}
            disabled={!hasData}
            variant="success"
            size="sm"
            fullWidth
            icon={<Save className="h-3.5 w-3.5" />}
          >
            Save As
          </Button>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => { fetchSavedConfigs(); setShowLoadModal(true); }}
            variant="secondary"
            size="sm"
            icon={<FolderOpen className="h-3 w-3" />}
            className="flex-1"
          >
            Load
          </Button>
          {currentConfigId && (
            <>
              <Button
                onClick={() => handlePublish(currentConfigId)}
                variant="secondary"
                size="sm"
                icon={<CloudUpload className="h-3 w-3" />}
                className="flex-1"
              >
                Publish
              </Button>
              <IconButton
                icon={<History className="h-3 w-3" />}
                onClick={handleOpenVersionHistory}
                label="Version history"
                size="sm"
                variant="secondary"
              />
            </>
          )}
        </div>

        {unstagedConfigs.length > 0 && (
          <Button
            onClick={() => setShowUnstagedModal(true)}
            variant="warning"
            size="sm"
            fullWidth
            icon={<CloudUpload className="h-3 w-3" />}
          >
            {unstagedConfigs.length} unpublished
          </Button>
        )}
      </div>

      {/* Save Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => { setShowSaveModal(false); setSaveName(""); setSaveDescription(""); }}
        title="Save Configuration"
        size="md"
        footer={
          <>
            <Button onClick={() => { setShowSaveModal(false); setSaveName(""); setSaveDescription(""); }} variant="secondary">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !saveName.trim()} variant="success" loading={isSaving} icon={<Save className="h-4 w-4" />}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="e.g., 1000x Bases Config"
            required
            autoFocus
          />
          <Textarea
            label="Description (optional)"
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
            placeholder="Brief description..."
            rows={2}
          />
        </div>
      </Modal>

      {/* Load Modal */}
      <Modal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        title="Load Configuration"
        size="md"
      >
        {savedConfigs.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No saved configurations</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {savedConfigs.map((config) => (
              <div key={config.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                <button onClick={() => { onLoad(config); setShowLoadModal(false); }} className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-white truncate">{config.name}</p>
                  <p className="text-xs text-zinc-500">v{config.currentVersion} {config.publishedVersion !== null && `(pub v${config.publishedVersion})`}</p>
                </button>
                <IconButton
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => handleDelete(config.id)}
                  label="Delete config"
                  size="sm"
                  className="text-zinc-600 hover:text-red-400"
                />
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Version History Modal */}
      <Modal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        title="Version History"
        size="md"
      >
        {loadingVersions ? (
          <Loading text="Loading versions..." size="sm" className="py-4" />
        ) : versions.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No version history</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Version {v.version}</p>
                  <p className="text-xs text-zinc-500">{new Date(v.createdAt).toLocaleString()}</p>
                </div>
                {v.version === currentVersion ? (
                  <span className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> Current</span>
                ) : (
                  <Button
                    onClick={() => { onRestoreVersion(v.version); setShowVersionModal(false); }}
                    variant="secondary"
                    size="sm"
                    icon={<RotateCcw className="h-3 w-3" />}
                  >
                    Restore
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Unstaged Modal */}
      <Modal
        isOpen={showUnstagedModal}
        onClose={() => setShowUnstagedModal(false)}
        title="Unpublished Changes"
        size="md"
        footer={
          <Button onClick={handlePublishAll} variant="success" fullWidth>
            Publish All
          </Button>
        }
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {unstagedConfigs.map((config) => (
            <div key={config.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{config.name}</p>
                <p className="text-xs text-zinc-500">v{config.currentVersion} (published: {config.publishedVersion ?? "never"})</p>
              </div>
              <Button
                onClick={() => handlePublish(config.id)}
                variant="success"
                size="sm"
                icon={<CloudUpload className="h-3 w-3" />}
              >
                Publish
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
