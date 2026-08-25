import "server-only";
import type {
  AgentContext,
  PlannerOutput,
  ArchitectureOutput,
  DependencyOutput,
  ReviewOutput,
} from "./agent-types";

export function runReviewAgent(
  context: AgentContext,
  planner: PlannerOutput,
  architect: ArchitectureOutput,
  dependency: DependencyOutput
): ReviewOutput {
  const { evidence } = context;
  const contradictions: string[] = [];
  const missingEvidence: string[] = [];
  const unsupportedClaims: string[] = [];

  if (evidence.length === 0) {
    missingEvidence.push("No code chunks retrieved from vector index for target question.");
  }

  if (planner.perceivedRisks.length > 0) {
    for (const r of planner.perceivedRisks) {
      if (r.includes("No indexed code evidence")) {
        unsupportedClaims.push("Planner flagged missing code index verification.");
      }
    }
  }

  if (architect.structuralRisks.length > 0) {
    for (const r of architect.structuralRisks) {
      unsupportedClaims.push(`Architectural risk noted: ${r}`);
    }
  }

  if (dependency.dependencyRisks.length > 0) {
    for (const r of dependency.dependencyRisks) {
      unsupportedClaims.push(`Dependency risk noted: ${r}`);
    }
  }

  const auditPassed = contradictions.length === 0 && missingEvidence.length === 0;

  return {
    contradictions,
    missingEvidence,
    unsupportedClaims,
    auditPassed,
    confidence: auditPassed ? 0.95 : 0.7,
  };
}
