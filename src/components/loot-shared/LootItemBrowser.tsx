"use client";
import { useState, useEffect, useMemo } from "react";
import { Search, ChevronRight, Plus } from "lucide-react";
import { RustItem, fetchRustItems, getItemImageUrl, ITEM_CATEGORIES, searchItems, ItemCategory } from "@/lib/rust-items";

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

  const hoverBorder = `hover:border-${accentColor}-500/50`;
  const hoverBg = `hover:bg-${accentColor}-500/10`;
  const iconColor = `text-${accentColor}-400`;

  return (
    <div className={`flex flex-col bg-white/[0.02] border-l border-white/5 transition-all duration-300 ${isOpen ? "w-72" : "w-10"}`}>
      <button
        onClick={onToggle}
        className="p-2 text-zinc-500 hover:text-white border-b border-white/5 flex items-center justify-center"
        title={isOpen ? "Hide item browser" : "Show item browser"}
      >
        <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <>
          <div className="p-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white mb-2">Item Browser</h3>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search items..."
                className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 bg-white/5 border border-white/5 focus:outline-none"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory | "All")}
              className="w-full rounded-lg px-2 py-1.5 text-xs text-white bg-white/5 border border-white/5 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {ITEM_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {rustItems.length === 0 ? (
              <div className="text-center py-8 text-zinc-600">
                <div className={`w-6 h-6 border-2 border-${accentColor}-400 border-t-transparent rounded-full animate-spin mx-auto mb-2`} />
                <p className="text-xs">Loading items...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-zinc-600">
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
              <p className="text-xs text-zinc-500 text-center mt-2">Showing first 100 results</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
