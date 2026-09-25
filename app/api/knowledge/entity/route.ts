import { NextRequest, NextResponse } from "next/server";
import { authorizeKnowledgeRepo } from "@/lib/server/knowledge/api-helper";
import {
  getFileKnowledge,
  getSymbolKnowledge,
  getContributorKnowledge,
  getRepositoryKnowledge,
} from "@/lib/server/knowledge/queries";
import { KnowledgeEntityType } from "@/lib/server/knowledge/types";

const SUPPORTED_ENTITY_TYPES: Set<KnowledgeEntityType> = new Set([
  "Repository",
  "Module",
  "File",
  "Class",
  "Function",
  "Method",
  "Commit",
  "Contributor",
  "Dependency",
]);

export async function GET(request: NextRequest) {
  try {
    const authResult = await authorizeKnowledgeRepo(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { repoId } = authResult.context;
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type")?.trim() as KnowledgeEntityType;
    if (!type) {
      return NextResponse.json(
        { success: false, error: "Entity type (type) is required" },
        { status: 400 }
      );
    }

    if (!SUPPORTED_ENTITY_TYPES.has(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported entity type "${type}". Supported types: ${Array.from(SUPPORTED_ENTITY_TYPES).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const id = searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Entity identifier (id) is required" },
        { status: 400 }
      );
    }

    const filePath = searchParams.get("filePath")?.trim();

    // Delegate to existing Query Layer based on entity type
    switch (type) {
      case "File": {
        const fileKnowledge = await getFileKnowledge(repoId, id);
        if (!fileKnowledge) {
          return NextResponse.json(
            { success: false, error: `File entity not found: "${id}"` },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, data: fileKnowledge });
      }

      case "Class":
      case "Function":
      case "Method": {
        const symbolKnowledge = await getSymbolKnowledge(repoId, id, filePath);
        if (!symbolKnowledge || symbolKnowledge.symbolNode.type !== type) {
          return NextResponse.json(
            { success: false, error: `${type} entity not found: "${id}"` },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, data: symbolKnowledge });
      }

      case "Contributor": {
        const contributorKnowledge = await getContributorKnowledge(repoId, id);
        if (!contributorKnowledge) {
          return NextResponse.json(
            { success: false, error: `Contributor entity not found: "${id}"` },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, data: contributorKnowledge });
      }

      case "Repository": {
        const repoKnowledge = await getRepositoryKnowledge(repoId);
        const matchesRepo =
          id === repoId ||
          id === repoKnowledge.repoNode.id ||
          id === repoKnowledge.repoNode.name;

        if (!matchesRepo) {
          return NextResponse.json(
            { success: false, error: `Repository entity not found: "${id}"` },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: repoKnowledge.repoNode,
        });
      }

      case "Module": {
        const repoKnowledge = await getRepositoryKnowledge(repoId);
        const moduleNode = repoKnowledge.modules.find(
          (m) =>
            m.id === id ||
            m.name === id ||
            m.id === `module:${repoId}:${id}`
        );

        if (!moduleNode) {
          return NextResponse.json(
            { success: false, error: `Module entity not found: "${id}"` },
            { status: 404 }
          );
        }

        // Include files contained in this module
        const moduleFiles = repoKnowledge.files.filter(
          (f) => f.metadata?.moduleId === moduleNode.id.split(":").pop()
        );

        return NextResponse.json({
          success: true,
          data: {
            moduleNode,
            files: moduleFiles,
          },
        });
      }

      case "Commit": {
        const repoKnowledge = await getRepositoryKnowledge(repoId);
        const commitNode = repoKnowledge.commits.find(
          (c) =>
            c.id === id ||
            c.name === id ||
            c.metadata?.sha === id ||
            c.id === `commit:${repoId}:${id}`
        );

        if (!commitNode) {
          return NextResponse.json(
            { success: false, error: `Commit entity not found: "${id}"` },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: commitNode });
      }

      case "Dependency": {
        const repoKnowledge = await getRepositoryKnowledge(repoId);
        const depNode = repoKnowledge.dependencies.find(
          (d) =>
            d.id === id ||
            d.name === id ||
            d.id === `dep:${repoId}:${id}`
        );

        if (!depNode) {
          return NextResponse.json(
            { success: false, error: `Dependency entity not found: "${id}"` },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: depNode });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unsupported entity type: "${type}"` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("GET /api/knowledge/entity error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve knowledge entity" },
      { status: 500 }
    );
  }
}
