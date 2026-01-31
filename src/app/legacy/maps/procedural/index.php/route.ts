import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const size = formData.get("size") as string;
    const seed = formData.get("seed") as string;
    const byteData = formData.get("byteData") as string;

    if (!size || !seed || !byteData) {
      return new NextResponse(`Invalid settings: Size: ${size}, Seed: ${seed}, Data: ${byteData ? "present" : "missing"}`, {
        status: 400,
      });
    }

    const dataDir = path.join(process.cwd(), "public", "maps", "procedural", "data");
    const filePath = path.join(dataDir, `${size}${seed}.jpg`);

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
