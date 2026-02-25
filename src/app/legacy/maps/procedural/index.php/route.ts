import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { authenticateWithScope } from "@/services/api-auth";

// SECURITY: Max file size 5MB (base64 encoded)
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1.37; // ~6.85MB base64 for 5MB binary

export async function POST(request: NextRequest) {
  // SECURITY: Require auth
  const authResult = await authenticateWithScope(request, "servers:write");
  if (!authResult.success) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const size = formData.get("size") as string;
    const seed = formData.get("seed") as string;
    const byteData = formData.get("byteData") as string;

    if (!size || !seed || !byteData) {
      return new NextResponse("Missing required parameters", { status: 400 });
    }

    // SECURITY: Validate size and seed to prevent path traversal
    if (!/^\d{1,5}$/.test(size)) {
      return new NextResponse("Invalid size parameter", { status: 400 });
    }
    if (!/^\d{1,12}$/.test(seed)) {
      return new NextResponse("Invalid seed parameter", { status: 400 });
    }

    // SECURITY: Enforce max file size
    if (byteData.length > MAX_FILE_SIZE) {
      return new NextResponse("File too large", { status: 413 });
    }

    const dataDir = path.join(process.cwd(), "public", "maps", "procedural", "data");
    const fileName = `${size}${seed}.jpg`;

    // SECURITY: Verify resolved path stays within dataDir
    const filePath = path.resolve(dataDir, fileName);
    if (!filePath.startsWith(path.resolve(dataDir))) {
      return new NextResponse("Invalid file path", { status: 400 });
    }

    if (existsSync(filePath)) {
      return new NextResponse("Image already exists", { status: 200 });
    }

    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    const buffer = Buffer.from(byteData, "base64");
    await writeFile(filePath, buffer);

    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (error) {
    console.error("Map upload error:", error);
    return new NextResponse("Error processing image", { status: 500 });
  }
}
