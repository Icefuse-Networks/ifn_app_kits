/**
 * Kit Type Definitions
 *
 * Defines the structure of kit data stored in the database.
 * Based on the Rust Kits plugin data format.
 */

// =============================================================================
// Kit Item Types
// =============================================================================

/**
 * Individual item within a kit
 * Matches the Rust Kits plugin item format
 */
export interface KitItem {
  /** Rust item shortname (e.g., "rifle.ak", "metal.facemask") */
  Shortname: string
  /** Skin ID (workshop skin) */
  Skin: number | string
  /** Stack amount */
  Amount: number
  /** Item condition (0-1, where 1 = 100%) */
  Condition: number
  /** Maximum condition (usually 1) */
  MaxCondition: number
  /** Ammo count (for weapons) */
  Ammo: number
  /** Ammo type shortname (e.g., "ammo.rifle") */
  Ammotype: string | null
  /** Inventory slot position (-1 = auto) */
  Position: number
  /** RF frequency (for RF devices) */
  Frequency: number
  /** Blueprint shortname (if item is a blueprint) */
  BlueprintShortname: string | null
  /** Nested items (for containers like backpacks) */
  Contents: KitItem[] | null
}

// =============================================================================
// Kit Types
// =============================================================================

/**
 * Individual kit definition
 */
export interface Kit {
  /** Display name of the kit */
  Name: string
  /** Description shown to players */
  Description: string
  /** Permission required to use (e.g., "kits.vip") */
  RequiredPermission: string
  /** Max times kit can be used (-1 = unlimited) */
  MaximumUses: number
  /** Required auth level (0 = none, 1 = steam auth) */
  RequiredAuth: number
  /** Cooldown in seconds between uses */
  Cooldown: number
  /** Cost to redeem (in-game currency) */
  Cost: number
  /** Hidden from kit list */
  IsHidden: boolean
  /** Copy/paste file reference */
  CopyPasteFile: string
  /** Kit image URL */
  KitImage: string
  /** Main inventory items (24 slots) */
  MainItems: KitItem[]
  /** Wear items - armor/clothing (8 slots) */
  WearItems: KitItem[]
  /** Belt items - hotbar (6 slots) */
  BeltItems: KitItem[]
  /** Unique identifier */
  uuid?: string
}

/**
 * Full kit data structure stored in KitConfig.kitData
 */
export interface KitsData {
  /** Optional comment/description */
  _comment?: string
  /** Map of kit name to kit definition */
  _kits: Record<string, Kit>
  /** Auto-kit priority order */
  'AutoKits Priority'?: string[]
  /** Post-wipe cooldowns (kit name -> seconds) */
  'Post wipe cooldowns (kit name | seconds)'?: Record<string, number>
}

// =============================================================================
// Database Model Types (matching Prisma)
// =============================================================================

/**
 * KitConfig as returned from database
 */
export interface KitConfigRecord {
  id: number
  name: string
  description: string | null
  kitData: string
  storeData: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * KitConfig with parsed kitData
 */
export interface KitConfigParsed extends Omit<KitConfigRecord, 'kitData' | 'storeData'> {
  kitData: KitsData
  storeData: Record<string, unknown> | null
  gameServers?: GameServerBasic[]
  _count?: {
    gameServers: number
  }
}

/**
 * Basic game server info for relationships
 */
export interface GameServerBasic {
  id: number
  name: string
}

/**
 * Full game server record
 */
export interface GameServerRecord {
  id: number
  categoryID: number
  name: string
  ip: string
  port: number
  imageUrl: string
  iconUrl: string
  wipeConfig: string | null
  botToken: string | null
  kitConfigId: number | null
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// Inventory Slot Constants
// =============================================================================

/** Number of main inventory slots */
export const MAIN_INVENTORY_SLOTS = 24

/** Number of wear (clothing/armor) slots */
export const WEAR_SLOTS = 8

/** Number of belt (hotbar) slots */
export const BELT_SLOTS = 6

/** Wear slot names in order (matches Rust inventory layout) */
export const WEAR_SLOT_NAMES = [
  'Head',
  'Chest',
  'Shirt',
  'Pants',
  'Kilt',
  'Boots',
  'Gloves',
  'Back',
] as const

// =============================================================================
// CDN Constants
// =============================================================================

/** Base URL for Rust item images */
export const RUST_ITEM_CDN = 'https://cdn.icefuse.com/rust/items'

/**
 * Build item image URL from shortname
 */
export function getItemImageUrl(shortname: string): string {
  return `${RUST_ITEM_CDN}/${shortname}.png`
}
