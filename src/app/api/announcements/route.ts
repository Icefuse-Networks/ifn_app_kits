import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId");

    let announcements;
    if (serverId) {
      announcements = await prisma.announcement.findMany({
        where: {
          OR: [{ isGlobal: true }, { serverAssignments: { some: { serverId } } }],
          isActive: true,
        },
        include: { serverAssignments: true },
        orderBy: [{ isGlobal: "desc" }, { createdAt: "desc" }],
      });
    } else {
      announcements = await prisma.announcement.findMany({
        where: { isActive: true },
        include: { serverAssignments: true },
        orderBy: [{ isGlobal: "desc" }, { createdAt: "desc" }],
      });
    }

    return NextResponse.json({ announcements: announcements.map(serializeAnnouncement) });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, delay, serverIds, isGlobal, showCardNotification, cardDisplayDuration } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required and must be a non-empty string" }, { status: 400 });
    }

    if (!isGlobal && (!serverIds || !Array.isArray(serverIds) || serverIds.length === 0)) {
      return NextResponse.json({ error: "At least one server must be selected for non-global announcements" }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        text: text.trim(),
        delay: showCardNotification ? delay : 0,
        isGlobal: !!isGlobal,
        isActive: true,
        showCardNotification: showCardNotification || false,
        cardDisplayDuration: showCardNotification ? cardDisplayDuration : null,
        serverAssignments: isGlobal ? undefined : { create: serverIds.map((serverId: string) => ({ serverId })) },
      },
      include: { serverAssignments: true },
    });

    return NextResponse.json({ announcement: serializeAnnouncement(announcement) }, { status: 201 });
  } catch (error) {
    console.error("Error creating announcement:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, text, delay, serverIds, isGlobal, isActive, showCardNotification, cardDisplayDuration } = body;

    if (!id || !Number.isInteger(id)) {
      return NextResponse.json({ error: "Valid announcement ID is required" }, { status: 400 });
    }

    const updateData: Partial<{
      text: string
      isActive: boolean
      isGlobal: boolean
      showCardNotification: boolean
      delay: number
      cardDisplayDuration: number | null
    }> = {};
    if (text !== undefined) updateData.text = text.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isGlobal !== undefined) updateData.isGlobal = isGlobal;
    if (showCardNotification !== undefined) updateData.showCardNotification = showCardNotification;
    if (showCardNotification !== undefined) {
      if (showCardNotification) {
        if (delay !== undefined) updateData.delay = delay;
        if (cardDisplayDuration !== undefined) updateData.cardDisplayDuration = cardDisplayDuration;
      } else {
        updateData.delay = 0;
        updateData.cardDisplayDuration = null;
      }
    } else {
      if (delay !== undefined) updateData.delay = delay;
      if (cardDisplayDuration !== undefined) updateData.cardDisplayDuration = cardDisplayDuration;
    }

    const announcement = await prisma.$transaction(async (tx) => {
      const updated = await tx.announcement.update({ where: { id }, data: updateData, include: { serverAssignments: true } });
      if (serverIds !== undefined || isGlobal !== undefined) {
        await tx.announcementServer.deleteMany({ where: { announcementId: id } });
        if (!updated.isGlobal && serverIds && serverIds.length > 0) {
          await tx.announcementServer.createMany({ data: serverIds.map((serverId: string) => ({ announcementId: id, serverId })) });
        }
      }
      return await tx.announcement.findUnique({ where: { id }, include: { serverAssignments: true } });
    });

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    return NextResponse.json({ announcement: serializeAnnouncement(announcement) });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    console.error("Error updating announcement:", error);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || !Number.isInteger(parseInt(id))) {
      return NextResponse.json({ error: "Valid announcement ID is required" }, { status: 400 });
    }

    await prisma.announcement.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    console.error("Error deleting announcement:", error);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
