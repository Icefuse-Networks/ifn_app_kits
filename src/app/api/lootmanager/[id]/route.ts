import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";

const idSchema = z.coerce.number().int().positive();
const MAX_VERSIONS = 50;

const updateSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(1000).trim().nullable().optional(),
  lootData: z.string().min(1).max(10_000_000).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
  }

  try {
    const config = await prisma.lootConfig.findUnique({ where: { id: parsedId.data } });
    if (!config) return NextResponse.json({ error: "Config not found" }, { status: 404 });
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching loot config:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, description, lootData } = parsed.data;
    const configId = parsedId.data;

    const existing = await prisma.lootConfig.findUnique({ where: { id: configId } });
    if (!existing) return NextResponse.json({ error: "Config not found" }, { status: 404 });

    const newVersion = existing.currentVersion + 1;
    const updateData: { currentVersion: number; name?: string; description?: string | null; lootData?: string } = { currentVersion: newVersion };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (lootData !== undefined) updateData.lootData = lootData;

    const [config] = await prisma.$transaction([
      prisma.lootConfig.update({ where: { id: configId }, data: updateData }),
      prisma.lootConfigVersion.create({
        data: { configId, lootData: lootData || existing.lootData, version: newVersion },
      }),
    ]);

    const versionCount = await prisma.lootConfigVersion.count({ where: { configId } });
    if (versionCount > MAX_VERSIONS) {
      const oldVersions = await prisma.lootConfigVersion.findMany({
        where: { configId },
        orderBy: { version: "asc" },
        take: versionCount - MAX_VERSIONS,
        select: { id: true },
      });
      if (oldVersions.length > 0) {
        await prisma.lootConfigVersion.deleteMany({
          where: { id: { in: oldVersions.map(v => v.id) } },
        });
      }
    }

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === "P2025") {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    console.error("Error updating loot config:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
  }

  try {
    await prisma.lootConfig.delete({ where: { id: parsedId.data } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === "P2025") {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    console.error("Error deleting loot config:", error);
    return NextResponse.json({ error: "Failed to delete config" }, { status: 500 });
  }
}
