import "server-only";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { searchEvidence, type EvidenceResultItem } from "../rag/search";
import type { AgentContext, SynthesisOutput } from "./agent-types";
import { runPlannerAgent } from "./planner-agent";
import { runArchitectAgent } from "./architect-agent";
import { runDependencyAgent } from "./dependency-agent";
import { runReviewAgent } from "./review-agent";
import { runSynthesisAgent } from "./synthesis-agent";

export interface MultiAgentAnalyzeParams {
  repositoryId: string;
  question: string;
}

export async function runMultiAgentAnalysis({
  repositoryId,
  question,
}: MultiAgentAnalyzeParams): Promise<SynthesisOutput> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthenticated: User must be signed in to run multi-agent analysis");
  }

  // 1. Verify Repository access
  const repo = await db.repository.findFirst({
    where: { id: repositoryId },
    include: {
      modules: true,
      dependencyRecords: true,
    },
  });

  if (!repo) {
    throw new Error(`Repository "${repositoryId}" not found or unauthorized`);
  }

  // 2. Fetch RAG Evidence Chunks
  let evidence: EvidenceResultItem[] = [];
  try {
    evidence = await searchEvidence({
      repoId: repositoryId,
      query: question,
      limit: 5,
    });
  } catch {
    // Fallback if RAG index empty
  }

  // 3. Assemble Shared Agent Context
  const context: AgentContext = {
    question,
    repositoryId,
    userId: user.id,
    evidence,
    modules: repo.modules.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      desc: m.desc,
    })),
    dependencies: repo.dependencyRecords.map((d) => ({
      kind: d.kind,
      name: d.name ?? undefined,
      fromModule: d.fromModule ?? undefined,
      toModule: d.toModule ?? undefined,
    })),
  };

  // 4. Bounded Single-Pass Pipeline Execution
  const plannerResult = runPlannerAgent(context);
  const architectResult = runArchitectAgent(context);
  const dependencyResult = runDependencyAgent(context);
  const reviewResult = runReviewAgent(context, plannerResult, architectResult, dependencyResult);
  const synthesisResult = runSynthesisAgent(
    context,
    plannerResult,
    architectResult,
    dependencyResult,
    reviewResult
  );

  return synthesisResult;
}
