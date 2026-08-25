import "server-only";
import type { EvidenceResultItem } from "../rag/search";
import type { EvidenceCitation } from "../ai/validate";

export interface AgentContext {
  question: string;
  repositoryId: string;
  userId: string;
  evidence: EvidenceResultItem[];
  modules: Array<{ id: string; name: string; type: string; desc: string }>;
  dependencies: Array<{ kind: string; name?: string; fromModule?: string; toModule?: string }>;
}

export interface PlannerOutput {
  goal: string;
  subQuestions: string[];
  requiredEvidenceFocus: string[];
  perceivedRisks: string[];
}

export interface ArchitectureOutput {
  findings: string[];
  relevantModules: string[];
  patternsDetected: string[];
  structuralRisks: string[];
  confidence: number;
}

export interface DependencyOutput {
  findings: string[];
  internalDependencies: string[];
  externalPackages: string[];
  dependencyRisks: string[];
  confidence: number;
}

export interface ReviewOutput {
  contradictions: string[];
  missingEvidence: string[];
  unsupportedClaims: string[];
  auditPassed: boolean;
  confidence: number;
}

export interface SynthesisOutput {
  summary: string;
  plan: PlannerOutput;
  architecture: ArchitectureOutput;
  dependencies: DependencyOutput;
  review: ReviewOutput;
  recommendation: string;
  risks: string[];
  confidence: number;
  citations: EvidenceCitation[];
}
