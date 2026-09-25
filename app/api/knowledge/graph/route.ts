import { NextRequest, NextResponse } from "next/server";
import { authorizeKnowledgeRepo } from "@/lib/server/knowledge/api-helper";
import { getRepositoryKnowledge } from "@/lib/server/knowledge/queries";
import {
  KnowledgeEntityType,
  KnowledgeRelationType,
  KnowledgeGraphOptions,
} from "@/lib/server/knowledge/types";

const VALID_ENTITY_TYPES: Set<string> = new Set([
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

const VALID_RELATION_TYPES: Set<string> = new Set([
  "CONTAINS",
  "IMPORTS",
  "DEPENDS_ON",
  "CHANGES",
  "AUTHORED_BY",
  "COMMITTED_BY",
  "EXTENDS",
  "IMPLEMENTS",
]);

export async function GET(request: NextRequest) {
  try {
    const authResult = await authorizeKnowledgeRepo(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { repoId } = authResult.context;
    const { searchParams } = new URL(request.url);

    const options: KnowledgeGraphOptions = {};

    // 1. Entity Types Filter
    const entityTypesParam = searchParams.get("entityTypes")?.trim();
    if (entityTypesParam) {
      const types = entityTypesParam.split(",").map((t) => t.trim()).filter(Boolean);
      for (const t of types) {
        if (!VALID_ENTITY_TYPES.has(t)) {
          return NextResponse.json(
            { success: false, error: `Invalid entity type: "${t}"` },
            { status: 400 }
          );
        }
      }
      options.entityTypes = types as KnowledgeEntityType[];
    }

    // 2. Relation Types Filter
    const relationTypesParam = searchParams.get("relationTypes")?.trim();
    if (relationTypesParam) {
      const rels = relationTypesParam.split(",").map((r) => r.trim()).filter(Boolean);
      for (const r of rels) {
        if (!VALID_RELATION_TYPES.has(r)) {
          return NextResponse.json(
            { success: false, error: `Invalid relation type: "${r}"` },
            { status: 400 }
          );
        }
      }
      options.relationTypes = rels as KnowledgeRelationType[];
    }

    // 3. Inclusions
    if (searchParams.has("includeSymbols")) {
      options.includeSymbols = searchParams.get("includeSymbols") !== "false";
    }
    if (searchParams.has("includeCommits")) {
      options.includeCommits = searchParams.get("includeCommits") !== "false";
    }
    if (searchParams.has("includeContributors")) {
      options.includeContributors = searchParams.get("includeContributors") !== "false";
    }
    if (searchParams.has("includeDependencies")) {
      options.includeDependencies = searchParams.get("includeDependencies") !== "false";
    }

    // 4. Commit Limit
    const commitLimitParam = searchParams.get("commitLimit");
    if (commitLimitParam) {
      const parsedLimit = parseInt(commitLimitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        return NextResponse.json(
          { success: false, error: "commitLimit must be a positive integer" },
          { status: 400 }
        );
      }
      options.commitLimit = parsedLimit;
    }

    const repositoryKnowledge = await getRepositoryKnowledge(repoId, options);

    return NextResponse.json({
      success: true,
      data: repositoryKnowledge,
    });
  } catch (error) {
    console.error("GET /api/knowledge/graph error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve repository knowledge graph" },
      { status: 500 }
    );
  }
}
