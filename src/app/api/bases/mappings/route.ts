import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";

const createMappingSchema = z.object({
  configId: z.number().int().positive(),
  serverIdentifierId: z.string().min(1),
  isLive: z.boolean().optional().default(false),
  minutesAfterWipe: z.number().int().min(0).nullable().optional(),
});

const updateMappingSchema = z.object({
  id: z.number().int().positive(),
  isLive: z.boolean().optional(),
  minutesAfterWipe: z.number().int().min(0).nullable().optional(),
  configId: z.number().int().positive().optional(),
});

const deleteMappingSchema = z.object({
  id: z.number().int().positive(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const mappings = await prisma.basesMapping.findMany({
      include: {
        config: { select: { id: true, name: true, currentVersion: true, publishedVersion: true } },
        serverIdentifier: { select: { id: true, name: true, hashedId: true, ip: true, port: true } },
      },
      orderBy: [{ serverIdentifierId: "asc" }, { minutesAfterWipe: "asc" }],
    });
    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Error fetching bases mappings:", error);
    return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const parsed = createMappingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { configId, serverIdentifierId, isLive, minutesAfterWipe } = parsed.data;
    const minutes = minutesAfterWipe !== undefined && minutesAfterWipe !== null ? minutesAfterWipe : null;

    const mapping = await prisma.basesMapping.create({
      data: { configId, serverIdentifierId, isLive, minutesAfterWipe: minutes },
      include: {
        config: { select: { id: true, name: true, currentVersion: true, publishedVersion: true } },
        serverIdentifier: { select: { id: true, name: true, hashedId: true, ip: true, port: true } },
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error("Error creating bases mapping:", error);
    return NextResponse.json({ error: "Failed to create mapping" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const parsed = deleteMappingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    await prisma.basesMapping.delete({ where: { id: parsed.data.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bases mapping:", error);
    return NextResponse.json({ error: "Failed to delete mapping" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const parsed = updateMappingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { id, isLive, minutesAfterWipe, configId } = parsed.data;

    const data: { isLive?: boolean; minutesAfterWipe?: number | null; configId?: number } = {};
    if (isLive !== undefined) data.isLive = isLive;
    if (minutesAfterWipe !== undefined) data.minutesAfterWipe = minutesAfterWipe;
    if (configId !== undefined) data.configId = configId;

    const mapping = await prisma.basesMapping.update({
      where: { id },
      data,
      include: {
        config: { select: { id: true, name: true, currentVersion: true, publishedVersion: true } },
        serverIdentifier: { select: { id: true, name: true, hashedId: true, ip: true, port: true } },
      },
    });

    return NextResponse.json(mapping);
  } catch (error) {
    console.error("Error updating bases mapping:", error);
    return NextResponse.json({ error: "Failed to update mapping" }, { status: 500 });
  }
}
