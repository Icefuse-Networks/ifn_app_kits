'use client'

import { useState, useEffect } from 'react'
import { getItemImageUrl } from '@/lib/rust-items'
import type { KitItem } from '@/types/kit'

// =============================================================================
// Types
// =============================================================================

export type ItemSlot = 'MainItems' | 'WearItems' | 'BeltItems'

interface InventorySlotProps {
  position: number
  item?: KitItem
  slotType: ItemSlot
  index?: number
  selected?: boolean
  dragOver?: boolean
  size?: number
  skinImageUrl?: string | null
  onSelect?: (slot: ItemSlot, index: number) => void
  onEmptyClick?: (slot: ItemSlot, position: number) => void
  onContextMenu?: (slot: ItemSlot, index: number, x: number, y: number) => void
  onDragStart?: (e: React.DragEvent, slot: ItemSlot, index: number) => void
  onDrop?: (e: React.DragEvent, slot: ItemSlot, position: number) => void
  onDragOver?: (slot: ItemSlot, position: number) => void
  onDragLeave?: () => void
}

// =============================================================================
// Component
// =============================================================================

const DEFAULT_SIZE = 56

export function InventorySlot({
  position,
  item,
  slotType,
  index,
  selected = false,
  dragOver = false,
  size = DEFAULT_SIZE,
  skinImageUrl,
  onSelect,
  onEmptyClick,
  onContextMenu: onCtxMenu,
  onDragStart,
  onDrop,
  onDragOver,
  onDragLeave,
}: InventorySlotProps) {
  const imgSize = Math.floor(size * 0.75)
  const [imgFailed, setImgFailed] = useState(false)
  const [skinFailed, setSkinFailed] = useState(false)

  // Reset image error state when item changes
  useEffect(() => {
    setImgFailed(false)
    setSkinFailed(false)
  }, [item?.Shortname, item?.Skin])

  const handleClick = () => {
    if (item && index !== undefined && onSelect) {
      onSelect(slotType, index)
    } else if (!item && onEmptyClick) {
      onEmptyClick(slotType, position)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (item && index !== undefined && onCtxMenu) {
      e.preventDefault()
      onCtxMenu(slotType, index, e.clientX, e.clientY)
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (item && index !== undefined && onDragStart) {
      onDragStart(e, slotType, index)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    onDragOver?.(slotType, position)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    onDrop?.(e, slotType, position)
  }

  const isHighlighted = selected || dragOver

  return (
    <div
      className="relative flex items-center justify-center cursor-pointer transition-all duration-150"
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background: selected
          ? 'rgba(59, 130, 246, 0.2)'
          : dragOver
            ? 'rgba(59, 130, 246, 0.3)'
            : 'rgba(255, 255, 255, 0.06)',
        border: isHighlighted
          ? '2px solid var(--accent-primary)'
          : '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-sm)',
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      draggable={!!item}
      onDragStart={handleDragStart}
    >
      {item ? (
        <>
          {skinImageUrl && !skinFailed ? (
            <img
              src={skinImageUrl}
              alt={`${item.Shortname} skin`}
              draggable={false}
              referrerPolicy="no-referrer"
              style={{ width: imgSize, height: imgSize, objectFit: 'contain' }}
              onError={() => setSkinFailed(true)}
            />
          ) : !imgFailed ? (
            <img
              src={getItemImageUrl(item.Shortname)}
              alt={item.Shortname}
              draggable={false}
              referrerPolicy="no-referrer"
              style={{ width: imgSize, height: imgSize, objectFit: 'contain' }}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span
              className="text-[8px] text-[var(--text-muted)] text-center leading-tight px-0.5 overflow-hidden"
              style={{
                maxWidth: imgSize,
                maxHeight: imgSize,
                wordBreak: 'break-all',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {item.Shortname}
            </span>
          )}

          {/* Always show amount */}
          <span
            className="absolute bottom-0.5 right-1 text-[10px] font-bold text-white"
            style={{ textShadow: '0 0 2px #000, 0 0 4px #000' }}
          >
            x{item.Amount}
          </span>

          {item.Condition < 1 && (
            <div
              className="absolute bottom-0 left-0 right-0 h-1"
              style={{
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
              }}
            >
              <div
                className="h-full"
                style={{
                  width: `${item.Condition * 100}%`,
                  background:
                    item.Condition > 0.5
                      ? 'var(--status-success)'
                      : item.Condition > 0.25
                        ? 'var(--status-warning)'
                        : 'var(--status-error)',
                  borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                }}
              />
            </div>
          )}
        </>
      ) : (
        <span className="text-[10px] text-[var(--text-muted)] opacity-40 select-none">
          {position + 1}
        </span>
      )}
    </div>
  )
}
