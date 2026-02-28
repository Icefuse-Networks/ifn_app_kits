import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";
import { auditCreate } from "@/services/audit";

const createSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).trim().nullable().optional(),
  categoriesData: z.string().min(2).max(10_000_000),
  itemsData: z.string().min(2).max(10_000_000),
});

export async function GET(request: NextRequest) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const unstaged = request.nextUrl.searchParams.get("unstaged");
  try {
    const configs = await prisma.shopConfig.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true,
        currentVersion: true, publishedVersion: true, createdAt: true, updatedAt: true,
      },
    });
    if (unstaged === "true") {
      return NextResponse.json(configs.filter(c => c.currentVersion > (c.publishedVersion ?? 0)));
    }
    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching shop configs:", error);
    return NextResponse.json({ error: "Failed to fetch shop configs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, description, categoriesData, itemsData } = parsed.data;

    const config = await prisma.shopConfig.create({
      data: {
        name,
        description: description || null,
        categoriesData,
        itemsData,
        currentVersion: 1,
      },
    });

    await prisma.shopConfigVersion.create({
      data: { configId: config.id, categoriesData, itemsData, version: 1 },
    });

    await auditCreate("shop_config", String(config.id), authResult.context, { name }, request);

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("Error creating shop config:", error);
    return NextResponse.json({ error: "Failed to create shop config" }, { status: 500 });
  }
}
