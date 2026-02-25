import { NextRequest, NextResponse } from "next/server";
import { clickhouse } from "@/lib/clickhouse";
import { authenticateWithScope } from "@/services/api-auth";
import { auditDelete } from "@/services/audit";
import { z } from "zod";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const analyticsCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30000;

const optionalNumber = (min: number, max: number) =>
  z.preprocess((v) => (v === null || v === "" ? undefined : v), z.coerce.number().int().min(min).max(max).optional());

const querySchema = z.object({
  server: z.string().max(100).default(""),
  hours: optionalNumber(1, 8760),
  days: optionalNumber(1, 365),
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
  const parsed = querySchema.safeParse({
    server: searchParams.get("server") ?? "",
    hours: searchParams.get("hours"),
    days: searchParams.get("days"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid parameters" } },
      { status: 400 }
    );
  }

  const { server, hours, days } = parsed.data;
  const intervalHours = hours ?? (days ? days * 24 : 720);

  const cacheKey = `analytics:${server}:${intervalHours}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    // SECURITY: Use parameterized interval
    const dateWhere = `timestamp >= now() - INTERVAL {interval_hours:UInt32} HOUR`;
    const intervalParams = { interval_hours: intervalHours };
    let groupByExpr: string;
    let dateFormat: string;
    if (intervalHours <= 1) {
      groupByExpr = "toStartOfMinute(timestamp)";
      dateFormat = "formatDateTime(toStartOfMinute(timestamp), '%H:%i')";
    } else if (intervalHours <= 6) {
      groupByExpr = "toStartOfFiveMinutes(timestamp)";
      dateFormat = "formatDateTime(toStartOfFiveMinutes(timestamp), '%H:%i')";
    } else if (intervalHours <= 24) {
      groupByExpr = "toStartOfFifteenMinutes(timestamp)";
      dateFormat = "formatDateTime(toStartOfFifteenMinutes(timestamp), '%m-%d %H:%i')";
    } else if (intervalHours <= 72) {
      groupByExpr = "toStartOfHour(timestamp)";
      dateFormat = "formatDateTime(toStartOfHour(timestamp), '%m-%d %H:00')";
    } else if (intervalHours <= 168) {
      groupByExpr = "toStartOfInterval(timestamp, INTERVAL 4 HOUR)";
      dateFormat = "formatDateTime(toStartOfInterval(timestamp, INTERVAL 4 HOUR), '%m-%d %H:00')";
    } else if (intervalHours <= 720) {
      groupByExpr = "toStartOfDay(timestamp)";
      dateFormat = "formatDateTime(toStartOfDay(timestamp), '%Y-%m-%d')";
    } else {
      groupByExpr = "toStartOfDay(timestamp)";
      dateFormat = "formatDateTime(toStartOfDay(timestamp), '%Y-%m-%d')";
    }

    const [
      overviewResult,
      timeSeriesResult,
      serverStatsResult,
      topItemsResult,
      hourlyResult,
      currencyResult,
      topPlayersResult,
      recentTrendsResult,
    ] = await Promise.all([
      clickhouse.query({
        query: `SELECT COUNT(*) as total_purchases, SUM(cost) as total_revenue, COUNT(DISTINCT steamid64) as unique_players, COUNT(DISTINCT server_name) as active_servers, COUNT(DISTINCT item_name) as unique_items, ROUND(AVG(cost)) as avg_purchase_value, MAX(cost) as max_purchase_value FROM shop_purchases WHERE ${dateWhere} AND ({server:String} = '' OR server_name = {server:String})`,
        query_params: { ...intervalParams, server },
        format: "JSONEachRow",
      }),
      clickhouse.query({
        query: `SELECT ${dateFormat} as date, COUNT(*) as purchases, SUM(cost) as revenue, COUNT(DISTINCT steamid64) as players FROM shop_purchases WHERE ${dateWhere} AND ({server:String} = '' OR server_name = {server:String}) GROUP BY ${groupByExpr} ORDER BY ${groupByExpr} ASC`,
        query_params: { ...intervalParams, server },
        format: "JSONEachRow",
      }),
      clickhouse.query({
        query: `SELECT server_name, COUNT(*) as purchases, SUM(cost) as revenue, COUNT(DISTINCT steamid64) as players, COUNT(DISTINCT item_name) as items_sold, ROUND(AVG(cost)) as avg_value FROM shop_purchases WHERE ${dateWhere} AND ({server:String} = '' OR server_name = {server:String}) GROUP BY server_name ORDER BY purchases DESC`,
        query_params: { ...intervalParams, server },
        format: "JSONEachRow",
      }),
      clickhouse.query({
        query: `SELECT item_name, COUNT(*) as count, SUM(cost) as revenue, SUM(amount) as total_amount, COUNT(DISTINCT steamid64) as buyers FROM shop_purchases WHERE ${dateWhere} AND ({server:String} = '' OR server_name = {server:String}) GROUP BY item_name ORDER BY count DESC LIMIT 20`,
        query_params: { ...intervalParams, server },
        format: "JSONEachRow",
      }),
      clickhouse.query({
        query: `SELECT toHour(timestamp) as hour, toDayOfWeek(timestamp) as day_of_week, COUNT(*) as count FROM shop_purchases WHERE ${dateWhere} AND ({server:String} = '' OR server_name = {server:String}) GROUP BY hour, day_of_week ORDER BY day_of_week, hour`,
        query_params: { ...intervalParams, server },
        format: "JSONEachRow",
      }),
      clickhouse.query({
        query: `SELECT currency, COUNT(*) as count, SUM(cost) as total FROM shop_purchases WHERE ${dateWhere} AND ({server:String} = '' OR server_name = {server:String}) GROUP BY currency ORDER BY count DESC`,
        query_params: { ...intervalParams, server },
        format: "JSONEachRow",
      }),
      clickhouse.query({
        query: `SELECT steamid64, any(player_name) as player_name, COUNT(*) as purchases, SUM(cost) as total_spent, COUNT(DISTINCT item_name) as unique_items FROM shop_purchases WHERE ${dateWhere} AND ({server:String} = '' OR server_name = {server:String}) GROUP BY steamid64 ORDER BY total_spent DESC LIMIT 15`,
        query_params: { ...intervalParams, server },
        format: "JSONEachRow",
      }),
      clickhouse.query({
        query: `SELECT ${dateFormat} as date, server_name, COUNT(*) as purchases FROM shop_purchases WHERE ${dateWhere} AND ({server:String} = '' OR server_name = {server:String}) GROUP BY ${groupByExpr}, server_name ORDER BY ${groupByExpr} ASC`,
        query_params: { ...intervalParams, server },
        format: "JSONEachRow",
      }),
    ]);

    const overview = (await overviewResult.json<Record<string, string | number>>())[0] || {};
    const timeSeries = await timeSeriesResult.json<{ date: string; purchases: string; revenue: string; players: string }>();
    const serverStats = await serverStatsResult.json<{ server_name: string; purchases: string; revenue: string; players: string; items_sold: string; avg_value: string }>();
    const topItems = await topItemsResult.json<{ item_name: string; count: string; revenue: string; total_amount: string; buyers: string }>();
    const hourlyData = await hourlyResult.json<{ hour: string; day_of_week: string; count: string }>();
    const currencyData = await currencyResult.json<{ currency: string; count: string; total: string }>();
    const topPlayers = await topPlayersResult.json<{ steamid64: string; player_name: string; purchases: string; total_spent: string; unique_items: string }>();
    const serverTrends = await recentTrendsResult.json<{ date: string; server_name: string; purchases: string }>();

    const response = {
      success: true,
      overview: {
        totalPurchases: Number(overview.total_purchases) || 0,
        totalRevenue: Number(overview.total_revenue) || 0,
        uniquePlayers: Number(overview.unique_players) || 0,
        activeServers: Number(overview.active_servers) || 0,
        uniqueItems: Number(overview.unique_items) || 0,
        avgPurchaseValue: Number(overview.avg_purchase_value) || 0,
        maxPurchaseValue: Number(overview.max_purchase_value) || 0,
      },
      timeSeries: timeSeries.map(r => ({
        date: r.date,
        purchases: Number(r.purchases),
        revenue: Number(r.revenue),
        players: Number(r.players),
      })),
      serverStats: serverStats.map(r => ({
        server: r.server_name,
        purchases: Number(r.purchases),
        revenue: Number(r.revenue),
        players: Number(r.players),
        itemsSold: Number(r.items_sold),
        avgValue: Number(r.avg_value),
      })),
      topItems: topItems.map(r => ({
        item: r.item_name,
        count: Number(r.count),
        revenue: Number(r.revenue),
        totalAmount: Number(r.total_amount),
        buyers: Number(r.buyers),
      })),
      hourlyHeatmap: hourlyData.map(r => ({
        hour: Number(r.hour),
        dayOfWeek: Number(r.day_of_week),
        count: Number(r.count),
      })),
      currencyBreakdown: currencyData.map(r => ({
        currency: r.currency,
        count: Number(r.count),
        total: Number(r.total),
      })),
      topPlayers: topPlayers.map(r => ({
        steamid64: r.steamid64,
        playerName: r.player_name,
        purchases: Number(r.purchases),
        totalSpent: Number(r.total_spent),
        uniqueItems: Number(r.unique_items),
      })),
      serverTrends: serverTrends.map(r => ({
        date: r.date,
        server: r.server_name,
        purchases: Number(r.purchases),
      })),
    };

    analyticsCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Analytics API Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch analytics" } },
      { status: 500 }
    );
  }
}

const deleteSchema = z.object({
  server_name: z.string().min(1).max(100).optional(),
});

export async function DELETE(request: NextRequest) {
  const authResult = await authenticateWithScope(request, "analytics:write");
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_ERROR", message: authResult.error } },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { server_name } = parsed.data;

    if (server_name) {
      await clickhouse.command({
        query: "ALTER TABLE shop_purchases DELETE WHERE server_name = {server_name:String}",
        query_params: { server_name },
      });
      await auditDelete("shop_purchases", `server_${server_name}`, authResult.context, { server_name }, request);
    } else {
      await clickhouse.command({ query: "TRUNCATE TABLE shop_purchases" });
      await auditDelete("shop_purchases", "all", authResult.context, { action: "truncate" }, request);
    }

    analyticsCache.clear();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing shop purchases:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to clear purchases" } },
      { status: 500 }
    );
  }
}
