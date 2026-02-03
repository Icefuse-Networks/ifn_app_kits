import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLootManagerRead } from "@/services/api-auth";

const querySchema = z.object({
  serverId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const authResult = await requireLootManagerRead(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const parsed = querySchema.safeParse({
      serverId: request.nextUrl.searchParams.get("serverId"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { serverId } = parsed.data;

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

    const configIds = [...new Set(mappings.map(m => m.config.id))];
    const versions = await prisma.lootConfigVersion.findMany({
      where: {
        OR: configIds.map(configId => {
          const mapping = mappings.find(m => m.config.id === configId);
          return { configId, version: mapping!.config.publishedVersion! };
        }),
      },
    });

    const versionMap = new Map(versions.map(v => [`${v.configId}-${v.version}`, v]));

    const sortedMappings = [...mappings].sort((a, b) => (a.minutesAfterWipe ?? -1) - (b.minutesAfterWipe ?? -1));

    const configs = sortedMappings.map(m => {
      const version = versionMap.get(`${m.config.id}-${m.config.publishedVersion}`);
      return {
        name: m.config.name,
        configId: m.config.id,
        version: m.config.publishedVersion,
        minutesAfterWipe: m.minutesAfterWipe,
        data: version ? JSON.parse(version.lootData) : null,
      };
    }).filter(c => c.data !== null);

    const baseConfig = configs.find(c => c.minutesAfterWipe === null);
    const schedule = configs.filter(c => c.minutesAfterWipe !== null);

    return NextResponse.json({
      baseConfig: baseConfig || null,
      schedule,
    });
  } catch (error) {
    console.error("Error downloading loot config:", error);
    return NextResponse.json({ error: "Failed to download config" }, { status: 500 });
  }
}
