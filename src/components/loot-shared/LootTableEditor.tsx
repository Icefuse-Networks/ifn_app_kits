"use client";
import { useState, useMemo } from "react";
import { Grid, List, Trash2, Plus } from "lucide-react";
import { getItemImageUrl } from "@/lib/rust-items";
import type { GenericLootItem, ExtraFieldDef } from "./types";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button, IconButton, ButtonGroup } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CheckboxSwitch } from "@/components/ui/Switch";
import { GlassContainer } from "@/components/global/GlassContainer";

interface LootTableEditorProps {
  tableName: string;
  items: GenericLootItem[];
  minItems?: number;
  maxItems?: number;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onUpdateItem: (index: number, updates: Partial<GenericLootItem>) => void;
  onRemoveItem: (index: number) => void;
  onAddItem: (shortname: string) => void;
  onUpdateTableSettings?: (updates: { minItems?: number; maxItems?: number }) => void;
  extraFields?: ExtraFieldDef[];
  accentColor?: string;
}

export default function LootTableEditor({
  tableName,
  items,
  minItems,
  maxItems,
  viewMode,
  onViewModeChange,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
  onUpdateTableSettings,
  extraFields = [],
  accentColor = "purple",
}: LootTableEditorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items.map((item, i) => ({ item, originalIndex: i }));
    return items
      .map((item, i) => ({ item, originalIndex: i }))
      .filter(({ item }) => item.shortname.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [items, searchTerm]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white capitalize">{tableName}</h2>
          <span className="text-xs text-[var(--text-muted)]">{items.length} items</span>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search items..."
            size="sm"
            className="w-48"
          />
          <ButtonGroup>
            <IconButton
              icon={<Grid className="h-3.5 w-3.5" />}
              onClick={() => onViewModeChange("grid")}
              className={viewMode === "grid" ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}
            />
            <IconButton
              icon={<List className="h-3.5 w-3.5" />}
              onClick={() => onViewModeChange("list")}
              className={viewMode === "list" ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}
            />
          </ButtonGroup>
        </div>
      </div>

      {/* Table settings */}
      <GlassContainer variant="subtle" className="shrink-0 flex items-center gap-4 px-4 py-2 border-b border-white/5 !rounded-none" features={{ hoverGlow: false }}>
        {minItems !== undefined && maxItems !== undefined && onUpdateTableSettings && (
          <>
            <Input
              label="Min Items"
              type="number"
              value={minItems}
              onChange={(e) => onUpdateTableSettings({ minItems: parseInt(e.target.value) || 1 })}
              min={1}
              size="sm"
              className="w-28"
            />
            <Input
              label="Max Items"
              type="number"
              value={maxItems}
              onChange={(e) => onUpdateTableSettings({ maxItems: parseInt(e.target.value) || 1 })}
              min={1}
              size="sm"
              className="w-28"
            />
          </>
        )}
        <Button
          onClick={() => setShowAddItem(true)}
          variant="primary"
          size="sm"
          icon={<Plus className="h-3 w-3" />}
          className="ml-auto text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/20"
        >
          Add Item
        </Button>
      </GlassContainer>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
            <p className="text-sm">No items in this table</p>
            <p className="text-xs mt-1">Add items from the browser or click &quot;Add Item&quot;</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <p className="text-sm">No items match &quot;{searchTerm}&quot;</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredItems.map(({ item, originalIndex }) => (
              <ItemCard
                key={originalIndex}
                item={item}
                index={originalIndex}
                onUpdate={onUpdateItem}
                onRemove={onRemoveItem}
                extraFields={extraFields}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[2fr,1fr,1fr,1fr,repeat(var(--extra),1fr),auto] gap-2 px-3 py-1.5 text-xs text-[var(--text-muted)] font-medium" style={{ "--extra": extraFields.length } as React.CSSProperties}>
              <span>Item</span>
              <span>Amount</span>
              <span>Chance</span>
              {extraFields.map(f => <span key={f.key}>{f.label}</span>)}
              <span></span>
            </div>
            {filteredItems.map(({ item, originalIndex }) => (
              <ItemListRow
                key={originalIndex}
                item={item}
                index={originalIndex}
                onUpdate={onUpdateItem}
                onRemove={onRemoveItem}
                extraFields={extraFields}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add item inline */}
      {showAddItem && (
        <GlassContainer variant="subtle" className="shrink-0 border-t border-white/5 p-3 !rounded-none" features={{ hoverGlow: false }}>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={addItemSearch}
              onChange={(e) => setAddItemSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && addItemSearch.trim()) {
                  onAddItem(addItemSearch.trim());
                  setAddItemSearch("");
                  setShowAddItem(false);
                }
                if (e.key === "Escape") setShowAddItem(false);
              }}
              placeholder="Enter item shortname..."
              size="sm"
              className="flex-1"
              autoFocus
            />
            <Button
              onClick={() => {
                if (addItemSearch.trim()) {
                  onAddItem(addItemSearch.trim());
                  setAddItemSearch("");
                  setShowAddItem(false);
                }
              }}
              variant="primary"
              size="sm"
            >
              Add
            </Button>
            <Button
              onClick={() => setShowAddItem(false)}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </GlassContainer>
      )}
    </div>
  );
}

function ItemCard({
  item,
  index,
  onUpdate,
  onRemove,
  extraFields,
}: {
  item: GenericLootItem;
  index: number;
  onUpdate: (index: number, updates: Partial<GenericLootItem>) => void;
  onRemove: (index: number) => void;
  extraFields: ExtraFieldDef[];
}) {
  return (
    <GlassContainer variant="default" radius="md" className="p-3">
      <div className="flex items-start gap-3 mb-3">
        <img
          src={getItemImageUrl(item.shortname)}
          alt={item.shortname}
          referrerPolicy="no-referrer"
          className="w-12 h-12 object-contain bg-[var(--bg-secondary)]/50 rounded-lg p-1"
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{item.shortname}</p>
          <p className="text-xs text-[var(--text-muted)]">Chance: {item.spawnChance}%</p>
        </div>
        <IconButton
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={() => onRemove(index)}
          label="Remove item"
          className="text-[var(--text-muted)] hover:text-[var(--status-error)]"
          size="sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Min"
          type="number"
          value={item.minAmount}
          onChange={(e) => onUpdate(index, { minAmount: parseInt(e.target.value) || 1 })}
          min={1}
          size="sm"
        />
        <Input
          label="Max"
          type="number"
          value={item.maxAmount}
          onChange={(e) => onUpdate(index, { maxAmount: parseInt(e.target.value) || 1 })}
          min={1}
          size="sm"
        />
        <Input
          label="Spawn Chance"
          type="number"
          value={item.spawnChance}
          onChange={(e) => onUpdate(index, { spawnChance: parseFloat(e.target.value) || 0 })}
          min={0}
          step={0.1}
          size="sm"
          className="col-span-2"
        />
        {extraFields.map((field) => (
          <div key={field.key}>
            {field.type === "number" ? (
              <Input
                label={field.label}
                type="number"
                value={(item[field.key] as number) ?? field.default}
                onChange={(e) => onUpdate(index, { [field.key]: parseFloat(e.target.value) || 0 })}
                min={field.min}
                max={field.max}
                step={field.step}
                size="sm"
              />
            ) : (
              <CheckboxSwitch
                label={field.label}
                checked={!!item[field.key]}
                onChange={(checked) => onUpdate(index, { [field.key]: checked })}
              />
            )}
          </div>
        ))}
      </div>
    </GlassContainer>
  );
}

function ItemListRow({
  item,
  index,
  onUpdate,
  onRemove,
  extraFields,
}: {
  item: GenericLootItem;
  index: number;
  onUpdate: (index: number, updates: Partial<GenericLootItem>) => void;
  onRemove: (index: number) => void;
  extraFields: ExtraFieldDef[];
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors group">
      <img
        src={getItemImageUrl(item.shortname)}
        alt={item.shortname}
        referrerPolicy="no-referrer"
        className="w-7 h-7 object-contain bg-[var(--bg-secondary)]/50 rounded p-0.5"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
      />
      <span className="text-xs text-white font-medium flex-1 truncate min-w-0">{item.shortname}</span>
      <div className="flex items-center gap-1">
        <input type="number" value={item.minAmount} onChange={(e) => onUpdate(index, { minAmount: parseInt(e.target.value) || 1 })} min={1} className="w-14 rounded bg-white/5 border border-white/5 px-1.5 py-0.5 text-xs text-white text-center focus:outline-none" />
        <span className="text-[var(--text-muted)] text-xs">-</span>
        <input type="number" value={item.maxAmount} onChange={(e) => onUpdate(index, { maxAmount: parseInt(e.target.value) || 1 })} min={1} className="w-14 rounded bg-white/5 border border-white/5 px-1.5 py-0.5 text-xs text-white text-center focus:outline-none" />
      </div>
      <input type="number" value={item.spawnChance} onChange={(e) => onUpdate(index, { spawnChance: parseFloat(e.target.value) || 0 })} min={0} step={0.1} className="w-16 rounded bg-white/5 border border-white/5 px-1.5 py-0.5 text-xs text-white text-center focus:outline-none" />
      {extraFields.map((field) => (
        field.type === "number" ? (
          <input key={field.key} type="number" value={(item[field.key] as number) ?? field.default} onChange={(e) => onUpdate(index, { [field.key]: parseFloat(e.target.value) || 0 })} min={field.min} max={field.max} step={field.step} className="w-14 rounded bg-white/5 border border-white/5 px-1.5 py-0.5 text-xs text-white text-center focus:outline-none" />
        ) : (
          <CheckboxSwitch key={field.key} checked={!!item[field.key]} onChange={(checked) => onUpdate(index, { [field.key]: checked })} label="" />
        )
      ))}
      <IconButton
        icon={<Trash2 className="h-3.5 w-3.5" />}
        onClick={() => onRemove(index)}
        label="Remove item"
        className="text-[var(--text-muted)] hover:text-[var(--status-error)] opacity-0 group-hover:opacity-100"
        size="sm"
      />
    </div>
  );
}
