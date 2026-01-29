/**
 * Rust Items Library
 *
 * Fetches and manages Rust game item data from external source.
 * Used by ItemBrowser for item selection in the Kit Manager.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Rust item data structure from external API
 */
export interface RustItem {
  /** Internal item ID */
  itemid: number
  /** Item shortname (e.g., "rifle.ak") */
  shortname: string
  /** Display name */
  Name: string
  /** Item description */
  Description: string
  /** Item category (Weapon, Attire, etc.) */
  Category: string
  /** Max stack size for dragging */
  maxDraggable: number
  /** Item type classification */
  ItemType: string
  /** Amount type */
  AmountType: string
  /** Max stack size */
  stackable: number
  /** Quick despawn flag */
  quickDespawn: boolean
  /** Item rarity */
  rarity: string
  /** Condition settings */
  condition: {
    enabled: boolean
    max: number
    repairable: boolean
  }
  /** Parent item ID */
  Parent: number
  /** Can be worn as clothing/armor */
  isWearable: boolean
  /** Can be held in hand */
  isHoldable: boolean
  /** Can be used/consumed */
  isUsable: boolean
  /** Has workshop skins */
  HasSkins: boolean
}

// =============================================================================
// Constants
// =============================================================================

/**
 * External URL for Rust item data
 * Source: Community-maintained item list
 */
export const RUST_ITEMS_URL =
  'https://raw.githubusercontent.com/SzyMig/Rust-item-list-JSON/refs/heads/main/Rust-Items.json'

/**
 * Base URL for Rust item images
 * Hosted on Icefuse CDN
 */
export const RUST_ITEM_CDN = 'https://cdn.icefuse.com/rust/items'

/**
 * Item categories in display order
 */
export const ITEM_CATEGORIES = [
  'Weapon',
  'Ammunition',
  'Attire',
  'Tool',
  'Medical',
  'Food',
  'Resources',
  'Component',
  'Construction',
  'Items',
  'Electrical',
  'Fun',
  'Misc',
] as const

export type ItemCategory = (typeof ITEM_CATEGORIES)[number]

// =============================================================================
// Functions
// =============================================================================

/**
 * Build item image URL from shortname
 *
 * @param shortname - Rust item shortname (e.g., "rifle.ak")
 * @returns Full URL to item image PNG
 */
export function getItemImageUrl(shortname: string): string {
  return `${RUST_ITEM_CDN}/${shortname}.png`
}

/**
 * Build item JSON data URL from shortname
 *
 * @param shortname - Rust item shortname (e.g., "rifle.ak")
 * @returns Full URL to item JSON data
 */
export function getItemJsonUrl(shortname: string): string {
  return `${RUST_ITEM_CDN}/${shortname}.json`
}

/**
 * Fetch all Rust items via server-side proxy
 *
 * Uses /api/v1/items which fetches from upstream server-side
 * (bypasses browser CSP restrictions on raw.githubusercontent.com)
 *
 * @returns Array of RustItem objects
 */
export async function fetchRustItems(): Promise<RustItem[]> {
  const response = await fetch('/api/v1/items')

  if (!response.ok) {
    throw new Error('Failed to fetch')
  }

  return response.json()
}

/**
 * Group items by category
 *
 * @param items - Array of RustItem objects
 * @returns Map of category name to items
 */
export function groupItemsByCategory(
  items: RustItem[]
): Record<ItemCategory, RustItem[]> {
  const groups: Record<string, RustItem[]> = {}

  // Initialize all categories
  ITEM_CATEGORIES.forEach((cat) => {
    groups[cat] = []
  })

  // Sort items into categories
  items.forEach((item) => {
    const category = ITEM_CATEGORIES.includes(item.Category as ItemCategory)
      ? item.Category
      : 'Misc'

    groups[category].push(item)
  })

  // Sort items within each category by name
  Object.keys(groups).forEach((cat) => {
    groups[cat].sort((a, b) => a.Name.localeCompare(b.Name))
  })

  return groups as Record<ItemCategory, RustItem[]>
}

/**
 * Search items by shortname or display name
 *
 * @param items - Array of RustItem objects
 * @param query - Search query string
 * @returns Filtered array of items
 */
export function searchItems(items: RustItem[], query: string): RustItem[] {
  if (!query.trim()) return items

  const lowerQuery = query.toLowerCase()

  return items.filter(
    (item) =>
      item.shortname.toLowerCase().includes(lowerQuery) ||
      item.Name.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get item by shortname
 *
 * @param items - Array of RustItem objects
 * @param shortname - Item shortname to find
 * @returns RustItem or undefined
 */
export function getItemByShortname(
  items: RustItem[],
  shortname: string
): RustItem | undefined {
  return items.find(
    (item) => item.shortname.toLowerCase() === shortname.toLowerCase()
  )
}

/**
 * Get wearable items only
 */
export function getWearableItems(items: RustItem[]): RustItem[] {
  return items.filter((item) => item.isWearable)
}

/**
 * Get holdable items only
 */
export function getHoldableItems(items: RustItem[]): RustItem[] {
  return items.filter((item) => item.isHoldable)
}
