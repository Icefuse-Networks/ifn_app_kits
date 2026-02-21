/**
 * Kit Utility Functions
 *
 * Helper functions for working with kit data.
 */

import type { Kit, KitItem, KitsData } from '@/types/kit'

// NOTE: RUST_ITEM_CDN and getItemImageUrl are defined in @/lib/rust-items.ts
// Import from there to avoid duplication

// =============================================================================
// Kit Data Parsing
// =============================================================================

/**
 * Parse kit data from string or return as-is if already parsed
 *
 * @param kitData - JSON string or KitsData object
 * @returns Parsed KitsData object
 */
export function parseKitData(kitData: string | KitsData): KitsData {
  if (typeof kitData === 'string') {
    return JSON.parse(kitData) as KitsData
  }
  return kitData
}

/**
 * Safely parse kit data, returning null on error
 */
export function safeParseKitData(kitData: string | KitsData): KitsData | null {
  try {
    return parseKitData(kitData)
  } catch {
    return null
  }
}

/**
 * Stringify kit data for database storage
 *
 * @param kitData - KitsData object
 * @returns JSON string
 */
export function stringifyKitData(kitData: KitsData): string {
  return JSON.stringify(kitData)
}

// =============================================================================
// Kit Statistics
// =============================================================================

/**
 * Count total kits in a config
 *
 * @param kitsData - KitsData object
 * @returns Number of kits
 */
export function countKits(kitsData: KitsData): number {
  return Object.keys(kitsData._kits || {}).length
}

/**
 * Count total items in a kit
 *
 * @param kit - Kit object
 * @returns Total number of items across all slots
 */
export function countKitItems(kit: Kit): number {
  return (
    (kit.MainItems?.length || 0) +
    (kit.WearItems?.length || 0) +
    (kit.BeltItems?.length || 0)
  )
}

/**
 * Get all unique item shortnames from a kit
 *
 * @param kit - Kit object
 * @returns Array of unique shortnames
 */
export function getKitItemShortnames(kit: Kit): string[] {
  const shortnames = new Set<string>()

  const addItems = (items: KitItem[] | undefined) => {
    if (!items) return
    items.forEach((item) => {
      shortnames.add(item.Shortname)
      if (item.Contents) {
        item.Contents.forEach((content) => shortnames.add(content.Shortname))
      }
    })
  }

  addItems(kit.MainItems)
  addItems(kit.WearItems)
  addItems(kit.BeltItems)

  return Array.from(shortnames)
}

/**
 * Get all kit names from a config
 */
export function getKitNames(kitsData: KitsData): string[] {
  return Object.keys(kitsData._kits || {})
}

/**
 * Get a specific kit by name
 */
export function getKitByName(kitsData: KitsData, name: string): Kit | undefined {
  return kitsData._kits?.[name]
}

// =============================================================================
// Kit Validation
// =============================================================================

/**
 * Check if kit data is valid
 */
export function isValidKitsData(data: unknown): data is KitsData {
  if (!data || typeof data !== 'object') {
    return false
  }

  const kitsData = data as KitsData

  if (!kitsData._kits || typeof kitsData._kits !== 'object') {
    return false
  }

  return true
}

/**
 * Check if a kit has any items
 */
export function kitHasItems(kit: Kit): boolean {
  return countKitItems(kit) > 0
}

// =============================================================================
// Kit Transformation
// =============================================================================

/**
 * Create an empty kit template
 */
export function createEmptyKit(name: string, description: string = '', order: number = 0): Kit {
  return {
    Name: name,
    Description: description,
    RequiredPermission: '',
    MaximumUses: -1,
    RequiredAuth: 0,
    Cooldown: 0,
    Cost: 0,
    IsHidden: false,
    HideWithoutPermission: false,
    IsAutoKit: false,
    IsStoreKit: false,
    CopyPasteFile: '',
    KitImage: '',
    KitColor: '',
    Order: order,
    Category: undefined,
    Subcategory: undefined,
    MainItems: [],
    WearItems: [],
    BeltItems: [],
  }
}

/**
 * Create an empty kits data structure
 */
export function createEmptyKitsData(): KitsData {
  return {
    _kits: {},
    _categories: {},
  }
}

/**
 * Add a kit to kits data
 */
export function addKit(kitsData: KitsData, name: string, kit: Kit): KitsData {
  return {
    ...kitsData,
    _kits: {
      ...kitsData._kits,
      [name]: kit,
    },
  }
}

/**
 * Remove a kit from kits data
 */
export function removeKit(kitsData: KitsData, name: string): KitsData {
  const { [name]: _removed, ...remainingKits } = kitsData._kits
  return {
    ...kitsData,
    _kits: remainingKits,
  }
}

/**
 * Rename a kit in kits data
 */
export function renameKit(
  kitsData: KitsData,
  oldName: string,
  newName: string
): KitsData {
  const kit = kitsData._kits[oldName]
  if (!kit) return kitsData

  const { [oldName]: _removed, ...remainingKits } = kitsData._kits
  return {
    ...kitsData,
    _kits: {
      ...remainingKits,
      [newName]: { ...kit, Name: newName },
    },
  }
}

// =============================================================================
// Item Helpers
// =============================================================================

/**
 * Create an empty kit item
 */
export function createEmptyItem(shortname: string, position: number = -1): KitItem {
  return {
    Shortname: shortname,
    Skin: 0,
    Amount: 1,
    Condition: 1,
    MaxCondition: 1,
    Ammo: 0,
    Ammotype: null,
    Position: position,
    Frequency: 0,
    BlueprintShortname: null,
    Contents: null,
  }
}

/**
 * Calculate total item count including nested contents
 */
export function getTotalItemCount(items: KitItem[]): number {
  let count = 0

  for (const item of items) {
    count += item.Amount
    if (item.Contents) {
      count += getTotalItemCount(item.Contents)
    }
  }

  return count
}
