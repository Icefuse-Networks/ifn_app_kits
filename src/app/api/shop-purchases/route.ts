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

const purchaseCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30000;

interface ShopPurchase {
  timestamp: string;
  server_name: string;
  player_name: string;
  steamid64: string;
  item_name: string;
  amount: number;
  currency: string;
  cost: number;
}

function sanitizeIdentifier(input: string | undefined | null): string {
  if (!input) return "";
  return String(input).replace(/[^A-Za-z0-9\-_: ]/g, "");
}

const allowedOrderColumns: Array<keyof ShopPurchase> = [
  "timestamp",
  "server_name",
  "player_name",
  "steamid64",
  "item_name",
  "amount",
  "currency",
  "cost",
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {
    const draw = parseInt(sanitizeIdentifier(searchParams.get("draw") ?? "1"), 10);
    const start = parseInt(sanitizeIdentifier(searchParams.get("start") ?? "0"), 10);
    const length = parseInt(sanitizeIdentifier(searchParams.get("length") ?? "25"), 10);
    const search = sanitizeIdentifier(searchParams.get("search[value]") ?? "");
    const serverFilter = sanitizeIdentifier(searchParams.get("server") ?? "");

    const orderColumnIndex = parseInt(sanitizeIdentifier(searchParams.get("order[0][column]") ?? "0"), 10);
    const orderDir = sanitizeIdentifier(searchParams.get("order[0][dir]") ?? "desc") === "asc" ? "ASC" : "DESC";
    let orderColumnName = sanitizeIdentifier(searchParams.get(`columns[${orderColumnIndex}][name]`) ?? "timestamp");

    if (!allowedOrderColumns.includes(orderColumnName as keyof ShopPurchase)) {
      orderColumnName = "timestamp";
    }

    const cacheKey = `purchases:${serverFilter}:${search}:${orderColumnName}:${orderDir}:${start}:${length}`;
    const cached = purchaseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    let whereClause = "WHERE 1=1";
    if (serverFilter) {
      whereClause += ` AND server_name = '${serverFilter}'`;
    }
    if (search) {
      whereClause += ` AND (player_name ILIKE '%${search}%' OR steamid64 = '${search}' OR item_name ILIKE '%${search}%')`;
    }

    const totalCountSql = `SELECT COUNT(*) as count FROM shop_purchases`;
    const totalCountResult = await client.query({ query: totalCountSql, format: "JSONEachRow" });
    const totalCountRows = await totalCountResult.json<{ count: string }>();
    const recordsTotal = parseInt(totalCountRows[0]?.count || "0", 10);

    const filteredCountSql = `SELECT COUNT(*) as count FROM shop_purchases ${whereClause}`;
    const filteredCountResult = await client.query({ query: filteredCountSql, format: "JSONEachRow" });
    const filteredCountRows = await filteredCountResult.json<{ count: string }>();
    const recordsFiltered = parseInt(filteredCountRows[0]?.count || "0", 10);

    const dataSql = `
      SELECT
        formatDateTime(timestamp, '%Y-%m-%d %H:%i:%s') as timestamp,
        server_name,
        player_name,
        steamid64,
        item_name,
        amount,
        currency,
        cost
      FROM shop_purchases
      ${whereClause}
      ORDER BY ${orderColumnName} ${orderDir}
      LIMIT ${length} OFFSET ${start}
    `;
    const dataResult = await client.query({ query: dataSql, format: "JSONEachRow" });
    const purchases = await dataResult.json<ShopPurchase>();

    const processedPurchases = purchases.map((p) => ({
      ...p,
      amount: Number(p.amount) || 0,
      cost: Number(p.cost) || 0,
    }));

    const response = { draw, recordsTotal, recordsFiltered, data: processedPurchases };
    purchaseCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  } catch (error) {
    console.error("API Error fetching shop purchases:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch purchases";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { secret_key, purchases } = data;

    if (!secret_key) {
      return NextResponse.json({ error: "Missing secret key" }, { status: 400 });
    }

    if (secret_key !== process.env.APP_SECRET) {
      return NextResponse.json({ error: "Invalid secret key" }, { status: 403 });
    }

    if (Array.isArray(purchases) && purchases.length > 0) {
      const rows = purchases.map((p: Record<string, unknown>) => ({
        server_name: String(p.server_name || ""),
        player_name: String(p.player_name || ""),
        steamid64: String(p.steamid64 || ""),
        item_name: String(p.item_name || ""),
        amount: Number(p.amount) || 1,
        currency: String(p.currency) || "RP",
        cost: Number(p.cost) || 0,
      }));

      await client.insert({
        table: "shop_purchases",
        values: rows,
        format: "JSONEachRow",
      });

      purchaseCache.clear();
      return NextResponse.json({ status: "success", inserted: rows.length });
    }

    const { server_name, player_name, steamid64, item_name, amount, currency, cost } = data;
    if (!server_name || !player_name || !steamid64 || !item_name) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    await client.insert({
      table: "shop_purchases",
      values: [{
        server_name: String(server_name),
        player_name: String(player_name),
        steamid64: String(steamid64),
        item_name: String(item_name),
        amount: Number(amount) || 1,
        currency: String(currency) || "RP",
        cost: Number(cost) || 0,
      }],
      format: "JSONEachRow",
    });

    purchaseCache.clear();
    return NextResponse.json({ status: "success", inserted: 1 });
  } catch (error) {
    console.error("Error inserting shop purchase:", error);
    const message = error instanceof Error ? error.message : "Failed to insert purchase";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json();
    const { secret_key, server_name } = data;

    if (!secret_key) {
      return NextResponse.json({ error: "Missing secret key" }, { status: 400 });
    }

    if (secret_key !== process.env.APP_SECRET) {
      return NextResponse.json({ error: "Invalid secret key" }, { status: 403 });
    }

    if (server_name) {
      await client.command({ query: `ALTER TABLE shop_purchases DELETE WHERE server_name = '${sanitizeIdentifier(server_name)}'` });
    } else {
      await client.command({ query: `TRUNCATE TABLE shop_purchases` });
    }

    purchaseCache.clear();
    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Error clearing shop purchases:", error);
    const message = error instanceof Error ? error.message : "Failed to clear purchases";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
