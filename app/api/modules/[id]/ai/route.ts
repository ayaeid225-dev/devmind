import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { searchEvidence, type EvidenceResultItem } from "@/lib/server/rag/search";
import { GeminiLLMProvider } from "@/lib/server/ai/gemini";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const moduleRecord = await db.module.findFirst({
      where: { id },
    });

    if (!moduleRecord) {
      return NextResponse.json(
        { success: false, error: `Module "${id}" not found` },
        { status: 404 }
      );
    }

    const fileRecords = await db.fileRecord.findMany({
      where: { repoId: moduleRecord.repoId, moduleId: moduleRecord.id },
    });

    let evidence: EvidenceResultItem[] = [];
    try {
      evidence = await searchEvidence({
        repoId: moduleRecord.repoId,
        query: `module ${moduleRecord.name} ${moduleRecord.desc}`,
        limit: 3,
      });
    } catch {
      // Fallback
    }

    const geminiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6KWb3_GRPFKJHIIHB0PuhDHtg6iZ6kHAaTQcgagqCsLpA";
    const gemini = new GeminiLLMProvider(geminiKey, "gemini-3.6-flash");

    const prompt = `Analyze the "${moduleRecord.name}" module in this codebase.
Description: ${moduleRecord.desc}.
Files: ${fileRecords.map((f) => f.path).join(", ")}.

Code Evidence:
${evidence.map((e) => `[${e.path}]\n${e.content}`).join("\n\n")}

Provide a concise 2-3 sentence architectural summary explaining the role, dependencies, and importance of the ${moduleRecord.name} module.`;

    const aiSummary = await gemini.generateText(prompt);

    const updatedModule = await db.module.update({
      where: { id: moduleRecord.id },
      data: {
        aiSummary: aiSummary || moduleRecord.aiSummary,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedModule,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to generate module AI summary";
    console.error(`API POST /api/modules/${id}/ai error:`, error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
