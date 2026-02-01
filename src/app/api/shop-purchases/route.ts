import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@clickhouse/client";
import { authenticateWithScope } from "@/services/api-auth";
import { prisma } from "@/lib/db";
import { auditCreate, auditDelete } from "@/services/audit";
import { z } from "zod";

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
const MAX_BATCH_SIZE = 100;

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

const allowedOrderColumns = ["timestamp", "server_name", "player_name", "steamid64", "item_name", "amount", "currency", "cost"] as const;

const optionalNumber = (min: number, max: number, def: number) =>
  z.preprocess((v) => (v === null || v === "" ? undefined : v), z.coerce.number().int().min(min).max(max).default(def));

const getQuerySchema = z.object({
  draw: optionalNumber(0, 1000000, 1),
  start: optionalNumber(0, 1000000, 0),
  length: optionalNumber(1, 100, 25),
  search: z.string().max(100).default(""),
  server: z.string().max(100).default(""),
  orderColumn: z.enum(allowedOrderColumns).default("timestamp"),
  orderDir: z.enum(["asc", "desc"]).default("desc"),
});

const purchaseItemSchema = z.object({
  server_name: z.string().max(100).optional(),
  player_name: z.string().min(1).max(100),
  steamid64: z.string().regex(/^\d{17}$/),
  item_name: z.string().min(1).max(200),
  amount: z.coerce.number().int().min(1).max(1000000).default(1),
  currency: z.string().max(20).default("RP"),
  cost: z.coerce.number().int().min(0).max(1000000000).default(0),
});

const postSchema = z.object({
  server_id: z.string().max(60).optional(),
  server_name: z.string().max(100).optional(),
  purchases: z.array(purchaseItemSchema).max(MAX_BATCH_SIZE).optional(),
  player_name: z.string().min(1).max(100).optional(),
  steamid64: z.string().regex(/^\d{17}$/).optional(),
  item_name: z.string().min(1).max(200).optional(),
  amount: z.coerce.number().int().min(1).max(1000000).optional(),
  currency: z.string().max(20).optional(),
  cost: z.coerce.number().int().min(0).max(1000000000).optional(),
});

const deleteSchema = z.object({
  server_name: z.string().max(100).optional(),
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
  const orderColumnIndex = parseInt(searchParams.get("order[0][column]") ?? "0", 10);
  const rawOrderColumn = searchParams.get(`columns[${orderColumnIndex}][name]`) ?? "timestamp";

  const parsed = getQuerySchema.safeParse({
    draw: searchParams.get("draw"),
    start: searchParams.get("start"),
    length: searchParams.get("length"),
    search: searchParams.get("search[value]") ?? "",
    server: searchParams.get("server") ?? "",
    orderColumn: allowedOrderColumns.includes(rawOrderColumn as typeof allowedOrderColumns[number]) ? rawOrderColumn : "timestamp",
    orderDir: searchParams.get("order[0][dir]") ?? "desc",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid parameters", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { draw, start, length, search, server, orderColumn, orderDir } = parsed.data;

  try {
    const cacheKey = `purchases:${server}:${search}:${orderColumn}:${orderDir}:${start}:${length}`;
    const cached = purchaseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const totalCountResult = await client.query({ query: "SELECT COUNT(*) as count FROM shop_purchases", format: "JSONEachRow" });
    const totalCountRows = await totalCountResult.json<{ count: string }>();
    const recordsTotal = parseInt(totalCountRows[0]?.count || "0", 10);

    const filteredCountResult = await client.query({
      query: "SELECT COUNT(*) as count FROM shop_purchases WHERE 1=1 AND ({server:String} = '' OR server_name = {server:String}) AND ({search:String} = '' OR player_name ILIKE {searchPattern:String} OR steamid64 = {search:String} OR item_name ILIKE {searchPattern:String})",
      query_params: { server, search, searchPattern: `%${search}%` },
      format: "JSONEachRow",
    });
    const filteredCountRows = await filteredCountResult.json<{ count: string }>();
    const recordsFiltered = parseInt(filteredCountRows[0]?.count || "0", 10);

    const dataResult = await client.query({
      query: `SELECT formatDateTime(timestamp, '%Y-%m-%d %H:%i:%s') as timestamp, server_name, player_name, steamid64, item_name, amount, currency, cost FROM shop_purchases WHERE 1=1 AND ({server:String} = '' OR server_name = {server:String}) AND ({search:String} = '' OR player_name ILIKE {searchPattern:String} OR steamid64 = {search:String} OR item_name ILIKE {searchPattern:String}) ORDER BY ${orderColumn} ${orderDir.toUpperCase()} LIMIT {length:UInt32} OFFSET {start:UInt32}`,
      query_params: { server, search, searchPattern: `%${search}%`, length, start },
      format: "JSONEachRow",
    });
    const purchases = await dataResult.json<ShopPurchase>();

    const processedPurchases = purchases.map((p) => ({
      ...p,
      amount: Number(p.amount) || 0,
      cost: Number(p.cost) || 0,
    }));

    const response = { success: true, draw, recordsTotal, recordsFiltered, data: processedPurchases };
    purchaseCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  } catch (error) {
    console.error("API Error fetching shop purchases:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch purchases" } },
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

    const { server_id, purchases, server_name, player_name, steamid64, item_name, amount, currency, cost } = parsed.data;

    let resolvedServerName: string | null = null;
    if (server_id) {
      const server = await prisma.serverIdentifier.findFirst({
        where: { hashedId: server_id },
        select: { name: true },
      });
      if (!server) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_SERVER", message: "Invalid server_id" } },
          { status: 400 }
        );
      }
      resolvedServerName = server.name;
    }

    if (purchases && purchases.length > 0) {
      const rows = purchases.map((p) => ({
        server_name: resolvedServerName || p.server_name || "",
        player_name: p.player_name,
        steamid64: p.steamid64,
        item_name: p.item_name,
        amount: p.amount,
        currency: p.currency,
        cost: p.cost,
      }));

      await client.insert({ table: "shop_purchases", values: rows, format: "JSONEachRow" });

      await auditCreate("shop_purchase_batch", `batch_${Date.now()}`, authResult.context, { count: rows.length, server: resolvedServerName || rows[0]?.server_name }, request);

      purchaseCache.clear();
      return NextResponse.json({ success: true, inserted: rows.length });
    }

    if (!player_name || !steamid64 || !item_name || (!server_name && !resolvedServerName)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    const row = {
      server_name: resolvedServerName || server_name!,
      player_name,
      steamid64,
      item_name,
      amount: amount ?? 1,
      currency: currency ?? "RP",
      cost: cost ?? 0,
    };

    await client.insert({ table: "shop_purchases", values: [row], format: "JSONEachRow" });

    await auditCreate("shop_purchase", `${steamid64}_${Date.now()}`, authResult.context, row, request);

    purchaseCache.clear();
    return NextResponse.json({ success: true, inserted: 1 });
  } catch (error) {
    console.error("Error inserting shop purchase:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to insert purchase" } },
      { status: 500 }
    );
  }
}

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
      await client.command({
        query: "ALTER TABLE shop_purchases DELETE WHERE server_name = {server_name:String}",
        query_params: { server_name },
      });
      await auditDelete("shop_purchases", `server_${server_name}`, authResult.context, { server_name }, request);
    } else {
      await client.command({ query: "TRUNCATE TABLE shop_purchases" });
      await auditDelete("shop_purchases", "all", authResult.context, { action: "truncate" }, request);
    }

    purchaseCache.clear();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing shop purchases:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to clear purchases" } },
      { status: 500 }
    );
  }
}
