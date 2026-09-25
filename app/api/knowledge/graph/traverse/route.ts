import { NextRequest, NextResponse } from "next/server";
import { authorizeKnowledgeRepo } from "@/lib/server/knowledge/api-helper";
import { traverseKnowledgeGraph } from "@/lib/server/knowledge/queries";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authorizeKnowledgeRepo(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { repoId } = authResult.context;
    const { searchParams } = new URL(request.url);

    const startNodeId = searchParams.get("startNodeId")?.trim();
    if (!startNodeId) {
      return NextResponse.json(
        { success: false, error: "startNodeId is required for graph traversal" },
        { status: 400 }
      );
    }

    let maxDepth = 1;
    const maxDepthParam = searchParams.get("maxDepth");
    if (maxDepthParam) {
      const parsedDepth = parseInt(maxDepthParam, 10);
      if (isNaN(parsedDepth) || parsedDepth < 1 || parsedDepth > 5) {
        return NextResponse.json(
          { success: false, error: "maxDepth must be an integer between 1 and 5" },
          { status: 400 }
        );
      }
      maxDepth = parsedDepth;
    }

    const subgraph = await traverseKnowledgeGraph(repoId, startNodeId, maxDepth);

    return NextResponse.json({
      success: true,
      data: subgraph,
    });
  } catch (error) {
    console.error("GET /api/knowledge/graph/traverse error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to traverse knowledge graph" },
      { status: 500 }
    );
  }
}
