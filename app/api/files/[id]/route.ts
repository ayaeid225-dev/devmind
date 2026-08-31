import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const file = await db.fileRecord.findFirst({
      where: { id },
      include: {
        module: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: file });
  } catch (error) {
    console.error(`GET /api/files/${id} error:`, error);
    return NextResponse.json({ success: false, error: "Failed to fetch file" }, { status: 500 });
  }
}
