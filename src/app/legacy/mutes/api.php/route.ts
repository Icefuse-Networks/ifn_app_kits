import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const action = searchParams.get("action");

  if (key !== process.env.MUTES_API_KEY) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    switch (action) {
      case "mute": {
        const playerSID = searchParams.get("playerSID");
        const adminSID = searchParams.get("adminSID");
        const reason = searchParams.get("reason");
        const endTime = searchParams.get("endTime");

        if (!playerSID || !reason || !endTime) {
          return NextResponse.json({ error: "Missing parameters for mute. Required: playerSID, reason, endTime" });
        }

        await prisma.mute.create({
          data: {
            playerSid64: BigInt(playerSID),
            adminSid64: adminSID ? BigInt(adminSID) : BigInt(0),
            reason,
            end: new Date(endTime),
          },
        });

        return NextResponse.json({ message: `${playerSID} has been successfully muted for ${reason} until ${endTime}` });
      }

      case "unmute": {
        const playerSID = searchParams.get("playerSID");

        if (!playerSID) {
          return NextResponse.json({ error: "Missing parameters for unmute. Required: playerSID" });
        }

        await prisma.mute.deleteMany({
          where: { playerSid64: BigInt(playerSID) },
        });

        return NextResponse.json({ message: `${playerSID} has been successfully unmuted.` });
      }

      case "list": {
        const playerSID = searchParams.get("playerSID");

        const mutes = await prisma.mute.findMany({
          where: playerSID ? { playerSid64: BigInt(playerSID) } : undefined,
          select: {
            playerSid64: true,
            reason: true,
            end: true,
          },
        });

        if (mutes.length === 0) {
          return NextResponse.json({ message: "No records found" });
        }

        return NextResponse.json(
          mutes.map((m) => ({
            PLAYER_SID64: m.playerSid64.toString(),
            REASON: m.reason,
            END: m.end.toISOString(),
          }))
        );
      }

      case "allactive": {
        const mutes = await prisma.mute.findMany({
          where: { end: { gte: new Date() } },
          orderBy: { end: "desc" },
          select: {
            playerSid64: true,
            end: true,
            reason: true,
          },
        });

        if (mutes.length === 0) {
          return NextResponse.json({ message: "No active mutes found" });
        }

        return NextResponse.json({
          mutes: mutes.map((m) => ({
            PLAYER_SID64: m.playerSid64.toString(),
            END: m.end.toISOString(),
            REASON: m.reason,
          })),
        });
      }

      case "purge": {
        const playerSID = searchParams.get("playerSID");

        if (playerSID) {
          await prisma.mute.deleteMany({
            where: { playerSid64: BigInt(playerSID) },
          });
          return NextResponse.json({ message: `All mutes for player ${playerSID} have been successfully purged.` });
        } else {
          await prisma.$executeRawUnsafe("TRUNCATE TABLE ifn_admin.mutes RESTART IDENTITY");
          return NextResponse.json({ message: "The mute database has been successfully purged." });
        }
      }

      case "init": {
        return NextResponse.json({ message: "Database initialized successfully." });
      }

      case "purgeold": {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        await prisma.mute.deleteMany({
          where: { end: { lte: thirtyDaysAgo } },
        });

        return NextResponse.json({ message: "Old records purged successfully." });
      }

      case "history": {
        const playerSID = searchParams.get("playerSID");

        if (!playerSID) {
          return NextResponse.json({ error: "Missing parameters for history. Required: playerSID" });
        }

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const count = await prisma.mute.count({
          where: {
            playerSid64: BigInt(playerSID),
            start: { gte: ninetyDaysAgo },
          },
        });

        return NextResponse.json({ history: [{ COUNT: count }] });
      }

      default:
        return NextResponse.json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error("Mutes API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
