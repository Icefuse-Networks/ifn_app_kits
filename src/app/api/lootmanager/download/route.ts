import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 401 });

    const validKey = await prisma.lootApiKey.findUnique({ where: { key: apiKey } });
    if (!validKey) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

    const target = request.nextUrl.searchParams.get("target");
    if (!target) return NextResponse.json({ error: "Target parameter required" }, { status: 400 });

    let config = await prisma.lootConfig.findFirst({
      where: { targetName: target, publishedVersion: { not: null } },
      orderBy: { updatedAt: "desc" },
    });

    if (!config) {
      const rateMatch = target.match(/(\d+x)/i);
      if (rateMatch) {
        config = await prisma.lootConfig.findFirst({
          where: { targetName: { contains: rateMatch[1], mode: "insensitive" }, publishedVersion: { not: null } },
          orderBy: { updatedAt: "desc" },
        });
      }
    }

    if (!config || !config.publishedVersion) {
      return NextResponse.json({ error: "No published config found for target" }, { status: 404 });
    }

    const version = await prisma.lootConfigVersion.findUnique({
      where: { configId_version: { configId: config.id, version: config.publishedVersion } },
    });

    if (!version) return NextResponse.json({ error: "Published version not found" }, { status: 404 });

    return NextResponse.json({
      name: config.name,
      target: config.targetName,
      version: config.publishedVersion,
      data: JSON.parse(version.lootData),
    });
  } catch (error) {
    console.error("Error downloading loot config:", error);
    return NextResponse.json({ error: "Failed to download config" }, { status: 500 });
  }
}
