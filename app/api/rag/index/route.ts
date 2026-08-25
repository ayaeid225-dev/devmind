import { NextRequest, NextResponse } from "next/server";
import { indexRepositoryEmbeddings } from "@/lib/server/rag/indexer";
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
    const { repoId } = body;

    if (!repoId) {
      return NextResponse.json(
        { success: false, error: "repoId is required" },
        { status: 400 }
      );
    }

    const result = await indexRepositoryEmbeddings(repoId);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Embedding indexing failed";
    console.error("API POST /api/rag/index error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
