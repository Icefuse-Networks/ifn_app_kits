import { NextRequest, NextResponse } from "next/server";
import { clickhouse } from "@/lib/clickhouse";
import { authenticateWithScope } from "@/services/api-auth";
import { z } from "zod";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const raidCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30000;

const raiderSchema = z.object({
  steam_id: z.string().min(1).max(30),
  name: z.string().min(1).max(100),
  entities_destroyed: z.coerce.number().int().min(0).max(100000).default(0),
  containers_destroyed: z.coerce.number().int().min(0).max(10000).default(0),
  npcs_killed: z.coerce.number().int().min(0).max(1000).default(0),
});

const postSchema = z.object({
  server_id: z.string().max(60),
  base_id: z.coerce.number().int().min(0),
  building_name: z.string().max(100),
  base_type: z.string().max(20),
  building_grade: z.string().max(20),
  raid_duration_seconds: z.coerce.number().int().min(0).max(86400).default(0),
  was_completed: z.coerce.boolean().default(false),
  total_entities_destroyed: z.coerce.number().int().min(0).max(100000).default(0),
  total_containers_destroyed: z.coerce.number().int().min(0).max(10000).default(0),
  total_npcs_killed: z.coerce.number().int().min(0).max(1000).default(0),
  raiders: z.array(raiderSchema).max(100).default([]),
});

const getQuerySchema = z.object({
  start: z.coerce.number().int().min(0).max(1000000).default(0),
  length: z.coerce.number().int().min(1).max(1000).default(25),
  server_id: z.string().max(60).default(""),
  base_type: z.string().max(20).default(""),
  hours: z.preprocess((v) => (v === null || v === "" ? undefined : v), z.coerce.number().int().min(1).max(8760).optional()),
  days: z.preprocess((v) => (v === null || v === "" ? undefined : v), z.coerce.number().int().min(1).max(365).optional()),
});

export async function GET(request: NextRequest) {
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
    base_type: searchParams.get("base_type") ?? "",
    hours: searchParams.get("hours"),
    days: searchParams.get("days"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid parameters", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { start, length, server_id, base_type, hours, days } = parsed.data;

  try {
    // SECURITY: Use parameterized interval to prevent SQL injection
    let timeFilter = "";
    const timeParams: Record<string, unknown> = {};
    if (hours) {
      timeFilter = `AND timestamp >= now() - INTERVAL {interval_val:UInt32} HOUR`;
      timeParams.interval_val = hours;
    } else if (days) {
      timeFilter = `AND timestamp >= now() - INTERVAL {interval_val:UInt32} DAY`;
      timeParams.interval_val = days;
    }

    const cacheKey = `raids:${server_id}:${base_type}:${hours ?? days ?? "all"}:${start}:${length}`;
    const cached = raidCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const totalCountResult = await clickhouse.query({
      query: `SELECT COUNT(*) as count FROM bases_raid_events WHERE 1=1 ${timeFilter}`,
      query_params: { ...timeParams },
      format: "JSONEachRow",
    });
    const totalCountRows = await totalCountResult.json<{ count: string }>();
    const recordsTotal = parseInt(totalCountRows[0]?.count || "0", 10);

    const filteredCountResult = await clickhouse.query({
      query: `SELECT COUNT(*) as count FROM bases_raid_events WHERE 1=1 ${timeFilter} AND ({server_id:String} = '' OR server_id = {server_id:String}) AND ({base_type:String} = '' OR base_type = {base_type:String})`,
      query_params: { ...timeParams, server_id, base_type },
      format: "JSONEachRow",
    });
    const filteredCountRows = await filteredCountResult.json<{ count: string }>();
    const recordsFiltered = parseInt(filteredCountRows[0]?.count || "0", 10);

    const dataResult = await clickhouse.query({
      query: `
        SELECT
          formatDateTime(timestamp, '%Y-%m-%d %H:%i:%s') as timestamp_str,
          server_id,
          base_id,
          building_name,
          base_type,
          building_grade,
          raid_duration_seconds,
          was_completed,
          total_entities_destroyed,
          total_containers_destroyed,
          total_npcs_killed,
          raider_steam_ids,
          raider_names,
          raider_entities_destroyed,
          raider_containers_destroyed,
          raider_npcs_killed
        FROM bases_raid_events
        WHERE 1=1 ${timeFilter}
          AND ({server_id:String} = '' OR server_id = {server_id:String})
          AND ({base_type:String} = '' OR base_type = {base_type:String})
        ORDER BY timestamp DESC
        LIMIT {length:UInt32} OFFSET {start:UInt32}
      `,
      query_params: { ...timeParams, server_id, base_type, length, start },
      format: "JSONEachRow",
    });
    const raids = await dataResult.json();

    const response = { success: true, recordsTotal, recordsFiltered, data: raids };
    raidCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  } catch (error) {
    console.error("API Error fetching raid events:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch raid events" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const row = {
      server_id: data.server_id,
      base_id: data.base_id,
      building_name: data.building_name,
      base_type: data.base_type,
      building_grade: data.building_grade,
      raid_duration_seconds: data.raid_duration_seconds,
      was_completed: data.was_completed ? 1 : 0,
      total_entities_destroyed: data.total_entities_destroyed,
      total_containers_destroyed: data.total_containers_destroyed,
      total_npcs_killed: data.total_npcs_killed,
      raider_steam_ids: data.raiders.map(r => r.steam_id),
      raider_names: data.raiders.map(r => r.name),
      raider_entities_destroyed: data.raiders.map(r => r.entities_destroyed),
      raider_containers_destroyed: data.raiders.map(r => r.containers_destroyed),
      raider_npcs_killed: data.raiders.map(r => r.npcs_killed),
    };

    await clickhouse.insert({
      table: "bases_raid_events",
      values: [row],
      format: "JSONEachRow",
    });

    raidCache.clear();
    return NextResponse.json({ success: true, inserted: 1 });
  } catch (error) {
    console.error("Error inserting raid event:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to insert raid event" } },
      { status: 500 }
    );
  }
}
