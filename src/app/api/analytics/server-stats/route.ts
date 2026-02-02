import { NextRequest, NextResponse } from "next/server";
import { clickhouse } from "@/lib/clickhouse";

type GroupBy = "hour" | "day" | "week";

function getGroupByFormat(groupBy: GroupBy): string {
  switch (groupBy) {
    case "hour": return "toStartOfHour(timestamp)";
    case "day": return "toStartOfDay(timestamp)";
    case "week": return "toStartOfWeek(timestamp)";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const server = searchParams.get("server");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const groupBy = (searchParams.get("groupBy") || "hour") as GroupBy;
  const type = searchParams.get("type") || "timeseries";

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
      const groupByExpr = getGroupByFormat(groupBy);
      const result = await clickhouse.query({
        query: `
          SELECT
            ${groupByExpr} as time_bucket,
            server_ip,
            server_name,
            ROUND(AVG(players)) as avg_players,
            MAX(players) as peak_players,
            MIN(players) as min_players,
            ROUND(AVG(max_players)) as capacity
          FROM server_population_stats
          ${whereClause}
          GROUP BY time_bucket, server_ip, server_name
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
            server_ip,
            server_name,
            category,
            ROUND(AVG(players)) as avg_players,
            MAX(players) as peak_players,
            MIN(players) as min_players,
            ROUND(AVG(max_players)) as avg_capacity,
            COUNT(*) as data_points,
            ROUND(AVG(players / max_players * 100)) as avg_utilization
          FROM server_population_stats
          ${whereClause}
          GROUP BY server_ip, server_name, category
          ORDER BY avg_players DESC
        `,
        format: "JSONEachRow",
      });
      const data = await result.json();
      return NextResponse.json({ data });
    }

    if (type === "totals") {
      const groupByExpr = getGroupByFormat(groupBy);
      const result = await clickhouse.query({
        query: `
          SELECT
            time_bucket,
            ROUND(SUM(avg_players)) as total_players,
            ROUND(SUM(avg_capacity)) as total_capacity,
            COUNT(*) as server_count
          FROM (
            SELECT
              ${groupByExpr} as time_bucket,
              server_ip,
              AVG(players) as avg_players,
              AVG(max_players) as avg_capacity
            FROM server_population_stats
            ${whereClause}
            GROUP BY time_bucket, server_ip
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
              toDayOfWeek(timestamp) as day_of_week,
              toHour(timestamp) as hour,
              server_ip,
              AVG(players) as avg_players
            FROM server_population_stats
            ${whereClause}
            GROUP BY day_of_week, hour, server_ip
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
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
