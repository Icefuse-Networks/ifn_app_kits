import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  const method = (searchParams.get("method") || "GET").toUpperCase();
  const headersParam = searchParams.get("headers");
  let headers: Record<string, string> = {};

  try {
    if (headersParam) {
      headers = JSON.parse(headersParam);
    }
  } catch {
    headers = {};
  }

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
    });

    const responseHeaders: string[] = [];
    response.headers.forEach((value, key) => {
      responseHeaders.push(`${key}: ${value}`);
    });

    const responseBody = await response.json().catch(() => null);

    return NextResponse.json(
      { headers: responseHeaders, body: responseBody },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  const method = (searchParams.get("method") || "POST").toUpperCase();
  const headersParam = searchParams.get("headers");
  let headers: Record<string, string> = {};

  try {
    if (headersParam) {
      headers = JSON.parse(headersParam);
    }
  } catch {
    headers = {};
  }

  const body = await request.text();

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: body || undefined,
    });

    const responseHeaders: string[] = [];
    response.headers.forEach((value, key) => {
      responseHeaders.push(`${key}: ${value}`);
    });

    const responseBody = await response.json().catch(() => null);

    return NextResponse.json(
      { headers: responseHeaders, body: responseBody },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 });
  }
}
