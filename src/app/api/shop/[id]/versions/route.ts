import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";

const idSchema = z.coerce.number().int().positive();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const versions = await prisma.shopConfigVersion.findMany({
      where: { configId: parsedId.data },
      orderBy: { version: "desc" },
      select: { id: true, version: true, createdAt: true },
    });
    return NextResponse.json(versions);
  } catch (error) {
    console.error("Error fetching shop config versions:", error);
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }
}
