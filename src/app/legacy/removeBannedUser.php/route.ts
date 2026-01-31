import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createHmac } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    const body = JSON.parse(bodyText);

    if (!body.SteamID64) {
      return NextResponse.json({ error: "Missing Parameters" }, { status: 400 });
    }

    const xSignature = request.headers.get("x-signature");
    if (!xSignature) {
      return NextResponse.json({ error: "Missing X-Signature" }, { status: 403 });
    }

    const parts = xSignature.replace(/t=|s=/g, "").split(",");
    const timestamp = parts[0];
    const signature = parts[1];

    const computedSignature = createHmac("sha256", process.env.REMOVE_BANNED_HMAC_SECRET || "")
      .update(`${timestamp}.${bodyText}`)
      .digest("hex");

    if (computedSignature !== signature) {
      return NextResponse.json({ error: "Invalid X-Signature" }, { status: 403 });
    }

    await new Promise((resolve) => setTimeout(resolve, 10000));

    const steamId64 = body.SteamID64;

    await prisma.$transaction([
      prisma.rustStats.deleteMany({ where: { steamid: steamId64 } }),
      prisma.rustStatsMonthly.deleteMany({ where: { steamid: steamId64 } }),
      prisma.rustStatsOverall.deleteMany({ where: { steamid: steamId64 } }),
    ]);

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Error removing banned user:", error);
    return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
  }
}
