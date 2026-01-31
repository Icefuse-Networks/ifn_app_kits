import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@clickhouse/client";

const client = createClient({
  url: "http://168.100.163.49:8124",
  username: "default",
  password: "DvqUTqWMe7cQ9NJme83coT48RA0ex3D7lgnWO1fhhkFQp4oVneM93WwrMpwGDl90",
  database: "default",
});

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const analyticsCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 60000;

function sanitizeIdentifier(input: string | undefined | null): string {
  if (!input) return "";
  return String(input).replace(/[^A-Za-z0-9\-_: ]/g, "");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const serverFilter = sanitizeIdentifier(searchParams.get("server") ?? "");
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10) || 30, 1), 365);

  const cacheKey = `analytics:${serverFilter}:${days}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const serverWhere = serverFilter ? `AND server_name = '${serverFilter}'` : "";
    const dateWhere = `timestamp >= now() - INTERVAL ${days} DAY`;

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
      client.query({
        query: `
          SELECT
            COUNT(*) as total_purchases,
            SUM(cost) as total_revenue,
            COUNT(DISTINCT steamid64) as unique_players,
            COUNT(DISTINCT server_name) as active_servers,
            COUNT(DISTINCT item_name) as unique_items,
            AVG(cost) as avg_purchase_value,
            MAX(cost) as max_purchase_value
          FROM shop_purchases
          WHERE ${dateWhere} ${serverWhere}
        `,
        format: "JSONEachRow",
      }),
      client.query({
        query: `
          SELECT
            toDate(timestamp) as date,
            COUNT(*) as purchases,
            SUM(cost) as revenue,
            COUNT(DISTINCT steamid64) as players
          FROM shop_purchases
          WHERE ${dateWhere} ${serverWhere}
          GROUP BY date
          ORDER BY date ASC
        `,
        format: "JSONEachRow",
      }),
      client.query({
        query: `
          SELECT
            server_name,
            COUNT(*) as purchases,
            SUM(cost) as revenue,
            COUNT(DISTINCT steamid64) as players,
            COUNT(DISTINCT item_name) as items_sold,
            AVG(cost) as avg_value
          FROM shop_purchases
          WHERE ${dateWhere} ${serverWhere}
          GROUP BY server_name
          ORDER BY purchases DESC
        `,
        format: "JSONEachRow",
      }),
      client.query({
        query: `
          SELECT
            item_name,
            COUNT(*) as count,
            SUM(cost) as revenue,
            SUM(amount) as total_amount,
            COUNT(DISTINCT steamid64) as buyers
          FROM shop_purchases
          WHERE ${dateWhere} ${serverWhere}
          GROUP BY item_name
          ORDER BY count DESC
          LIMIT 20
        `,
        format: "JSONEachRow",
      }),
      client.query({
        query: `
          SELECT
            toHour(timestamp) as hour,
            toDayOfWeek(timestamp) as day_of_week,
            COUNT(*) as count
          FROM shop_purchases
          WHERE ${dateWhere} ${serverWhere}
          GROUP BY hour, day_of_week
          ORDER BY day_of_week, hour
        `,
        format: "JSONEachRow",
      }),
      client.query({
        query: `
          SELECT
            currency,
            COUNT(*) as count,
            SUM(cost) as total
          FROM shop_purchases
          WHERE ${dateWhere} ${serverWhere}
          GROUP BY currency
          ORDER BY count DESC
        `,
        format: "JSONEachRow",
      }),
      client.query({
        query: `
          SELECT
            steamid64,
            any(player_name) as player_name,
            COUNT(*) as purchases,
            SUM(cost) as total_spent,
            COUNT(DISTINCT item_name) as unique_items
          FROM shop_purchases
          WHERE ${dateWhere} ${serverWhere}
          GROUP BY steamid64
          ORDER BY total_spent DESC
          LIMIT 15
        `,
        format: "JSONEachRow",
      }),
      client.query({
        query: `
          SELECT
            toDate(timestamp) as date,
            server_name,
            COUNT(*) as purchases
          FROM shop_purchases
          WHERE ${dateWhere} ${serverWhere}
          GROUP BY date, server_name
          ORDER BY date ASC
        `,
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
    const message = error instanceof Error ? error.message : "Failed to fetch analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
