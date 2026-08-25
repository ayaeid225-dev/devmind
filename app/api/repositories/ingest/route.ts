import { NextRequest, NextResponse } from "next/server";
import { ingestRepository } from "@/lib/server/ingestion";
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
    const { owner, repo, branch } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, error: "Owner and repo are required parameters" },
        { status: 400 }
      );
    }

    const result = await ingestRepository({ owner, repo, branch });
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Repository ingestion failed";
    console.error("API POST /api/repositories/ingest error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
