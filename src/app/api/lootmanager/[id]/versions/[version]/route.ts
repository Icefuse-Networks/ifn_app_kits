import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; version: string }> }) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id, version } = await params;
  const parsed = paramsSchema.safeParse({ id, version });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    const versionRecord = await prisma.lootConfigVersion.findUnique({
      where: { configId_version: { configId: parsed.data.id, version: parsed.data.version } },
      select: { id: true, version: true, lootData: true, createdAt: true },
    });

    if (!versionRecord) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    return NextResponse.json(versionRecord);
  } catch (error) {
    console.error("Error fetching version:", error);
    return NextResponse.json({ error: "Failed to fetch version" }, { status: 500 });
  }
}
