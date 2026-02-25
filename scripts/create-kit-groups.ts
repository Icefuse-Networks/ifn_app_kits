/**
 * Create Kit Groups
 *
 * Creates 3 category groups across every KitConfig via the REST API,
 * then assigns each kit to the correct group based on name matching.
 *
 * Groups:
 *   Paid Kits       (order 0): Loyal, Legend, Champion, Immortal
 *   General Use     (order 1): everything else
 *   Linking Rewards (order 2): Steam, Discord, Nitro
 *
 * Run with: npx tsx scripts/create-kit-groups.ts
 */

const BASE_URL = 'http://localhost:3020'
const TOKEN    = 'ifn_rust_339aa1fce7b9f91e413c62ab46b0ea3e'

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
}

// ── Name-matching rules ───────────────────────────────────────────────────────

const PAID_NAMES    = ['loyal', 'legend', 'champion', 'immortal']
const LINKING_NAMES = ['steam', 'discord', 'nitro']

function assignGroup(kitName: string): 'paid' | 'general' | 'linking' {
  const lower = kitName.toLowerCase()
  if (PAID_NAMES.some((n)    => lower.includes(n))) return 'paid'
  if (LINKING_NAMES.some((n) => lower.includes(n))) return 'linking'
  return 'general'
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: { ...HEADERS, ...(init?.headers ?? {}) } })
  const json = await res.json() as { success: boolean; data: T; error?: unknown }
  if (!res.ok || !json.success) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${JSON.stringify(json.error)}`)
  return json.data
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface KitConfigBasic {
  id: string
  name: string
  kitData: string
}

interface KitEntry {
  Name: string
  [key: string]: unknown
}

interface KitsData {
  _kits: Record<string, KitEntry>
}

interface CreatedCategory {
  id: string
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching all kit configurations...\n')

  const configs = await apiFetch<KitConfigBasic[]>('/api/kits?full=true')
  console.log(`Found ${configs.length} config(s).\n`)

  let totalKits = 0

  for (const config of configs) {
    console.log(`── Config: "${config.name}" (${config.id})`)

    // 1. Create the 3 categories
    const [paidCat, generalCat, linkingCat] = await Promise.all([
      apiFetch<CreatedCategory>(`/api/kits/${config.id}/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Paid Kits', order: 0 }),
      }),
      apiFetch<CreatedCategory>(`/api/kits/${config.id}/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: 'General Use', order: 1 }),
      }),
      apiFetch<CreatedCategory>(`/api/kits/${config.id}/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Linking Rewards', order: 2 }),
      }),
    ])

    const catMap = {
      paid:    paidCat.id,
      general: generalCat.id,
      linking: linkingCat.id,
    }

    console.log(`   Created categories:`)
    console.log(`     Paid Kits       → ${paidCat.id}`)
    console.log(`     General Use     → ${generalCat.id}`)
    console.log(`     Linking Rewards → ${linkingCat.id}`)

    // 2. Parse kits and assign each one
    let kitsData: KitsData
    try {
      kitsData = JSON.parse(config.kitData) as KitsData
    } catch {
      console.warn(`   [SKIP] kitData is not valid JSON\n`)
      continue
    }

    if (!kitsData._kits || typeof kitsData._kits !== 'object') {
      console.warn(`   [SKIP] no _kits field\n`)
      continue
    }

    const kitEntries = Object.entries(kitsData._kits)
    console.log(`   Assigning ${kitEntries.length} kit(s)...`)

    // Sequential to avoid hammering the API
    for (const [kitName, kit] of kitEntries) {
      const group  = assignGroup(kit.Name)
      const catId  = catMap[group]

      await apiFetch(`/api/kits/${config.id}/kit`, {
        method: 'PATCH',
        body: JSON.stringify({
          kitName,
          updates: { Category: catId, Subcategory: '' },
        }),
      })

      console.log(`     - "${kit.Name}" → ${group} (${catId})`)
      totalKits++
    }

    console.log()
  }

  console.log(`Done. Processed ${totalKits} kit(s) across ${configs.length} config(s).`)
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
