import "server-only";
import type {
  AgentContext,
  PlannerOutput,
  ArchitectureOutput,
  DependencyOutput,
  ReviewOutput,
  SynthesisOutput,
} from "./agent-types";
import { validateCitations, type EvidenceCitation } from "../ai/validate";

export function runSynthesisAgent(
  context: AgentContext,
  planner: PlannerOutput,
  architect: ArchitectureOutput,
  dependency: DependencyOutput,
  review: ReviewOutput
): SynthesisOutput {
  const { question, evidence } = context;

  const rawCitations: EvidenceCitation[] = evidence.map((e, idx) => ({
    id: `ev-${idx + 1}`,
    path: e.path,
    startLine: e.startLine,
    endLine: e.endLine,
    snippet: e.content.slice(0, 150),
    relevance: e.score,
  }));

  const citations = validateCitations(rawCitations, evidence);

  const summary = `Multi-agent intelligence analysis completed for "${question}". Evaluated ${architect.relevantModules.length} modules and ${dependency.externalPackages.length} package dependencies across ${evidence.length} verified evidence chunks.`;

  const recommendation = `Review the identified patterns in ${architect.relevantModules.slice(0, 2).join(", ") || "core modules"} before modifying dependency contracts. Ensure architectural boundaries are respected as outlined in evidence items.`;

  const risks = Array.from(
    new Set([
      ...planner.perceivedRisks,
      ...architect.structuralRisks,
      ...dependency.dependencyRisks,
    ])
  );

  const avgConfidence = parseFloat(
    ((architect.confidence + dependency.confidence + review.confidence) / 3).toFixed(2)
  );

  return {
    summary,
    plan: planner,
    architecture: architect,
    dependencies: dependency,
    review,
    recommendation,
    risks,
    confidence: avgConfidence,
    citations,
  };
}
