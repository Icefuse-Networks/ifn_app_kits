import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLootManagerRead } from "@/services/api-auth";

const querySchema = z.object({
  serverId: z.string().min(1),
  wipeTime: z.coerce.number().int().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireLootManagerRead(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const parsed = querySchema.safeParse({
      serverId: request.nextUrl.searchParams.get("serverId"),
      wipeTime: request.nextUrl.searchParams.get("wipeTime") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { serverId, wipeTime } = parsed.data;
    let minutesElapsed: number | null = null;

    if (wipeTime !== undefined) {
      const wipeTimeMs = wipeTime * 1000;
      const now = Date.now();
      minutesElapsed = Math.floor((now - wipeTimeMs) / (1000 * 60));
    }

    const serverIdentifier = await prisma.serverIdentifier.findFirst({
      where: { OR: [{ id: serverId }, { hashedId: serverId }] },
    });

    if (!serverIdentifier) {
      return NextResponse.json({ error: "Server not found", serverId }, { status: 404 });
    }

    const allMappingsForServer = await prisma.lootMapping.findMany({
      where: { serverIdentifierId: serverIdentifier.id },
      include: { config: true },
    });

    const mappings = allMappingsForServer.filter(
      m => m.isLive && m.config.publishedVersion !== null
    );

    if (mappings.length === 0) {
      const debugInfo = {
        serverId,
        resolvedServerId: serverIdentifier.id,
        serverName: serverIdentifier.name,
        totalMappings: allMappingsForServer.length,
        mappingsNotLive: allMappingsForServer.filter(m => !m.isLive).length,
        mappingsNotPublished: allMappingsForServer.filter(m => m.config.publishedVersion === null).length,
      };
      console.log("[LootManager Download] No valid mappings found:", debugInfo);
      return NextResponse.json({ error: "No live published config found for server", debug: debugInfo }, { status: 404 });
    }

    mappings.sort((a, b) => (b.minutesAfterWipe ?? -1) - (a.minutesAfterWipe ?? -1));

    let selectedMapping = mappings.find(m => m.minutesAfterWipe === null);

    if (minutesElapsed !== null) {
      for (const mapping of mappings) {
        if (mapping.minutesAfterWipe !== null && minutesElapsed >= mapping.minutesAfterWipe) {
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
      .filter(m => m.minutesAfterWipe !== null)
      .sort((a, b) => (a.minutesAfterWipe ?? 0) - (b.minutesAfterWipe ?? 0))
      .map(m => ({ minutesAfterWipe: m.minutesAfterWipe, configId: m.configId, configName: m.config.name }));

    return NextResponse.json({
      name: selectedMapping.config.name,
      configId: selectedMapping.config.id,
      version: selectedMapping.config.publishedVersion,
      minutesAfterWipe: selectedMapping.minutesAfterWipe,
      data: JSON.parse(version.lootData),
      schedule: schedule.length > 0 ? schedule : undefined,
    });
  } catch (error) {
    console.error("Error downloading loot config:", error);
    return NextResponse.json({ error: "Failed to download config" }, { status: 500 });
  }
}
