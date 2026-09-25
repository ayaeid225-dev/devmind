import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { searchRepository } from "@/lib/server/rag/search";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated: User must be signed in to search" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get("repoId") || searchParams.get("repositoryId");
    const query = searchParams.get("q") ?? searchParams.get("query") ?? "";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;
    const type = (searchParams.get("type") as "all" | "file" | "chunk" | "module" | "doc") || "all";

    if (!repoId || !repoId.trim()) {
      return NextResponse.json(
        { success: false, error: "Repository parameter (repoId) is required" },
        { status: 400 }
      );
    }

    const searchData = await searchRepository({
      repoId: repoId.trim(),
      query: query.trim(),
      limit: Math.min(Math.max(limit, 1), 50),
      type,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: searchData,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Search failed";
    console.error("GET /api/search error:", error);

    const status = errorMsg.includes("not found")
      ? 404
      : errorMsg.includes("Unauthorized")
      ? 403
      : errorMsg.includes("Unauthenticated")
      ? 401
      : 500;

    return NextResponse.json(
      { success: false, error: errorMsg },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated: User must be signed in to search" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const repoId = body.repoId || body.repositoryId;
    const query = body.query ?? body.q ?? "";
    const limit = body.limit ? parseInt(body.limit, 10) : 20;
    const type = body.type || "all";

    if (!repoId || typeof repoId !== "string" || !repoId.trim()) {
      return NextResponse.json(
        { success: false, error: "Repository context (repoId) is required" },
        { status: 400 }
      );
    }

    const searchData = await searchRepository({
      repoId: repoId.trim(),
      query: typeof query === "string" ? query.trim() : "",
      limit: Math.min(Math.max(limit, 1), 50),
      type,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: searchData,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Search failed";
    console.error("POST /api/search error:", error);

    const status = errorMsg.includes("not found")
      ? 404
      : errorMsg.includes("Unauthorized")
      ? 403
      : errorMsg.includes("Unauthenticated")
      ? 401
      : 500;

    return NextResponse.json(
      { success: false, error: errorMsg },
      { status }
    );
  }
}
