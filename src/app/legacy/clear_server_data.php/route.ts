import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { server_id, secret_key } = body;

    if (!server_id || !secret_key) {
      return NextResponse.json({ error: "Missing Parameters" }, { status: 400 });
    }

    if (secret_key !== process.env.RUST_STATS_SECRET) {
      return NextResponse.json({ error: "Invalid Secret Key" }, { status: 403 });
    }

    if (server_id === "monthly") {
      await prisma.$transaction([
        prisma.rustStats.deleteMany(),
        prisma.rustStatsMonthly.deleteMany(),
      ]);
    } else {
      const serverId = parseInt(server_id);
      await prisma.rustStats.deleteMany({ where: { serverId } });
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Error clearing server data:", error);
    return NextResponse.json({ error: "Failed to clear data" }, { status: 500 });
  }
}
