import { NextRequest, NextResponse } from "next/server";
import { authorizeKnowledgeRepo } from "@/lib/server/knowledge/api-helper";
import { getFileKnowledge } from "@/lib/server/knowledge/queries";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authorizeKnowledgeRepo(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { repoId } = authResult.context;
    const { searchParams } = new URL(request.url);

    const path = searchParams.get("path")?.trim();
    if (!path) {
      return NextResponse.json(
        { success: false, error: "File path (path) is required" },
        { status: 400 }
      );
    }

    const fileKnowledge = await getFileKnowledge(repoId, path);
    if (!fileKnowledge) {
      return NextResponse.json(
        { success: false, error: `File not found in repository: "${path}"` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: fileKnowledge,
    });
  } catch (error) {
    console.error("GET /api/knowledge/file error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve file knowledge" },
      { status: 500 }
    );
  }
}
