import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";

const createSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).trim().nullable().optional(),
  lootData: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const unstaged = request.nextUrl.searchParams.get("unstaged");
  try {
    const configs = await prisma.lootConfig.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true,
        currentVersion: true, publishedVersion: true, createdAt: true, updatedAt: true
      },
    });
    if (unstaged === "true") {
      return NextResponse.json(configs.filter(c => c.currentVersion > (c.publishedVersion ?? 0)));
    }
    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching loot configs:", error);
    return NextResponse.json({ error: "Failed to fetch loot configs" }, { status: 500 });
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

    const { name, description, lootData } = parsed.data;

    const config = await prisma.lootConfig.create({
      data: {
        name,
        description: description || null,
        lootData,
        currentVersion: 1,
      },
    });

    await prisma.lootConfigVersion.create({
      data: { configId: config.id, lootData, version: 1 },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("Error creating loot config:", error);
    return NextResponse.json({ error: "Failed to create loot config" }, { status: 500 });
  }
}
