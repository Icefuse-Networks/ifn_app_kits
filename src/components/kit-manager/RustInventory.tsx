'use client'

import { useState, useCallback } from 'react'
import { InventorySlot, type ItemSlot } from './InventorySlot'
import { GlassContainer } from '@/components/global/GlassContainer'
import type { Kit, KitItem } from '@/types/kit'
import {
  WEAR_SLOT_NAMES,
  BELT_SLOTS,
  MAIN_INVENTORY_SLOTS,
  WEAR_SLOTS,
} from '@/types/kit'

// =============================================================================
// Types
// =============================================================================

interface RustInventoryProps {
  kit: Kit
  selectedSlot?: ItemSlot
  selectedIndex?: number
  skinImages?: Map<string, string | null>
  onSelect: (slot: ItemSlot, index: number) => void
  onEmptySlotClick?: (slot: ItemSlot, position: number) => void
  onDrop: (
    fromSlot: ItemSlot,
    fromIndex: number,
    toSlot: ItemSlot,
    toPosition: number
  ) => void
  onExternalDrop?: (shortname: string, slot: ItemSlot, position: number) => void
  onContextMenu?: (slot: ItemSlot, index: number, x: number, y: number) => void
}

interface DragOverState {
  slot: ItemSlot
  position: number
}

// =============================================================================
// Constants
// =============================================================================

const SLOT_SIZE = 94
const BELT_SLOT_SIZE = 94
const WEAR_SLOT_SIZE = 94
const SLOT_GAP = 3
const MAIN_COLS = 6
const WEAR_COLS = 2

// =============================================================================
// Component
// =============================================================================

export function RustInventory({
  kit,
  selectedSlot,
  selectedIndex,
  skinImages,
  onSelect,
  onEmptySlotClick,
  onDrop,
  onExternalDrop,
  onContextMenu,
}: RustInventoryProps) {
  const [dragOver, setDragOver] = useState<DragOverState | null>(null)
  const [dragSource, setDragSource] = useState<{
    slot: ItemSlot
    index: number
  } | null>(null)

  const getItemAtPosition = useCallback(
    (items: KitItem[], position: number) => {
      const idx = items.findIndex((i) => i.Position === position)
      return idx !== -1 ? { item: items[idx], index: idx } : null
    },
    []
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent, slot: ItemSlot, index: number) => {
      setDragSource({ slot, index })
      e.dataTransfer.setData(
        'text/plain',
        JSON.stringify({ slot, index })
      )
      e.dataTransfer.effectAllowed = 'move'
    },
    []
  )

  const handleDrop = useCallback(
    (
      e: React.DragEvent,
      targetSlot: ItemSlot,
      targetPosition: number
    ) => {
      e.preventDefault()
      setDragOver(null)

      // Check for external item drop (from ItemBrowser)
      const externalItem = e.dataTransfer.getData('application/x-rust-item')
      if (externalItem && onExternalDrop) {
        onExternalDrop(externalItem, targetSlot, targetPosition)
        return
      }

      // Internal drag and drop between slots
      if (!dragSource) return
      onDrop(dragSource.slot, dragSource.index, targetSlot, targetPosition)
      setDragSource(null)
    },
    [dragSource, onDrop, onExternalDrop]
  )

  const handleSelect = useCallback(
    (slot: ItemSlot, index: number) => {
      onSelect(slot, index)
    },
    [onSelect]
  )

  // Shared slot props factory
  const slotProps = (
    slotType: ItemSlot,
    items: KitItem[],
    pos: number,
    size: number = SLOT_SIZE
  ) => {
    const found = getItemAtPosition(items, pos)
    const skinId = found?.item ? String(found.item.Skin) : undefined
    const skinUrl =
      skinId && skinId !== '0' && skinImages
        ? skinImages.get(skinId) ?? undefined
        : undefined
    return {
      position: pos,
      item: found?.item,
      slotType,
      index: found?.index,
      size,
      skinImageUrl: skinUrl,
      selected:
        selectedSlot === slotType &&
        selectedIndex === found?.index &&
        found?.index !== undefined,
      dragOver:
        dragOver?.slot === slotType && dragOver?.position === pos,
      onSelect: handleSelect,
      onEmptyClick: onEmptySlotClick,
      onContextMenu,
      onDragStart: handleDragStart,
      onDrop: handleDrop,
      onDragOver: (slot: ItemSlot, position: number) =>
        setDragOver({ slot, position }),
      onDragLeave: () => setDragOver(null),
    }
  }

  return (
    <div className="inline-flex gap-4 items-start">
      {/* Left: Clothing / Armor (8 slots, 2x4 with labels) */}
      <GlassContainer
        as="section"
        variant="prominent"
        padding="md"
        radius="md"
        features={{ hoverGlow: false, shadow: false }}
        className="self-start"
      >
        <header className="flex items-center gap-2 mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Clothing
          </h4>
          <span className="text-[10px] text-[var(--text-muted)]">
            {kit.WearItems.length} / {WEAR_SLOTS}
          </span>
        </header>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${WEAR_COLS}, ${WEAR_SLOT_SIZE}px)`,
            gap: SLOT_GAP,
          }}
        >
          {Array.from({ length: WEAR_SLOTS }).map((_, pos) => (
            <div key={`wear-${pos}`} className="flex flex-col items-center gap-1">
              <span
                className="text-[9px] text-[var(--text-muted)] truncate text-center"
                style={{ width: WEAR_SLOT_SIZE }}
                title={WEAR_SLOT_NAMES[pos]}
              >
                {WEAR_SLOT_NAMES[pos]}
              </span>
              <InventorySlot
                {...slotProps('WearItems', kit.WearItems, pos, WEAR_SLOT_SIZE)}
              />
            </div>
          ))}
        </div>
      </GlassContainer>

      {/* Right: Main Inventory + Belt */}
      <div className="flex flex-col gap-4">
        {/* Main Inventory (24 slots, 6x4) */}
        <GlassContainer
          as="section"
          variant="prominent"
          padding="md"
          radius="md"
          features={{ hoverGlow: false, shadow: false }}
        >
          <header className="flex items-center gap-2 mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Inventory
            </h4>
            <span className="text-[10px] text-[var(--text-muted)]">
              {kit.MainItems.length} / {MAIN_INVENTORY_SLOTS}
            </span>
          </header>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${MAIN_COLS}, ${SLOT_SIZE}px)`,
              gap: SLOT_GAP,
            }}
          >
            {Array.from({ length: MAIN_INVENTORY_SLOTS }).map((_, pos) => (
              <InventorySlot
                key={`main-${pos}`}
                {...slotProps('MainItems', kit.MainItems, pos)}
              />
            ))}
          </div>
        </GlassContainer>

        {/* Belt - Hotbar (6 slots) */}
        <GlassContainer
          as="section"
          variant="prominent"
          padding="md"
          radius="md"
          features={{ hoverGlow: false, shadow: false }}
        >
          <header className="flex items-center gap-2 mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Belt
            </h4>
            <span className="text-[10px] text-[var(--text-muted)]">
              {kit.BeltItems.length} / {BELT_SLOTS}
            </span>
          </header>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${BELT_SLOTS}, ${BELT_SLOT_SIZE}px)`,
              gap: SLOT_GAP,
            }}
          >
            {Array.from({ length: BELT_SLOTS }).map((_, pos) => (
              <InventorySlot
                key={`belt-${pos}`}
                {...slotProps('BeltItems', kit.BeltItems, pos, BELT_SLOT_SIZE)}
              />
            ))}
          </div>
        </GlassContainer>
      </div>
    </div>
  )
}
