import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clickhouse } from "@/lib/clickhouse";
import { authenticateWithScope } from "@/services/api-auth";
import { logger } from "@/lib/logger";

type GroupBy = "minute" | "hour" | "day" | "week";

// SECURITY: Zod validated
const VALID_GROUP_BY = ["minute", "hour", "day", "week"] as const;
const VALID_TYPES = ["timeseries", "servers", "current", "aggregate", "totals", "heatmap", "peaks"] as const;

const querySchema = z.object({
  server: z.string().max(500).optional(),
  from: z.string().max(50).optional(),
  to: z.string().max(50).optional(),
  groupBy: z.enum(VALID_GROUP_BY).optional().default("hour"),
  type: z.enum(VALID_TYPES).optional().default("timeseries"),
  timezone: z.string().max(50).optional().default("UTC"),
});

// SECURITY: Whitelist valid IANA timezones to prevent SQL injection
const VALID_TIMEZONES = new Set([
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland'
]);

function validateTimezone(tz: string): string {
  // SECURITY: Only allow whitelisted timezones to prevent SQL injection
  if (!VALID_TIMEZONES.has(tz)) {
    return 'UTC';
  }
  return tz;
}

function getGroupByFormat(groupBy: GroupBy, timezone: string = 'UTC'): string {
  // SECURITY: Timezone validated before use in SQL
  const safeTimezone = validateTimezone(timezone);
  switch (groupBy) {
    case "minute": return `toStartOfMinute(timestamp, '${safeTimezone}')`;
    case "hour": return `toStartOfHour(timestamp, '${safeTimezone}')`;
    case "day": return `toStartOfDay(timestamp, '${safeTimezone}')`;
    case "week": return `toStartOfWeek(timestamp, '${safeTimezone}')`;
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Auth check at route start
  const authResult = await authenticateWithScope(request, "analytics:read");
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = request.nextUrl;

  // SECURITY: Zod validated
  const parsed = querySchema.safeParse({
    server: searchParams.get("server") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    groupBy: searchParams.get("groupBy") || undefined,
    type: searchParams.get("type") || undefined,
    timezone: searchParams.get("timezone") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters", details: parsed.error.flatten() }, { status: 400 });
  }

  const { server, from, to, groupBy, type, timezone } = parsed.data;

  try {
    let whereClause = "WHERE 1=1";
    if (server && server !== "all") {
      const serverList = server.split(",").map(s => `'${s.replace(/'/g, "")}'`).join(",");
      whereClause += ` AND server_ip IN (${serverList})`;
    }
    if (from) {
      whereClause += ` AND timestamp >= parseDateTimeBestEffort('${from.replace(/'/g, "")}')`;
    }
    if (to) {
      whereClause += ` AND timestamp <= parseDateTimeBestEffort('${to.replace(/'/g, "")}')`;
    }

    if (type === "servers") {
      const result = await clickhouse.query({
        query: `SELECT DISTINCT server_ip, server_name FROM server_population_stats ORDER BY server_name`,
        format: "JSONEachRow",
      });
      const servers = await result.json<{ server_ip: string; server_name: string }>();
      return NextResponse.json({ servers });
    }

    if (type === "current") {
      const result = await clickhouse.query({
        query: `
          SELECT
            server_ip,
            server_name,
            players,
            max_players,
            timestamp
          FROM server_population_stats
          WHERE timestamp >= now() - INTERVAL 5 MINUTE
          ORDER BY server_ip, timestamp DESC
          LIMIT 1 BY server_ip
        `,
        format: "JSONEachRow",
      });
      const data = await result.json<{ server_ip: string; server_name: string; players: number; max_players: number; timestamp: string }>();
      const totalPlayers = data.reduce((sum, s) => sum + Number(s.players), 0);
      const totalCapacity = data.reduce((sum, s) => sum + Number(s.max_players), 0);
      return NextResponse.json({ data, totalPlayers, totalCapacity, serverCount: data.length });
    }

    if (type === "timeseries") {
      const groupByExpr = getGroupByFormat(groupBy, timezone);
      const result = await clickhouse.query({
        query: `
          SELECT
            toString(${groupByExpr}) as time_bucket,
            server_id,
            argMax(server_ip, timestamp) as server_ip,
            argMax(server_name, timestamp) as server_name,
            ROUND(argMax(players, timestamp)) as avg_players,
            MAX(players) as peak_players,
            MIN(players) as min_players,
            ROUND(argMax(max_players, timestamp)) as capacity
          FROM server_population_stats
          ${whereClause}
          GROUP BY time_bucket, server_id
          ORDER BY time_bucket ASC
        `,
        format: "JSONEachRow",
      });
      const data = await result.json<{
        time_bucket: string;
        server_ip: string;
        server_name: string;
        avg_players: number;
        peak_players: number;
        min_players: number;
        capacity: number;
      }>();
      return NextResponse.json({ data });
    }

    if (type === "aggregate") {
      const result = await clickhouse.query({
        query: `
          SELECT
            server_id,
            argMax(server_ip, timestamp) as server_ip,
            argMax(server_name, timestamp) as server_name,
            argMax(category, timestamp) as category,
            ROUND(AVG(players)) as avg_players,
            MAX(players) as peak_players,
            MIN(players) as min_players,
            ROUND(AVG(max_players)) as avg_capacity,
            COUNT(*) as data_points,
            ROUND(AVG(players / max_players * 100)) as avg_utilization
          FROM server_population_stats
          ${whereClause}
          GROUP BY server_id
          ORDER BY avg_players DESC
        `,
        format: "JSONEachRow",
      });
      const data = await result.json();
      return NextResponse.json({ data });
    }

    if (type === "totals") {
      const groupByExpr = getGroupByFormat(groupBy, timezone);
      const result = await clickhouse.query({
        query: `
          SELECT
            toString(time_bucket) as time_bucket,
            ROUND(SUM(latest_players)) as total_players,
            ROUND(SUM(latest_capacity)) as total_capacity,
            COUNT(*) as server_count
          FROM (
            SELECT
              ${groupByExpr} as time_bucket,
              server_id,
              argMax(players, timestamp) as latest_players,
              argMax(max_players, timestamp) as latest_capacity
            FROM server_population_stats
            ${whereClause}
            GROUP BY time_bucket, server_id
          )
          GROUP BY time_bucket
          ORDER BY time_bucket ASC
        `,
        format: "JSONEachRow",
      });
      const data = await result.json<{
        time_bucket: string;
        total_players: number;
        total_capacity: number;
        server_count: number;
      }>();
      return NextResponse.json({ data });
    }

    if (type === "heatmap") {
      const result = await clickhouse.query({
        query: `
          SELECT
            day_of_week,
            hour,
            ROUND(SUM(avg_players)) as avg_players
          FROM (
            SELECT
              toDayOfWeek(timestamp, '${validateTimezone(timezone)}') as day_of_week,
              toHour(timestamp, '${validateTimezone(timezone)}') as hour,
              server_id,
              AVG(players) as avg_players
            FROM server_population_stats
            ${whereClause}
            GROUP BY day_of_week, hour, server_id
          )
          GROUP BY day_of_week, hour
          ORDER BY day_of_week, hour
        `,
        format: "JSONEachRow",
      });
      const data = await result.json<{
        day_of_week: number;
        hour: number;
        avg_players: number;
      }>();
      return NextResponse.json({ data });
    }

    if (type === "peaks") {
      const result = await clickhouse.query({
        query: `
          SELECT
            server_ip,
            server_name,
            MAX(players) as peak_players,
            argMax(timestamp, players) as peak_time
          FROM server_population_stats
          ${whereClause}
          GROUP BY server_ip, server_name
          ORDER BY peak_players DESC
        `,
        format: "JSONEachRow",
      });
      const data = await result.json();
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    logger.admin.error("Analytics error", error as Error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
