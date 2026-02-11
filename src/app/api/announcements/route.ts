import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { translateText } from "@/lib/translator"
import { authenticateWithScope } from "@/services/api-auth"
import { auditCreate, auditUpdate, auditDelete } from "@/services/audit"
import { logger } from "@/lib/logger"

// =============================================================================
// Types
// =============================================================================

interface ServerAssignment {
  id: number
  announcementId: number
  serverId: string
}

interface AnnouncementRecord {
  id: number
  text: string
  delay: number
  isActive: boolean
  isGlobal: boolean
  showCardNotification: boolean
  cardDisplayDuration: number | null
  createdAt: Date
  updatedAt: Date
  serverAssignments?: ServerAssignment[]
}

// =============================================================================
// Zod Schemas
// =============================================================================

// SECURITY: Zod validated
const createSchema = z.object({
  text: z.string().min(1).max(2000).trim(),
  delay: z.number().int().min(0).max(3600).optional().default(0),
  serverIds: z.array(z.string().min(1).max(100)).optional(),
  isGlobal: z.boolean().optional().default(false),
  showCardNotification: z.boolean().optional().default(false),
  cardDisplayDuration: z.number().int().min(0).max(300).nullable().optional(),
})

const updateSchema = z.object({
  id: z.number().int().positive(),
  text: z.string().min(1).max(2000).trim().optional(),
  delay: z.number().int().min(0).max(3600).optional(),
  serverIds: z.array(z.string().min(1).max(100)).optional(),
  isGlobal: z.boolean().optional(),
  isActive: z.boolean().optional(),
  showCardNotification: z.boolean().optional(),
  cardDisplayDuration: z.number().int().min(0).max(300).nullable().optional(),
})

const deleteSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const getSchema = z.object({
  serverId: z.string().min(1).max(100).optional(),
})

// =============================================================================
// Helpers
// =============================================================================

function serializeAnnouncement(a: AnnouncementRecord) {
  return {
    ...a,
    id: Number(a.id),
    delay: Number(a.delay),
    cardDisplayDuration: a.cardDisplayDuration != null ? Number(a.cardDisplayDuration) : null,
    serverAssignments: a.serverAssignments?.map((s) => ({
      ...s,
      id: Number(s.id),
      announcementId: Number(s.announcementId),
    })),
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

export async function GET(request: NextRequest) {
  // SECURITY: Auth check at route start
  const authResult = await authenticateWithScope(request, "announcements:read")
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const params = getSchema.safeParse({ serverId: searchParams.get("serverId") || undefined })
    if (!params.success) {
      return NextResponse.json({ error: "Invalid query parameters", details: params.error.flatten() }, { status: 400 })
    }

    const { serverId } = params.data

    let announcements
    if (serverId) {
      announcements = await prisma.announcement.findMany({
        where: {
          OR: [{ isGlobal: true }, { serverAssignments: { some: { serverId } } }],
          isActive: true,
        },
        include: { serverAssignments: true },
        orderBy: [{ isGlobal: "desc" }, { createdAt: "desc" }],
      })
    } else {
      announcements = await prisma.announcement.findMany({
        where: { isActive: true },
        include: { serverAssignments: true },
        orderBy: [{ isGlobal: "desc" }, { createdAt: "desc" }],
      })
    }

    return NextResponse.json({ announcements: announcements.map(serializeAnnouncement) })
  } catch (error) {
    logger.admin.error("Error fetching announcements", error as Error)
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Auth check at route start
  const authResult = await authenticateWithScope(request, "announcements:write")
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
    }

    const { text, delay, serverIds, isGlobal, showCardNotification, cardDisplayDuration } = parsed.data

    if (!isGlobal && (!serverIds || serverIds.length === 0)) {
      return NextResponse.json({ error: "At least one server must be selected for non-global announcements" }, { status: 400 })
    }

    const translations = await translateText(text)

    const announcement = await prisma.announcement.create({
      data: {
        text,
        textEs: translations.es,
        textFr: translations.fr,
        textDe: translations.de,
        textRu: translations.ru,
        textZh: translations.zh,
        textJa: translations.ja,
        textPt: translations.pt,
        textAr: translations.ar,
        textKo: translations.ko,
        textIt: translations.it,
        delay: showCardNotification ? delay : 0,
        isGlobal,
        isActive: true,
        showCardNotification,
        cardDisplayDuration: showCardNotification ? cardDisplayDuration : null,
        serverAssignments: isGlobal ? undefined : { create: serverIds!.map((serverId: string) => ({ serverId })) },
      },
      include: { serverAssignments: true },
    })

    // SECURITY: Audit logged
    await auditCreate("announcement", String(announcement.id), authResult.context, { text, isGlobal, serverIds }, request)

    return NextResponse.json({ announcement: serializeAnnouncement(announcement) }, { status: 201 })
  } catch (error) {
    logger.admin.error("Error creating announcement", error as Error)
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  // SECURITY: Auth check at route start
  const authResult = await authenticateWithScope(request, "announcements:write")
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
    }

    const { id, text, delay, serverIds, isGlobal, isActive, showCardNotification, cardDisplayDuration } = parsed.data

    // Fetch old values for audit log
    const oldAnnouncement = await prisma.announcement.findUnique({
      where: { id },
      include: { serverAssignments: true },
    })
    if (!oldAnnouncement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (text !== undefined) {
      updateData.text = text
      const translations = await translateText(text)
      updateData.textEs = translations.es
      updateData.textFr = translations.fr
      updateData.textDe = translations.de
      updateData.textRu = translations.ru
      updateData.textZh = translations.zh
      updateData.textJa = translations.ja
      updateData.textPt = translations.pt
      updateData.textAr = translations.ar
      updateData.textKo = translations.ko
      updateData.textIt = translations.it
    }
    if (isActive !== undefined) updateData.isActive = isActive
    if (isGlobal !== undefined) updateData.isGlobal = isGlobal
    if (showCardNotification !== undefined) updateData.showCardNotification = showCardNotification
    if (showCardNotification !== undefined) {
      if (showCardNotification) {
        if (delay !== undefined) updateData.delay = delay
        if (cardDisplayDuration !== undefined) updateData.cardDisplayDuration = cardDisplayDuration
      } else {
        updateData.delay = 0
        updateData.cardDisplayDuration = null
      }
    } else {
      if (delay !== undefined) updateData.delay = delay
      if (cardDisplayDuration !== undefined) updateData.cardDisplayDuration = cardDisplayDuration
    }

    const announcement = await prisma.$transaction(async (tx) => {
      const updated = await tx.announcement.update({ where: { id }, data: updateData, include: { serverAssignments: true } })
      if (serverIds !== undefined || isGlobal !== undefined) {
        await tx.announcementServer.deleteMany({ where: { announcementId: id } })
        if (!updated.isGlobal && serverIds && serverIds.length > 0) {
          await tx.announcementServer.createMany({ data: serverIds.map((serverId: string) => ({ announcementId: id, serverId })) })
        }
      }
      return await tx.announcement.findUnique({ where: { id }, include: { serverAssignments: true } })
    })

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    // SECURITY: Audit logged
    await auditUpdate(
      "announcement",
      String(id),
      authResult.context,
      { text: oldAnnouncement.text, isGlobal: oldAnnouncement.isGlobal, isActive: oldAnnouncement.isActive },
      updateData,
      request
    )

    return NextResponse.json({ announcement: serializeAnnouncement(announcement) })
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }
    logger.admin.error("Error updating announcement", error as Error)
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  // SECURITY: Auth check at route start
  const authResult = await authenticateWithScope(request, "announcements:write")
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { searchParams } = new URL(request.url)

    // SECURITY: Zod validated
    const parsed = deleteSchema.safeParse({ id: searchParams.get("id") })
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid announcement ID is required" }, { status: 400 })
    }

    const { id } = parsed.data

    // Fetch old values for audit log
    const oldAnnouncement = await prisma.announcement.findUnique({ where: { id } })
    if (!oldAnnouncement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    await prisma.announcement.delete({ where: { id } })

    // SECURITY: Audit logged
    await auditDelete(
      "announcement",
      String(id),
      authResult.context,
      { text: oldAnnouncement.text, isGlobal: oldAnnouncement.isGlobal },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }
    logger.admin.error("Error deleting announcement", error as Error)
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 })
  }
}
