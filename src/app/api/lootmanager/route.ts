import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const unstaged = request.nextUrl.searchParams.get("unstaged");
  try {
    const configs = await prisma.lootConfig.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true,
        currentVersion: true, publishedVersion: true, createdAt: true, updatedAt: true
      },
    });
    if (unstaged === "true") {
      return NextResponse.json(configs.filter(c => c.currentVersion > (c.publishedVersion ?? 0)));
    }
    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching loot configs:", error);
    return NextResponse.json({ error: "Failed to fetch loot configs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, lootData } = body;

    if (!name || !lootData) {
      return NextResponse.json({ error: "Name and lootData are required" }, { status: 400 });
    }

    const config = await prisma.lootConfig.create({
      data: {
        name,
        description: description || null,
        lootData,
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
