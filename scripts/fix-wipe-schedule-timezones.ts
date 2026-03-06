/**
 * Fix Wipe Schedule Timezones
 *
 * Converts EU (Europe/London) server wipe schedules from local time to EST.
 * US servers are already EST and are not modified.
 *
 * Usage:
 *   npx tsx scripts/fix-wipe-schedule-timezones.ts
 *   npx tsx scripts/fix-wipe-schedule-timezones.ts --dry-run
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

function getTimezoneOffset(tz: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = date.toLocaleString('en-US', { timeZone: tz })
  return new Date(utcStr).getTime() - new Date(tzStr).getTime()
}

function convertToEst(hour: number, minute: number, dow: number, fromTz: string): { hour: number; minute: number; dow: number } {
  const base = new Date()
  const diff = (dow - base.getDay() + 7) % 7
  base.setDate(base.getDate() + diff)
  const dateStr = base.toISOString().split('T')[0]
  const srcDate = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)
  const srcOffset = getTimezoneOffset(fromTz, srcDate)
  const estOffset = getTimezoneOffset('America/New_York', srcDate)
  const diffMs = estOffset - srcOffset
  const result = new Date(srcDate.getTime() + diffMs)
  return { hour: result.getHours(), minute: result.getMinutes(), dow: result.getDay() }
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===')

  // Find all EU servers (timezone = Europe/London)
  const euServers = await prisma.serverIdentifier.findMany({
    where: { timezone: 'Europe/London' },
    select: { id: true, name: true, timezone: true },
  })

  if (euServers.length === 0) {
    console.log('No EU (Europe/London) servers found. Nothing to do.')
    return
  }

  console.log(`Found ${euServers.length} EU server(s):`)
  for (const s of euServers) {
    console.log(`  - ${s.name} (${s.id})`)
  }

  const euServerIds = euServers.map(s => s.id)

  // Find all active wipe schedules for EU servers
  const schedules = await prisma.wipeSchedule.findMany({
    where: { serverIdentifierId: { in: euServerIds }, isActive: true },
  })

  if (schedules.length === 0) {
    console.log('No active wipe schedules found for EU servers.')
    return
  }

  console.log(`\nFound ${schedules.length} schedule(s) to convert:\n`)

  for (const schedule of schedules) {
    const serverName = euServers.find(s => s.id === schedule.serverIdentifierId)?.name || schedule.serverIdentifierId
    const est = convertToEst(schedule.hour, schedule.minute, schedule.dayOfWeek, 'Europe/London')

    const before = `${DAYS[schedule.dayOfWeek]} ${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')} London`
    const after = `${DAYS[est.dow]} ${String(est.hour).padStart(2, '0')}:${String(est.minute).padStart(2, '0')} EST`

    console.log(`  [${serverName}] ${schedule.wipeType}: ${before} -> ${after}`)

    if (!dryRun) {
      await prisma.wipeSchedule.update({
        where: { id: schedule.id },
        data: {
          dayOfWeek: est.dow,
          hour: est.hour,
          minute: est.minute,
        },
      })
    }
  }

  console.log(dryRun ? '\nDry run complete. No changes made.' : '\nDone. All EU schedules converted to EST.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
