import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const versions = await prisma.lootConfigVersion.findMany({
      where: { configId: parseInt(id) },
      orderBy: { version: "desc" },
      select: { id: true, version: true, createdAt: true },
    });
    return NextResponse.json(versions);
  } catch (error) {
    console.error("Error fetching versions:", error);
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }
}
