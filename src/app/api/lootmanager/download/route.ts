import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 401 });

    const validKey = await prisma.lootApiKey.findUnique({ where: { key: apiKey } });
    if (!validKey) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

    const serverId = request.nextUrl.searchParams.get("serverId");
    if (!serverId) return NextResponse.json({ error: "serverId parameter required" }, { status: 400 });

    const wipeTimeParam = request.nextUrl.searchParams.get("wipeTime");
    let hoursElapsed: number | null = null;

    if (wipeTimeParam) {
      const wipeTimeUnix = parseInt(wipeTimeParam);
      if (!isNaN(wipeTimeUnix)) {
        const wipeTimeMs = wipeTimeUnix * 1000;
        const now = Date.now();
        hoursElapsed = Math.floor((now - wipeTimeMs) / (1000 * 60 * 60));
      }
    }

    const mappings = await prisma.lootMapping.findMany({
      where: {
        serverIdentifier: { hashedId: serverId },
        isLive: true,
        config: { publishedVersion: { not: null } },
      },
      include: { config: true },
      orderBy: { hoursAfterWipe: "desc" },
    });

    if (mappings.length === 0) {
      return NextResponse.json({ error: "No live published config found for server" }, { status: 404 });
    }

    let selectedMapping = mappings.find(m => m.hoursAfterWipe === null);

    if (hoursElapsed !== null) {
      for (const mapping of mappings) {
        if (mapping.hoursAfterWipe !== null && hoursElapsed >= mapping.hoursAfterWipe) {
          selectedMapping = mapping;
          break;
        }
      }
    }

    if (!selectedMapping) {
      selectedMapping = mappings[mappings.length - 1];
    }

    if (!selectedMapping?.config?.publishedVersion) {
      return NextResponse.json({ error: "No live published config found for server" }, { status: 404 });
    }

    const version = await prisma.lootConfigVersion.findUnique({
      where: { configId_version: { configId: selectedMapping.config.id, version: selectedMapping.config.publishedVersion } },
    });

    if (!version) return NextResponse.json({ error: "Published version not found" }, { status: 404 });

    const schedule = mappings
      .filter(m => m.hoursAfterWipe !== null)
      .sort((a, b) => (a.hoursAfterWipe ?? 0) - (b.hoursAfterWipe ?? 0))
      .map(m => ({ hoursAfterWipe: m.hoursAfterWipe, configId: m.configId, configName: m.config.name }));

    return NextResponse.json({
      name: selectedMapping.config.name,
      configId: selectedMapping.config.id,
      version: selectedMapping.config.publishedVersion,
      hoursAfterWipe: selectedMapping.hoursAfterWipe,
      data: JSON.parse(version.lootData),
      schedule: schedule.length > 0 ? schedule : undefined,
    });
  } catch (error) {
    console.error("Error downloading loot config:", error);
    return NextResponse.json({ error: "Failed to download config" }, { status: 500 });
  }
}
