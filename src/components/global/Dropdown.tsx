"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown, Check, X } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyOption?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  clearable?: boolean;
  searchable?: boolean;
  maxHeight?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select...",
  emptyOption,
  disabled = false,
  className = "",
  error,
  clearable = false,
  searchable = false,
  maxHeight = "240px",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const hasValue = value !== null && value !== "";
  const displayLabel = !hasValue
    ? emptyOption || placeholder
    : options.find((o) => o.value === value)?.label || placeholder;

  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: string | null) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
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
        <span
          className={`truncate flex-1 text-left ${
            hasValue
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-muted)]"
          }`}
        >
          {displayLabel}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {clearable && hasValue && !disabled && (
            <button
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-[var(--glass-bg)] transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {error && (
        <p className="mt-1 text-xs text-[var(--status-error)]">{error}</p>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 rounded-[var(--radius-md)] overflow-hidden shadow-lg"
          style={{
            background: 'linear-gradient(to bottom right, #0a0a0f 0%, #1a1a2e 50%, #0f1419 100%)',
            border: "1px solid var(--glass-border)",
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          }}
        >
          {searchable && (
            <div className="p-2 border-b border-[var(--glass-border)]">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          )}

          <div className="py-1 overflow-y-auto" style={{ maxHeight }}>
            {emptyOption && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition-colors ${
                  !hasValue
                    ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
                }`}
              >
                <span>{emptyOption}</span>
                {!hasValue && <Check className="w-4 h-4 shrink-0" />}
              </button>
            )}

            {filteredOptions.map((option) => {
              const isSelected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  disabled={option.disabled}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                      : "text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {option.icon && <span className="shrink-0">{option.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{option.label}</span>
                      {option.description && (
                        <span className="text-xs text-[var(--text-muted)] block truncate">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <p className="px-4 py-2 text-xs text-[var(--text-muted)] italic">
                {searchable && searchQuery ? "No results found" : "No options available"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
