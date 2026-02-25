"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Package, Plus, Trash2, Upload, Download, Search, X, ChevronDown, Copy, Clipboard,
  Percent, Grid, List, Save, Undo2, Redo2, FolderOpen, FileText, Check, CloudUpload, Server, Link2, ToggleLeft, ToggleRight, Clock, Pencil, History, RotateCcw, ChevronRight,
} from "lucide-react";
import { useSidebarCompact } from "@/contexts/SidebarContext";
import { RustItem, fetchRustItems, getItemImageUrl, ITEM_CATEGORIES, searchItems, groupItemsByCategory, ItemCategory } from "@/lib/rust-items";
import { CheckboxSwitch } from "@/components/ui/Switch";
import { Dropdown } from "@/components/global/Dropdown";
import { GlassContainer } from "@/components/global/GlassContainer";

interface LootItem {
  "Item Shortname"?: string;
  "Item shortname"?: string;
  "Skin Id"?: number;
  "Min item amount": number;
  "Max item amount": number;
  "Chance to spawn": number;
  "Is Blueprint": boolean;
  "Min Condition % (0.0% - 100.0%)": number;
  "max Condition % (0.0% - 100.0%)": number;
  "Times allowed to spawn per container": string | number;
}

function getItemShortname(item: LootItem): string {
  return item["Item Shortname"] || item["Item shortname"] || "";
}

interface ContainerConfig {
  "Min items": number;
  "Max Items": number;
  "Min Scrap": number;
  "Max Scrap": number;
  "Scrap Amount"?: number | null;
  Enabled: boolean;
  Items: LootItem[];
}

interface LootManagerData {
  ContainerItems: Record<string, ContainerConfig>;
}

interface SavedConfig {
  id: number;
  name: string;
  description: string | null;
  currentVersion: number;
  publishedVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ServerIdentifier {
  id: string;
  name: string;
  hashedId: string;
  ip: string | null;
  port: number | null;
}

interface LootMapping {
  id: number;
  configId: number;
  serverIdentifierId: string;
  isLive: boolean;
  minutesAfterWipe: number | null;
  config: { id: number; name: string; currentVersion: number; publishedVersion: number | null };
  serverIdentifier: ServerIdentifier;
}

interface ConfigVersion {
  id: number;
  version: number;
  createdAt: string;
}

const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const MAX_HISTORY = 50;

const defaultItem: LootItem = {
  "Item Shortname": "",
  "Min item amount": 1,
  "Max item amount": 1,
  "Chance to spawn": 100,
  "Is Blueprint": false,
  "Min Condition % (0.0% - 100.0%)": 100,
  "max Condition % (0.0% - 100.0%)": 100,
  "Times allowed to spawn per container": "1",
};

const defaultContainer: ContainerConfig = {
  "Min items": 1,
  "Max Items": 5,
  "Min Scrap": 0,
  "Max Scrap": 0,
  Enabled: true,
  Items: [],
};

function migrateContainer(container: ContainerConfig): ContainerConfig {
  if (container["Scrap Amount"] != null && container["Scrap Amount"] > 0 && (container["Max Scrap"] ?? 0) === 0) {
    const maxScrap = container["Scrap Amount"];
    const minScrap = Math.max(1, Math.round(maxScrap * 0.75));
    return { ...container, "Min Scrap": minScrap, "Max Scrap": maxScrap, "Scrap Amount": null };
  }
  return { ...container, "Min Scrap": container["Min Scrap"] ?? 0, "Max Scrap": container["Max Scrap"] ?? 0 };
}

function useUndoRedo<T>(initialState: T) {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = history[currentIndex];

  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory((prev) => {
      const curr = prev[currentIndex];
      const next = typeof newState === "function" ? (newState as (prev: T) => T)(curr) : newState;
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(next);
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return newHistory;
    });
    setCurrentIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [currentIndex]);

  const undo = useCallback(() => setCurrentIndex((prev) => Math.max(0, prev - 1)), []);
  const redo = useCallback(() => setCurrentIndex((prev) => Math.min(history.length - 1, prev + 1)), [history.length]);
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  const reset = useCallback((newState: T) => { setHistory([newState]); setCurrentIndex(0); }, []);

  return { current, setState, undo, redo, canUndo, canRedo, reset };
}

export default function LootManagerPage() {
  useSidebarCompact(true);
  const [activeTab, setActiveTab] = useState<"tables" | "mapping">("tables");
  const { current: data, setState: setData, undo, redo, canUndo, canRedo, reset: resetHistory } = useUndoRedo<LootManagerData>({ ContainerItems: {} });
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [addItemSearch, setAddItemSearch] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [copiedContainer, setCopiedContainer] = useState<ContainerConfig | null>(null);
  const [showMultiplierModal, setShowMultiplierModal] = useState(false);
  const [showNewContainerModal, setShowNewContainerModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [newContainerName, setNewContainerName] = useState("");
  const [multiplierValue, setMultiplierValue] = useState(2);
  const [multiplierApplyMin, setMultiplierApplyMin] = useState(true);
  const [multiplierApplyMax, setMultiplierApplyMax] = useState(true);
  const [multiplierApplyChance, setMultiplierApplyChance] = useState(false);
  const [multiplierSkipOnes, setMultiplierSkipOnes] = useState(false);
  const [multiplierApplyScrap, setMultiplierApplyScrap] = useState(false);
  const [multiplierScope, setMultiplierScope] = useState<"current" | "all">("current");
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [loadingSavedConfigs, setLoadingSavedConfigs] = useState(false);
  const [currentConfigId, setCurrentConfigId] = useState<number | null>(null);
  const [currentConfigName, setCurrentConfigName] = useState<string>("");
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showUnstagedModal, setShowUnstagedModal] = useState(false);
  const [unstagedConfigs, setUnstagedConfigs] = useState<SavedConfig[]>([]);
  const [currentConfigVersion, setCurrentConfigVersion] = useState<number>(1);
  const [currentPublishedVersion, setCurrentPublishedVersion] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mappings, setMappings] = useState<LootMapping[]>([]);
  const [servers, setServers] = useState<ServerIdentifier[]>([]);
  const [selectedMappingServerId, setSelectedMappingServerId] = useState<string | null>(null);
  const [showAddMappingModal, setShowAddMappingModal] = useState(false);
  const [selectedMappingConfig, setSelectedMappingConfig] = useState<number | null>(null);
  const [selectedMappingServer, setSelectedMappingServer] = useState<string | null>(null);
  const [selectedMappingHours, setSelectedMappingHours] = useState<string>("");
  const [selectedMappingMinutes, setSelectedMappingMinutes] = useState<string>("");
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rustItems, setRustItems] = useState<RustItem[]>([]);
  const [itemBrowserSearch, setItemBrowserSearch] = useState("");
  const [itemBrowserCategory, setItemBrowserCategory] = useState<ItemCategory | "All">("All");
  const [showItemBrowser, setShowItemBrowser] = useState(true);

  useEffect(() => {
    fetchRustItems().then(setRustItems).catch(() => toast.error("Failed to load items"));
  }, []);

  const filteredRustItems = useMemo(() => {
    let items = rustItems;
    if (itemBrowserCategory !== "All") {
      items = items.filter(i => i.Category === itemBrowserCategory);
    }
    if (itemBrowserSearch) {
      items = searchItems(items, itemBrowserSearch);
    }
    return items.slice(0, 100);
  }, [rustItems, itemBrowserSearch, itemBrowserCategory]);

  const groupedItems = useMemo(() => groupItemsByCategory(rustItems), [rustItems]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) { e.preventDefault(); if (canRedo) redo(); }
        else { e.preventDefault(); if (canUndo) undo(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); if (canRedo) redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (currentConfigId) handleQuickSave();
        else setShowSaveModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUndo, canRedo, undo, redo, currentConfigId]);

  useEffect(() => { fetchSavedConfigs(); fetchUnstagedConfigs(); fetchMappings(); fetchServers(); }, []);

  const fetchSavedConfigs = async () => {
    setLoadingSavedConfigs(true);
    try {
      const res = await fetch("/api/lootmanager");
      if (res.ok) setSavedConfigs(await res.json());
    } catch (error) { console.error("Failed to fetch saved configs:", error); }
    finally { setLoadingSavedConfigs(false); }
  };

  const fetchUnstagedConfigs = async () => {
    try {
      const res = await fetch("/api/lootmanager?unstaged=true");
      if (res.ok) setUnstagedConfigs(await res.json());
    } catch (error) { console.error("Failed to fetch unstaged configs:", error); }
  };

  const fetchMappings = async () => {
    try {
      const res = await fetch("/api/lootmanager/mappings");
      if (res.ok) setMappings(await res.json());
    } catch (error) { console.error("Failed to fetch mappings:", error); }
  };

  const fetchServers = async () => {
    try {
      const res = await fetch("/api/identifiers", { credentials: "include" });
      console.log("identifiers response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("identifiers data:", data.length, "total,", data.filter((s: { ip: string | null; port: number | null }) => s.ip && s.port).length, "with ip/port");
        if (Array.isArray(data)) {
          setServers(data.filter((s: { ip: string | null; port: number | null }) => s.ip && s.port));
        }
      }
    } catch (error) { console.error("Failed to fetch servers:", error); }
  };

  const handlePublish = async (configId: number) => {
    try {
      const res = await fetch(`/api/lootmanager/${configId}/publish`, { method: "POST" });
      if (res.ok) {
        toast.success("Published successfully");
        fetchSavedConfigs();
        fetchUnstagedConfigs();
        if (currentConfigId === configId) {
          const updated = await res.json();
          setCurrentPublishedVersion(updated.publishedVersion);
        }
      } else toast.error("Failed to publish");
    } catch { toast.error("Failed to publish"); }
  };

  const handlePublishAll = async () => {
    for (const config of unstagedConfigs) {
      await handlePublish(config.id);
    }
  };

  const fetchVersions = async (configId: number) => {
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/lootmanager/${configId}/versions`);
      if (res.ok) setVersions(await res.json());
    } catch (error) { console.error("Failed to fetch versions:", error); }
    finally { setLoadingVersions(false); }
  };

  const handleOpenVersionHistory = () => {
    if (!currentConfigId) return;
    fetchVersions(currentConfigId);
    setShowVersionHistoryModal(true);
  };

  const handleRestoreVersion = async (version: number) => {
    if (!currentConfigId) return;
    try {
      const res = await fetch(`/api/lootmanager/${currentConfigId}/versions/${version}`);
      if (res.ok) {
        const versionData = await res.json();
        const lootData = typeof versionData.lootData === "string" ? JSON.parse(versionData.lootData) : versionData.lootData;
        const migrated: LootManagerData = {
          ContainerItems: Object.fromEntries(Object.entries(lootData.ContainerItems || {}).map(([k, v]) => [k, migrateContainer(v as ContainerConfig)])),
        };
        resetHistory(migrated);
        setSelectedContainer(null);
        setShowVersionHistoryModal(false);
        toast.success(`Restored version ${version}`);
      } else toast.error("Failed to load version");
    } catch { toast.error("Failed to restore version"); }
  };

  const containerNames = useMemo(() => Object.keys(data.ContainerItems).sort(), [data.ContainerItems]);
  const filteredContainers = useMemo(() => containerNames.filter((name) => name.toLowerCase().includes(searchTerm.toLowerCase())), [containerNames, searchTerm]);
  const currentContainer = selectedContainer ? data.ContainerItems[selectedContainer] : null;
  const filteredItems = useMemo(() => {
    if (!currentContainer) return [];
    return currentContainer.Items.filter((item) => getItemShortname(item).toLowerCase().includes(itemSearchTerm.toLowerCase()));
  }, [currentContainer, itemSearchTerm]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.ContainerItems) {
          const migrated: LootManagerData = {
            ContainerItems: Object.fromEntries(Object.entries(json.ContainerItems).map(([k, v]) => [k, migrateContainer(v as ContainerConfig)])),
          };
          resetHistory(migrated);
          setSelectedContainer(null);
          setCurrentConfigId(null);
          setCurrentConfigName("");
          toast.success(`Loaded ${Object.keys(json.ContainerItems).length} containers`);
        } else { toast.error("Invalid format - missing ContainerItems key"); }
      } catch (err) { console.error("JSON parse error:", err); toast.error("Failed to parse JSON file"); }
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExport = () => {
    const exportData: LootManagerData = {
      ContainerItems: Object.fromEntries(Object.entries(data.ContainerItems).map(([k, v]) => { const { "Scrap Amount": _scrap, ...rest } = v; return [k, rest]; })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "LootManager.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("LootManager.json exported");
  };

  const handleSaveConfig = async () => {
    if (!saveName.trim()) { toast.error("Please enter a name"); return; }
    setIsSaving(true);
    try {
      const res = await fetch("/api/lootmanager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName, description: saveDescription || null, lootData: JSON.stringify(data) }),
      });
      if (res.ok) {
        const newConfig = await res.json();
        setCurrentConfigId(newConfig.id);
        setCurrentConfigName(saveName);
        setCurrentConfigVersion(newConfig.currentVersion);
        setCurrentPublishedVersion(newConfig.publishedVersion);
        toast.success("Config saved successfully");
        setShowSaveModal(false);
        setSaveName("");
        setSaveDescription("");
        fetchSavedConfigs();
        fetchUnstagedConfigs();
      } else { const err = await res.json(); toast.error(err.error || "Failed to save"); }
    } catch { toast.error("Failed to save config"); }
    finally { setIsSaving(false); }
  };

  const handleQuickSave = async () => {
    if (!currentConfigId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/lootmanager/${currentConfigId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lootData: JSON.stringify(data) }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentConfigVersion(updated.currentVersion);
        toast.success("Saved");
        fetchSavedConfigs();
        fetchUnstagedConfigs();
      }
      else toast.error("Failed to save");
    } catch { toast.error("Failed to save"); }
    finally { setIsSaving(false); }
  };

  const handleLoadConfig = async (config: SavedConfig) => {
    try {
      const res = await fetch(`/api/lootmanager/${config.id}`);
      if (res.ok) {
        const fullConfig = await res.json();
        const lootData = typeof fullConfig.lootData === "string" ? JSON.parse(fullConfig.lootData) : fullConfig.lootData;
        const migrated: LootManagerData = {
          ContainerItems: Object.fromEntries(Object.entries(lootData.ContainerItems || {}).map(([k, v]) => [k, migrateContainer(v as ContainerConfig)])),
        };
        resetHistory(migrated);
        setCurrentConfigId(config.id);
        setCurrentConfigName(config.name);
        setCurrentConfigVersion(fullConfig.currentVersion || 1);
        setCurrentPublishedVersion(fullConfig.publishedVersion);
        setSelectedContainer(null);
        setShowLoadModal(false);
        toast.success(`Loaded "${config.name}"`);
      } else toast.error("Failed to load config");
    } catch { toast.error("Failed to load config"); }
  };

  const handleDeleteConfig = async (id: number) => {
    if (!confirm("Delete this saved config?")) return;
    try {
      const res = await fetch(`/api/lootmanager/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (currentConfigId === id) { setCurrentConfigId(null); setCurrentConfigName(""); }
        toast.success("Config deleted");
        fetchSavedConfigs();
        fetchMappings();
      } else toast.error("Failed to delete");
    } catch { toast.error("Failed to delete"); }
  };

  const handleAddMapping = async () => {
    if (!selectedMappingConfig || !selectedMappingServer) { toast.error("Select both config and server"); return; }
    const hours = selectedMappingHours.trim() === "" ? 0 : parseInt(selectedMappingHours);
    const mins = selectedMappingMinutes.trim() === "" ? 0 : parseInt(selectedMappingMinutes);
    if (isNaN(hours) || hours < 0 || isNaN(mins) || mins < 0 || mins > 59) { toast.error("Invalid time values"); return; }
    const minutesAfterWipe = (selectedMappingHours.trim() === "" && selectedMappingMinutes.trim() === "") ? null : (hours * 60 + mins);
    try {
      const res = await fetch("/api/lootmanager/mappings", {
        method: editingMappingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingMappingId
          ? { id: editingMappingId, configId: selectedMappingConfig, minutesAfterWipe }
          : { configId: selectedMappingConfig, serverIdentifierId: selectedMappingServer, isLive: false, minutesAfterWipe }),
      });
      if (res.ok) {
        toast.success(editingMappingId ? "Mapping updated" : "Mapping created");
        fetchMappings();
        closeAddMappingModal();
      } else { const err = await res.json(); toast.error(err.error || "Failed to save mapping"); }
    } catch { toast.error("Failed to save mapping"); }
  };

  const handleAddToRotation = (serverId: string) => {
    setSelectedMappingServer(serverId);
    setSelectedMappingConfig(null);
    setSelectedMappingHours("");
    setSelectedMappingMinutes("");
    setEditingMappingId(null);
    setShowAddMappingModal(true);
  };

  const closeAddMappingModal = () => {
    setShowAddMappingModal(false);
    setSelectedMappingConfig(null);
    setSelectedMappingServer(null);
    setSelectedMappingHours("");
    setSelectedMappingMinutes("");
    setEditingMappingId(null);
  };

  const handleEditMapping = (mapping: LootMapping) => {
    setEditingMappingId(mapping.id);
    setSelectedMappingConfig(mapping.configId);
    setSelectedMappingServer(mapping.serverIdentifierId);
    if (mapping.minutesAfterWipe !== null) {
      setSelectedMappingHours(String(Math.floor(mapping.minutesAfterWipe / 60)));
      setSelectedMappingMinutes(String(mapping.minutesAfterWipe % 60));
    } else {
      setSelectedMappingHours("");
      setSelectedMappingMinutes("");
    }
    setShowAddMappingModal(true);
  };

  const handleDeleteMapping = async (id: number) => {
    if (!confirm("Remove this server assignment?")) return;
    try {
      const res = await fetch("/api/lootmanager/mappings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { toast.success("Mapping removed"); fetchMappings(); }
      else toast.error("Failed to remove mapping");
    } catch { toast.error("Failed to remove mapping"); }
  };

  const handleToggleLive = async (mapping: LootMapping) => {
    try {
      const res = await fetch("/api/lootmanager/mappings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mapping.id, isLive: !mapping.isLive }),
      });
      if (res.ok) {
        toast.success(mapping.isLive ? "Set to inactive" : "Set to live");
        fetchMappings();
      } else toast.error("Failed to update");
    } catch { toast.error("Failed to update"); }
  };

  const updateContainer = useCallback((containerName: string, updates: Partial<ContainerConfig>) => {
    setData((prev) => ({
      ...prev,
      ContainerItems: { ...prev.ContainerItems, [containerName]: { ...prev.ContainerItems[containerName], ...updates } },
    }));
  }, [setData]);

  const updateItem = useCallback((containerName: string, itemIndex: number, updates: Partial<LootItem>) => {
    setData((prev) => {
      const container = prev.ContainerItems[containerName];
      const newItems = [...container.Items];
      newItems[itemIndex] = { ...newItems[itemIndex], ...updates };
      return { ...prev, ContainerItems: { ...prev.ContainerItems, [containerName]: { ...container, Items: newItems } } };
    });
  }, [setData]);

  const addItem = useCallback((containerName: string, shortname: string) => {
    setData((prev) => {
      const container = prev.ContainerItems[containerName];
      return {
        ...prev,
        ContainerItems: { ...prev.ContainerItems, [containerName]: { ...container, Items: [...container.Items, { ...defaultItem, "Item Shortname": shortname }] } },
      };
    });
    setShowAddItem(false);
    setAddItemSearch("");
    toast.success(`Added ${shortname}`);
  }, [setData]);

  const removeItem = useCallback((containerName: string, itemIndex: number) => {
    setData((prev) => {
      const container = prev.ContainerItems[containerName];
      const newItems = container.Items.filter((_, i) => i !== itemIndex);
      return { ...prev, ContainerItems: { ...prev.ContainerItems, [containerName]: { ...container, Items: newItems } } };
    });
  }, [setData]);

  const copyContainer = useCallback(() => {
    if (!selectedContainer || !currentContainer) return;
    setCopiedContainer(JSON.parse(JSON.stringify(currentContainer)));
    toast.success("Container copied");
  }, [selectedContainer, currentContainer]);

  const pasteContainer = useCallback(() => {
    if (!selectedContainer || !copiedContainer) return;
    updateContainer(selectedContainer, {
      Items: JSON.parse(JSON.stringify(copiedContainer.Items)),
      "Min items": copiedContainer["Min items"],
      "Max Items": copiedContainer["Max Items"],
      "Min Scrap": copiedContainer["Min Scrap"],
      "Max Scrap": copiedContainer["Max Scrap"],
    });
    toast.success("Container items pasted");
  }, [selectedContainer, copiedContainer, updateContainer]);

  const addNewContainer = useCallback(() => {
    if (!newContainerName.trim()) { toast.error("Please enter a container name"); return; }
    if (data.ContainerItems[newContainerName]) { toast.error("Container already exists"); return; }
    setData((prev) => ({ ...prev, ContainerItems: { ...prev.ContainerItems, [newContainerName]: { ...defaultContainer } } }));
    setSelectedContainer(newContainerName);
    setShowNewContainerModal(false);
    setNewContainerName("");
    toast.success("Container created");
  }, [newContainerName, data.ContainerItems, setData]);

  const deleteContainer = useCallback((containerName: string) => {
    if (!confirm(`Delete container "${containerName}"?`)) return;
    setData((prev) => { const { [containerName]: _removed, ...rest } = prev.ContainerItems; return { ...prev, ContainerItems: rest }; });
    if (selectedContainer === containerName) setSelectedContainer(null);
    toast.success("Container deleted");
  }, [selectedContainer, setData]);

  const applyMultiplier = useCallback(() => {
    const apply = (items: LootItem[]) =>
      items.map((item) => {
        if (multiplierSkipOnes && item["Min item amount"] === 1 && item["Max item amount"] === 1) return item;
        return {
          ...item,
          "Min item amount": multiplierApplyMin ? Math.round(item["Min item amount"] * multiplierValue) : item["Min item amount"],
          "Max item amount": multiplierApplyMax ? Math.round(item["Max item amount"] * multiplierValue) : item["Max item amount"],
          "Chance to spawn": multiplierApplyChance ? Math.round(item["Chance to spawn"] * multiplierValue) : item["Chance to spawn"],
        };
      });
    const applyScrap = (container: ContainerConfig): ContainerConfig => {
      if (!multiplierApplyScrap) return container;
      return { ...container, "Min Scrap": Math.round((container["Min Scrap"] ?? 0) * multiplierValue), "Max Scrap": Math.round((container["Max Scrap"] ?? 0) * multiplierValue) };
    };
    if (multiplierScope === "current" && selectedContainer) {
      const container = data.ContainerItems[selectedContainer];
      updateContainer(selectedContainer, applyScrap({ ...container, Items: apply(container.Items) }));
      toast.success(`Applied ${multiplierValue}x to ${selectedContainer}`);
    } else {
      setData((prev) => ({
        ...prev,
        ContainerItems: Object.fromEntries(Object.entries(prev.ContainerItems).map(([name, container]) => [name, applyScrap({ ...container, Items: apply(container.Items) })])),
      }));
      toast.success(`Applied ${multiplierValue}x to all containers`);
    }
    setShowMultiplierModal(false);
  }, [multiplierValue, multiplierApplyMin, multiplierApplyMax, multiplierApplyChance, multiplierSkipOnes, multiplierApplyScrap, multiplierScope, selectedContainer, data.ContainerItems, updateContainer, setData]);

  const clearAllItems = useCallback(() => {
    if (!selectedContainer) return;
    if (!confirm("Clear all items from this container?")) return;
    updateContainer(selectedContainer, { Items: [] });
    toast.success("Items cleared");
  }, [selectedContainer, updateContainer]);

  const toggleContainerEnabled = useCallback((containerName: string) => {
    const container = data.ContainerItems[containerName];
    updateContainer(containerName, { Enabled: !container.Enabled });
  }, [data.ContainerItems, updateContainer]);

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden">
      <GlassContainer as="aside" variant="subtle" radius="sm" className="w-72 flex flex-col border-r border-white/5 !rounded-none" features={{ hoverGlow: false }}>
        <div className="p-4 border-b border-white/5">
          <div className="flex gap-1 mb-4 p-1 rounded-lg bg-white/5">
            <button
              onClick={() => setActiveTab("tables")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "tables" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)] hover:text-white"}`}
            >
              <Package className="h-4 w-4" />Tables
            </button>
            <button
              onClick={() => setActiveTab("mapping")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "mapping" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)] hover:text-white"}`}
            >
              <Link2 className="h-4 w-4" />Mapping
            </button>
          </div>

          {activeTab === "tables" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="h-5 w-5 text-[var(--accent-primary)]" />
                  Containers
                </h2>
                <div className="flex items-center gap-1">
                  <button onClick={undo} disabled={!canUndo} className="p-1.5 rounded text-[var(--text-muted)] disabled:opacity-30 bg-white/5" title="Undo"><Undo2 className="h-4 w-4" /></button>
                  <button onClick={redo} disabled={!canRedo} className="p-1.5 rounded text-[var(--text-muted)] disabled:opacity-30 bg-white/5" title="Redo"><Redo2 className="h-4 w-4" /></button>
                </div>
              </div>
              {currentConfigName && (
                <div className="mb-3 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30">
                  <FileText className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span className="text-sm text-[var(--accent-primary)] truncate flex-1">{currentConfigName}</span>
                  <button onClick={handleOpenVersionHistory} className="p-1 rounded hover:bg-[var(--accent-primary)]/20 transition-colors" title="Version History">
                    <History className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  </button>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${currentConfigVersion > (currentPublishedVersion || 0) ? "bg-[var(--status-warning)]/20 text-[var(--status-warning)]" : "bg-[var(--status-success)]/20 text-[var(--status-success)]"}`}>
                    v{currentConfigVersion}{currentPublishedVersion ? ` / v${currentPublishedVersion}` : ""}
                  </span>
                  {isSaving && <div className="w-3 h-3 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search containers..." className="w-full rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[var(--text-tertiary)] bg-white/5 border border-white/5 focus:outline-none" />
              </div>
            </>
          )}

          {activeTab === "mapping" && (
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Server className="h-5 w-5 text-[var(--accent-primary)]" />
                Server Assignments
              </h2>
            </div>
          )}
        </div>

        {activeTab === "tables" && (
          <>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredContainers.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-tertiary)]">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50 text-[var(--accent-primary)]" />
                  <p className="text-sm">No containers found</p>
                  <p className="text-xs mt-1">Upload a LootManager.json</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredContainers.map((name) => {
                    const container = data.ContainerItems[name];
                    const isSelected = selectedContainer === name;
                    return (
                      <div key={name}
                        className={`group relative rounded-lg cursor-pointer transition-all ${isSelected ? "bg-[var(--accent-primary)] text-white" : "bg-white/[0.02] text-[var(--text-muted)] hover:bg-white/5"}`}
                        onClick={() => setSelectedContainer(name)}
                      >
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${container.Enabled ? "bg-[var(--status-success)]" : "bg-[var(--status-error)]"}`} />
                            <span className="truncate text-sm font-medium">{name}</span>
                          </div>
                          <span className="text-xs opacity-60 flex-shrink-0">{container.Items.length}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 space-y-2 border-t border-white/5">
              <button onClick={() => setShowUnstagedModal(true)} className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm border ${unstagedConfigs.length > 0 ? "text-[var(--status-warning)] bg-[var(--status-warning)]/10 border-[var(--status-warning)]/30" : "text-[var(--text-muted)] bg-white/5 border-white/10"}`}>
                <CloudUpload className="h-4 w-4" />Unstaged{unstagedConfigs.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-[var(--status-warning)]/30 text-xs">{unstagedConfigs.length}</span>}
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowLoadModal(true)} className="flex-1 flex items-center justify-center gap-1 text-[var(--text-muted)] px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10"><FolderOpen className="h-4 w-4" />Load</button>
                <button onClick={() => currentConfigId ? handleQuickSave() : setShowSaveModal(true)} disabled={containerNames.length === 0} className="flex-1 flex items-center justify-center gap-1 text-[var(--status-success)] px-3 py-2 rounded-lg text-sm bg-[var(--status-success)]/10 border border-[var(--status-success)]/30 disabled:opacity-50"><Save className="h-4 w-4" />{currentConfigId ? "Save" : "Save As"}</button>
              </div>
              {currentConfigId && currentConfigVersion > (currentPublishedVersion || 0) && (
                <button onClick={() => handlePublish(currentConfigId)} className="w-full flex items-center justify-center gap-2 text-[var(--status-success)] px-3 py-2 rounded-lg text-sm font-medium bg-[var(--status-success)]/20 border border-[var(--status-success)]/30">
                  <CloudUpload className="h-4 w-4" />Publish v{currentConfigVersion}
                </button>
              )}
              <button onClick={() => setShowNewContainerModal(true)} className="w-full flex items-center justify-center gap-2 text-white px-3 py-2 rounded-lg text-sm font-medium bg-[var(--accent-primary)]"><Plus className="h-4 w-4" />New Container</button>
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1 text-[var(--text-muted)] px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10"><Upload className="h-4 w-4" />Upload</button>
                <button onClick={handleExport} disabled={containerNames.length === 0} className="flex-1 flex items-center justify-center gap-1 text-[var(--text-muted)] px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 disabled:opacity-50"><Download className="h-4 w-4" />Export</button>
              </div>
            </div>
          </>
        )}

        {activeTab === "mapping" && (
          <>
            <div className="flex-1 overflow-y-auto p-2">
              {servers.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-tertiary)]">
                  <Server className="h-8 w-8 mx-auto mb-2 opacity-50 text-[var(--accent-primary)]" />
                  <p className="text-sm">No servers</p>
                  <p className="text-xs mt-1">Servers register automatically</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {servers.map((server) => {
                    const serverMappings = mappings.filter(m => m.serverIdentifierId === server.id);
                    const liveMappings = serverMappings.filter(m => m.isLive);
                    const isSelected = selectedMappingServerId === server.id;
                    return (
                      <div
                        key={server.id}
                        onClick={() => setSelectedMappingServerId(server.id)}
                        className={`rounded-lg p-3 cursor-pointer transition-all ${isSelected ? "bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30" : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-white truncate">{server.name}</div>
                            <div className="text-xs text-[var(--text-muted)] truncate">{server.ip}:{server.port}</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {liveMappings.length > 0 ? (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--status-success)]/20 text-[var(--status-success)]">{liveMappings.length} live</span>
                            ) : serverMappings.length > 0 ? (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--text-muted)]/20 text-[var(--text-muted)]">{serverMappings.length}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </GlassContainer>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "tables" && (
          <>
            {!selectedContainer ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-[var(--accent-primary)]" />
                    Quick Load
                  </h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1">Select a saved config to start editing</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {loadingSavedConfigs ? (
                    <div className="text-center py-12">
                      <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-[var(--text-muted)]">Loading configs...</p>
                    </div>
                  ) : savedConfigs.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-16 w-16 mx-auto mb-4 opacity-30 text-[var(--accent-primary)]" />
                      <h3 className="text-xl font-medium text-[var(--text-muted)] mb-2">No Saved Configs</h3>
                      <p className="text-sm text-[var(--text-tertiary)] mb-4">Upload a LootManager.json to get started</p>
                      <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/20 transition-colors">
                        <Upload className="h-4 w-4" />Upload JSON
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {savedConfigs.map((config) => (
                        <button
                          key={config.id}
                          className="group text-left w-full"
                          onClick={() => handleLoadConfig(config)}
                        >
                        <GlassContainer
                          variant="default"
                          padding="md"
                          radius="lg"
                          interactive
                          features={{ hoverGlow: true, hoverLift: false }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-medium text-white group-hover:text-[var(--accent-primary)] transition-colors truncate">{config.name}</h3>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {config.currentVersion > (config.publishedVersion ?? 0) ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--status-warning)]/20 text-[var(--status-warning)]">draft</span>
                              ) : config.publishedVersion ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--status-success)]/20 text-[var(--status-success)]">v{config.publishedVersion}</span>
                              ) : null}
                            </div>
                          </div>
                          {config.description && <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-2">{config.description}</p>}
                          <div className="text-xs text-[var(--text-tertiary)]">
                            Updated {new Date(config.updatedAt).toLocaleDateString()}
                          </div>
                        </GlassContainer>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <GlassContainer variant="subtle" className="p-4 border-b border-white/5 !rounded-none" features={{ hoverGlow: false }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold text-white">{selectedContainer}</h1>
                      <button onClick={() => toggleContainerEnabled(selectedContainer)} className={`px-3 py-1 rounded-full text-xs font-medium ${currentContainer?.Enabled ? "bg-[var(--status-success)]/20 text-[var(--status-success)] border border-[var(--status-success)]/30" : "bg-[var(--status-error)]/20 text-[var(--status-error)] border border-[var(--status-error)]/30"}`}>
                        {currentContainer?.Enabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={copyContainer} className="p-2 rounded-lg text-[var(--text-muted)] bg-white/5 border border-white/10" title="Copy"><Copy className="h-4 w-4" /></button>
                      <button onClick={pasteContainer} disabled={!copiedContainer} className="p-2 rounded-lg text-[var(--text-muted)] bg-white/5 border border-white/10 disabled:opacity-50" title="Paste"><Clipboard className="h-4 w-4" /></button>
                      <button onClick={() => setShowMultiplierModal(true)} className="p-2 rounded-lg text-[var(--text-muted)] bg-white/5 border border-white/10" title="Multiplier"><Percent className="h-4 w-4" /></button>
                      <button onClick={clearAllItems} className="p-2 rounded-lg text-[var(--status-error)] bg-[var(--status-error)]/10 border border-[var(--status-error)]/30" title="Clear all"><Trash2 className="h-4 w-4" /></button>
                      <button onClick={() => deleteContainer(selectedContainer)} className="p-2 rounded-lg text-[var(--status-error)] bg-[var(--status-error)]/10 border border-[var(--status-error)]/30" title="Delete"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Min Items", key: "Min items" as const },
                      { label: "Max Items", key: "Max Items" as const },
                      { label: "Min Scrap", key: "Min Scrap" as const },
                      { label: "Max Scrap", key: "Max Scrap" as const },
                    ].map(({ label, key }) => (
                      <GlassContainer key={key} variant="subtle" radius="sm" className="p-3" features={{ hoverGlow: false }}>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
                        <input type="number" value={currentContainer?.[key] ?? 0} onChange={(e) => updateContainer(selectedContainer, { [key]: parseInt(e.target.value) || 0 })} className="w-full rounded px-3 py-2 text-white text-sm bg-white/[0.02] border border-white/5 focus:outline-none" />
                      </GlassContainer>
                    ))}
                  </div>
                </GlassContainer>

                <GlassContainer variant="subtle" className="px-4 py-3 flex items-center justify-between border-b border-white/5 !rounded-none" features={{ hoverGlow: false }}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                      <input type="text" value={itemSearchTerm} onChange={(e) => setItemSearchTerm(e.target.value)} placeholder="Search items..." className="rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[var(--text-tertiary)] bg-white/[0.02] border border-white/5 focus:outline-none w-64" />
                    </div>
                    <span className="text-sm text-[var(--text-muted)]">{filteredItems.length} items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-[var(--accent-primary)] text-white" : "bg-white/5 text-[var(--text-muted)]"}`}><Grid className="h-4 w-4" /></button>
                    <button onClick={() => setViewMode("list")} className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-[var(--accent-primary)] text-white" : "bg-white/5 text-[var(--text-muted)]"}`}><List className="h-4 w-4" /></button>
                    <button onClick={() => setShowAddItem(true)} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-primary)]"><Plus className="h-4 w-4" />Add Item</button>
                  </div>
                </GlassContainer>

                <div className="flex-1 overflow-y-auto p-4">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-tertiary)]">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30 text-[var(--accent-primary)]" />
                      <p>No items in this container</p>
                      <button onClick={() => setShowAddItem(true)} className="mt-3 text-[var(--accent-primary)] hover:text-[var(--accent-primary)] text-sm">Add your first item</button>
                    </div>
                  ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredItems.map((item) => {
                        const realIndex = currentContainer!.Items.indexOf(item);
                        return <ItemCard key={`${getItemShortname(item)}-${realIndex}`} item={item} index={realIndex} containerName={selectedContainer} onUpdate={updateItem} onRemove={removeItem} />;
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredItems.map((item) => {
                        const realIndex = currentContainer!.Items.indexOf(item);
                        return <ItemListRow key={`${getItemShortname(item)}-${realIndex}`} item={item} index={realIndex} containerName={selectedContainer} onUpdate={updateItem} onRemove={removeItem} />;
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "mapping" && (
          <>
            {!selectedMappingServerId ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Server className="h-5 w-5 text-[var(--accent-primary)]" />
                    Server Loot Rotation
                  </h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1">Assign loot tables to servers with time-based rotation</p>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-2xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--accent-primary)]/10 to-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 rounded-lg bg-[var(--accent-primary)]/20"><Clock className="h-5 w-5 text-[var(--accent-primary)]" /></div>
                          <h3 className="font-medium text-white">Rolling Loot</h3>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">Automatically switch loot tables based on time since wipe</p>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--status-success)]/10 to-[var(--status-success)]/10 border border-[var(--status-success)]/20">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 rounded-lg bg-[var(--status-success)]/20"><ToggleRight className="h-5 w-5 text-[var(--status-success)]" /></div>
                          <h3 className="font-medium text-white">Live Toggle</h3>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">Enable/disable tables without removing them from rotation</p>
                      </div>
                    </div>
                    <GlassContainer variant="subtle" radius="md" className="p-5" features={{ hoverGlow: false }}>
                      <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[var(--accent-primary)]" />Example Rotation Schedule
                      </h4>
                      <div className="relative pl-4 border-l-2 border-[var(--accent-primary)]/30 space-y-4">
                        {[
                          { time: "Wipe Day", desc: "Standard vanilla-like loot" },
                          { time: "12h+", desc: "Slightly increased rates" },
                          { time: "24h+", desc: "Medium tier progression" },
                          { time: "48h+", desc: "High-tier end-game loot" },
                        ].map((stage, i) => (
                          <div key={i} className="relative">
                            <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-[var(--accent-primary)] border-2 border-[var(--bg-root)]" />
                            <div className="text-sm font-medium text-white">{stage.time}</div>
                            <div className="text-xs text-[var(--text-muted)]">{stage.desc}</div>
                          </div>
                        ))}
                      </div>
                    </GlassContainer>
                    <p className="text-center text-[var(--text-tertiary)] text-sm mt-6">Select a server from the sidebar to configure its rotation</p>
                  </div>
                </div>
              </div>
            ) : (() => {
              const server = servers.find(s => s.id === selectedMappingServerId);
              const serverMappings = mappings.filter(m => m.serverIdentifierId === selectedMappingServerId).sort((a, b) => (a.minutesAfterWipe ?? -1) - (b.minutesAfterWipe ?? -1));
              const liveMappings = serverMappings.filter(m => m.isLive);
              if (!server) return null;
              return (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-[var(--accent-primary)]/5 to-[var(--accent-primary)]/5 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                          <Server className="h-6 w-6 text-[var(--accent-primary)]" />
                        </div>
                        <div>
                          <h1 className="text-xl font-bold text-white">{server.name}</h1>
                          <p className="text-sm text-[var(--text-muted)]">{server.ip}:{server.port}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {liveMappings.length > 0 ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--status-success)]/10 border border-[var(--status-success)]/20">
                            <div className="w-2 h-2 rounded-full bg-[var(--status-success)] animate-pulse" />
                            <span className="text-sm text-[var(--status-success)]">{liveMappings.length} active</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--text-muted)]/10 border border-[var(--text-muted)]/20">
                            <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                            <span className="text-sm text-[var(--text-muted)]">No active tables</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleAddToRotation(server.id)}
                          disabled={savedConfigs.length === 0}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <Plus className="h-4 w-4" />Add Table
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className="p-4">
                      {serverMappings.length === 0 ? (
                        <GlassContainer variant="subtle" radius="md" className="text-center py-16 border border-dashed border-white/10" features={{ hoverGlow: false }}>
                          <div className="p-4 rounded-full bg-[var(--accent-primary)]/10 w-fit mx-auto mb-4">
                            <Link2 className="h-8 w-8 text-[var(--accent-primary)]" />
                          </div>
                          <h3 className="text-lg font-medium text-[var(--text-muted)] mb-2">No Loot Tables Assigned</h3>
                          <p className="text-sm text-[var(--text-tertiary)] mb-4 max-w-md mx-auto">Add your first loot table to this server to start configuring the rotation schedule.</p>
                          <button
                            onClick={() => handleAddToRotation(server.id)}
                            disabled={savedConfigs.length === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/20 text-sm disabled:opacity-50 transition-colors"
                          >
                            <Plus className="h-4 w-4" />Add First Table
                          </button>
                        </GlassContainer>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Rotation Tables</h3>
                            <div className="space-y-2">
                              {serverMappings.map((mapping) => (
                                <div
                                  key={mapping.id}
                                  className={`relative p-4 rounded-xl border transition-all ${
                                    mapping.isLive
                                      ? "bg-gradient-to-r from-[var(--status-success)]/5 to-[var(--status-success)]/5 border-[var(--status-success)]/20"
                                      : "bg-white/[0.02] border-white/5 opacity-60"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                      <button
                                        onClick={() => handleToggleLive(mapping)}
                                        className={`mt-0.5 flex-shrink-0 transition-colors ${mapping.isLive ? "text-[var(--status-success)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-muted)]"}`}
                                      >
                                        {mapping.isLive ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                                      </button>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-white">{mapping.config.name}</span>
                                          {mapping.config.publishedVersion && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--text-muted)]/20 text-[var(--text-muted)]">v{mapping.config.publishedVersion}</span>
                                          )}
                                        </div>
                                        <div className="mt-1">
                                          {mapping.minutesAfterWipe !== null ? (
                                            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-primary)]">
                                              <Clock className="h-3.5 w-3.5" />
                                              {formatDuration(mapping.minutesAfterWipe)} after wipe
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                                              <Clock className="h-3.5 w-3.5" />
                                              Wipe day default
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <button onClick={() => handleEditMapping(mapping)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-all" title="Edit">
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button onClick={() => handleDeleteMapping(mapping.id)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--status-error)] hover:bg-[var(--status-error)]/10 transition-all" title="Remove">
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Timeline Preview</h3>
                            <GlassContainer variant="subtle" radius="md" className="p-4" features={{ hoverGlow: false }}>
                              <div className="relative pl-4 border-l-2 border-[var(--accent-primary)]/30 space-y-3">
                                {serverMappings.filter(m => m.isLive).map((m, i) => (
                                  <div key={m.id} className="relative">
                                    <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-[var(--status-success)] border-2 border-[var(--bg-root)]" />
                                    <div className="text-sm font-medium text-white">
                                      {m.minutesAfterWipe !== null ? `${formatDuration(m.minutesAfterWipe)}+` : "Wipe Day"}
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)]">{m.config.name}</div>
                                  </div>
                                ))}
                                {serverMappings.filter(m => m.isLive).length === 0 && (
                                  <div className="text-sm text-[var(--text-tertiary)] italic">No active tables in rotation</div>
                                )}
                              </div>
                            </GlassContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {activeTab === "tables" && selectedContainer && (
        <GlassContainer as="aside" variant="subtle" radius="sm" className={`flex flex-col border-l border-white/5 transition-all duration-300 !rounded-none ${showItemBrowser ? "w-72" : "w-10"}`} features={{ hoverGlow: false }}>
          <button
            onClick={() => setShowItemBrowser(!showItemBrowser)}
            className="p-2 text-[var(--text-muted)] hover:text-white border-b border-white/5 flex items-center justify-center"
            title={showItemBrowser ? "Hide item browser" : "Show item browser"}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${showItemBrowser ? "rotate-180" : ""}`} />
          </button>
          {showItemBrowser && (
            <>
              <div className="p-3 border-b border-white/5">
                <h3 className="text-sm font-semibold text-white mb-2">Item Browser</h3>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={itemBrowserSearch}
                    onChange={(e) => setItemBrowserSearch(e.target.value)}
                    placeholder="Search items..."
                    className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[var(--text-tertiary)] bg-white/5 border border-white/5 focus:outline-none"
                  />
                </div>
                <Dropdown
                  value={itemBrowserCategory}
                  onChange={(value) => setItemBrowserCategory(value as ItemCategory | "All")}
                  options={[
                    { value: "All", label: "All Categories" },
                    ...ITEM_CATEGORIES.map(cat => ({ value: cat, label: cat }))
                  ]}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {rustItems.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-tertiary)]">
                    <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading items...</p>
                  </div>
                ) : filteredRustItems.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-tertiary)]">
                    <p className="text-xs">No items found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1">
                    {filteredRustItems.map((item) => (
                      <button
                        key={item.shortname}
                        onClick={() => { addItem(selectedContainer, item.shortname); toast.success(`Added ${item.Name}`); }}
                        className="group relative aspect-square rounded-lg bg-white/[0.02] border border-white/5 hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/10 transition-all p-1"
                        title={`${item.Name}\n${item.shortname}`}
                      >
                        <img
                          src={getItemImageUrl(item.shortname)}
                          alt={item.Name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-lg">
                          <Plus className="h-4 w-4 text-[var(--accent-primary)]" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {filteredRustItems.length >= 100 && (
                  <p className="text-xs text-[var(--text-muted)] text-center mt-2">Showing first 100 results</p>
                )}
              </div>
            </>
          )}
        </GlassContainer>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />

        {showAddItem && selectedContainer && (
          <Modal onClose={() => { setShowAddItem(false); setAddItemSearch(""); }} title="Add Item">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input type="text" value={addItemSearch} onChange={(e) => setAddItemSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && addItemSearch.trim()) addItem(selectedContainer, addItemSearch.trim()); }} placeholder="Enter item shortname..." className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-3 text-white placeholder-[var(--text-muted)] focus:outline-none" autoFocus />
            </div>
            {addItemSearch.trim() && (
              <button onClick={() => addItem(selectedContainer, addItemSearch.trim())} className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                <img src={getItemImageUrl(addItemSearch.trim())} alt={addItemSearch} referrerPolicy="no-referrer" className="w-10 h-10 object-contain bg-[var(--bg-elevated)] rounded-lg p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div className="flex-1 text-left">
                  <span className="text-white font-medium">{addItemSearch.trim()}</span>
                  <p className="text-xs text-[var(--text-muted)]">Press Enter or click to add</p>
                </div>
                <Plus className="h-5 w-5 text-[var(--accent-primary)]" />
              </button>
            )}
          </Modal>
        )}

        {showMultiplierModal && (
          <Modal onClose={() => setShowMultiplierModal(false)} title="Multiplier">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Multiplier Value</label>
                <input type="number" value={multiplierValue} onChange={(e) => setMultiplierValue(parseFloat(e.target.value) || 1)} min={0.1} step={0.1} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Apply To</label>
                <div className="flex flex-wrap gap-2">
                  {[{ label: "Min", checked: multiplierApplyMin, set: setMultiplierApplyMin }, { label: "Max", checked: multiplierApplyMax, set: setMultiplierApplyMax }, { label: "Chance", checked: multiplierApplyChance, set: setMultiplierApplyChance }, { label: "Scrap", checked: multiplierApplyScrap, set: setMultiplierApplyScrap }].map(({ label, checked, set }) => (
                      <CheckboxSwitch
                        key={label}
                        variant="pill"
                        pillColor="purple-500"
                        checked={checked}
                        onChange={() => set(!checked)}
                        label={label}
                      />
                    ))}
                </div>
              </div>
              <CheckboxSwitch
                variant="pill"
                pillColor="yellow-500"
                checked={multiplierSkipOnes}
                onChange={setMultiplierSkipOnes}
                label="Skip items at 1"
                className="inline-block"
              />
              <div className="flex gap-2">
                <button onClick={() => setMultiplierScope("current")} disabled={!selectedContainer} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${multiplierScope === "current" && selectedContainer ? "bg-[var(--accent-primary)] text-white" : "bg-white/5 text-[var(--text-muted)]"} disabled:opacity-50`}>Current</button>
                <button onClick={() => setMultiplierScope("all")} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${multiplierScope === "all" ? "bg-[var(--accent-primary)] text-white" : "bg-white/5 text-[var(--text-muted)]"}`}>All</button>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowMultiplierModal(false)} className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg">Cancel</button>
              <button onClick={applyMultiplier} className="flex-1 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg font-medium">Apply {multiplierValue}x</button>
            </div>
          </Modal>
        )}

        {showNewContainerModal && (
          <Modal onClose={() => { setShowNewContainerModal(false); setNewContainerName(""); }} title="New Container">
            <input type="text" value={newContainerName} onChange={(e) => setNewContainerName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNewContainer()} placeholder="e.g., crate_elite" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white placeholder-[var(--text-muted)] focus:outline-none" autoFocus />
            <p className="text-xs text-[var(--text-muted)] mt-2">Use the same name as the container prefab in Rust</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowNewContainerModal(false); setNewContainerName(""); }} className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg">Cancel</button>
              <button onClick={addNewContainer} className="flex-1 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg font-medium">Create</button>
            </div>
          </Modal>
        )}

        {showSaveModal && (
          <Modal onClose={() => { setShowSaveModal(false); setSaveName(""); setSaveDescription(""); }} title="Save Configuration">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Name *</label>
                <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g., 1000x Server Loot" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white placeholder-[var(--text-muted)] focus:outline-none" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Description (optional)</label>
                <textarea value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} placeholder="Brief description..." rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white placeholder-[var(--text-muted)] focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowSaveModal(false); setSaveName(""); setSaveDescription(""); }} className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg">Cancel</button>
              <button onClick={handleSaveConfig} disabled={isSaving || !saveName.trim()} className="flex-1 px-4 py-2 bg-[var(--status-success)] text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="h-4 w-4" />Save</>}
              </button>
            </div>
          </Modal>
        )}

        {showUnstagedModal && (
          <Modal onClose={() => setShowUnstagedModal(false)} title="Unstaged Changes" wide>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {unstagedConfigs.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]"><Check className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>All configs are published</p></div>
              ) : (
                <>
                  <div className="flex justify-end mb-4">
                    <button onClick={handlePublishAll} className="flex items-center gap-2 text-[var(--status-success)] px-4 py-2 rounded-lg text-sm font-medium bg-[var(--status-success)]/20 border border-[var(--status-success)]/30">
                      <CloudUpload className="h-4 w-4" />Publish All ({unstagedConfigs.length})
                    </button>
                  </div>
                  {unstagedConfigs.map((config) => (
                    <GlassContainer key={config.id} variant="prominent" radius="sm" className="p-4" features={{ hoverGlow: false }}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate">{config.name}</h4>
                          <p className="text-xs text-[var(--text-muted)] mt-1">v{config.currentVersion} → publish (current: {config.publishedVersion || "none"})</p>
                        </div>
                        <button onClick={() => handlePublish(config.id)} className="ml-4 flex items-center gap-2 text-[var(--status-success)] px-3 py-1.5 rounded-lg text-sm bg-[var(--status-success)]/20 border border-[var(--status-success)]/30">
                          <CloudUpload className="h-4 w-4" />Publish
                        </button>
                      </div>
                    </GlassContainer>
                  ))}
                </>
              )}
            </div>
            <button onClick={() => setShowUnstagedModal(false)} className="w-full mt-4 px-4 py-2 bg-white/5 text-white rounded-lg">Close</button>
          </Modal>
        )}

        {showLoadModal && (
          <Modal onClose={() => setShowLoadModal(false)} title="Load Configuration" wide>
            <div className="mb-4">
              <input type="text" placeholder="Search saved configs..." className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-[var(--text-muted)] focus:outline-none" />
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {loadingSavedConfigs ? (
                <div className="text-center py-12"><div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-[var(--text-muted)]">Loading...</p></div>
              ) : savedConfigs.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]"><FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No saved configs yet</p></div>
              ) : (
                savedConfigs.map((config) => (
                  <GlassContainer key={config.id} variant="prominent" interactive radius="sm" className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadConfig(config)}>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium truncate group-hover:text-[var(--accent-primary)] transition-colors">{config.name}</h4>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${config.currentVersion > (config.publishedVersion || 0) ? "bg-[var(--status-warning)]/20 text-[var(--status-warning)]" : "bg-[var(--status-success)]/20 text-[var(--status-success)]"}`}>
                            v{config.currentVersion}
                          </span>
                        </div>
                        {config.description && <p className="text-sm text-[var(--text-muted)] mt-1 line-clamp-2">{config.description}</p>}
                        <p className="text-xs text-[var(--text-tertiary)] mt-2">Updated {new Date(config.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button onClick={() => handleLoadConfig(config)} className="p-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] rounded-lg text-white transition-colors" title="Load"><Check className="h-4 w-4" /></button>
                        <button onClick={() => handleDeleteConfig(config.id)} className="p-2 bg-[var(--status-error)]/20 hover:bg-[var(--status-error)]/30 rounded-lg text-[var(--status-error)] transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </GlassContainer>
                ))
              )}
            </div>
            <button onClick={() => setShowLoadModal(false)} className="w-full mt-4 px-4 py-2 bg-white/5 text-white rounded-lg">Cancel</button>
          </Modal>
        )}

        {showAddMappingModal && (
          <Modal onClose={closeAddMappingModal} title={editingMappingId ? "Edit Mapping" : "Assign Server to Loot Table"}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Loot Table *</label>
                <Dropdown
                  options={savedConfigs.map(c => ({
                    value: c.id.toString(),
                    label: `${c.name} ${c.publishedVersion ? `(v${c.publishedVersion})` : "(unpublished)"}`,
                  }))}
                  value={selectedMappingConfig?.toString() ?? null}
                  onChange={(val) => setSelectedMappingConfig(val ? parseInt(val) : null)}
                  placeholder="Select a loot table..."
                  searchable={savedConfigs.length > 5}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Server *</label>
                <Dropdown
                  options={servers.map(s => ({
                    value: s.id,
                    label: `${s.name} (${s.ip}:${s.port})`,
                  }))}
                  value={selectedMappingServer}
                  onChange={setSelectedMappingServer}
                  placeholder="Select a server..."
                  disabled={!!editingMappingId}
                  searchable={servers.length > 5}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Time After Wipe (optional)</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="number"
                        value={selectedMappingHours}
                        onChange={(e) => setSelectedMappingHours(e.target.value)}
                        placeholder="0"
                        min={0}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white placeholder-[var(--text-muted)] focus:outline-none pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">h</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="number"
                        value={selectedMappingMinutes}
                        onChange={(e) => setSelectedMappingMinutes(e.target.value)}
                        placeholder="0"
                        min={0}
                        max={59}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white placeholder-[var(--text-muted)] focus:outline-none pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">m</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">Leave both empty for wipe day default. Example: 1h 30m = 90 minutes after wipe.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeAddMappingModal} className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg">Cancel</button>
              <button onClick={handleAddMapping} disabled={!selectedMappingConfig || !selectedMappingServer} className="flex-1 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg font-medium disabled:opacity-50">
                {editingMappingId ? <><Pencil className="h-4 w-4 inline mr-2" />Update</> : <><Plus className="h-4 w-4 inline mr-2" />Assign</>}
              </button>
            </div>
          </Modal>
        )}

        {showVersionHistoryModal && (
          <Modal onClose={() => setShowVersionHistoryModal(false)} title="Version History" wide>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {loadingVersions ? (
                <div className="text-center py-12"><div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-[var(--text-muted)]">Loading...</p></div>
              ) : versions.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]"><History className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No version history</p></div>
              ) : (
                versions.map((v) => (
                  <GlassContainer key={v.id} variant="prominent" radius="sm" className="flex items-center justify-between p-3" features={{ hoverGlow: false }}>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${v.version === currentConfigVersion ? "text-[var(--accent-primary)]" : "text-white"}`}>
                        v{v.version}
                        {v.version === currentConfigVersion && <span className="ml-2 text-xs opacity-60">(current)</span>}
                        {v.version === currentPublishedVersion && <span className="ml-2 text-xs text-[var(--status-success)]">(published)</span>}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">{new Date(v.createdAt).toLocaleString()}</span>
                    </div>
                    {v.version !== currentConfigVersion && (
                      <button
                        onClick={() => handleRestoreVersion(v.version)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--accent-primary)] bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30 rounded-lg hover:bg-[var(--accent-primary)]/30 transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />Restore
                      </button>
                    )}
                  </GlassContainer>
                ))
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-4">Up to 50 versions are retained per config. Older versions are automatically deleted.</p>
            <button onClick={() => setShowVersionHistoryModal(false)} className="w-full mt-4 px-4 py-2 bg-white/5 text-white rounded-lg">Close</button>
          </Modal>
        )}
    </div>
  );
}

function Modal({ children, onClose, title, wide = false }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div className="anim-fade-scale fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <GlassContainer variant="elevated" padding="lg" radius="lg" className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </GlassContainer>
    </div>
  );
}

function ItemCard({ item, index, containerName, onUpdate, onRemove }: { item: LootItem; index: number; containerName: string; onUpdate: (c: string, i: number, u: Partial<LootItem>) => void; onRemove: (c: string, i: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <GlassContainer variant="subtle" radius="md" className="anim-fade-scale" features={{ hoverGlow: false }}>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <img src={getItemImageUrl(getItemShortname(item))} alt={getItemShortname(item)} referrerPolicy="no-referrer" className="w-12 h-12 object-contain rounded-lg p-1 bg-black/30" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-white truncate">{getItemShortname(item)}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[var(--text-muted)]">{item["Min item amount"]}-{item["Max item amount"]}</span>
              <span className="text-xs text-[var(--accent-primary)]">{item["Chance to spawn"]}%</span>
              {item["Is Blueprint"] && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">BP</span>}
            </div>
          </div>
          <button onClick={() => onRemove(containerName, index)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors"><Trash2 className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-[var(--text-tertiary)]">Min</label><input type="number" value={item["Min item amount"]} onChange={(e) => onUpdate(containerName, index, { "Min item amount": parseInt(e.target.value) || 0 })} className="w-full rounded px-2 py-1 text-white text-sm bg-white/[0.02] border border-white/5 focus:outline-none" /></div>
          <div><label className="text-xs text-[var(--text-tertiary)]">Max</label><input type="number" value={item["Max item amount"]} onChange={(e) => onUpdate(containerName, index, { "Max item amount": parseInt(e.target.value) || 0 })} className="w-full rounded px-2 py-1 text-white text-sm bg-white/[0.02] border border-white/5 focus:outline-none" /></div>
        </div>
        <div className="mt-2"><label className="text-xs text-[var(--text-tertiary)]">Chance</label><input type="number" value={item["Chance to spawn"]} onChange={(e) => onUpdate(containerName, index, { "Chance to spawn": parseInt(e.target.value) || 0 })} className="w-full rounded px-2 py-1 text-white text-sm bg-white/[0.02] border border-white/5 focus:outline-none" /></div>
        <button onClick={() => setExpanded(!expanded)} className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-[var(--text-muted)] hover:text-white transition-colors">{expanded ? "Less" : "More"}<ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>
          {expanded && (
            <div className="overflow-hidden">
              <div className="pt-3 mt-3 space-y-2 border-t border-white/5">
                <CheckboxSwitch checked={item["Is Blueprint"]} onChange={(checked) => onUpdate(containerName, index, { "Is Blueprint": checked })} label="Is Blueprint" />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-[var(--text-tertiary)]">Min Cond %</label><input type="number" value={item["Min Condition % (0.0% - 100.0%)"]} onChange={(e) => onUpdate(containerName, index, { "Min Condition % (0.0% - 100.0%)": parseFloat(e.target.value) || 0 })} className="w-full rounded px-2 py-1 text-white text-sm bg-white/[0.02] border border-white/5 focus:outline-none" /></div>
                  <div><label className="text-xs text-[var(--text-tertiary)]">Max Cond %</label><input type="number" value={item["max Condition % (0.0% - 100.0%)"]} onChange={(e) => onUpdate(containerName, index, { "max Condition % (0.0% - 100.0%)": parseFloat(e.target.value) || 0 })} className="w-full rounded px-2 py-1 text-white text-sm bg-white/[0.02] border border-white/5 focus:outline-none" /></div>
                </div>
                <div><label className="text-xs text-[var(--text-tertiary)]">Times per container</label><input type="text" value={item["Times allowed to spawn per container"]} onChange={(e) => onUpdate(containerName, index, { "Times allowed to spawn per container": e.target.value })} className="w-full rounded px-2 py-1 text-white text-sm bg-white/[0.02] border border-white/5 focus:outline-none" /></div>
              </div>
            </div>
          )}
      </div>
    </GlassContainer>
  );
}

function ItemListRow({ item, index, containerName, onUpdate, onRemove }: { item: LootItem; index: number; containerName: string; onUpdate: (c: string, i: number, u: Partial<LootItem>) => void; onRemove: (c: string, i: number) => void }) {
  return (
    <GlassContainer variant="subtle" radius="sm" className="p-3 flex items-center gap-4" features={{ hoverGlow: false }}>
      <img src={getItemImageUrl(getItemShortname(item))} alt={getItemShortname(item)} referrerPolicy="no-referrer" className="w-10 h-10 object-contain rounded-lg p-1 bg-black/30" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      <div className="flex-1 min-w-0"><span className="text-sm font-medium text-white truncate block">{getItemShortname(item)}</span></div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <input type="number" value={item["Min item amount"]} onChange={(e) => onUpdate(containerName, index, { "Min item amount": parseInt(e.target.value) || 0 })} className="w-16 rounded px-2 py-1 text-white text-sm text-center bg-white/[0.02] border border-white/5 focus:outline-none" />
          <span className="text-[var(--text-tertiary)]">-</span>
          <input type="number" value={item["Max item amount"]} onChange={(e) => onUpdate(containerName, index, { "Max item amount": parseInt(e.target.value) || 0 })} className="w-16 rounded px-2 py-1 text-white text-sm text-center bg-white/[0.02] border border-white/5 focus:outline-none" />
        </div>
        <input type="number" value={item["Chance to spawn"]} onChange={(e) => onUpdate(containerName, index, { "Chance to spawn": parseInt(e.target.value) || 0 })} className="w-20 rounded px-2 py-1 text-white text-sm text-center bg-white/[0.02] border border-white/5 focus:outline-none" title="Chance" />
        <CheckboxSwitch checked={item["Is Blueprint"]} onChange={(checked) => onUpdate(containerName, index, { "Is Blueprint": checked })} label="BP" />
        <button onClick={() => onRemove(containerName, index)} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors"><Trash2 className="h-4 w-4" /></button>
      </div>
    </GlassContainer>
  );
}
