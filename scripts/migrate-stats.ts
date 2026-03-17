/**
 * Stats Migration Script
 *
 * Migrates player stats from the old ifn_app_main ClickHouse tables (ruststats*)
 * to the new ifn_app_kits tables (rust_player_stats_*) with new server IDs.
 *
 * Reads from old DB, remaps server IDs, batch inserts into new DB.
 *
 * Usage:
 *   npx tsx scripts/migrate-stats.ts [--dry-run]
 */

import { createClient } from '@clickhouse/client'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 10000

// Old → New server ID mapping
const SERVER_MAP: Record<string, string> = {
  '343384': 'serverid_05f39854-aa0e-4754-b3e2-07523292ecb5', // us_3x_amigos
  '691432': 'serverid_dd9dacc2-610a-4e51-8d73-d33b8d0b64f1', // us_3x_havoc
  '345469': 'serverid_7e132bc4-d57c-46fa-b866-296ec9777531', // us_5x_alpha
  '939846': 'serverid_75014add-5e20-491c-9142-69de6c3278ce', // us_10x_omega
  '918573': 'serverid_ff7b2469-ba63-406e-869a-65ee3509c3d6', // us_20x_phoenix
  '644288': 'serverid_e8c71903-e693-4c03-ac5b-4c0b2aadf8cc', // us_100x_kamikaze
  '684253': 'serverid_bcbdc573-8bf6-485f-8d86-cf1c6189777c', // us_vanilla
  '587255': 'serverid_a115581b-1dd2-49c1-a9f4-d0239c0c2b8c', // us_2x_oblivion
  '196837': 'serverid_6176e936-219d-48b6-a0ba-68cc7deb1aa4', // eu_100x_velocity
  '918635': 'serverid_03f5e193-15b8-4ccb-85c6-566e8a41212e', // eu_5x_echo
  '735943': 'serverid_69d1a430-e7d9-4e27-bd68-3593108d83d2', // us_1000000x
  '462688': 'serverid_c2c6f8d1-20db-47be-81ea-2244bc91f548', // eu_1000000x
  '912853': 'serverid_6f59c47a-7dbb-4b92-9db5-0522cbef9098', // eu_vanilla
  '521234': 'serverid_f840e22a-3e7a-4c1a-aba7-9b29d2126654', // us_5x_vanguard
}

const OLD_IDS = Object.keys(SERVER_MAP)

// Table mapping
const TABLES = [
  { old: 'ruststats',         new: 'rust_player_stats_wipe',    label: 'wipe' },
  { old: 'ruststats_monthly', new: 'rust_player_stats_monthly', label: 'monthly' },
  { old: 'ruststats_overall', new: 'rust_player_stats_overall', label: 'overall' },
]

async function main() {
  console.log(`[migrate] Stats Migration (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`)

  const oldCH = createClient({
    url: 'http://168.100.163.49:8124',
    username: 'default',
    password: 'DvqUTqWMe7cQ9NJme83coT48RA0ex3D7lgnWO1fhhkFQp4oVneM93WwrMpwGDl90',
    database: 'default',
  })

  const newCH = createClient({
    url: 'http://104.129.132.73:8124',
    username: 'ifn_analytics',
    password: 'kpsnylcmnaaarc25qbbfgowykmhynez4',
    database: 'analytics',
  })

  try {
    for (const t of TABLES) {
      console.log(`\n[migrate] === ${t.label}: ${t.old} -> ${t.new} ===`)

      const placeholders = OLD_IDS.map((_, i) => `{id${i}:String}`).join(', ')
      const params: Record<string, string> = {}
      OLD_IDS.forEach((id, i) => { params[`id${i}`] = id })

      // Count
      const countRes = await oldCH.query({
        query: `SELECT count() as cnt FROM ${t.old} WHERE server_id IN (${placeholders})`,
        query_params: params,
        format: 'JSONEachRow',
      })
      const total = Number((await countRes.json<{ cnt: string }>())[0]?.cnt || 0)
      console.log(`[migrate] ${total} rows to migrate`)

      if (total === 0) continue

      let migrated = 0
      let offset = 0

      while (offset < total) {
        const batchRes = await oldCH.query({
          query: `SELECT * FROM ${t.old} WHERE server_id IN (${placeholders}) ORDER BY server_id, steamid LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
          query_params: params,
          format: 'JSONEachRow',
        })
        const rows = await batchRes.json<Record<string, unknown>>()
        if (rows.length === 0) break

        const transformed = rows.map(row => ({
          server_id: SERVER_MAP[row.server_id as string] || row.server_id,
          steamid: row.steamid,
          name: row.name || '',
          avatar: row.avatar || '',
          clan: row.clan || '',
          kills: Number(row.kills) || 0,
          deaths: Number(row.deaths) || 0,
          kdr: Number(row.kdr) || 0,
          playtime: Number(row.playtime) || 0,
          tcs_destroyed: Number(row.tcs_destroyed) || 0,
          c4_thrown: Number(row.c4_thrown) || 0,
          rockets_launched: Number(row.rockets_launched) || 0,
          c4_crafted: Number(row.c4_crafted) || 0,
          rockets_crafted: Number(row.rockets_crafted) || 0,
          container_points: Number(row.container_points) || 0,
          weapon_kills: row.weapon_kills || '{}',
          points: Number(row.points) || 0,
          updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        }))

        if (!DRY_RUN) {
          await newCH.insert({
            table: t.new,
            values: transformed,
            format: 'JSONEachRow',
          })
        }

        migrated += rows.length
        offset += BATCH_SIZE
        console.log(`[migrate] ${t.label}: ${migrated}/${total}`)
      }

      console.log(`[migrate] ${t.label}: done (${migrated} rows ${DRY_RUN ? 'would be' : ''} migrated)`)
    }

    console.log('\n[migrate] Done!')
  } catch (error) {
    console.error('[migrate] Failed:', error)
    process.exit(1)
  } finally {
    await oldCH.close()
    await newCH.close()
  }
}

main()
