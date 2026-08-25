import { NextRequest, NextResponse } from "next/server";
import { searchEvidence } from "@/lib/server/rag/search";
import { getCurrentUser } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { repoId, query, limit } = body;

    if (!repoId || !query) {
      return NextResponse.json(
        { success: false, error: "repoId and query are required" },
        { status: 400 }
      );
    }

    const evidence = await searchEvidence({ repoId, query, limit });
    return NextResponse.json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Evidence retrieval failed";
    console.error("API POST /api/rag/search error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
