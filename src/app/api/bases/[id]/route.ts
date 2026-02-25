import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";

const idSchema = z.coerce.number().int().positive();
const MAX_VERSIONS = 50;

const updateSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(1000).trim().nullable().optional(),
  configData: z.string().min(1).max(10_000_000).optional(),
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
    const config = await prisma.basesConfig.findUnique({ where: { id: parsedId.data } });
    if (!config) return NextResponse.json({ error: "Config not found" }, { status: 404 });
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching bases config:", error);
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

    const { name, description, configData } = parsed.data;
    const configId = parsedId.data;

    const existing = await prisma.basesConfig.findUnique({ where: { id: configId } });
    if (!existing) return NextResponse.json({ error: "Config not found" }, { status: 404 });

    const newVersion = existing.currentVersion + 1;
    const updateData: { currentVersion: number; name?: string; description?: string | null; configData?: string } = { currentVersion: newVersion };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (configData !== undefined) updateData.configData = configData;

    const [config] = await prisma.$transaction([
      prisma.basesConfig.update({ where: { id: configId }, data: updateData }),
      prisma.basesConfigVersion.create({
        data: { configId, configData: configData || existing.configData, version: newVersion },
      }),
    ]);

    const versionCount = await prisma.basesConfigVersion.count({ where: { configId } });
    if (versionCount > MAX_VERSIONS) {
      const oldVersions = await prisma.basesConfigVersion.findMany({
        where: { configId },
        orderBy: { version: "asc" },
        take: versionCount - MAX_VERSIONS,
        select: { id: true },
      });
      if (oldVersions.length > 0) {
        await prisma.basesConfigVersion.deleteMany({
          where: { id: { in: oldVersions.map(v => v.id) } },
        });
      }
    }

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === "P2025") {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    console.error("Error updating bases config:", error);
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
    await prisma.basesConfig.delete({ where: { id: parsedId.data } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === "P2025") {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    console.error("Error deleting bases config:", error);
    return NextResponse.json({ error: "Failed to delete config" }, { status: 500 });
  }
}
