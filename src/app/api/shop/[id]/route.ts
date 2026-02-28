import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";
import { auditUpdate, auditDelete } from "@/services/audit";

const idSchema = z.coerce.number().int().positive();
const MAX_VERSIONS = 50;

const updateSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(1000).trim().nullable().optional(),
  categoriesData: z.string().min(2).max(10_000_000).optional(),
  itemsData: z.string().min(2).max(10_000_000).optional(),
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
    const config = await prisma.shopConfig.findUnique({ where: { id: parsedId.data } });
    if (!config) return NextResponse.json({ error: "Config not found" }, { status: 404 });
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching shop config:", error);
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

    const { name, description, categoriesData, itemsData } = parsed.data;
    const configId = parsedId.data;

    const existing = await prisma.shopConfig.findUnique({ where: { id: configId } });
    if (!existing) return NextResponse.json({ error: "Config not found" }, { status: 404 });

    const newVersion = existing.currentVersion + 1;
    const updateData: Record<string, unknown> = { currentVersion: newVersion };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (categoriesData !== undefined) updateData.categoriesData = categoriesData;
    if (itemsData !== undefined) updateData.itemsData = itemsData;

    const [config] = await prisma.$transaction([
      prisma.shopConfig.update({ where: { id: configId }, data: updateData }),
      prisma.shopConfigVersion.create({
        data: {
          configId,
          categoriesData: categoriesData || existing.categoriesData,
          itemsData: itemsData || existing.itemsData,
          version: newVersion,
        },
      }),
    ]);

    const versionCount = await prisma.shopConfigVersion.count({ where: { configId } });
    if (versionCount > MAX_VERSIONS) {
      const oldVersions = await prisma.shopConfigVersion.findMany({
        where: { configId },
        orderBy: { version: "asc" },
        take: versionCount - MAX_VERSIONS,
        select: { id: true },
      });
      if (oldVersions.length > 0) {
        await prisma.shopConfigVersion.deleteMany({
          where: { id: { in: oldVersions.map(v => v.id) } },
        });
      }
    }

    await auditUpdate("shop_config", String(configId), authResult.context, { name: existing.name }, { name: config.name }, request);

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    console.error("Error updating shop config:", error);
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
    const existing = await prisma.shopConfig.findUnique({ where: { id: parsedId.data }, select: { name: true } });
    await prisma.shopConfig.delete({ where: { id: parsedId.data } });
    await auditDelete("shop_config", String(parsedId.data), authResult.context, existing, request);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    console.error("Error deleting shop config:", error);
    return NextResponse.json({ error: "Failed to delete config" }, { status: 500 });
  }
}
