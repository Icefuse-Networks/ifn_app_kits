"use client";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Save, FolderOpen, CloudUpload, History, RotateCcw, FileText, Trash2, Check } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import Modal from "./Modal";
import type { SavedConfig, ConfigVersion } from "./types";

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
          <button onClick={onQuickSave} disabled={isSaving} className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-${accentColor}-500 rounded-lg hover:bg-${accentColor}-600 transition-colors disabled:opacity-50`}>
            {isSaving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        ) : (
          <button onClick={() => setShowSaveModal(true)} disabled={!hasData} className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50`}>
            <Save className="h-3.5 w-3.5" /> Save As
          </button>
        )}

        <div className="flex gap-2">
          <button onClick={() => { fetchSavedConfigs(); setShowLoadModal(true); }} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-zinc-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
            <FolderOpen className="h-3 w-3" /> Load
          </button>
          {currentConfigId && (
            <>
              <button onClick={() => handlePublish(currentConfigId)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-zinc-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                <CloudUpload className="h-3 w-3" /> Publish
              </button>
              <button onClick={handleOpenVersionHistory} className="flex items-center justify-center px-2 py-1.5 text-xs text-zinc-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                <History className="h-3 w-3" />
              </button>
            </>
          )}
        </div>

        {unstagedConfigs.length > 0 && (
          <button onClick={() => setShowUnstagedModal(true)} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/20 transition-colors">
            <CloudUpload className="h-3 w-3" /> {unstagedConfigs.length} unpublished
          </button>
        )}
      </div>

      {/* Save Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <Modal onClose={() => { setShowSaveModal(false); setSaveName(""); setSaveDescription(""); }} title="Save Configuration">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Name *</label>
                <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g., 1000x Bases Config" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white placeholder-zinc-500 focus:outline-none" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Description (optional)</label>
                <textarea value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} placeholder="Brief description..." rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white placeholder-zinc-500 focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowSaveModal(false); setSaveName(""); setSaveDescription(""); }} className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={isSaving || !saveName.trim()} className={`flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2`}>
                {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="h-4 w-4" />Save</>}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Load Modal */}
      <AnimatePresence>
        {showLoadModal && (
          <Modal onClose={() => setShowLoadModal(false)} title="Load Configuration">
            {savedConfigs.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">No saved configurations</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {savedConfigs.map((config) => (
                  <div key={config.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                    <button onClick={() => { onLoad(config); setShowLoadModal(false); }} className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-white truncate">{config.name}</p>
                      <p className="text-xs text-zinc-500">v{config.currentVersion} {config.publishedVersion !== null && `(pub v${config.publishedVersion})`}</p>
                    </button>
                    <button onClick={() => handleDelete(config.id)} className="p-1 text-zinc-600 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>

      {/* Version History Modal */}
      <AnimatePresence>
        {showVersionModal && (
          <Modal onClose={() => setShowVersionModal(false)} title="Version History">
            {loadingVersions ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">No version history</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">Version {v.version}</p>
                      <p className="text-xs text-zinc-500">{new Date(v.createdAt).toLocaleString()}</p>
                    </div>
                    {v.version === currentVersion ? (
                      <span className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> Current</span>
                    ) : (
                      <button onClick={() => { onRestoreVersion(v.version); setShowVersionModal(false); }} className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 bg-white/5 rounded hover:bg-white/10 transition-colors">
                        <RotateCcw className="h-3 w-3" /> Restore
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>

      {/* Unstaged Modal */}
      <AnimatePresence>
        {showUnstagedModal && (
          <Modal onClose={() => setShowUnstagedModal(false)} title="Unpublished Changes">
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {unstagedConfigs.map((config) => (
                <div key={config.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{config.name}</p>
                    <p className="text-xs text-zinc-500">v{config.currentVersion} (published: {config.publishedVersion ?? "never"})</p>
                  </div>
                  <button onClick={() => handlePublish(config.id)} className="flex items-center gap-1.5 px-2 py-1 text-xs text-green-400 bg-green-500/10 rounded hover:bg-green-500/20 transition-colors">
                    <CloudUpload className="h-3 w-3" /> Publish
                  </button>
                </div>
              ))}
            </div>
            <button onClick={handlePublishAll} className="w-full px-4 py-2 bg-green-500 text-white rounded-lg font-medium text-sm">Publish All</button>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
