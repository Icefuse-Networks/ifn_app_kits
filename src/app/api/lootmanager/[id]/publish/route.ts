import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const configId = parseInt(id);
    const existing = await prisma.lootConfig.findUnique({ where: { id: configId } });
    if (!existing) return NextResponse.json({ error: "Config not found" }, { status: 404 });

    const config = await prisma.lootConfig.update({
      where: { id: configId },
      data: { publishedVersion: existing.currentVersion },
    });

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === "P2025") {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    console.error("Error publishing loot config:", error);
    return NextResponse.json({ error: "Failed to publish config" }, { status: 500 });
  }
}
