import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";
import { auditUpdate } from "@/services/audit";

const idSchema = z.coerce.number().int().positive();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid config ID" }, { status: 400 });
  }

  try {
    const configId = parsedId.data;
    const existing = await prisma.shopConfig.findUnique({ where: { id: configId } });
    if (!existing) return NextResponse.json({ error: "Config not found" }, { status: 404 });

    const config = await prisma.shopConfig.update({
      where: { id: configId },
      data: { publishedVersion: existing.currentVersion },
    });

    await auditUpdate(
      "shop_config", String(configId), authResult.context,
      { publishedVersion: existing.publishedVersion },
      { publishedVersion: config.publishedVersion },
      request
    );

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error publishing shop config:", error);
    return NextResponse.json({ error: "Failed to publish config" }, { status: 500 });
  }
}
