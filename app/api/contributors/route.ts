import { NextRequest, NextResponse } from "next/server";
import { authorizeKnowledgeRepo } from "@/lib/server/knowledge/api-helper";
import { getContributors } from "@/lib/server/contributors/service";
import type { ContributorQueryOptions } from "@/lib/server/contributors/types";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authorizeKnowledgeRepo(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { repoId } = authResult.context;
    const { searchParams } = new URL(request.url);

    const options: ContributorQueryOptions = {};

    // 1. Role Filter ("author" | "committer")
    const roleParam = searchParams.get("role")?.trim().toLowerCase();
    if (roleParam) {
      if (roleParam !== "author" && roleParam !== "committer") {
        return NextResponse.json(
          { success: false, error: 'Invalid role filter. Must be "author" or "committer"' },
          { status: 400 }
        );
      }
      options.role = roleParam;
    }

    // 2. Sort By ("commits" | "additions" | "recent" | "name")
    const sortByParam = searchParams.get("sortBy")?.trim().toLowerCase();
    if (sortByParam) {
      if (!["commits", "additions", "recent", "name"].includes(sortByParam)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid sortBy filter. Must be one of: "commits", "additions", "recent", "name"',
          },
          { status: 400 }
        );
      }
      options.sortBy = sortByParam as "commits" | "additions" | "recent" | "name";
    }

    // 3. Limit & Offset
    const limitParam = searchParams.get("limit");
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json(
          { success: false, error: "limit must be a positive integer" },
          { status: 400 }
        );
      }
      options.limit = parsed;
    }

    const offsetParam = searchParams.get("offset");
    if (offsetParam) {
      const parsed = parseInt(offsetParam, 10);
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json(
          { success: false, error: "offset must be a non-negative integer" },
          { status: 400 }
        );
      }
      options.offset = parsed;
    }

    // 4. Include recent authored commits
    if (searchParams.has("includeCommits")) {
      options.includeCommits = searchParams.get("includeCommits") !== "false";
    }

    const contributors = await getContributors(repoId, options);

    return NextResponse.json({
      success: true,
      data: contributors,
    });
  } catch (error) {
    console.error("GET /api/contributors error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contributors" },
      { status: 500 }
    );
  }
}
