import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/services/api-auth";

// SECURITY: Allowlist of domains this proxy is permitted to fetch from
const ALLOWED_DOMAINS = [
  "api.battlemetrics.com",
  "api.steampowered.com",
  "steamcommunity.com",
  "store.steampowered.com",
  "cdn.cloudflare.steamstatic.com",
];

function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    // SECURITY: Only allow HTTPS
    if (url.protocol !== "https:") return false;
    // SECURITY: Check against domain allowlist
    const hostname = url.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Require admin session
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  // SECURITY: Validate URL against allowlist to prevent SSRF
  if (!isAllowedUrl(targetUrl)) {
    return NextResponse.json({ error: "URL domain not allowed" }, { status: 403 });
  }

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const responseHeaders: string[] = [];
    response.headers.forEach((value, key) => {
      responseHeaders.push(`${key}: ${value}`);
    });

    const responseBody = await response.json().catch(() => null);

    return NextResponse.json({ headers: responseHeaders, body: responseBody });
  } catch {
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Require admin session
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  // SECURITY: Validate URL against allowlist to prevent SSRF
  if (!isAllowedUrl(targetUrl)) {
    return NextResponse.json({ error: "URL domain not allowed" }, { status: 403 });
  }

  const body = await request.text();

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: body || undefined,
    });

    const responseHeaders: string[] = [];
    response.headers.forEach((value, key) => {
      responseHeaders.push(`${key}: ${value}`);
    });

    const responseBody = await response.json().catch(() => null);

    return NextResponse.json({ headers: responseHeaders, body: responseBody });
  } catch {
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 });
  }
}
