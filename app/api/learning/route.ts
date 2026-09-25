import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { authorizeKnowledgeRepo } from "@/lib/server/knowledge/api-helper";
import { getRepositoryKnowledge } from "@/lib/server/knowledge/queries";
import { generateOnboardingPath } from "@/lib/onboarding-helper";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authorizeKnowledgeRepo(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { repoId } = authResult.context;
    const graphData = await getRepositoryKnowledge(repoId, {
      includeSymbols: true,
      includeDependencies: true,
    });

    const onboardingPath = generateOnboardingPath(graphData, {
      repoIdOverride: repoId,
    });

    return NextResponse.json({
      success: true,
      data: onboardingPath,
    });
  } catch (error) {
    console.error("API GET /api/learning error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate onboarding path" },
      { status: 500 }
    );
  }
}

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
    const { lessonId, completed } = body;

    return NextResponse.json({
      success: true,
      data: {
        lessonId,
        completed: Boolean(completed),
      },
      message: `Lesson "${lessonId}" progress updated.`,
    });
  } catch (error) {
    console.error("API POST /api/learning error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update lesson progress" },
      { status: 500 }
    );
  }
}
