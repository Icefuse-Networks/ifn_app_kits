import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBasesRead } from "@/services/api-auth";

const querySchema = z.object({
  serverId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const authResult = await requireBasesRead(request);
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

    const allMappingsForServer = await prisma.basesMapping.findMany({
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
      console.log("[Bases Download] No valid mappings found:", debugInfo);
      return NextResponse.json({ error: "No live published config found for server", debug: debugInfo }, { status: 404 });
    }

    const configIds = [...new Set(mappings.map(m => m.config.id))];
    const versions = await prisma.basesConfigVersion.findMany({
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
      if (!version) return null;
      const data = JSON.parse(version.configData);
      return {
        name: m.config.name,
        configId: m.config.id,
        version: m.config.publishedVersion,
        minutesAfterWipe: m.minutesAfterWipe,
        pluginConfig: data.pluginConfig,
        lootTables: data.lootTables,
      };
    }).filter(Boolean);

    const baseConfig = configs.find(c => c!.minutesAfterWipe === null) || null;
    const schedule = configs.filter(c => c!.minutesAfterWipe !== null);

    // Collect all building names referenced in configs
    const buildingNames = new Set<string>();
    for (const config of configs) {
      const basesData = config!.pluginConfig?.["Bases Data"];
      if (basesData && typeof basesData === "object") {
        for (const sizeData of Object.values(basesData as Record<string, { Buildings?: string[] }>)) {
          if (sizeData?.Buildings) {
            for (const name of sizeData.Buildings) {
              buildingNames.add(name);
            }
          }
        }
      }
    }

    // Fetch base files from database
    const baseFiles: Record<string, string> = {};
    if (buildingNames.size > 0) {
      const files = await prisma.basesFile.findMany({
        where: { name: { in: [...buildingNames] } },
        select: { name: true, fileData: true },
      });
      for (const file of files) {
        baseFiles[file.name] = file.fileData;
      }
    }

    return NextResponse.json({
      baseConfig,
      schedule,
      baseFiles,
    });
  } catch (error) {
    console.error("Error downloading bases config:", error);
    return NextResponse.json({ error: "Failed to download config" }, { status: 500 });
  }
}
