import "server-only";
import type { AgentContext, DependencyOutput } from "./agent-types";

export function runDependencyAgent(context: AgentContext): DependencyOutput {
  const { dependencies, evidence } = context;

  const externalPackages = dependencies
    .filter((d) => d.kind === "external" && d.name)
    .map((d) => d.name!);

  const internalDependencies = dependencies
    .filter((d) => d.kind === "internal" && d.fromModule && d.toModule)
    .map((d) => `${d.fromModule} -> ${d.toModule}`);

  const findings: string[] = [];
  if (externalPackages.length > 0) {
    findings.push(`Identified ${externalPackages.length} package dependencies (e.g. ${externalPackages.slice(0, 3).join(", ")})`);
  }
  if (internalDependencies.length > 0) {
    findings.push(`Identified ${internalDependencies.length} internal module import connections`);
  }

  const dependencyRisks: string[] = [];
  if (evidence.some((e) => e.path.endsWith("package.json") || e.path.endsWith("pubspec.yaml"))) {
    findings.push("Validated manifest dependency file in codebase evidence.");
  }

  return {
    findings,
    internalDependencies: internalDependencies.slice(0, 5),
    externalPackages: externalPackages.slice(0, 5),
    dependencyRisks,
    confidence: dependencies.length > 0 ? 0.9 : 0.6,
  };
}
