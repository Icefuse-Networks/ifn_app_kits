import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";

const idSchema = z.coerce.number().int().positive();
const versionSchema = z.coerce.number().int().positive();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; version: string }> }) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id, version } = await params;
  const parsedId = idSchema.safeParse(id);
  const parsedVersion = versionSchema.safeParse(version);
  if (!parsedId.success || !parsedVersion.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    const versionData = await prisma.basesConfigVersion.findUnique({
      where: { configId_version: { configId: parsedId.data, version: parsedVersion.data } },
    });
    if (!versionData) return NextResponse.json({ error: "Version not found" }, { status: 404 });
    return NextResponse.json(versionData);
  } catch (error) {
    console.error("Error fetching bases config version:", error);
    return NextResponse.json({ error: "Failed to fetch version" }, { status: 500 });
  }
}
