import { NextRequest, NextResponse } from "next/server";
import { authenticateWithScope } from "@/services/api-auth";

interface BattlemetricsIdentifier {
  type: string;
  id: string;
  attributes: {
    type: string;
    identifier: string;
    metadata?: {
      profile?: {
        personaname: string;
        avatar: string;
        avatarmedium: string;
        avatarfull: string;
      };
    };
  };
}

interface BattlemetricsResponse {
  data: unknown;
  included?: BattlemetricsIdentifier[];
}

// SECURITY: Token from env vars only (no hardcoded values)
const BATTLEMETRICS_TOKEN = process.env.SERVERS_API_KEY || '';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverid: string }> }
): Promise<NextResponse> {
  // SECURITY: Auth check at route start
  const authResult = await authenticateWithScope(request, 'servers:read');
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
  }

  try {
    const resolvedParams = await params;
    const serverId = resolvedParams?.serverid;

    if (!serverId || serverId === "undefined") {
      return NextResponse.json({ success: false, error: "Server ID is required" }, { status: 400 });
    }

    if (!/^\d+$/.test(serverId)) {
      return NextResponse.json({ success: false, error: "Server ID must be numeric" }, { status: 400 });
    }

    const battlemetricsUrl = `https://api.battlemetrics.com/servers/${serverId}?include=player,identifier&fields[identifier]=type,identifier,metadata`;

    const response = await fetch(battlemetricsUrl, {
      headers: {
        Authorization: `Bearer ${BATTLEMETRICS_TOKEN}`,
        Accept: "application/json",
        "User-Agent": "Icefuse-Admin-Panel/1.0.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ success: false, error: "Invalid Battlemetrics token" }, { status: 401 });
      }
      if (response.status === 404) {
        return NextResponse.json({ success: false, error: `Server ${serverId} not found` }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: `Battlemetrics API error: ${response.status}` }, { status: response.status });
    }

    const data: BattlemetricsResponse = await response.json();

    const filteredData = {
      success: true,
      players: [] as Array<{
        steamID: string;
        personaname: string;
        avatar: string;
        avatarmedium: string;
        avatarfull: string;
      }>,
    };

    if (data.included) {
      const steamIdentifiersWithProfiles = data.included.filter(
        (item: BattlemetricsIdentifier) =>
          item.type === "identifier" && item.attributes?.type === "steamID" && item.attributes?.metadata?.profile
      );

      filteredData.players = steamIdentifiersWithProfiles.map((identifier: BattlemetricsIdentifier) => ({
        steamID: identifier.attributes.identifier,
        personaname: identifier.attributes.metadata!.profile!.personaname,
        avatar: identifier.attributes.metadata!.profile!.avatar,
        avatarmedium: identifier.attributes.metadata!.profile!.avatarmedium,
        avatarfull: identifier.attributes.metadata!.profile!.avatarfull,
      }));
    }

    return NextResponse.json(filteredData);
  } catch (error) {
    console.error("Error fetching Battlemetrics data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch server data", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
