import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { runMultiAgentAnalysis } from "@/lib/server/agents";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated: Please sign in to run multi-agent analysis" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { repositoryId = "clinic-management", question } = body;

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

    const result = await runMultiAgentAnalysis({
      repositoryId,
      question: question.trim(),
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Multi-agent analysis failed";
    console.error("API POST /api/agents/analyze error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
