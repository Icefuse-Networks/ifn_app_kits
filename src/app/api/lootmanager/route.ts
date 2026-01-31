import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const unstaged = request.nextUrl.searchParams.get("unstaged");
  try {
    if (unstaged === "true") {
      const configs = await prisma.$queryRaw`
        SELECT id, name, description, target_name as "targetName", current_version as "currentVersion",
               published_version as "publishedVersion", created_at as "createdAt", updated_at as "updatedAt"
        FROM ifn_admin.loot_configs
        WHERE current_version > COALESCE(published_version, 0)
        ORDER BY updated_at DESC
` as { id: number; name: string; description: string | null; targetName: string; currentVersion: number; publishedVersion: number | null; createdAt: Date; updatedAt: Date }[];
      return NextResponse.json(configs);
    }
    const configs = await prisma.lootConfig.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true, targetName: true,
        currentVersion: true, publishedVersion: true, createdAt: true, updatedAt: true
      },
    });
    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching loot configs:", error);
    return NextResponse.json({ error: "Failed to fetch loot configs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, lootData, targetName } = body;

    if (!name || !lootData) {
      return NextResponse.json({ error: "Name and lootData are required" }, { status: 400 });
    }

    const config = await prisma.lootConfig.create({
      data: {
        name,
        description: description || null,
        lootData,
        targetName: targetName || "",
        currentVersion: 1,
      },
    });

    await prisma.lootConfigVersion.create({
      data: { configId: config.id, lootData, version: 1 },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("Error creating loot config:", error);
    return NextResponse.json({ error: "Failed to create loot config" }, { status: 500 });
  }
}
