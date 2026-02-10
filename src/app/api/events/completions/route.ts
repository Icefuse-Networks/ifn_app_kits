import { NextRequest, NextResponse } from "next/server";
import { clickhouse } from "@/lib/clickhouse";
import { authenticateWithScope } from "@/services/api-auth";
import { prisma } from "@/lib/db";
import { auditCreate } from "@/services/audit";
import { z } from "zod";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const eventCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30000;

// SECURITY: Zod validated
const participantSchema = z.object({
  steam_id: z.string().regex(/^\d{17}$/, "Invalid SteamID64"),
  name: z.string().min(1).max(100),
  kills: z.coerce.number().int().min(0).max(10000).default(0),
  deaths: z.coerce.number().int().min(0).max(10000).default(0),
  position: z.coerce.number().int().min(1).max(1000).default(1),
});

const postSchema = z.object({
  server_id: z.string().max(60),
  event_type: z.enum(["koth", "maze"]),
  winner_steam_id: z.string().regex(/^\d{17}$/, "Invalid winner SteamID64"),
  winner_name: z.string().min(1).max(100),
  winner_clan_tag: z.string().max(20).nullable().optional(),
  winner_kills: z.coerce.number().int().min(0).max(10000).default(0),
  is_clan_mode: z.coerce.boolean().default(false),
  event_modes: z.array(z.string().max(30)).max(10).default([]),
  location: z.string().max(100).nullable().optional(),
  duration_seconds: z.coerce.number().int().min(0).max(86400).default(900),
  participants: z.array(participantSchema).max(500).default([]),
});

const getQuerySchema = z.object({
  start: z.coerce.number().int().min(0).max(1000000).default(0),
  length: z.coerce.number().int().min(1).max(1000).default(25), // Up to 1000 for analytics aggregation
  server_id: z.string().max(60).default(""),
  event_type: z.enum(["koth", "maze", ""]).default(""),
  hours: z.preprocess((v) => (v === null || v === "" ? undefined : v), z.coerce.number().int().min(1).max(8760).optional()),
  days: z.preprocess((v) => (v === null || v === "" ? undefined : v), z.coerce.number().int().min(1).max(365).optional()),
});

export async function GET(request: NextRequest) {
  // SECURITY: Auth wrapper with scope check
  const authResult = await authenticateWithScope(request, "analytics:read");
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_ERROR", message: authResult.error } },
      { status: authResult.status }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const parsed = getQuerySchema.safeParse({
    start: searchParams.get("start"),
    length: searchParams.get("length"),
    server_id: searchParams.get("server_id") ?? "",
    event_type: searchParams.get("event_type") ?? "",
    hours: searchParams.get("hours"),
    days: searchParams.get("days"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid parameters", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { start, length, server_id, event_type, hours, days } = parsed.data;

  try {
    // Build time filter
    let timeFilter = "";
    if (hours) {
      timeFilter = `AND timestamp >= now64(3) - INTERVAL ${hours} HOUR`;
    } else if (days) {
      timeFilter = `AND timestamp >= now64(3) - INTERVAL ${days} DAY`;
    }

    const cacheKey = `events:${server_id}:${event_type}:${hours ?? days ?? "all"}:${start}:${length}`;
    const cached = eventCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // Total count
    const totalCountResult = await clickhouse.query({
      query: `SELECT COUNT(*) as count FROM event_completions WHERE 1=1 ${timeFilter}`,
      format: "JSONEachRow",
    });
    const totalCountRows = await totalCountResult.json<{ count: string }>();
    const recordsTotal = parseInt(totalCountRows[0]?.count || "0", 10);

    // Filtered count
    const filteredCountResult = await clickhouse.query({
      query: `SELECT COUNT(*) as count FROM event_completions WHERE 1=1 ${timeFilter} AND ({server_id:String} = '' OR server_id = {server_id:String}) AND ({event_type:String} = '' OR event_type = {event_type:String})`,
      query_params: { server_id, event_type },
      format: "JSONEachRow",
    });
    const filteredCountRows = await filteredCountResult.json<{ count: string }>();
    const recordsFiltered = parseInt(filteredCountRows[0]?.count || "0", 10);

    // Get events
    const dataResult = await clickhouse.query({
      query: `
        SELECT
          formatDateTime(timestamp, '%Y-%m-%d %H:%i:%s') as timestamp_str,
          server_id,
          event_type,
          winner_steam_id,
          winner_name,
          winner_clan_tag,
          winner_kills,
          is_clan_mode,
          event_modes,
          location,
          duration_seconds,
          participants
        FROM event_completions
        WHERE 1=1 ${timeFilter}
          AND ({server_id:String} = '' OR server_id = {server_id:String})
          AND ({event_type:String} = '' OR event_type = {event_type:String})
        ORDER BY timestamp DESC
        LIMIT {length:UInt32} OFFSET {start:UInt32}
      `,
      query_params: { server_id, event_type, length, start },
      format: "JSONEachRow",
    });
    const events = await dataResult.json();

    const response = { success: true, recordsTotal, recordsFiltered, data: events };
    eventCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  } catch (error) {
    console.error("API Error fetching event completions:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch events" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Auth wrapper with scope check
  const authResult = await authenticateWithScope(request, "analytics:write");
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_ERROR", message: authResult.error } },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate server_id exists
    const server = await prisma.serverIdentifier.findFirst({
      where: { hashedId: data.server_id },
      select: { id: true },
    });
    if (!server) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_SERVER", message: "Invalid server_id" } },
        { status: 400 }
      );
    }

    // Build row for ClickHouse - participants as array of tuples
    const participantsTuples = data.participants.map(p => [
      BigInt(p.steam_id),
      p.name,
      p.kills,
      p.deaths,
      p.position,
    ]);

    const row = {
      server_id: data.server_id,
      event_type: data.event_type,
      winner_steam_id: BigInt(data.winner_steam_id),
      winner_name: data.winner_name,
      winner_clan_tag: data.winner_clan_tag ?? null,
      winner_kills: data.winner_kills,
      is_clan_mode: data.is_clan_mode ? 1 : 0,
      event_modes: data.event_modes,
      location: data.location ?? null,
      duration_seconds: data.duration_seconds,
      participants: participantsTuples,
    };

    await clickhouse.insert({
      table: "event_completions",
      values: [row],
      format: "JSONEachRow",
    });

    // SECURITY: Audit logged
    await auditCreate(
      "event_completion",
      `${data.event_type}_${data.winner_steam_id}_${Date.now()}`,
      authResult.context,
      {
        server_id: data.server_id,
        event_type: data.event_type,
        winner: data.winner_name,
        participant_count: data.participants.length,
      },
      request
    );

    eventCache.clear();
    return NextResponse.json({ success: true, inserted: 1 });
  } catch (error) {
    console.error("Error inserting event completion:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to insert event" } },
      { status: 500 }
    );
  }
}
