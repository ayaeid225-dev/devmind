import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const repoId = searchParams.get("repoId");

  if (!repoId) {
    return NextResponse.json(
      { success: false, error: "repoId is required" },
      { status: 400 }
    );
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const repo = await db.repository.findFirst({
      where: { id: repoId },
      select: {
        id: true,
        name: true,
        embeddingStatus: true,
        embeddingError: true,
        indexedChunksCount: true,
        embeddingStartedAt: true,
        embeddingCompletedAt: true,
      },
    });

    if (!repo) {
      return NextResponse.json(
        { success: false, error: `Repository "${repoId}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: repo,
    });
  } catch (error) {
    console.error(`API GET /api/rag/status error:`, error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
