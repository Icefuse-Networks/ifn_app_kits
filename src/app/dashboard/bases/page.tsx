"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Upload, Download, Plus, Trash2, Settings, Undo2, Redo2, File, Loader2, X } from "lucide-react";
import { useSidebarCompact } from "@/contexts/SidebarContext";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import {
  LootItemBrowser,
  LootTableEditor,
  ServerMappingEditor,
  ConfigManager,
} from "@/components/loot-shared";
import type { GenericLootItem, ExtraFieldDef, SavedConfig, MappingRecord, ServerIdentifierRecord } from "@/components/loot-shared";
import { Dropdown } from "@/components/global/Dropdown";
import { CheckboxSwitch } from "@/components/ui/Switch";

// ─── IcefuseBases data types ──────────────────────────────────────────────────

interface BasesLootItem {
  Shortname: string;
  "Min amount": number;
  "Max amount": number;
  "Spawn chance": number;
  "Max spawns per container": number;
  "Min wipe hours to unlock": number;
}

interface BasesLootTable {
  "Min items": number;
  "Max Items": number;
  Items: BasesLootItem[];
}

interface ContainerMappingData {
  "Loot Tables": string[];
  "Min Items": number;
  "Max Items": number;
}

interface BaseData {
  Buildings: string[];
  "Spawn Count": number;
  "Initial Building Grade": number;
  "Upgraded Building Grade": number;
  "Auto Upgrade Delay": number;
}

interface BasesPluginConfig {
  "Bases Data": Record<string, BaseData>;
  "Container Mappings": Record<string, ContainerMappingData>;
  "Loot Multiplier": number;
  "Wipe Progression Enabled": boolean;
  "Wipe Progression Min Scale": number;
  "Wipe Progression Hours To Max": number;
}

interface BasesConfigData {
  pluginConfig: BasesPluginConfig;
  lootTables: Record<string, BasesLootTable>;
}

interface BasesFileRecord {
  id: number;
  name: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Default data ─────────────────────────────────────────────────────────────

const DEFAULT_LOOT_TABLES: Record<string, BasesLootTable> = {
  weapons: { "Min items": 3, "Max Items": 15, Items: [] },
  armor: { "Min items": 3, "Max Items": 15, Items: [] },
  components: { "Min items": 3, "Max Items": 15, Items: [] },
  mixed: { "Min items": 3, "Max Items": 15, Items: [] },
  toolcupboard: { "Min items": 3, "Max Items": 6, Items: [] },
  smallbox: { "Min items": 3, "Max Items": 8, Items: [] },
  locker: { "Min items": 6, "Max Items": 12, Items: [] },
  npcloadout: { "Min items": 6, "Max Items": 10, Items: [] },
};

const DEFAULT_CONFIG: BasesConfigData = {
  pluginConfig: {
    "Bases Data": {
      Small:  { Buildings: [], "Spawn Count": 20, "Initial Building Grade": 2, "Upgraded Building Grade": 3, "Auto Upgrade Delay": 0 },
      Medium: { Buildings: [], "Spawn Count": 15, "Initial Building Grade": 2, "Upgraded Building Grade": 3, "Auto Upgrade Delay": 0 },
      Large:  { Buildings: [], "Spawn Count": 10, "Initial Building Grade": 2, "Upgraded Building Grade": 4, "Auto Upgrade Delay": 0 },
    },
    "Container Mappings": {
      "box.wooden.large": { "Loot Tables": ["weapons", "armor", "components", "mixed"], "Min Items": 12, "Max Items": 24 },
      "woodbox_deployed": { "Loot Tables": ["smallbox"], "Min Items": 3, "Max Items": 8 },
      "locker.deployed": { "Loot Tables": ["locker"], "Min Items": 6, "Max Items": 12 },
      "coffinstorage": { "Loot Tables": ["weapons", "components"], "Min Items": 12, "Max Items": 24 },
      "storage_barrel_c": { "Loot Tables": ["weapons", "armor", "components", "mixed"], "Min Items": 6, "Max Items": 14 },
      "storage_barrel_b": { "Loot Tables": ["weapons", "armor", "components", "mixed"], "Min Items": 6, "Max Items": 14 },
      "wicker_barrel": { "Loot Tables": ["weapons", "armor", "components", "mixed"], "Min Items": 6, "Max Items": 14 },
      "bamboo_barrel": { "Loot Tables": ["armor", "locker"], "Min Items": 4, "Max Items": 8 },
      "cupboard.tool.deployed": { "Loot Tables": ["toolcupboard"], "Min Items": 3, "Max Items": 6 },
    },
    "Loot Multiplier": 1.0,
    "Wipe Progression Enabled": true,
    "Wipe Progression Min Scale": 0.3,
    "Wipe Progression Hours To Max": 72,
  },
  lootTables: { ...DEFAULT_LOOT_TABLES },
};

// ─── Normalization ────────────────────────────────────────────────────────────

const BASES_EXTRA_FIELDS: ExtraFieldDef[] = [
  { key: "maxSpawns", label: "Max Spawns", type: "number", default: 1, min: 1 },
  { key: "minWipeHours", label: "Min Wipe Hrs", type: "number", default: 0, min: 0 },
];

function toGenericItem(item: BasesLootItem): GenericLootItem {
  return {
    shortname: item.Shortname,
    minAmount: item["Min amount"],
    maxAmount: item["Max amount"],
    spawnChance: item["Spawn chance"],
    maxSpawns: item["Max spawns per container"],
    minWipeHours: item["Min wipe hours to unlock"],
  };
}

function fromGenericItem(item: GenericLootItem): BasesLootItem {
  return {
    Shortname: item.shortname,
    "Min amount": item.minAmount,
    "Max amount": item.maxAmount,
    "Spawn chance": item.spawnChance,
    "Max spawns per container": (item.maxSpawns as number) ?? 1,
    "Min wipe hours to unlock": (item.minWipeHours as number) ?? 0,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BasesPage() {
  useSidebarCompact(true);
  const [activeTab, setActiveTab] = useState<"config" | "mapping" | "files">("config");
  const { current: data, setState: setData, undo, redo, canUndo, canRedo, reset: resetHistory } = useUndoRedo<BasesConfigData>(DEFAULT_CONFIG);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<"table" | "settings">("table");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showItemBrowser, setShowItemBrowser] = useState(true);

  // Config management state
  const [currentConfigId, setCurrentConfigId] = useState<number | null>(null);
  const [currentConfigName, setCurrentConfigName] = useState("");
  const [currentConfigVersion, setCurrentConfigVersion] = useState(1);
  const [currentPublishedVersion, setCurrentPublishedVersion] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Mapping state
  const [mappings, setMappings] = useState<MappingRecord[]>([]);
  const [servers, setServers] = useState<ServerIdentifierRecord[]>([]);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File management state
  const [basesFiles, setBasesFiles] = useState<BasesFileRecord[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const pasteFileInputRef = useRef<HTMLInputElement>(null);

  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragCounterRef = useRef(0);

  // Container mapping state
  const [newMappingPrefab, setNewMappingPrefab] = useState("");

  // Loot table management state
  const [newTableName, setNewTableName] = useState("");

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
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
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUndo, canRedo, undo, redo, currentConfigId]);

  // ─── Data fetchers ────────────────────────────────────────────────────────
  useEffect(() => { fetchMappings(); fetchServers(); fetchSavedConfigs(); fetchBasesFiles(); }, []);

  const fetchMappings = async () => {
    try {
      const res = await fetch("/api/bases/mappings");
      if (res.ok) setMappings(await res.json());
    } catch (error) { console.error("Failed to fetch mappings:", error); }
  };

  const fetchServers = async () => {
    try {
      const res = await fetch("/api/identifiers", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setServers(data.filter((s: ServerIdentifierRecord) => s.ip && s.port));
      }
    } catch (error) { console.error("Failed to fetch servers:", error); }
  };

  const fetchSavedConfigs = async () => {
    try {
      const res = await fetch("/api/bases");
      if (res.ok) setSavedConfigs(await res.json());
    } catch (error) { console.error("Failed to fetch configs:", error); }
  };

  const fetchBasesFiles = async () => {
    try {
      const res = await fetch("/api/bases/files");
      if (res.ok) setBasesFiles(await res.json());
    } catch (error) { console.error("Failed to fetch bases files:", error); }
  };

  const categorizeBaseName = (name: string): string | null => {
    const lower = name.toLowerCase();
    if (lower.includes("sm") || lower.includes("small")) return "Small";
    if (lower.includes("med") || lower.includes("medium")) return "Medium";
    if (lower.includes("lg") || lower.includes("large")) return "Large";
    return null;
  };

  // Auto-populate buildings from uploaded files when no config is loaded
  useEffect(() => {
    if (currentConfigId || basesFiles.length === 0) return;
    const allBuildings = Object.values(data.pluginConfig["Bases Data"]).flatMap(bd => bd.Buildings);
    if (allBuildings.length > 0) return; // already has data

    const basesData: Record<string, BaseData> = {
      Small:  { Buildings: [], "Spawn Count": 20, "Initial Building Grade": 2, "Upgraded Building Grade": 3, "Auto Upgrade Delay": 0 },
      Medium: { Buildings: [], "Spawn Count": 15, "Initial Building Grade": 2, "Upgraded Building Grade": 3, "Auto Upgrade Delay": 0 },
      Large:  { Buildings: [], "Spawn Count": 10, "Initial Building Grade": 2, "Upgraded Building Grade": 4, "Auto Upgrade Delay": 0 },
    };
    for (const file of basesFiles) {
      const cat = categorizeBaseName(file.name);
      if (cat && basesData[cat]) {
        basesData[cat].Buildings.push(file.name);
      }
    }
    const hasAny = Object.values(basesData).some(bd => bd.Buildings.length > 0);
    if (hasAny) {
      setData(prev => ({ ...prev, pluginConfig: { ...prev.pluginConfig, "Bases Data": basesData } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basesFiles, currentConfigId]);

  const uploadPasteFiles = async (fileList: File[]) => {
    if (fileList.length === 0) return;
    setIsUploadingFile(true);

    const uploadedNames: string[] = [];
    for (const file of fileList) {
      const name = file.name.replace(/\.data$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const res = await fetch("/api/bases/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, fileData: base64 }),
        });
        if (res.ok) uploadedNames.push(name);
        else {
          const err = await res.json().catch(() => ({}));
          toast.error(`Failed to upload ${name}: ${err.error || res.status}`);
          console.error(`Upload failed for ${name}:`, err);
        }
      } catch (err) {
        toast.error(`Failed to upload ${name}`);
        console.error(`Upload error for ${name}:`, err);
      }
    }

    if (uploadedNames.length > 0) {
      toast.success(`Uploaded ${uploadedNames.length} file(s)`);
      fetchBasesFiles();

      // Auto-assign to base types by name pattern
      const allAssigned = new Set(
        Object.values(data.pluginConfig["Bases Data"]).flatMap(bd => bd.Buildings)
      );
      let autoAssigned = 0;
      setData(prev => {
        const basesData = { ...prev.pluginConfig["Bases Data"] };
        for (const name of uploadedNames) {
          if (allAssigned.has(name)) continue;
          const category = categorizeBaseName(name);
          if (category && basesData[category]) {
            basesData[category] = { ...basesData[category], Buildings: [...basesData[category].Buildings, name] };
            autoAssigned++;
          }
        }
        if (autoAssigned > 0) {
          toast.success(`Auto-assigned ${autoAssigned} file(s) by name`);
        }
        return { ...prev, pluginConfig: { ...prev.pluginConfig, "Bases Data": basesData } };
      });
    }
    setIsUploadingFile(false);
  };

  const handleUploadPasteFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadPasteFiles(Array.from(files));
    if (pasteFileInputRef.current) pasteFileInputRef.current.value = "";
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFiles(false);
    dragCounterRef.current = 0;
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".data"));
    if (files.length === 0) {
      toast.error("Only .data files are supported");
      return;
    }
    await uploadPasteFiles(files);
  };

  const handleDeletePasteFile = async (name: string) => {
    try {
      const res = await fetch("/api/bases/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toast.success(`Deleted ${name}`);
        fetchBasesFiles();
      } else toast.error("Failed to delete file");
    } catch { toast.error("Failed to delete file"); }
  };

  // ─── Loot table list from config ──────────────────────────────────────────
  const lootTableNames = useMemo(() => {
    const names = new Set<string>();
    // Include tables from container mappings
    const containerMappings = data.pluginConfig["Container Mappings"];
    if (containerMappings) {
      for (const mapping of Object.values(containerMappings)) {
        if (mapping["Loot Tables"]) mapping["Loot Tables"].forEach(t => { if (t) names.add(t); });
      }
    }
    // Also include any extra tables in lootTables
    for (const name of Object.keys(data.lootTables)) {
      names.add(name);
    }
    return Array.from(names).sort();
  }, [data.pluginConfig, data.lootTables]);

  const currentLootTable = selectedTable ? data.lootTables[selectedTable] : null;
  const currentItems = useMemo(() => {
    if (!currentLootTable) return [];
    return currentLootTable.Items.map(toGenericItem);
  }, [currentLootTable]);

  // ─── Loot table item operations ───────────────────────────────────────────
  const handleUpdateItem = useCallback((index: number, updates: Partial<GenericLootItem>) => {
    if (!selectedTable) return;
    setData(prev => {
      const table = prev.lootTables[selectedTable];
      if (!table) return prev;
      const newItems = [...table.Items];
      const generic = toGenericItem(newItems[index]);
      const merged = { ...generic, ...updates };
      newItems[index] = fromGenericItem(merged);
      return {
        ...prev,
        lootTables: { ...prev.lootTables, [selectedTable]: { ...table, Items: newItems } },
      };
    });
  }, [selectedTable, setData]);

  const handleRemoveItem = useCallback((index: number) => {
    if (!selectedTable) return;
    setData(prev => {
      const table = prev.lootTables[selectedTable];
      if (!table) return prev;
      return {
        ...prev,
        lootTables: { ...prev.lootTables, [selectedTable]: { ...table, Items: table.Items.filter((_, i) => i !== index) } },
      };
    });
  }, [selectedTable, setData]);

  const handleAddItem = useCallback((shortname: string) => {
    if (!selectedTable) return;
    setData(prev => {
      const table = prev.lootTables[selectedTable] || { "Min items": 3, "Max Items": 15, Items: [] };
      const newItem: BasesLootItem = {
        Shortname: shortname,
        "Min amount": 1,
        "Max amount": 1,
        "Spawn chance": 10,
        "Max spawns per container": 1,
        "Min wipe hours to unlock": 0,
      };
      return {
        ...prev,
        lootTables: { ...prev.lootTables, [selectedTable]: { ...table, Items: [...table.Items, newItem] } },
      };
    });
    toast.success(`Added ${shortname}`);
  }, [selectedTable, setData]);

  // ─── Config save/load ─────────────────────────────────────────────────────
  const handleSave = async (name: string, description: string | null) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, configData: JSON.stringify(data) }),
      });
      if (res.ok) {
        const newConfig = await res.json();
        setCurrentConfigId(newConfig.id);
        setCurrentConfigName(name);
        setCurrentConfigVersion(newConfig.currentVersion);
        setCurrentPublishedVersion(newConfig.publishedVersion);
        toast.success("Config saved");
        fetchSavedConfigs();
      } else { const err = await res.json(); toast.error(err.error || "Failed to save"); }
    } catch { toast.error("Failed to save"); }
    finally { setIsSaving(false); }
  };

  const handleQuickSave = async () => {
    if (!currentConfigId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/bases/${currentConfigId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configData: JSON.stringify(data) }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentConfigVersion(updated.currentVersion);
        toast.success("Saved");
        fetchSavedConfigs();
      } else toast.error("Failed to save");
    } catch { toast.error("Failed to save"); }
    finally { setIsSaving(false); }
  };

  const handleLoad = async (config: SavedConfig) => {
    try {
      const res = await fetch(`/api/bases/${config.id}`);
      if (res.ok) {
        const fullConfig = await res.json();
        const configData = typeof fullConfig.configData === "string" ? JSON.parse(fullConfig.configData) : fullConfig.configData;
        resetHistory(configData);
        setCurrentConfigId(config.id);
        setCurrentConfigName(config.name);
        setCurrentConfigVersion(fullConfig.currentVersion || 1);
        setCurrentPublishedVersion(fullConfig.publishedVersion);
        setSelectedTable(null);
        toast.success(`Loaded "${config.name}"`);
      } else toast.error("Failed to load config");
    } catch { toast.error("Failed to load config"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this saved config?")) return;
    try {
      const res = await fetch(`/api/bases/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (currentConfigId === id) { setCurrentConfigId(null); setCurrentConfigName(""); }
        toast.success("Config deleted");
        fetchSavedConfigs();
        fetchMappings();
      } else toast.error("Failed to delete");
    } catch { toast.error("Failed to delete"); }
  };

  const handlePublish = async (configId: number) => {
    try {
      const res = await fetch(`/api/bases/${configId}/publish`, { method: "POST" });
      if (res.ok) {
        toast.success("Published successfully");
        fetchSavedConfigs();
        if (currentConfigId === configId) {
          const updated = await res.json();
          setCurrentPublishedVersion(updated.publishedVersion);
        }
      } else toast.error("Failed to publish");
    } catch { toast.error("Failed to publish"); }
  };

  const handleRestoreVersion = async (version: number) => {
    if (!currentConfigId) return;
    try {
      const res = await fetch(`/api/bases/${currentConfigId}/versions/${version}`);
      if (res.ok) {
        const versionData = await res.json();
        const configData = typeof versionData.configData === "string" ? JSON.parse(versionData.configData) : versionData.configData;
        resetHistory(configData);
        setSelectedTable(null);
        toast.success(`Restored version ${version}`);
      } else toast.error("Failed to load version");
    } catch { toast.error("Failed to restore version"); }
  };

  // ─── Import/Export ────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Single file: could be a combined config
    if (files.length === 1) {
      const file = files[0];
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        // Combined config format
        if (json.pluginConfig && json.lootTables) {
          resetHistory(json);
          setSelectedTable(null);
          setCurrentConfigId(null);
          setCurrentConfigName("");
          toast.success("Loaded config from file");
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        // Single loot table file
        if (json.Items && Array.isArray(json.Items)) {
          const tableName = file.name.replace(/\.json$/i, "");
          setData(prev => ({
            ...prev,
            lootTables: { ...prev.lootTables, [tableName]: json },
          }));
          setSelectedTable(tableName);
          toast.success(`Imported loot table: ${tableName}`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        toast.error("Invalid format - expected combined config or loot table");
      } catch { toast.error("Failed to parse JSON"); }
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Multiple files: treat each as an individual loot table
    const newTables: Record<string, BasesLootTable> = {};
    let imported = 0;
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        if (json.Items && Array.isArray(json.Items)) {
          const tableName = file.name.replace(/\.json$/i, "");
          newTables[tableName] = json;
          imported++;
        }
      } catch { /* skip invalid files */ }
    }

    if (imported > 0) {
      setData(prev => ({
        ...prev,
        lootTables: { ...prev.lootTables, ...newTables },
      }));
      toast.success(`Imported ${imported} loot table(s)`);
    } else {
      toast.error("No valid loot table files found");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "IcefuseBases.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported IcefuseBases.json");
  };

  // ─── Plugin settings operations ───────────────────────────────────────────
  const handleUpdatePluginSetting = useCallback((key: string, value: number | boolean) => {
    setData(prev => ({
      ...prev,
      pluginConfig: { ...prev.pluginConfig, [key]: value },
    }));
  }, [setData]);

  const handleUpdateBuilding = useCallback((baseType: string, index: number, value: string) => {
    setData(prev => {
      const basesData = { ...prev.pluginConfig["Bases Data"] };
      const buildings = [...(basesData[baseType]?.Buildings || [])];
      buildings[index] = value;
      basesData[baseType] = { ...basesData[baseType], Buildings: buildings };
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Bases Data": basesData } };
    });
  }, [setData]);

  const handleAddBuilding = useCallback((baseType: string, fileName?: string) => {
    setData(prev => {
      const basesData = { ...prev.pluginConfig["Bases Data"] };
      const buildings = [...(basesData[baseType]?.Buildings || []), fileName || ""];
      basesData[baseType] = { ...basesData[baseType], Buildings: buildings };
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Bases Data": basesData } };
    });
  }, [setData]);

  const handleRemoveBuilding = useCallback((baseType: string, index: number) => {
    setData(prev => {
      const basesData = { ...prev.pluginConfig["Bases Data"] };
      const buildings = (basesData[baseType]?.Buildings || []).filter((_, i) => i !== index);
      basesData[baseType] = { ...basesData[baseType], Buildings: buildings };
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Bases Data": basesData } };
    });
  }, [setData]);

  const handleChangeFileCategory = useCallback((fileName: string, oldCategory: string, newCategory: string) => {
    setData(prev => {
      const basesData = { ...prev.pluginConfig["Bases Data"] };
      // Remove from old category
      if (oldCategory && basesData[oldCategory]) {
        basesData[oldCategory] = {
          ...basesData[oldCategory],
          Buildings: basesData[oldCategory].Buildings.filter(b => b !== fileName),
        };
      }
      // Add to new category
      if (newCategory && basesData[newCategory]) {
        basesData[newCategory] = {
          ...basesData[newCategory],
          Buildings: [...basesData[newCategory].Buildings, fileName],
        };
      }
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Bases Data": basesData } };
    });
  }, [setData]);

  const handleUpdateSpawnCount = useCallback((baseType: string, count: number) => {
    setData(prev => {
      const basesData = { ...prev.pluginConfig["Bases Data"] };
      basesData[baseType] = { ...basesData[baseType], "Spawn Count": count };
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Bases Data": basesData } };
    });
  }, [setData]);

  const handleUpdateBaseDataField = useCallback((baseType: string, field: "Initial Building Grade" | "Upgraded Building Grade" | "Auto Upgrade Delay", value: number) => {
    setData(prev => {
      const basesData = { ...prev.pluginConfig["Bases Data"] };
      basesData[baseType] = { ...basesData[baseType], [field]: value };
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Bases Data": basesData } };
    });
  }, [setData]);

  const handleUpdateContainerMapping = useCallback((prefab: string, field: "Min Items" | "Max Items", value: number) => {
    setData(prev => {
      const mappings = { ...prev.pluginConfig["Container Mappings"] };
      mappings[prefab] = { ...mappings[prefab], [field]: value };
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Container Mappings": mappings } };
    });
  }, [setData]);

  const handleAddTableToMapping = useCallback((prefab: string, table: string) => {
    if (!table) return;
    setData(prev => {
      const mappings = { ...prev.pluginConfig["Container Mappings"] };
      const current = mappings[prefab]?.["Loot Tables"] || [];
      if (current.includes(table)) return prev;
      mappings[prefab] = { ...mappings[prefab], "Loot Tables": [...current, table] };
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Container Mappings": mappings } };
    });
  }, [setData]);

  const handleRemoveTableFromMapping = useCallback((prefab: string, table: string) => {
    setData(prev => {
      const mappings = { ...prev.pluginConfig["Container Mappings"] };
      const current = mappings[prefab]?.["Loot Tables"] || [];
      mappings[prefab] = { ...mappings[prefab], "Loot Tables": current.filter(t => t !== table) };
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Container Mappings": mappings } };
    });
  }, [setData]);

  const handleAddContainerMapping = useCallback((prefab: string) => {
    if (!prefab.trim()) return;
    setData(prev => {
      const mappings = { ...prev.pluginConfig["Container Mappings"] };
      if (prefab in mappings) return prev;
      mappings[prefab] = { "Loot Tables": [], "Min Items": 3, "Max Items": 15 };
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Container Mappings": mappings } };
    });
  }, [setData]);

  const handleRemoveContainerMapping = useCallback((prefab: string) => {
    setData(prev => {
      const mappings = { ...prev.pluginConfig["Container Mappings"] };
      delete mappings[prefab];
      return { ...prev, pluginConfig: { ...prev.pluginConfig, "Container Mappings": mappings } };
    });
  }, [setData]);

  const handleAddLootTable = useCallback((name: string) => {
    const key = name.trim().toLowerCase();
    if (!key) return;
    setData(prev => {
      if (prev.lootTables[key]) return prev;
      return { ...prev, lootTables: { ...prev.lootTables, [key]: { "Min items": 3, "Max Items": 15, Items: [] } } };
    });
  }, [setData]);

  const handleRemoveLootTable = useCallback((name: string) => {
    setData(prev => {
      const lootTables = { ...prev.lootTables };
      delete lootTables[name];
      return { ...prev, lootTables };
    });
    setSelectedTable(prev => prev === name ? null : prev);
  }, [setData]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-5rem)] bg-[var(--glass-bg)]">
      {/* Left sidebar */}
      <div className="w-56 border-r border-white/5 flex flex-col bg-white/[0.01]">
        {/* Tabs */}
        <div className="flex border-b border-white/5">
          <button onClick={() => setActiveTab("config")} className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${activeTab === "config" ? "text-[var(--status-success)] border-b-2 border-[var(--status-success)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
            Config
          </button>
          <button onClick={() => setActiveTab("mapping")} className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${activeTab === "mapping" ? "text-[var(--status-success)] border-b-2 border-[var(--status-success)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
            Mapping
          </button>
          <button onClick={() => setActiveTab("files")} className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${activeTab === "files" ? "text-[var(--status-success)] border-b-2 border-[var(--status-success)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
            Files
          </button>
        </div>

        {activeTab === "config" && (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-2 py-2 border-b border-white/5">
              <button onClick={undo} disabled={!canUndo} className="p-1.5 text-[var(--text-muted)] hover:text-white disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={redo} disabled={!canRedo} className="p-1.5 text-[var(--text-muted)] hover:text-white disabled:opacity-30 transition-colors" title="Redo (Ctrl+Shift+Z)">
                <Redo2 className="h-3.5 w-3.5" />
              </button>
              <div className="flex-1" />
              <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-[var(--text-muted)] hover:text-white transition-colors" title="Import JSON">
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button onClick={handleExport} className="p-1.5 text-[var(--text-muted)] hover:text-white transition-colors" title="Export JSON">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Plugin settings item */}
            <button
              onClick={() => { setSelectedSection("settings"); setSelectedTable(null); }}
              className={`w-full text-left px-3 py-2 border-b border-white/5 text-sm transition-colors flex items-center gap-2 ${
                selectedSection === "settings" && !selectedTable ? "bg-[var(--status-success)]/10 text-[var(--status-success)]" : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              <Settings className="h-3.5 w-3.5" /> Plugin Settings
            </button>

            {/* Loot table list */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 py-2 text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider">Loot Tables</div>
              {lootTableNames.map((name) => {
                const table = data.lootTables[name];
                const itemCount = table?.Items?.length || 0;
                return (
                  <div
                    key={name}
                    className={`flex items-center border-b border-white/5 transition-colors ${
                      selectedTable === name ? "bg-[var(--status-success)]/10 text-[var(--status-success)] border-l-2 border-l-[var(--status-success)]" : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.03]"
                    }`}
                  >
                    <button
                      onClick={() => { setSelectedTable(name); setSelectedSection("table"); }}
                      className="flex-1 text-left px-3 py-2 min-w-0"
                    >
                      <div className="text-sm font-medium capitalize truncate">{name === "npcloadout" ? "NPC Loadout" : name}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{itemCount} items{name === "npcloadout" ? " · sleeping NPC gear" : ""}</div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveLootTable(name); }}
                      className="p-1.5 mr-1 text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors shrink-0"
                      title={`Remove ${name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              {lootTableNames.length === 0 && (
                <div className="px-3 py-4 text-xs text-[var(--text-tertiary)] text-center">No loot tables configured</div>
              )}
              <div className="flex items-center gap-1 px-2 py-2 border-b border-white/5">
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="New table name..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTableName.trim()) {
                      handleAddLootTable(newTableName.trim());
                      setNewTableName("");
                    }
                  }}
                  className="flex-1 min-w-0 rounded bg-white/5 border border-white/5 px-2 py-1.5 text-xs text-white placeholder:text-[var(--text-tertiary)] focus:outline-none"
                />
                <button
                  onClick={() => { if (newTableName.trim()) { handleAddLootTable(newTableName.trim()); setNewTableName(""); } }}
                  className="p-1.5 text-[var(--status-success)] hover:text-[var(--status-success)] transition-colors shrink-0"
                  title="Add loot table"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Config manager */}
            <ConfigManager
              apiBasePath="/api/bases"
              currentConfigId={currentConfigId}
              currentConfigName={currentConfigName}
              currentVersion={currentConfigVersion}
              publishedVersion={currentPublishedVersion}
              isSaving={isSaving}
              hasData={Object.keys(data.lootTables).length > 0}
              onSave={handleSave}
              onQuickSave={handleQuickSave}
              onLoad={handleLoad}
              onDelete={handleDelete}
              onPublish={handlePublish}
              onRestoreVersion={handleRestoreVersion}
              onSetCurrentConfig={(id, name, version, pubVersion) => {
                setCurrentConfigId(id);
                setCurrentConfigName(name);
                setCurrentConfigVersion(version);
                setCurrentPublishedVersion(pubVersion);
              }}
              accentColor="emerald"
            />
          </>
        )}

        {activeTab === "mapping" && (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-tertiary)] p-3 text-center">
            Use the main area to manage server mappings
          </div>
        )}

        {activeTab === "files" && (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-tertiary)] p-3 text-center">
            Manage CopyPaste .data files for base buildings
          </div>
        )}
      </div>

      {/* Main content */}
      {activeTab === "config" ? (
        <>
          {selectedSection === "settings" && !selectedTable ? (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Plugin Settings</h2>

              {/* Global settings */}
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 mb-6">
                <h3 className="text-sm font-semibold text-white mb-4">Global Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="text-sm text-[var(--text-muted)]">
                    Loot Multiplier
                    <input type="number" value={data.pluginConfig["Loot Multiplier"]} onChange={(e) => handleUpdatePluginSetting("Loot Multiplier", parseFloat(e.target.value) || 1)} min={0.1} step={0.1} className="w-full mt-1 rounded-lg bg-white/5 border border-white/5 px-3 py-2 text-sm text-white focus:outline-none" />
                  </label>
                  <CheckboxSwitch
                    checked={data.pluginConfig["Wipe Progression Enabled"]}
                    onChange={(checked) => handleUpdatePluginSetting("Wipe Progression Enabled", checked)}
                    label="Wipe Progression"
                  />
                  {data.pluginConfig["Wipe Progression Enabled"] && (
                    <>
                      <label className="text-sm text-[var(--text-muted)]">
                        Min Scale (0-1)
                        <input type="number" value={data.pluginConfig["Wipe Progression Min Scale"]} onChange={(e) => handleUpdatePluginSetting("Wipe Progression Min Scale", parseFloat(e.target.value) || 0.3)} min={0} max={1} step={0.05} className="w-full mt-1 rounded-lg bg-white/5 border border-white/5 px-3 py-2 text-sm text-white focus:outline-none" />
                      </label>
                      <label className="text-sm text-[var(--text-muted)]">
                        Hours To Max
                        <input type="number" value={data.pluginConfig["Wipe Progression Hours To Max"]} onChange={(e) => handleUpdatePluginSetting("Wipe Progression Hours To Max", parseInt(e.target.value) || 72)} min={1} className="w-full mt-1 rounded-lg bg-white/5 border border-white/5 px-3 py-2 text-sm text-white focus:outline-none" />
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Container Mappings */}
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 mb-6">
                <h3 className="text-sm font-semibold text-white mb-1">Container Mappings</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">Map container prefabs to loot tables. Multiple tables = random pick per spawn. Unmapped containers are skipped.</p>
                <div className="space-y-2">
                  {Object.entries(data.pluginConfig["Container Mappings"] || {}).map(([prefab, mapping]) => (
                    <div key={prefab} className="p-2 rounded-lg bg-white/[0.02] space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium min-w-0 truncate flex-1" title={prefab}>{prefab}</span>
                        <input
                          type="number"
                          value={mapping["Min Items"]}
                          onChange={(e) => handleUpdateContainerMapping(prefab, "Min Items", parseInt(e.target.value) || 0)}
                          min={0}
                          title="Min Items"
                          className="w-14 rounded bg-white/5 border border-white/5 px-2 py-1 text-xs text-white text-center focus:outline-none"
                        />
                        <span className="text-[var(--text-tertiary)] text-xs">-</span>
                        <input
                          type="number"
                          value={mapping["Max Items"]}
                          onChange={(e) => handleUpdateContainerMapping(prefab, "Max Items", parseInt(e.target.value) || 0)}
                          min={0}
                          title="Max Items"
                          className="w-14 rounded bg-white/5 border border-white/5 px-2 py-1 text-xs text-white text-center focus:outline-none"
                        />
                        <button onClick={() => handleRemoveContainerMapping(prefab)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(mapping["Loot Tables"] || []).map((table) => (
                          <span key={table} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)] text-xs">
                            {table}
                            <button onClick={() => handleRemoveTableFromMapping(prefab, table)} className="hover:text-[var(--status-error)] transition-colors">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) handleAddTableToMapping(prefab, e.target.value); }}
                          className="rounded bg-white/5 border border-white/5 px-1.5 py-0.5 text-xs text-[var(--text-muted)] focus:outline-none cursor-pointer"
                        >
                          <option value="">+ table</option>
                          {lootTableNames.filter(n => !(mapping["Loot Tables"] || []).includes(n)).map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    value={newMappingPrefab}
                    onChange={(e) => setNewMappingPrefab(e.target.value)}
                    placeholder="prefab.name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newMappingPrefab.trim()) {
                        handleAddContainerMapping(newMappingPrefab.trim());
                        setNewMappingPrefab("");
                      }
                    }}
                    className="flex-1 rounded bg-white/5 border border-white/5 px-2 py-1.5 text-xs text-white placeholder:text-[var(--text-tertiary)] focus:outline-none"
                  />
                  <button
                    onClick={() => { if (newMappingPrefab.trim()) { handleAddContainerMapping(newMappingPrefab.trim()); setNewMappingPrefab(""); } }}
                    className="flex items-center gap-1 px-2 py-1.5 rounded bg-[var(--status-success)]/10 text-[var(--status-success)] text-xs hover:bg-[var(--status-success)]/20 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
              </div>

              {/* Bases Data */}
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                <h3 className="text-sm font-semibold text-white mb-4">Bases Data</h3>
                {basesFiles.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] mb-3">No files uploaded yet. Go to the Files tab to upload .data files first.</p>
                )}
                {Object.entries(data.pluginConfig["Bases Data"]).map(([baseType, baseData]) => {
                  const assignedFiles = new Set(
                    Object.values(data.pluginConfig["Bases Data"]).flatMap(bd => bd.Buildings)
                  );
                  const availableFiles = basesFiles.filter(f => !assignedFiles.has(f.name) || baseData.Buildings.includes(f.name));
                  const unassignedFiles = basesFiles.filter(f => !assignedFiles.has(f.name));

                  return (
                    <div key={baseType} className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-[var(--status-success)] flex items-center gap-2">
                          {baseType} <span className="text-[var(--text-tertiary)] font-normal">({baseData.Buildings.length})</span>
                          <label className="text-xs text-[var(--text-muted)] flex items-center gap-1 ml-2">
                            Spawn
                            <input type="number" value={baseData["Spawn Count"] ?? 10} onChange={(e) => handleUpdateSpawnCount(baseType, parseInt(e.target.value) || 0)} min={0} className="w-14 rounded bg-white/5 border border-white/5 px-2 py-0.5 text-xs text-white text-center focus:outline-none" />
                          </label>
                          <label className="text-xs text-[var(--text-muted)] flex items-center gap-1 ml-2">
                            Start
                            <select value={baseData["Initial Building Grade"] ?? 2} onChange={(e) => handleUpdateBaseDataField(baseType, "Initial Building Grade", parseInt(e.target.value))} className="rounded bg-white/5 border border-white/5 px-1 py-0.5 text-xs text-white focus:outline-none">
                              <option value={0} className="bg-[var(--bg-elevated)]">Twig</option>
                              <option value={1} className="bg-[var(--bg-elevated)]">Wood</option>
                              <option value={2} className="bg-[var(--bg-elevated)]">Stone</option>
                              <option value={3} className="bg-[var(--bg-elevated)]">Metal</option>
                              <option value={4} className="bg-[var(--bg-elevated)]">HQM</option>
                            </select>
                          </label>
                          <label className="text-xs text-[var(--text-muted)] flex items-center gap-1 ml-2">
                            Upgrade to
                            <select value={baseData["Upgraded Building Grade"] ?? 3} onChange={(e) => handleUpdateBaseDataField(baseType, "Upgraded Building Grade", parseInt(e.target.value))} className="rounded bg-white/5 border border-white/5 px-1 py-0.5 text-xs text-white focus:outline-none">
                              <option value={0} className="bg-[var(--bg-elevated)]">Twig</option>
                              <option value={1} className="bg-[var(--bg-elevated)]">Wood</option>
                              <option value={2} className="bg-[var(--bg-elevated)]">Stone</option>
                              <option value={3} className="bg-[var(--bg-elevated)]">Metal</option>
                              <option value={4} className="bg-[var(--bg-elevated)]">HQM</option>
                            </select>
                          </label>
                          <label className="text-xs text-[var(--text-muted)] flex items-center gap-1 ml-2">
                            after
                            <input type="number" value={baseData["Auto Upgrade Delay"] ?? 0} onChange={(e) => handleUpdateBaseDataField(baseType, "Auto Upgrade Delay", parseFloat(e.target.value) || 0)} min={0} step={60} className="w-16 rounded bg-white/5 border border-white/5 px-2 py-0.5 text-xs text-white text-center focus:outline-none" />
                            s
                          </label>
                        </h4>
                        {unassignedFiles.length > 0 && (
                          <Dropdown
                            value={null}
                            onChange={(value) => { if (value) handleAddBuilding(baseType, value); }}
                            options={unassignedFiles.map(f => ({ value: f.name, label: f.name }))}
                            placeholder="+ Add file..."
                            emptyOption="+ Add file..."
                          />
                        )}
                      </div>
                      {baseData.Buildings.length === 0 ? (
                        <p className="text-xs text-[var(--text-tertiary)] pl-2">No buildings assigned</p>
                      ) : (
                        <div className="space-y-1">
                          {baseData.Buildings.map((building, i) => {
                            const hasFile = basesFiles.some(f => f.name === building);
                            return (
                              <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-white/[0.02]">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasFile ? "bg-[var(--status-success)]" : "bg-[var(--status-error)]"}`} />
                                <File className={`h-3.5 w-3.5 flex-shrink-0 ${hasFile ? "text-[var(--status-success)]" : "text-[var(--status-error)]"}`} />
                                <span className={`text-xs flex-1 ${hasFile ? "text-white" : "text-[var(--status-error)]"}`}>
                                  {building}
                                  {!hasFile && <span className="text-[var(--status-error)]/60 ml-1">(missing)</span>}
                                </span>
                                <button onClick={() => handleRemoveBuilding(baseType, i)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : selectedTable && currentLootTable ? (
            <LootTableEditor
              tableName={selectedTable}
              items={currentItems}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onUpdateItem={handleUpdateItem}
              onRemoveItem={handleRemoveItem}
              onAddItem={handleAddItem}
              extraFields={BASES_EXTRA_FIELDS}
              accentColor="emerald"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)]">
              <div className="text-center">
                <Settings className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Select a loot table or plugin settings</p>
              </div>
            </div>
          )}

          {/* Item browser (right panel) */}
          {activeTab === "config" && selectedTable && (
            <LootItemBrowser
              isOpen={showItemBrowser}
              onToggle={() => setShowItemBrowser(!showItemBrowser)}
              onAddItem={handleAddItem}
              accentColor="emerald"
            />
          )}
        </>
      ) : activeTab === "mapping" ? (
        <ServerMappingEditor
          mappings={mappings}
          servers={servers}
          savedConfigs={savedConfigs}
          apiBasePath="/api/bases"
          onRefreshMappings={fetchMappings}
          onRefreshConfigs={fetchSavedConfigs}
          accentColor="emerald"
        />
      ) : (
        <div
          className="flex-1 overflow-y-auto p-6 relative"
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current++; setIsDraggingFiles(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current--; if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDraggingFiles(false); } }}
          onDrop={handleFileDrop}
        >
          {isDraggingFiles && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 border-2 border-dashed border-[var(--status-success)] rounded-xl pointer-events-none">
              <div className="text-center">
                <Upload className="h-10 w-10 text-[var(--status-success)] mx-auto mb-2" />
                <p className="text-lg font-medium text-[var(--status-success)]">Drop .data files here</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Base Paste Files</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">CopyPaste .data files downloaded by the plugin. Drag & drop or click upload.</p>
            </div>
            <button
              onClick={() => pasteFileInputRef.current?.click()}
              disabled={isUploadingFile}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--status-success)]/20 text-[var(--status-success)] rounded-lg hover:bg-[var(--status-success)]/30 transition-colors disabled:opacity-50"
            >
              {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload .data Files
            </button>
          </div>

          {basesFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)] border-2 border-dashed border-white/5 rounded-xl">
              <File className="h-10 w-10 mb-3" />
              <p className="text-sm">No base files uploaded yet</p>
              <p className="text-xs mt-1">Drag & drop .data files here or click Upload</p>
            </div>
          ) : (
            <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-4 py-3">Name</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-4 py-3">Category</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-4 py-3">Size</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-4 py-3">Updated</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {basesFiles.map(file => {
                    const assignedCategory = Object.entries(data.pluginConfig["Bases Data"]).find(
                      ([, bd]) => bd.Buildings.includes(file.name)
                    )?.[0] || "";
                    return (
                    <tr key={file.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <File className="h-4 w-4 text-[var(--status-success)]" />
                          <span className="text-sm text-white font-medium">{file.name}</span>
                          <span className="text-xs text-[var(--text-tertiary)]">.data</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={assignedCategory}
                          onChange={(e) => handleChangeFileCategory(file.name, assignedCategory, e.target.value)}
                          className="rounded bg-white/5 border border-white/5 px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          <option value="" className="bg-[var(--bg-elevated)]">Unassigned</option>
                          {Object.keys(data.pluginConfig["Bases Data"]).map(cat => (
                            <option key={cat} value={cat} className="bg-[var(--bg-elevated)]">{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                        {file.fileSize > 1024 * 1024
                          ? `${(file.fileSize / 1024 / 1024).toFixed(1)} MB`
                          : file.fileSize > 1024
                          ? `${(file.fileSize / 1024).toFixed(1)} KB`
                          : `${file.fileSize} B`}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                        {new Date(file.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeletePasteFile(file.name)}
                          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors"
                          title="Delete file"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Show which buildings reference which files */}
          {basesFiles.length > 0 && (
            <div className="mt-6 rounded-xl bg-white/[0.03] border border-white/5 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Config References</h3>
              <div className="space-y-1">
                {Object.entries(data.pluginConfig["Bases Data"]).flatMap(([baseType, baseData]) =>
                  baseData.Buildings.map(building => {
                    const hasFile = basesFiles.some(f => f.name === building);
                    return (
                      <div key={`${baseType}-${building}`} className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full ${hasFile ? "bg-[var(--status-success)]" : "bg-[var(--status-error)]"}`} />
                        <span className="text-[var(--text-muted)]">{baseType}:</span>
                        <span className={hasFile ? "text-white" : "text-[var(--status-error)]"}>{building}</span>
                        {!hasFile && <span className="text-[var(--status-error)]/60">(missing file)</span>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" multiple className="hidden" />
      <input type="file" ref={pasteFileInputRef} onChange={handleUploadPasteFile} accept=".data" multiple className="hidden" />
    </div>
  );
}
