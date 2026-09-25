import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { askAssistant } from "@/lib/server/ai/assistant";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated: Please sign in to use Ask DevMind" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const repoId = (body.repositoryId || body.repoId)?.trim();
    const question = body.question;

    if (!repoId) {
      return NextResponse.json(
        { success: false, error: "Repository context (repoId) is required for AI Assistant" },
        { status: 400 }
      );
    }

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Question parameter is required and cannot be empty" },
        { status: 400 }
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { success: false, error: "Question exceeds maximum length of 1000 characters" },
        { status: 400 }
      );
    }

    const aiResult = await askAssistant({
      repoId,
      question,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    const errorMsg = error instanceof Error ? error.message : "Failed to process question";
    console.error("API POST /api/ask error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: statusCode }
    );
  }
}
