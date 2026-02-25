import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { secureTokenCompare } from "@/lib/security/timing-safe";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const action = searchParams.get("action");

  // SECURITY: Timing-safe comparison to prevent timing attacks
  if (!key || !process.env.STAFF_API_KEY || !secureTokenCompare(key, process.env.STAFF_API_KEY)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    switch (action) {
      case "list": {
        const rank = searchParams.get("rank");

        const staff = await prisma.staff.findMany({
          where: rank ? { group: rank } : undefined,
          orderBy: { group: "asc" },
          select: {
            when: true,
            playerSid64: true,
            adminSid64: true,
            group: true,
          },
        });

        if (staff.length === 0) {
          return NextResponse.json({ message: "No records found" });
        }

        return NextResponse.json(
          staff.map((s) => ({
            WHEN: s.when.toISOString(),
            PLAYER_SID64: s.playerSid64.toString(),
            ADMIN_SID64: s.adminSid64.toString(),
            GROUP: s.group,
          }))
        );
      }

      case "promote": {
        const playerSID = searchParams.get("playerSID");
        const newRank = searchParams.get("newRank");
        const adminSID = searchParams.get("adminSID");

        if (!playerSID || !newRank || !adminSID) {
          return NextResponse.json({ error: "Missing parameters for promotion. Required: playerSID, newRank, adminSID" });
        }

        await prisma.$transaction(async (tx) => {
          await tx.staff.deleteMany({
            where: { playerSid64: BigInt(playerSID) },
          });

          await tx.staff.create({
            data: {
              playerSid64: BigInt(playerSID),
              adminSid64: BigInt(adminSID),
              group: newRank,
            },
          });
        });

        return NextResponse.json({ message: `${playerSID} has been successfully promoted to ${newRank}` });
      }

      case "demote": {
        const playerSID = searchParams.get("playerSID");

        if (!playerSID) {
          return NextResponse.json({ error: "Missing parameters for demotion. Required: playerSID" });
        }

        await prisma.staff.deleteMany({
          where: { playerSid64: BigInt(playerSID) },
        });

        return NextResponse.json({ message: `${playerSID} has been successfully demoted.` });
      }

      case "purge": {
        // SECURITY: Tagged template prevents SQL injection (vs $executeRawUnsafe)
        await prisma.$executeRaw`TRUNCATE TABLE ifn_admin.staff RESTART IDENTITY`;
        return NextResponse.json({ message: "The database has been successfully purged." });
      }

      default:
        return NextResponse.json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error("Staff API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
