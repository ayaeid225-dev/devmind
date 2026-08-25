import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { searchEvidence, type EvidenceResultItem } from "@/lib/server/rag/search";
import { getLLMProvider } from "@/lib/server/ai/provider";

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

    // 1. Search RAG Evidence
    let evidence: EvidenceResultItem[] = [];
    try {
      evidence = await searchEvidence({
        repoId: repositoryId,
        query: question.trim(),
        limit: 5,
      });
    } catch {
      // Fallback to empty evidence if repository chunk search is unavailable
    }

    // 2. Synthesize AI Answer using LLM Provider
    const provider = getLLMProvider();
    const aiResult = await provider.generateAnswer({
      question: question.trim(),
      evidence,
    });

    return NextResponse.json({
      success: true,
      data: aiResult,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to process question";
    console.error("API POST /api/ask error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
