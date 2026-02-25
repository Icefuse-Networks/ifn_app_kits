"use client";
import { useState, useEffect, useMemo } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { RustItem, fetchRustItems, getItemImageUrl, ITEM_CATEGORIES, searchItems, ItemCategory } from "@/lib/rust-items";
import { SearchInput } from "@/components/ui/SearchInput";
import { Dropdown, DropdownOption } from "@/components/global/Dropdown";
import { IconButton } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { GlassContainer } from "@/components/global/GlassContainer";

interface LootItemBrowserProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddItem: (shortname: string) => void;
  accentColor?: string;
}

export default function LootItemBrowser({ isOpen, onToggle, onAddItem, accentColor = "purple" }: LootItemBrowserProps) {
  const [rustItems, setRustItems] = useState<RustItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState<ItemCategory | "All">("All");

  useEffect(() => {
    fetchRustItems().then(setRustItems).catch(() => {});
  }, []);

  const filteredItems = useMemo(() => {
    let items = rustItems;
    if (category !== "All") items = items.filter(i => i.Category === category);
    if (searchTerm) items = searchItems(items, searchTerm);
    return items.slice(0, 100);
  }, [rustItems, searchTerm, category]);

  const categoryOptions: DropdownOption[] = [
    { value: "All", label: "All Categories" },
    ...ITEM_CATEGORIES.map(cat => ({ value: cat, label: cat }))
  ];

  const hoverBorder = "hover:border-[var(--accent-primary)]/50";
  const hoverBg = "hover:bg-[var(--accent-primary)]/10";
  const iconColor = "text-[var(--accent-primary)]";

  return (
    <GlassContainer as="aside" variant="subtle" radius="sm" className={`flex flex-col border-l border-white/5 transition-all duration-300 !rounded-none ${isOpen ? "w-72" : "w-10"}`} features={{ hoverGlow: false }}>
      <IconButton
        icon={<ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
        onClick={onToggle}
        label={isOpen ? "Hide item browser" : "Show item browser"}
        className="p-2 text-[var(--text-muted)] hover:text-white border-b border-white/5 flex items-center justify-center"
      />
      {isOpen && (
        <>
          <div className="p-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white mb-2">Item Browser</h3>
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items..."
              size="sm"
              className="mb-2"
            />
            <Dropdown
              value={category}
              options={categoryOptions}
              onChange={(value) => setCategory((value as ItemCategory | "All") || "All")}
              placeholder="Select category..."
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {rustItems.length === 0 ? (
              <Loading text="Loading items..." size="sm" className="py-8" />
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <p className="text-xs">No items found</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1">
                {filteredItems.map((item) => (
                  <button
                    key={item.shortname}
                    onClick={() => onAddItem(item.shortname)}
                    className={`group relative aspect-square rounded-lg bg-white/[0.02] border border-white/5 ${hoverBorder} ${hoverBg} transition-all p-1`}
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
                      <Plus className={`h-4 w-4 ${iconColor}`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
            {filteredItems.length >= 100 && (
              <p className="text-xs text-[var(--text-muted)] text-center mt-2">Showing first 100 results</p>
            )}
          </div>
        </>
      )}
    </GlassContainer>
  );
}
