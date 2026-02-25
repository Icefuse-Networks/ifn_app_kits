/**
 * Update VIP Kit Images
 *
 * One-time script to update KitImage URLs for all VIP-tier kits
 * across every KitConfig in the database.
 *
 * VIP tiers matched by exact kit Name:
 *   Loyal, Legend, Champion, Immortal, Eternal
 *
 * Run with: npx tsx scripts/update-vip-kit-images.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VIP_IMAGE_MAP: Record<string, string> = {
  Loyal:    'https://cdn.icefuse.com/products/ranks/loyal.webp',
  Legend:   'https://cdn.icefuse.com/products/ranks/legend.webp',
  Champion: 'https://cdn.icefuse.com/products/ranks/champion.webp',
  Immortal: 'https://cdn.icefuse.com/products/ranks/immortal.webp',
  Eternal:  'https://cdn.icefuse.com/products/ranks/eternal.webp',
}

interface KitEntry {
  Name: string
  KitImage?: string
  [key: string]: unknown
}

interface KitsData {
  _kits: Record<string, KitEntry>
  [key: string]: unknown
}

async function main() {
  console.log('Fetching all kit configurations...')
  const configs = await prisma.kitConfig.findMany({
    select: { id: true, name: true, kitData: true },
  })

  console.log(`Found ${configs.length} kit config(s).\n`)

  let totalUpdated = 0

  for (const config of configs) {
    let kitsData: KitsData
    try {
      kitsData = JSON.parse(config.kitData) as KitsData
    } catch {
      console.warn(`  [SKIP] Config "${config.name}" (${config.id}): kitData is not valid JSON`)
      continue
    }

    if (!kitsData._kits || typeof kitsData._kits !== 'object') {
      console.warn(`  [SKIP] Config "${config.name}" (${config.id}): no _kits field`)
      continue
    }

    const updatedInConfig: string[] = []

    for (const [kitKey, kit] of Object.entries(kitsData._kits)) {
      const kitName = kit.Name
      const newImage = VIP_IMAGE_MAP[kitName]

      if (newImage && kit.KitImage !== newImage) {
        kitsData._kits[kitKey] = { ...kit, KitImage: newImage }
        updatedInConfig.push(`${kitKey} (Name: "${kitName}")`)
        totalUpdated++
      }
    }

    if (updatedInConfig.length > 0) {
      await prisma.kitConfig.update({
        where: { id: config.id },
        data: { kitData: JSON.stringify(kitsData) },
      })
      console.log(`  [UPDATED] Config "${config.name}" (${config.id})`)
      for (const kit of updatedInConfig) {
        console.log(`    - ${kit}`)
      }
    } else {
      console.log(`  [NO CHANGE] Config "${config.name}" (${config.id})`)
    }
  }

  console.log(`\nDone. Updated ${totalUpdated} VIP kit image(s) across ${configs.length} config(s).`)
}

main()
  .catch((err) => {
    console.error('Script failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
