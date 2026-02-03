import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const mappings = await prisma.lootMapping.findMany({
      include: {
        config: { select: { id: true, name: true, currentVersion: true, publishedVersion: true } },
        serverIdentifier: { select: { id: true, name: true, hashedId: true, ip: true, port: true } },
      },
      orderBy: [{ serverIdentifierId: "asc" }, { minutesAfterWipe: "asc" }],
    });
    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Error fetching loot mappings:", error);
    return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { configId, serverIdentifierId, isLive, minutesAfterWipe } = body;

    if (!configId || !serverIdentifierId) {
      return NextResponse.json({ error: "configId and serverIdentifierId are required" }, { status: 400 });
    }

    const minutes = minutesAfterWipe !== undefined && minutesAfterWipe !== null ? minutesAfterWipe : null;

    const mapping = await prisma.lootMapping.create({
      data: { configId, serverIdentifierId, isLive: isLive ?? false, minutesAfterWipe: minutes },
      include: {
        config: { select: { id: true, name: true, currentVersion: true, publishedVersion: true } },
        serverIdentifier: { select: { id: true, name: true, hashedId: true, ip: true, port: true } },
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error("Error creating loot mapping:", error);
    return NextResponse.json({ error: "Failed to create mapping" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Mapping id is required" }, { status: 400 });
    }

    await prisma.lootMapping.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting loot mapping:", error);
    return NextResponse.json({ error: "Failed to delete mapping" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isLive, minutesAfterWipe, configId } = body;

    if (!id) {
      return NextResponse.json({ error: "Mapping id is required" }, { status: 400 });
    }

    const data: { isLive?: boolean; minutesAfterWipe?: number | null; configId?: number } = {};
    if (isLive !== undefined) data.isLive = isLive;
    if (minutesAfterWipe !== undefined) data.minutesAfterWipe = minutesAfterWipe;
    if (configId !== undefined) data.configId = configId;

    const mapping = await prisma.lootMapping.update({
      where: { id },
      data,
      include: {
        config: { select: { id: true, name: true, currentVersion: true, publishedVersion: true } },
        serverIdentifier: { select: { id: true, name: true, hashedId: true, ip: true, port: true } },
      },
    });

    return NextResponse.json(mapping);
  } catch (error) {
    console.error("Error updating loot mapping:", error);
    return NextResponse.json({ error: "Failed to update mapping" }, { status: 500 });
  }
}
