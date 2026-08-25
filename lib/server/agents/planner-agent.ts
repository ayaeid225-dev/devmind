import "server-only";
import type { AgentContext, PlannerOutput } from "./agent-types";

export function runPlannerAgent(context: AgentContext): PlannerOutput {
  const { question, evidence } = context;

  const goal = `Investigate codebase architecture and requirements for: "${question}"`;
  const subQuestions = [
    `What structural modules are involved in "${question}"?`,
    `What dependencies are impacted by this change or feature?`,
    `What architectural risks or technical debt should be reviewed?`,
  ];

  const requiredEvidenceFocus = evidence.map((e) => e.path);
  const perceivedRisks: string[] = [];

  if (evidence.length === 0) {
    perceivedRisks.push("No indexed code evidence found; analysis relies on structural metadata.");
  } else if (evidence.length < 3) {
    perceivedRisks.push("Limited evidence chunks available; recommend broader repository indexing.");
  }

  return {
    goal,
    subQuestions,
    requiredEvidenceFocus,
    perceivedRisks,
  };
}
