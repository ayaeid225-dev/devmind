import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, assertUserRepoAccess } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export interface RepoAuthContext {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  repoId: string;
}

export type AuthResult =
  | { success: true; context: RepoAuthContext }
  | { success: false; response: NextResponse };

/**
 * Validates session authentication, repoId parameter, repository existence,
 * and repository membership authorization according to DevMind conventions.
 */
export async function authorizeKnowledgeRepo(
  request: NextRequest,
  explicitRepoId?: string
): Promise<AuthResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: "Unauthenticated" },
          { status: 401 }
        ),
      };
    }

    const { searchParams } = new URL(request.url);
    const repoId = (explicitRepoId || searchParams.get("repoId"))?.trim();

    if (!repoId) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: "Repository context (repoId) is required" },
          { status: 400 }
        ),
      };
    }

    const repo = await db.repository.findUnique({
      where: { id: repoId },
    });

    if (!repo) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: `Repository not found: ${repoId}` },
          { status: 404 }
        ),
      };
    }

    const hasAccess = await assertUserRepoAccess(user.id, repoId);
    if (!hasAccess) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: "Forbidden: You do not have access to this repository" },
          { status: 403 }
        ),
      };
    }

    return {
      success: true,
      context: {
        user,
        repoId,
      },
    };
  } catch (error) {
    console.error("authorizeKnowledgeRepo error:", error);
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      ),
    };
  }
}
