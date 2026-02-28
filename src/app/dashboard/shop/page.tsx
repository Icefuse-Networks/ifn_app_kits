"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Upload, Download, Search, X, Save, Undo2, Redo2,
  FolderOpen, FileText, Check, CloudUpload, Server, Link2, Clock, Pencil,
  History, RotateCcw, ChevronRight, ShoppingCart, DollarSign, Tag, Image,
  Package, Percent, GripVertical, Copy, ChevronDown,
} from "lucide-react";
import { useSidebarCompact } from "@/contexts/SidebarContext";
import { GlassContainer } from "@/components/global/GlassContainer";
import { Dropdown, DropdownOption } from "@/components/global/Dropdown";
import { Switch } from "@/components/ui/Switch";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, NumberInput } from "@/components/ui/Input";
import ServerMappingEditor from "@/components/loot-shared/ServerMappingEditor";
import type { MappingRecord, ServerIdentifierRecord, SavedConfig } from "@/components/loot-shared/types";

// =============================================================================
// Types
// =============================================================================

interface ShopItem {
  DisplayName: string;
  Skin: number;
  Image: string;
  DefaultAmount: number;
  BlockAmountChange: boolean;
  BuyPrice: number;
  SellPrice: number;
  Currency: string;
}

interface ShopCategory {
  Image: string;
  Permission: string | null;
  Sale: number;
  Items: string[];
}

type CategoriesData = Record<string, ShopCategory>;
type ItemsData = Record<string, ShopItem>;

interface ShopData {
  categories: CategoriesData;
  items: ItemsData;
}

interface ConfigVersion {
  id: number;
  version: number;
  createdAt: string;
}

// =============================================================================
// Defaults
// =============================================================================

const defaultItem: ShopItem = {
  DisplayName: "default",
  Skin: 0,
  Image: "",
  DefaultAmount: 1,
  BlockAmountChange: false,
  BuyPrice: 100,
  SellPrice: 0,
  Currency: "eco",
};

const defaultCategory: ShopCategory = {
  Image: "",
  Permission: null,
  Sale: 0,
  Items: [],
};

const CURRENCY_OPTIONS: DropdownOption[] = [
  { value: "eco", label: "Economy ($)" },
  { value: "gem", label: "Gems" },
];

// =============================================================================
// Undo/Redo Hook
// =============================================================================

const MAX_HISTORY = 50;

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

// =============================================================================
// Main Component
// =============================================================================

export default function ShopPage() {
  useSidebarCompact(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<"editor" | "mapping">("editor");

  // Data state with undo/redo
  const { current: data, setState: setData, undo, redo, canUndo, canRedo, reset: resetHistory } = useUndoRedo<ShopData>({ categories: {}, items: {} });

  // Category/item selection
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItemShortname, setSelectedItemShortname] = useState<string | null>(null);

  // Search
  const [categorySearch, setCategorySearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");

  // Modals
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [showDeleteCategoryConfirm, setShowDeleteCategoryConfirm] = useState(false);
  const [showDeleteItemConfirm, setShowDeleteItemConfirm] = useState(false);

  // Add modals
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemShortname, setNewItemShortname] = useState("");

  // Config management
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [loadingSavedConfigs, setLoadingSavedConfigs] = useState(false);
  const [currentConfigId, setCurrentConfigId] = useState<number | null>(null);
  const [currentConfigName, setCurrentConfigName] = useState<string>("");
  const [currentConfigVersion, setCurrentConfigVersion] = useState<number>(1);
  const [currentPublishedVersion, setCurrentPublishedVersion] = useState<number | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Version history
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Mapping state
  const [mappings, setMappings] = useState<MappingRecord[]>([]);
  const [servers, setServers] = useState<ServerIdentifierRecord[]>([]);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsFileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================================================
  // Keyboard shortcuts
  // ==========================================================================

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

  // ==========================================================================
  // Data fetching
  // ==========================================================================

  useEffect(() => { fetchSavedConfigs(); fetchMappings(); fetchServers(); }, []);

  const fetchSavedConfigs = async () => {
    setLoadingSavedConfigs(true);
    try {
      const res = await fetch("/api/shop");
      if (res.ok) setSavedConfigs(await res.json());
    } catch (error) { console.error("Failed to fetch saved configs:", error); }
    finally { setLoadingSavedConfigs(false); }
  };

  const fetchMappings = async () => {
    try {
      const res = await fetch("/api/shop/mappings");
      if (res.ok) setMappings(await res.json());
    } catch (error) { console.error("Failed to fetch mappings:", error); }
  };

  const fetchServers = async () => {
    try {
      const res = await fetch("/api/identifiers", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d)) setServers(d.filter((s: ServerIdentifierRecord) => s.ip && s.port));
      }
    } catch (error) { console.error("Failed to fetch servers:", error); }
  };

  const fetchVersions = async (configId: number) => {
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/shop/${configId}/versions`);
      if (res.ok) setVersions(await res.json());
    } catch (error) { console.error("Failed to fetch versions:", error); }
    finally { setLoadingVersions(false); }
  };

  // ==========================================================================
  // Derived data
  // ==========================================================================

  const categoryNames = useMemo(() => Object.keys(data.categories), [data.categories]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch) return categoryNames;
    const term = categorySearch.toLowerCase();
    return categoryNames.filter(n => n.toLowerCase().includes(term));
  }, [categoryNames, categorySearch]);

  const selectedCategoryData = selectedCategory ? data.categories[selectedCategory] : null;

  const selectedCategoryItems = useMemo(() => {
    if (!selectedCategoryData) return [];
    if (!itemSearch) return selectedCategoryData.Items;
    const term = itemSearch.toLowerCase();
    return selectedCategoryData.Items.filter(s => s.toLowerCase().includes(term));
  }, [selectedCategoryData, itemSearch]);

  const selectedItemData = selectedItemShortname ? data.items[selectedItemShortname] : null;

  // ==========================================================================
  // File operations
  // ==========================================================================

  const handleImportCategories = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as CategoriesData;
        setData(prev => ({ ...prev, categories: parsed }));
        setSelectedCategory(null);
        setSelectedItemShortname(null);
        toast.success(`Imported ${Object.keys(parsed).length} categories`);
      } catch { toast.error("Invalid JSON file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportItems = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as ItemsData;
        setData(prev => ({ ...prev, items: parsed }));
        setSelectedItemShortname(null);
        toast.success(`Imported ${Object.keys(parsed).length} items`);
      } catch { toast.error("Invalid JSON file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExportCategories = () => {
    const blob = new Blob([JSON.stringify(data.categories, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Categories.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportItems = () => {
    const blob = new Blob([JSON.stringify(data.items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Items.json"; a.click();
    URL.revokeObjectURL(url);
  };

  // ==========================================================================
  // Save/Load operations
  // ==========================================================================

  const handleSave = async () => {
    if (!saveName.trim()) { toast.error("Name is required"); return; }
    setIsSaving(true);
    try {
      const body = {
        name: saveName.trim(),
        description: saveDescription.trim() || null,
        categoriesData: JSON.stringify(data.categories),
        itemsData: JSON.stringify(data.items),
      };
      const res = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        const config = await res.json();
        setCurrentConfigId(config.id);
        setCurrentConfigName(config.name);
        setCurrentConfigVersion(config.currentVersion);
        setCurrentPublishedVersion(config.publishedVersion);
        toast.success("Saved successfully");
        setShowSaveModal(false);
        setSaveName(""); setSaveDescription("");
        fetchSavedConfigs();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch { toast.error("Failed to save"); }
    finally { setIsSaving(false); }
  };

  const handleQuickSave = async () => {
    if (!currentConfigId) return;
    setIsSaving(true);
    try {
      const body = {
        categoriesData: JSON.stringify(data.categories),
        itemsData: JSON.stringify(data.items),
      };
      const res = await fetch(`/api/shop/${currentConfigId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        const config = await res.json();
        setCurrentConfigVersion(config.currentVersion);
        setCurrentPublishedVersion(config.publishedVersion);
        toast.success("Saved");
        fetchSavedConfigs();
      } else toast.error("Failed to save");
    } catch { toast.error("Failed to save"); }
    finally { setIsSaving(false); }
  };

  const handleLoad = async (configId: number) => {
    try {
      const res = await fetch(`/api/shop/${configId}`);
      if (res.ok) {
        const config = await res.json();
        const categories = JSON.parse(config.categoriesData) as CategoriesData;
        const items = JSON.parse(config.itemsData) as ItemsData;
        resetHistory({ categories, items });
        setCurrentConfigId(config.id);
        setCurrentConfigName(config.name);
        setCurrentConfigVersion(config.currentVersion);
        setCurrentPublishedVersion(config.publishedVersion);
        setSelectedCategory(null);
        setSelectedItemShortname(null);
        toast.success(`Loaded "${config.name}"`);
        setShowLoadModal(false);
      } else toast.error("Failed to load config");
    } catch { toast.error("Failed to load config"); }
  };

  const handlePublish = async (configId: number) => {
    try {
      const res = await fetch(`/api/shop/${configId}/publish`, { method: "POST" });
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

  const handleDeleteConfig = async (configId: number) => {
    try {
      const res = await fetch(`/api/shop/${configId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted");
        fetchSavedConfigs();
        if (currentConfigId === configId) {
          setCurrentConfigId(null);
          setCurrentConfigName("");
        }
      } else toast.error("Failed to delete");
    } catch { toast.error("Failed to delete"); }
  };

  const handleRestoreVersion = async (versionId: number) => {
    if (!currentConfigId) return;
    try {
      const res = await fetch(`/api/shop/${currentConfigId}/versions`);
      if (!res.ok) return;
      const allVersions = await res.json();
      const version = allVersions.find((v: { id: number }) => v.id === versionId);
      if (!version) { toast.error("Version not found"); return; }

      // Fetch the full config to get the version data — we don't store individual version data in the list endpoint
      // Instead, reload from the main config after restoring
      toast.info("Version restore requires re-loading the config from that version's data. Use Save & Load to manage versions.");
    } catch { toast.error("Failed to restore version"); }
  };

  // ==========================================================================
  // Category operations
  // ==========================================================================

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) { toast.error("Category name is required"); return; }
    if (data.categories[name]) { toast.error("Category already exists"); return; }
    setData(prev => ({
      ...prev,
      categories: { ...prev.categories, [name]: { ...defaultCategory } },
    }));
    setSelectedCategory(name);
    setShowAddCategoryModal(false);
    setNewCategoryName("");
    toast.success(`Added category "${name}"`);
  };

  const handleDeleteCategory = () => {
    if (!selectedCategory) return;
    setData(prev => {
      const { [selectedCategory]: _, ...rest } = prev.categories;
      return { ...prev, categories: rest };
    });
    setSelectedCategory(null);
    setSelectedItemShortname(null);
    setShowDeleteCategoryConfirm(false);
    toast.success("Category deleted");
  };

  const updateCategory = (field: keyof ShopCategory, value: unknown) => {
    if (!selectedCategory) return;
    setData(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [selectedCategory]: { ...prev.categories[selectedCategory], [field]: value },
      },
    }));
  };

  // ==========================================================================
  // Item operations
  // ==========================================================================

  const handleAddItemToCategory = () => {
    const shortname = newItemShortname.trim();
    if (!shortname) { toast.error("Shortname is required"); return; }
    if (!selectedCategory) return;
    if (data.categories[selectedCategory].Items.includes(shortname)) {
      toast.error("Item already in category"); return;
    }
    setData(prev => {
      const newItems = { ...prev.items };
      if (!newItems[shortname]) {
        newItems[shortname] = { ...defaultItem, Image: `${shortname}.png` };
      }
      return {
        categories: {
          ...prev.categories,
          [selectedCategory]: {
            ...prev.categories[selectedCategory],
            Items: [...prev.categories[selectedCategory].Items, shortname],
          },
        },
        items: newItems,
      };
    });
    setSelectedItemShortname(shortname);
    setShowAddItemModal(false);
    setNewItemShortname("");
    toast.success(`Added "${shortname}"`);
  };

  const handleRemoveItemFromCategory = () => {
    if (!selectedCategory || !selectedItemShortname) return;
    setData(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [selectedCategory]: {
          ...prev.categories[selectedCategory],
          Items: prev.categories[selectedCategory].Items.filter(s => s !== selectedItemShortname),
        },
      },
    }));
    setSelectedItemShortname(null);
    setShowDeleteItemConfirm(false);
    toast.success("Item removed from category");
  };

  const updateItem = (shortname: string, field: keyof ShopItem, value: unknown) => {
    setData(prev => ({
      ...prev,
      items: {
        ...prev.items,
        [shortname]: { ...prev.items[shortname], [field]: value },
      },
    }));
  };

  // ==========================================================================
  // Render helpers
  // ==========================================================================

  const totalItems = Object.keys(data.items).length;
  const totalCategories = categoryNames.length;
  const hasUnsavedChanges = currentConfigId !== null;

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-emerald-400" />
          <div>
            <h1 className="text-lg font-semibold text-white">
              Shop Editor
              {currentConfigName && <span className="text-[var(--text-muted)] ml-2 text-sm font-normal">— {currentConfigName}</span>}
            </h1>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>{totalCategories} categories</span>
              <span>·</span>
              <span>{totalItems} items</span>
              {currentConfigId && (
                <>
                  <span>·</span>
                  <span>v{currentConfigVersion}</span>
                  {currentPublishedVersion !== null && (
                    <span className={currentConfigVersion > currentPublishedVersion ? "text-amber-400" : "text-emerald-400"}>
                      (published: v{currentPublishedVersion})
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <button
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "editor" ? "bg-emerald-500/20 text-emerald-400" : "text-[var(--text-muted)] hover:text-white"}`}
            >
              <Package className="w-3.5 h-3.5 inline mr-1.5" />Editor
            </button>
            <button
              onClick={() => setActiveTab("mapping")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "mapping" ? "bg-emerald-500/20 text-emerald-400" : "text-[var(--text-muted)] hover:text-white"}`}
            >
              <Server className="w-3.5 h-3.5 inline mr-1.5" />Mappings
            </button>
          </div>

          <div className="w-px h-6 bg-[rgba(255,255,255,0.1)]" />

          {/* Undo/Redo */}
          <IconButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></IconButton>
          <IconButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4" /></IconButton>

          <div className="w-px h-6 bg-[rgba(255,255,255,0.1)]" />

          {/* Import / Export */}
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportCategories} className="hidden" />
          <input ref={itemsFileInputRef} type="file" accept=".json" onChange={handleImportItems} className="hidden" />
          <IconButton onClick={() => fileInputRef.current?.click()} title="Import Categories.json"><Upload className="w-4 h-4" /></IconButton>
          <IconButton onClick={() => itemsFileInputRef.current?.click()} title="Import Items.json"><Upload className="w-4 h-4 text-blue-400" /></IconButton>
          <IconButton onClick={handleExportCategories} title="Export Categories.json"><Download className="w-4 h-4" /></IconButton>
          <IconButton onClick={handleExportItems} title="Export Items.json"><Download className="w-4 h-4 text-blue-400" /></IconButton>

          <div className="w-px h-6 bg-[rgba(255,255,255,0.1)]" />

          {/* Save / Load */}
          <Button onClick={() => setShowLoadModal(true)} className="text-xs"><FolderOpen className="w-3.5 h-3.5 mr-1" />Load</Button>
          {currentConfigId ? (
            <Button onClick={handleQuickSave} disabled={isSaving} className="text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
              <Save className="w-3.5 h-3.5 mr-1" />{isSaving ? "Saving..." : "Save"}
            </Button>
          ) : (
            <Button onClick={() => setShowSaveModal(true)} className="text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
              <Save className="w-3.5 h-3.5 mr-1" />Save As
            </Button>
          )}
          {currentConfigId && currentConfigVersion > (currentPublishedVersion ?? 0) && (
            <Button onClick={() => handlePublish(currentConfigId)} className="text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
              <CloudUpload className="w-3.5 h-3.5 mr-1" />Publish
            </Button>
          )}
          {currentConfigId && (
            <IconButton onClick={() => { fetchVersions(currentConfigId); setShowVersionHistoryModal(true); }} title="Version History">
              <History className="w-4 h-4" />
            </IconButton>
          )}
        </div>
      </div>

      {/* Main content */}
      {activeTab === "editor" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Categories */}
          <div className="w-64 flex-shrink-0 border-r border-[rgba(255,255,255,0.08)] flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold text-white flex-1">Categories</h2>
                <IconButton onClick={() => setShowAddCategoryModal(true)} title="Add Category">
                  <Plus className="w-3.5 h-3.5" />
                </IconButton>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input
                  type="text" placeholder="Search..."
                  value={categorySearch} onChange={e => setCategorySearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {filteredCategories.map(name => (
                <button
                  key={name}
                  onClick={() => { setSelectedCategory(name); setSelectedItemShortname(null); setItemSearch(""); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                    selectedCategory === name
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] border border-transparent"
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate flex-1">{name}</span>
                  <span className="text-xs opacity-50">{data.categories[name].Items.length}</span>
                </button>
              ))}
              {filteredCategories.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">No categories</p>
              )}
            </div>
          </div>

          {/* Middle - Items list */}
          <div className="w-72 flex-shrink-0 border-r border-[rgba(255,255,255,0.08)] flex flex-col overflow-hidden">
            {selectedCategory ? (
              <>
                <div className="p-3 border-b border-[rgba(255,255,255,0.08)]">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-sm font-semibold text-white flex-1 truncate">{selectedCategory} Items</h2>
                    <IconButton onClick={() => setShowAddItemModal(true)} title="Add Item">
                      <Plus className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <input
                      type="text" placeholder="Search items..."
                      value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                  {selectedCategoryItems.map(shortname => {
                    const item = data.items[shortname];
                    return (
                      <button
                        key={shortname}
                        onClick={() => setSelectedItemShortname(shortname)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                          selectedItemShortname === shortname
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] border border-transparent"
                        }`}
                      >
                        <div className="font-medium truncate">{shortname}</div>
                        {item && (
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-60">
                            <span>${item.BuyPrice}</span>
                            {item.SellPrice > 0 && <span className="text-amber-400">sell: ${item.SellPrice}</span>}
                            {item.Skin > 0 && <span>skin: {item.Skin}</span>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {selectedCategoryItems.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] text-center py-4">No items</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <Package className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Select a category</p>
              </div>
            )}
          </div>

          {/* Right - Editor panel */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedItemShortname && selectedItemData ? (
              <ItemEditor
                shortname={selectedItemShortname}
                item={selectedItemData}
                onUpdate={updateItem}
                onDelete={() => setShowDeleteItemConfirm(true)}
              />
            ) : selectedCategory && selectedCategoryData ? (
              <CategoryEditor
                name={selectedCategory}
                category={selectedCategoryData}
                onUpdate={updateCategory}
                onDelete={() => setShowDeleteCategoryConfirm(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-base font-medium mb-1">Shop Editor</p>
                <p className="text-sm opacity-60">Import a Categories.json and Items.json to get started,<br />or load a saved config.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Mapping tab */
        <div className="flex-1 overflow-y-auto p-4">
          <ServerMappingEditor
            mappings={mappings}
            servers={servers}
            savedConfigs={savedConfigs}
            apiBasePath="/api/shop"
            onRefreshMappings={fetchMappings}
            onRefreshConfigs={fetchSavedConfigs}
            accentColor="emerald"
          />
        </div>
      )}

      {/* ================================================================== */}
      {/* Modals */}
      {/* ================================================================== */}

      {/* Save As Modal */}
      <Modal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} title="Save Shop Config">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
            <Input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="e.g. 5x Shop Config" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Description (optional)</label>
            <Input value={saveDescription} onChange={e => setSaveDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowSaveModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !saveName.trim()} className="bg-emerald-500/20 text-emerald-400">
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Load Modal */}
      <Modal isOpen={showLoadModal} onClose={() => setShowLoadModal(false)} title="Load Shop Config">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loadingSavedConfigs && <p className="text-sm text-[var(--text-muted)]">Loading...</p>}
          {savedConfigs.map(config => (
            <GlassContainer key={config.id} variant="subtle" padding="md" className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">{config.name}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  v{config.currentVersion}
                  {config.publishedVersion !== null && ` (published: v${config.publishedVersion})`}
                  {config.description && ` — ${config.description}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {config.currentVersion > (config.publishedVersion ?? 0) && (
                  <Button onClick={() => handlePublish(config.id)} className="text-xs bg-blue-500/20 text-blue-400">
                    <CloudUpload className="w-3 h-3 mr-1" />Publish
                  </Button>
                )}
                <Button onClick={() => handleLoad(config.id)} className="text-xs bg-emerald-500/20 text-emerald-400">
                  <FolderOpen className="w-3 h-3 mr-1" />Load
                </Button>
                <IconButton onClick={() => handleDeleteConfig(config.id)} title="Delete">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </IconButton>
              </div>
            </GlassContainer>
          ))}
          {!loadingSavedConfigs && savedConfigs.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">No saved configs yet</p>
          )}
        </div>
      </Modal>

      {/* Add Category Modal */}
      <Modal isOpen={showAddCategoryModal} onClose={() => setShowAddCategoryModal(false)} title="Add Category">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Category Name</label>
            <Input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="e.g. Weapon"
              onKeyDown={e => e.key === "Enter" && handleAddCategory()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowAddCategoryModal(false)}>Cancel</Button>
            <Button onClick={handleAddCategory} className="bg-emerald-500/20 text-emerald-400">Add</Button>
          </div>
        </div>
      </Modal>

      {/* Add Item Modal */}
      <Modal isOpen={showAddItemModal} onClose={() => setShowAddItemModal(false)} title="Add Item to Category">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Item Shortname</label>
            <Input
              value={newItemShortname}
              onChange={e => setNewItemShortname(e.target.value)}
              placeholder="e.g. rifle.ak"
              onKeyDown={e => e.key === "Enter" && handleAddItemToCategory()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowAddItemModal(false)}>Cancel</Button>
            <Button onClick={handleAddItemToCategory} className="bg-emerald-500/20 text-emerald-400">Add</Button>
          </div>
        </div>
      </Modal>

      {/* Version History Modal */}
      <Modal isOpen={showVersionHistoryModal} onClose={() => setShowVersionHistoryModal(false)} title="Version History">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loadingVersions && <p className="text-sm text-[var(--text-muted)]">Loading...</p>}
          {versions.map(v => (
            <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
              <div>
                <span className="text-sm text-white font-medium">v{v.version}</span>
                <span className="text-xs text-[var(--text-muted)] ml-2">{new Date(v.createdAt).toLocaleString()}</span>
                {currentPublishedVersion === v.version && (
                  <span className="text-xs text-emerald-400 ml-2">(published)</span>
                )}
              </div>
            </div>
          ))}
          {!loadingVersions && versions.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">No versions</p>
          )}
        </div>
      </Modal>

      {/* Delete Category Confirm */}
      <ConfirmModal
        isOpen={showDeleteCategoryConfirm}
        onClose={() => setShowDeleteCategoryConfirm(false)}
        onConfirm={handleDeleteCategory}
        title="Delete Category"
        description={`Are you sure you want to delete "${selectedCategory}"? This will remove it from the config but won't delete the individual item definitions.`}
        confirmText="Delete"
        variant="error"
      />

      {/* Delete Item Confirm */}
      <ConfirmModal
        isOpen={showDeleteItemConfirm}
        onClose={() => setShowDeleteItemConfirm(false)}
        onConfirm={handleRemoveItemFromCategory}
        title="Remove Item"
        description={`Remove "${selectedItemShortname}" from ${selectedCategory}?`}
        confirmText="Remove"
        variant="error"
      />
    </div>
  );
}

// =============================================================================
// Category Editor Sub-component
// =============================================================================

function CategoryEditor({ name, category, onUpdate, onDelete }: {
  name: string;
  category: ShopCategory;
  onUpdate: (field: keyof ShopCategory, value: unknown) => void;
  onDelete: () => void;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Tag className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{name}</h2>
            <p className="text-xs text-[var(--text-muted)]">Category Settings · {category.Items.length} items</p>
          </div>
        </div>
        <IconButton onClick={onDelete} title="Delete category"><Trash2 className="w-4 h-4 text-red-400" /></IconButton>
      </div>

      <GlassContainer variant="subtle" padding="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider">Image URL</label>
            <Input
              value={category.Image}
              onChange={e => onUpdate("Image", e.target.value)}
              placeholder="https://rust.icefuse.net/assets/img/shop/pistol.png"
            />
            {category.Image && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={category.Image}
                  alt={name}
                  className="w-10 h-10 rounded-lg object-contain bg-[rgba(255,255,255,0.05)] p-1"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <span className="text-xs text-[var(--text-muted)] truncate">{category.Image}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider">Permission</label>
              <Input
                value={category.Permission || ""}
                onChange={e => onUpdate("Permission", e.target.value || null)}
                placeholder="null (no permission)"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider">Sale %</label>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={category.Sale}
                  onChange={v => onUpdate("Sale", v)}
                  min={0} max={100} step={1}
                />
                <Percent className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            </div>
          </div>
        </div>
      </GlassContainer>
    </div>
  );
}

// =============================================================================
// Item Editor Sub-component
// =============================================================================

function ItemEditor({ shortname, item, onUpdate, onDelete }: {
  shortname: string;
  item: ShopItem;
  onUpdate: (shortname: string, field: keyof ShopItem, value: unknown) => void;
  onDelete: () => void;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{shortname}</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {item.DisplayName !== "default" ? item.DisplayName : shortname}
              {item.Skin > 0 && ` · Skin: ${item.Skin}`}
            </p>
          </div>
        </div>
        <IconButton onClick={onDelete} title="Remove from category"><Trash2 className="w-4 h-4 text-red-400" /></IconButton>
      </div>

      <GlassContainer variant="subtle" padding="lg">
        <div className="space-y-4">
          {/* Display & Identity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider">Display Name</label>
              <Input
                value={item.DisplayName}
                onChange={e => onUpdate(shortname, "DisplayName", e.target.value)}
                placeholder="default"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider">Skin ID</label>
              <NumberInput
                value={item.Skin}
                onChange={v => onUpdate(shortname, "Skin", v)}
                min={0}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider">Image</label>
            <Input
              value={item.Image}
              onChange={e => onUpdate(shortname, "Image", e.target.value)}
              placeholder="item.png"
            />
          </div>

          {/* Pricing */}
          <div className="border-t border-[rgba(255,255,255,0.08)] pt-4">
            <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Pricing</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Buy Price</label>
                <NumberInput
                  value={item.BuyPrice}
                  onChange={v => onUpdate(shortname, "BuyPrice", v)}
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Sell Price</label>
                <NumberInput
                  value={item.SellPrice}
                  onChange={v => onUpdate(shortname, "SellPrice", v)}
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Currency</label>
                <Dropdown
                  options={CURRENCY_OPTIONS}
                  value={item.Currency}
                  onChange={v => onUpdate(shortname, "Currency", v)}
                />
              </div>
            </div>
          </div>

          {/* Amount & Options */}
          <div className="border-t border-[rgba(255,255,255,0.08)] pt-4">
            <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Amount & Options</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Default Amount</label>
                <NumberInput
                  value={item.DefaultAmount}
                  onChange={v => onUpdate(shortname, "DefaultAmount", v)}
                  min={1}
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  checked={item.BlockAmountChange}
                  onChange={v => onUpdate(shortname, "BlockAmountChange", v)}
                />
                <label className="text-xs text-[var(--text-muted)]">Block Amount Change</label>
              </div>
            </div>
          </div>
        </div>
      </GlassContainer>
    </div>
  );
}
