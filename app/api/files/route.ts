import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get("repoId")?.trim();

    if (!repoId) {
      return NextResponse.json(
        { success: false, error: "Repository context (repoId) is required" },
        { status: 400 }
      );
    }

    const files = await db.fileRecord.findMany({
      where: { repoId },
      orderBy: { path: "asc" },
      include: {
        module: {
          select: { name: true, type: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: files });
  } catch (error) {
    console.error("GET /api/files error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch file records" }, { status: 500 });
  }
}
