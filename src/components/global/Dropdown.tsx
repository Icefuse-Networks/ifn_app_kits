"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown, Check, X, Search, CheckSquare, Square } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

// Single-select props
interface DropdownSingleProps {
  multiSelect?: false;
  value: string | null;
  onChange: (value: string | null) => void;
  multiValue?: never;
  onMultiChange?: never;
  showSelectAll?: never;
}

// Multi-select props
interface DropdownMultiProps {
  multiSelect: true;
  value?: never;
  onChange?: never;
  multiValue: string[];
  onMultiChange: (values: string[]) => void;
  showSelectAll?: boolean;
}

export type DropdownProps = (DropdownSingleProps | DropdownMultiProps) & {
  options: DropdownOption[];
  placeholder?: string;
  emptyOption?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  clearable?: boolean;
  searchable?: boolean;
  maxHeight?: string;
};

export function Dropdown(props: DropdownProps) {
  const {
    options,
    placeholder = "Select...",
    emptyOption,
    disabled = false,
    className = "",
    error,
    clearable = false,
    searchable = false,
    maxHeight = "240px",
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);  // controls DOM presence
  const [panelEntering, setPanelEntering] = useState(false); // true = animating in (closed → open)
  const [panelClosing, setPanelClosing] = useState(false);   // true = animating out (open → closed)
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMulti = props.multiSelect === true;

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (opt.description ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Single-select helpers
  const singleValue = !isMulti ? props.value : null;
  const hasValue = singleValue !== null && singleValue !== "";
  const singleLabel = !hasValue
    ? emptyOption || placeholder
    : options.find((o) => o.value === singleValue)?.label || placeholder;

  // Multi-select helpers
  const multiValue = isMulti ? props.multiValue : [];
  const allSelected = filteredOptions.length > 0 && filteredOptions.every((o) => multiValue.includes(o.value));
  const someSelected = !allSelected && filteredOptions.some((o) => multiValue.includes(o.value));

  const multiLabel =
    multiValue.length === 0
      ? placeholder
      : multiValue.length === 1
        ? options.find((o) => o.value === multiValue[0])?.label ?? placeholder
        : `${multiValue.length} selected`;

  const openPanel = () => {
    if (closeAnimTimerRef.current) clearTimeout(closeAnimTimerRef.current);
    setPanelEntering(true);
    setPanelClosing(false);
    setPanelVisible(true);
    setIsOpen(true);
    // One frame later: remove entering state so transition fires
    requestAnimationFrame(() => setPanelEntering(false));
  };

  const closePanel = () => {
    setPanelClosing(true);
    setIsOpen(false);
    setSearchQuery("");
    closeAnimTimerRef.current = setTimeout(() => {
      setPanelVisible(false);
      setPanelClosing(false);
    }, 160);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (closeAnimTimerRef.current) clearTimeout(closeAnimTimerRef.current); };
  }, []);

  // Click-outside / escape
  useEffect(() => {
    if (!panelVisible) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closePanel();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [panelVisible]);

  // Auto-focus search
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Single-select handler
  const handleSingleSelect = (optionValue: string | null) => {
    if (!isMulti) {
      props.onChange(optionValue);
      closePanel();
    }
  };

  // Multi-select handler
  const handleMultiToggle = (optionValue: string) => {
    if (!isMulti) return;
    const next = multiValue.includes(optionValue)
      ? multiValue.filter((v) => v !== optionValue)
      : [...multiValue, optionValue];
    props.onMultiChange(next);
  };

  const handleSelectAll = () => {
    if (!isMulti) return;
    if (allSelected) {
      // Deselect filtered options, keep any outside filter
      const filteredSet = new Set(filteredOptions.map((o) => o.value));
      props.onMultiChange(multiValue.filter((v) => !filteredSet.has(v)));
    } else {
      const filteredValues = filteredOptions.filter((o) => !o.disabled).map((o) => o.value);
      props.onMultiChange([...new Set([...multiValue, ...filteredValues])]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMulti) {
      props.onMultiChange([]);
    } else {
      props.onChange(null);
    }
  };

  const showClear = clearable && (isMulti ? multiValue.length > 0 : hasValue) && !disabled;
  const displayLabel = isMulti ? multiLabel : singleLabel;
  const displayHasValue = isMulti ? multiValue.length > 0 : hasValue;

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { if (!disabled) { isOpen ? closePanel() : openPanel(); } }}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2
          px-4 py-2.5
          bg-[var(--bg-input)]
          border ${error ? "border-[var(--status-error)]" : isOpen ? "border-[var(--accent-primary)]" : "border-[var(--border-secondary)] hover:border-[var(--border-primary)]"}
          rounded-[var(--radius-md)]
          text-sm
          transition-all duration-200
          focus:outline-none focus:border-[var(--accent-primary)]
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        <span className={`truncate flex-1 text-left ${displayHasValue ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
          {displayLabel}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {showClear && (
            <button
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-[var(--glass-bg)] transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {error && <p className="mt-1 text-xs text-[var(--status-error)]">{error}</p>}

      {/* Dropdown Panel */}
      {panelVisible && (
        <div
          className="absolute z-50 w-full mt-1 rounded-[var(--radius-md)] overflow-hidden shadow-lg"
          style={{
            background: 'linear-gradient(to bottom right, #0a0a0f 0%, #1a1a2e 50%, #0f1419 100%)',
            border: "1px solid var(--glass-border)",
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
            // Animation: slide down on open, slide up on close
            transition: 'opacity 160ms ease, transform 160ms cubic-bezier(0.16,1,0.3,1)',
            opacity: panelEntering || panelClosing ? 0 : 1,
            transform: panelEntering || panelClosing ? 'translateY(-6px) scaleY(0.97)' : 'translateY(0) scaleY(1)',
            transformOrigin: 'top center',
          }}
        >
          {/* Search */}
          {searchable && (
            <div className="p-2 border-b border-[var(--glass-border)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
              </div>
            </div>
          )}

          {/* Select All (multi-select only) */}
          {isMulti && props.showSelectAll && filteredOptions.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors"
            >
              <span className="shrink-0 text-[var(--accent-primary)]">
                {allSelected ? (
                  <CheckSquare className="w-4 h-4" />
                ) : someSelected ? (
                  <div className="w-4 h-4 rounded border-2 border-[var(--accent-primary)] flex items-center justify-center">
                    <div className="w-2 h-0.5 bg-[var(--accent-primary)]" />
                  </div>
                ) : (
                  <Square className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </span>
              <span className={allSelected || someSelected ? "text-[var(--accent-primary)]" : "text-[var(--text-secondary)]"}>
                {allSelected ? "Deselect all" : "Select all"}
              </span>
              {multiValue.length > 0 && (
                <span className="ml-auto text-xs text-[var(--text-muted)]">{multiValue.length} selected</span>
              )}
            </button>
          )}

          <div className="py-1 overflow-y-auto" style={{ maxHeight }}>
            {/* Empty option (single-select only) */}
            {!isMulti && emptyOption && (
              <button
                type="button"
                onClick={() => handleSingleSelect(null)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition-colors ${
                  !hasValue ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
                }`}
              >
                <span>{emptyOption}</span>
                {!hasValue && <Check className="w-4 h-4 shrink-0" />}
              </button>
            )}

            {filteredOptions.map((option) => {
              const isSelected = isMulti ? multiValue.includes(option.value) : singleValue === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => isMulti ? handleMultiToggle(option.value) : handleSingleSelect(option.value)}
                  disabled={option.disabled}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
                  }`}
                >
                  {/* Checkbox for multi, check icon for single */}
                  {isMulti ? (
                    <span className="shrink-0">
                      {isSelected
                        ? <CheckSquare className="w-4 h-4 text-[var(--accent-primary)]" />
                        : <Square className="w-4 h-4 text-[var(--text-muted)]" />
                      }
                    </span>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <span className="truncate">{option.label}</span>
                    </div>
                    {option.description && (
                      <span className="text-xs text-[var(--text-muted)] block truncate mt-0.5">{option.description}</span>
                    )}
                  </div>
                  {!isMulti && isSelected && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <p className="px-4 py-3 text-xs text-[var(--text-muted)] italic text-center">
                {searchable && searchQuery ? "No results found" : "No options available"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
