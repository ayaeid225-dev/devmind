import { NextRequest, NextResponse } from "next/server";
import { authorizeKnowledgeRepo } from "@/lib/server/knowledge/api-helper";
import { getSymbolKnowledge, findSymbolsByName } from "@/lib/server/knowledge/queries";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authorizeKnowledgeRepo(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { repoId } = authResult.context;
    const { searchParams } = new URL(request.url);

    const name = searchParams.get("name")?.trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Symbol name (name) is required" },
        { status: 400 }
      );
    }

    const filePath = searchParams.get("filePath")?.trim();
    const all = searchParams.get("all") === "true";

    // 1. Explicit request to list all matching symbols across files
    if (all) {
      const matches = await findSymbolsByName(repoId, name);
      return NextResponse.json({
        success: true,
        data: matches,
      });
    }

    // 2. Specific file requested -> Disambiguated single symbol lookup
    if (filePath) {
      const symbolKnowledge = await getSymbolKnowledge(repoId, name, filePath);
      if (!symbolKnowledge) {
        return NextResponse.json(
          { success: false, error: `Symbol "${name}" not found in "${filePath}"` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: symbolKnowledge,
      });
    }

    // 3. No filePath specified -> Check for duplicate symbol occurrences
    const matches = await findSymbolsByName(repoId, name);

    if (matches.length === 0) {
      return NextResponse.json(
        { success: false, error: `Symbol "${name}" not found in repository` },
        { status: 404 }
      );
    }

    if (matches.length === 1) {
      return NextResponse.json({
        success: true,
        data: matches[0],
      });
    }

    // Multiple symbols exist with the same name: do not guess
    return NextResponse.json(
      {
        success: false,
        ambiguous: true,
        error: `Multiple symbols found with name "${name}". Please specify filePath parameter to disambiguate.`,
        matches: matches.map((m) => ({
          name: m.symbolNode.name,
          type: m.symbolNode.type,
          filePath: m.fileNode?.filePath,
        })),
      },
      { status: 409 }
    );
  } catch (error) {
    console.error("GET /api/knowledge/symbol error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve symbol knowledge" },
      { status: 500 }
    );
  }
}
