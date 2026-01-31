import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const config = await prisma.lootConfig.findUnique({ where: { id: parseInt(id) } });
    if (!config) return NextResponse.json({ error: "Config not found" }, { status: 404 });
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching loot config:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { name, description, lootData, targetName } = body;
    const configId = parseInt(id);

    const existing = await prisma.lootConfig.findUnique({ where: { id: configId } });
    if (!existing) return NextResponse.json({ error: "Config not found" }, { status: 404 });

    const newVersion = existing.currentVersion + 1;
    const updateData: { currentVersion: number; name?: string; description?: string; lootData?: string; targetName?: string } = { currentVersion: newVersion };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (lootData !== undefined) updateData.lootData = lootData;
    if (targetName !== undefined) updateData.targetName = targetName;

    const [config] = await prisma.$transaction([
      prisma.lootConfig.update({ where: { id: configId }, data: updateData }),
      prisma.lootConfigVersion.create({
        data: { configId, lootData: lootData || existing.lootData, version: newVersion },
      }),
    ]);

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
  const { id } = await params;
  try {
    await prisma.lootConfig.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === "P2025") {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    console.error("Error deleting loot config:", error);
    return NextResponse.json({ error: "Failed to delete config" }, { status: 500 });
  }
}
