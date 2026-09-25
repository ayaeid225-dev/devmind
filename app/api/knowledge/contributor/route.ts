import { NextRequest, NextResponse } from "next/server";
import { authorizeKnowledgeRepo } from "@/lib/server/knowledge/api-helper";
import { getContributorKnowledge } from "@/lib/server/knowledge/queries";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authorizeKnowledgeRepo(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { repoId } = authResult.context;
    const { searchParams } = new URL(request.url);

    const id = searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Contributor ID, identityKey, email or name (id) is required" },
        { status: 400 }
      );
    }

    const contributorKnowledge = await getContributorKnowledge(repoId, id);
    if (!contributorKnowledge) {
      return NextResponse.json(
        { success: false, error: `Contributor not found in repository: "${id}"` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: contributorKnowledge,
    });
  } catch (error) {
    console.error("GET /api/knowledge/contributor error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve contributor knowledge" },
      { status: 500 }
    );
  }
}
