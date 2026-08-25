import "server-only";
import type { AgentContext, ArchitectureOutput } from "./agent-types";

export function runArchitectAgent(context: AgentContext): ArchitectureOutput {
  const { evidence, modules } = context;

  const relevantModules = modules
    .filter((m) => evidence.some((e) => e.path.startsWith(m.name) || e.path.includes(m.name)))
    .map((m) => `${m.name} (${m.type})`);

  const patternsDetected: string[] = [];
  const findings: string[] = [];

  if (evidence.some((e) => e.path.includes("controller") || e.path.includes("route") || e.path.includes("api"))) {
    patternsDetected.push("API Controller / Route Layer Pattern");
  }
  if (evidence.some((e) => e.path.includes("service") || e.path.includes("feature"))) {
    patternsDetected.push("Domain Feature / Service Layer Pattern");
  }
  if (evidence.some((e) => e.path.includes("model") || e.path.includes("db") || e.path.includes("schema"))) {
    patternsDetected.push("Data Persistence / Repository Model Pattern");
  }

  if (patternsDetected.length === 0) {
    patternsDetected.push("Modular Component Architecture");
  }

  for (const item of evidence.slice(0, 3)) {
    findings.push(`Verified architectural structure in ${item.path} (lines ${item.startLine}–${item.endLine})`);
  }

  const structuralRisks: string[] = [];
  if (relevantModules.length > 4) {
    structuralRisks.push("High module coupling across multiple domain boundaries.");
  }

  return {
    findings,
    relevantModules: relevantModules.length > 0 ? relevantModules : modules.slice(0, 3).map((m) => m.name),
    patternsDetected,
    structuralRisks,
    confidence: evidence.length > 0 ? 0.88 : 0.4,
  };
}
