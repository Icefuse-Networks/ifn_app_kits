import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const SERVERS: Record<number, string> = {
  684253: "US - Vanilla",
  791853: "US - 2x Quad",
  587255: "US - 2x Oblivion",
  691432: "US - 3x Unlimited",
  343384: "US - 3x Amigos",
  345469: "US - 5x Alpha",
  972442: "US - 5x Bravo",
  939846: "US - 10x Omega",
  918573: "US - 20x",
  644288: "US - 100x Kamikaze",
  533762: "US - 1000x Murphys Law",
  735943: "US - 1000000x",
  912853: "EU - Vanilla",
  918635: "EU - 5x",
  622389: "EU - 10x",
  196837: "EU - 100x",
  462688: "EU - 1000000x",
};

function convertPlaytimeToDisplay(playtime: number): string {
  const hours = Math.floor(playtime / 3600);
  const mins = Math.floor((playtime / 60) % 60);
  const secs = Math.floor(playtime % 60);
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const server = parseInt(searchParams.get("server") || "0");
  const timeframe = searchParams.get("timeframe") || "wipe";

  try {
    switch (action) {
      case "getStats": {
        const start = parseInt(searchParams.get("start") || "0");
        const length = parseInt(searchParams.get("length") || "10");
        const search = searchParams.get("search") || "";
        const orderKey = searchParams.get("orderKey") || "kills";
        const orderDir = searchParams.get("orderDir") === "asc" ? "asc" : "desc";

        const model =
          timeframe === "monthly"
            ? prisma.rustStatsMonthly
            : timeframe === "overall"
            ? prisma.rustStatsOverall
            : prisma.rustStats;

        const where: Prisma.RustStatsWhereInput = {};
        if (server !== 0) where.serverId = server;
        if (search) {
          where.OR = [{ name: { contains: search, mode: "insensitive" as const } }, { steamid: search }];
        }

        type StatsRow = { playtime: number; serverId: number };
        const [data, total] = await Promise.all([
          (model as typeof prisma.rustStats).findMany({
            where,
            orderBy: { [orderKey]: orderDir },
            skip: start,
            take: length,
          }),
          (model as typeof prisma.rustStats).count({ where }),
        ]);

        return NextResponse.json({
          data: data.map((row: StatsRow) => ({
            ...row,
            playtime_display: convertPlaytimeToDisplay(row.playtime),
            server_name: SERVERS[row.serverId as keyof typeof SERVERS] || `Server ${row.serverId}`,
          })),
          recordsTotal: total,
          recordsFiltered: total,
        });
      }

      case "getServers": {
        return NextResponse.json({ servers: SERVERS });
      }

      default:
        return NextResponse.json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error("Core API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret_key, server_id, type, players, bmData } = body;

    if (secret_key !== process.env.RUST_STATS_SECRET) {
      return NextResponse.json({ error: "Invalid Secret Key" }, { status: 403 });
    }

    const serverId = parseInt(server_id);
    const model =
      type === "monthly"
        ? prisma.rustStatsMonthly
        : type === "overall"
        ? prisma.rustStatsOverall
        : prisma.rustStats;

    const eventMap: Record<string, string> = {
      playtime: "playtime",
      tcs_destroyed: "tcsDestroyed",
      c4_thrown: "c4Thrown",
      rockets_launched: "rocketsLaunched",
      c4_crafted: "c4Crafted",
      rockets_crafted: "rocketsCrafted",
      bullets_fired: "bulletsFired",
      container_points: "containerPoints",
      kills: "kills",
      deaths: "deaths",
    };

    if (bmData?.data) {
      for (const playerData of bmData.data) {
        const profile = playerData.attributes?.metadata?.profile;
        if (!profile?.steamid || !profile?.personaname) continue;

        const existing = await (model as typeof prisma.rustStats).findFirst({
          where: { serverId, steamid: profile.steamid },
        });

        if (!existing) {
          await (model as typeof prisma.rustStats).create({
            data: {
              serverId,
              steamid: profile.steamid,
              name: profile.personaname,
              avatar: profile.avatar || null,
              playtime: 0,
              tcsDestroyed: 0,
              c4Thrown: 0,
              rocketsLaunched: 0,
              c4Crafted: 0,
              rocketsCrafted: 0,
              bulletsFired: 0,
              containerPoints: 0,
              kills: 0,
              deaths: 0,
              kdr: 0,
              points: 0,
            },
          });
        }
      }
    }

    if (players) {
      for (const player of players) {
        if (!player.steamid) continue;

        const existing = await (model as typeof prisma.rustStats).findFirst({
          where: { serverId, steamid: player.steamid },
        });

        const updateData: Record<string, string | number | null> = {};
        if (player.name) updateData.name = player.name;
        if (player.avatar) updateData.avatar = player.avatar;

        for (const [eventKey, dbKey] of Object.entries(eventMap)) {
          if (player[eventKey] !== undefined) {
            const existingVal = existing ? (existing as Record<string, unknown>)[dbKey] : 0;
            updateData[dbKey] = ((existingVal as number) || 0) + player[eventKey];
          }
        }

        const kills = (updateData.kills as number) ?? existing?.kills ?? 0;
        const deaths = (updateData.deaths as number) ?? existing?.deaths ?? 0;
        updateData.kdr = deaths === 0 ? kills : Math.round((kills / deaths) * 100) / 100;

        if (existing) {
          await (model as typeof prisma.rustStats).update({
            where: { id: existing.id },
            data: updateData,
          });
        } else {
          await (model as typeof prisma.rustStats).create({
            data: {
              serverId,
              steamid: player.steamid,
              name: player.name || "Unknown",
              avatar: player.avatar || null,
              playtime: player.playtime || 0,
              tcsDestroyed: player.tcs_destroyed || 0,
              c4Thrown: player.c4_thrown || 0,
              rocketsLaunched: player.rockets_launched || 0,
              c4Crafted: player.c4_crafted || 0,
              rocketsCrafted: player.rockets_crafted || 0,
              bulletsFired: player.bullets_fired || 0,
              containerPoints: player.container_points || 0,
              kills: player.kills || 0,
              deaths: player.deaths || 0,
              kdr: player.kdr || 0,
              points: player.points || 0,
            },
          });
        }
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Stats update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
