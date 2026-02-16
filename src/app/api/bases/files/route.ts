import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/services/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const uploadSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric with underscores/dashes"),
  fileData: z.string().min(1),
});

const deleteSchema = z.object({
  name: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const files = await prisma.basesFile.findMany({
      select: { id: true, name: true, fileSize: true, createdAt: true, updatedAt: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(files);
  } catch (error) {
    console.error("Error fetching bases files:", error);
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, fileData } = parsed.data;
    const fileSize = Math.ceil((fileData.length * 3) / 4);

    const file = await prisma.basesFile.upsert({
      where: { name },
      create: { name, fileData, fileSize },
      update: { fileData, fileSize },
    });

    return NextResponse.json({ id: file.id, name: file.name, fileSize: file.fileSize }, { status: 201 });
  } catch (error) {
    console.error("Error uploading bases file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireSession(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    await prisma.basesFile.delete({ where: { name: parsed.data.name } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bases file:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
