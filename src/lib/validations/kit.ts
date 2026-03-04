/**
 * Kit Validation Schemas
 *
 * Zod schemas for kit configs, kit items, categories, groups, and perks.
 * SECURITY: All inputs are validated before processing.
 */

import { z } from 'zod'
import { validatePrefixedId } from '@/lib/id'

// =============================================================================
// Kit Item Schemas
// =============================================================================

const kitItemSchemaBase = z.object({
  Shortname: z.string().min(1).max(100),
  Skin: z.union([z.number(), z.string()]),
  Amount: z.number().int().min(1),
  Condition: z.number().min(0).max(100),
  MaxCondition: z.number().min(0).max(100),
  Ammo: z.number().int().min(0),
  Ammotype: z.string().nullable(),
  Position: z.number().int().min(-1),
  Frequency: z.number().int().min(0),
  BlueprintShortname: z.string().nullable(),
})

type KitItemInput = z.infer<typeof kitItemSchemaBase> & {
  Contents: KitItemInput[] | null
}

export const kitItemSchema: z.ZodType<KitItemInput> = kitItemSchemaBase.extend({
  Contents: z.lazy(() => z.array(kitItemSchema).nullable()),
})

// =============================================================================
// Category Schemas (kitData._categories)
// =============================================================================

export const kitSubcategorySchema = z.object({
  name: z.string().min(1).max(50),
  order: z.number().int().min(0).default(0),
})

export const kitCategorySchema = z.object({
  name: z.string().min(1).max(50),
  order: z.number().int().min(0).default(0),
  subcategories: z.record(z.string(), kitSubcategorySchema).default({}),
})

// =============================================================================
// Kit Schemas
// =============================================================================

export const kitSchema = z.object({
  Name: z.string().min(1).max(100),
  Description: z.string().max(500).default(''),
  RequiredPermission: z.string().max(200).default(''),
  MaximumUses: z.number().int().min(-1).default(-1),
  RequiredAuth: z.number().int().min(0).default(0),
  Cooldown: z.number().min(0).default(0),
  Cost: z.number().min(0).default(0),
  IsHidden: z.boolean().default(false),
  HideWithoutPermission: z.boolean().default(false),
  IsAutoKit: z.boolean().default(false),
  IsStoreKit: z.boolean().default(false),
  CopyPasteFile: z.string().max(200).default(''),
  KitImage: z.string().max(500).default(''),
  KitColor: z.string().max(20).default(''),
  Order: z.number().int().min(0).default(0),
  Category: z.string().max(50).optional(),
  Subcategory: z.string().max(50).optional(),
  MainItems: z.array(kitItemSchema).max(24).default([]),
  WearItems: z.array(kitItemSchema).max(8).default([]),
  BeltItems: z.array(kitItemSchema).max(6).default([]),
  uuid: z.string().uuid().optional(),
})

export const kitsDataSchema = z.object({
  _comment: z.string().optional(),
  _kits: z.record(z.string(), kitSchema),
  _categories: z.record(z.string(), kitCategorySchema).optional(),
  'AutoKits Priority': z.array(z.string()).optional(),
  'Post wipe cooldowns (kit name | seconds)': z.record(z.string(), z.number()).optional(),
})

// =============================================================================
// Kit Config Schemas
// =============================================================================

export const createKitConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string().max(500).nullable().optional(),
  kitData: z.union([
    z.string().min(2).max(10_000_000),
    kitsDataSchema,
  ]),
  storeData: z.string().max(10_000_000).nullable().optional(),
})

export const updateKitConfigSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).nullable().optional(),
  kitData: z.union([z.string().min(2).max(10_000_000), kitsDataSchema]).optional(),
  storeData: z.string().max(10_000_000).nullable().optional(),
})

export const kitConfigIdSchema = z.object({
  id: z.string().refine(validatePrefixedId('category'), {
    message: 'Invalid category ID format',
  }),
})

export const kitIdSchema = z.object({
  id: z.string().refine(validatePrefixedId('kit'), {
    message: 'Invalid kit ID format',
  }),
})

export const cloneKitConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string().max(500).nullable().optional(),
})

// =============================================================================
// Individual Kit Operations
// =============================================================================

export const patchKitSchema = z.object({
  kitName: z.string().min(1).max(100),
  updates: kitSchema.partial(),
})

export const addKitSchema = z.object({
  kitName: z.string().min(1).max(100),
  kit: kitSchema,
})

export const deleteKitSchema = z.object({
  kitName: z.string().min(1).max(100),
})

// =============================================================================
// Kit Category & Group Operations
// =============================================================================

export const createKitCategorySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  order: z.number().int().min(0).optional(),
})

export const updateKitCategorySchema = z.object({
  catId: z.string().min(1).max(100),
  name: z.string().min(1).max(100).trim().optional(),
  order: z.number().int().min(0).optional(),
})

export const deleteKitCategorySchema = z.object({
  catId: z.string().min(1).max(100),
})

export const createKitGroupSchema = z.object({
  catId: z.string().min(1).max(100),
  name: z.string().min(1).max(100).trim(),
  order: z.number().int().min(0).optional(),
})

export const updateKitGroupSchema = z.object({
  catId: z.string().min(1).max(100),
  groupId: z.string().min(1).max(100),
  name: z.string().min(1).max(100).trim().optional(),
  order: z.number().int().min(0).optional(),
})

export const deleteKitGroupSchema = z.object({
  catId: z.string().min(1).max(100),
  groupId: z.string().min(1).max(100),
})

// =============================================================================
// Perk Schemas
// =============================================================================

export const perkSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(1000),
})

export const perkCategorySchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  perks: z.array(perkSchema),
  collapsed: z.boolean().optional(),
})

export const perksDataSchema = z.object({
  categories: z.array(perkCategorySchema),
  uncategorized: z.array(perkSchema),
})

export const putKitPerksSchema = z.object({
  kitId: z.string().min(1).max(100),
  perks: perksDataSchema,
})

export const deleteKitPerksSchema = z.object({
  kitId: z.string().min(1).max(100),
})

// =============================================================================
// Type Exports
// =============================================================================

export type CreateKitConfigInput = z.infer<typeof createKitConfigSchema>
export type UpdateKitConfigInput = z.infer<typeof updateKitConfigSchema>
export type CloneKitConfigInput = z.infer<typeof cloneKitConfigSchema>
export type PatchKitInput = z.infer<typeof patchKitSchema>
export type AddKitInput = z.infer<typeof addKitSchema>
export type DeleteKitInput = z.infer<typeof deleteKitSchema>
export type CreateKitCategoryInput = z.infer<typeof createKitCategorySchema>
export type UpdateKitCategoryInput = z.infer<typeof updateKitCategorySchema>
export type DeleteKitCategoryInput = z.infer<typeof deleteKitCategorySchema>
export type CreateKitGroupInput = z.infer<typeof createKitGroupSchema>
export type UpdateKitGroupInput = z.infer<typeof updateKitGroupSchema>
export type DeleteKitGroupInput = z.infer<typeof deleteKitGroupSchema>
export type PerkInput = z.infer<typeof perkSchema>
export type PerkCategoryInput = z.infer<typeof perkCategorySchema>
export type PerksDataInput = z.infer<typeof perksDataSchema>
export type PutKitPerksInput = z.infer<typeof putKitPerksSchema>
export type DeleteKitPerksInput = z.infer<typeof deleteKitPerksSchema>
