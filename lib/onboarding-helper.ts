import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeEntityType,
  RepositoryKnowledgeView,
} from "@/lib/server/knowledge/types";

// ============================================================================
// ONBOARDING DATA CONTRACTS & INTERFACES
// ============================================================================

export type OnboardingCategory =
  | "entry"
  | "core"
  | "domain"
  | "data"
  | "integration"
  | "support";

export interface OnboardingCodeLocation {
  id: string;
  name: string;
  type: "File" | "Class" | "Function" | "Method" | "Module";
  filePath?: string;
  startLine?: number;
  endLine?: number;
  subLabel?: string;
  href: string;
}

export interface OnboardingRelatedEntity {
  id: string;
  name: string;
  type: KnowledgeEntityType;
  relation: "DEPENDS_ON" | "IMPORTS" | "CONTAINS" | "REQUIRED_BY";
  relationLabel: string;
  desc?: string;
  href?: string;
}

export interface OnboardingStep {
  stepNumber: number;
  id: string;
  title: string;
  entityType: "Module" | "File" | "Repository";
  category: OnboardingCategory;
  categoryLabel: string;
  roleExplanation: string;
  whyItMatters: string;
  importanceScore: number;
  isStartingPoint: boolean;

  // Architecture Context
  dependencies: OnboardingRelatedEntity[];
  dependents: OnboardingRelatedEntity[];
  relatedModules: OnboardingRelatedEntity[];

  // Code Navigation Locations
  files: OnboardingCodeLocation[];
  classes: OnboardingCodeLocation[];
  functions: OnboardingCodeLocation[];

  // Metrics & Stats
  stats: {
    filesCount: number;
    classesCount: number;
    functionsCount: number;
    dependenciesCount: number;
    dependentsCount: number;
  };

  // Direct Navigation
  primaryHref: string;
  mapHref: string;
}

export interface OnboardingSummary {
  totalSteps: number;
  estimatedMinutes: number;
  startingPointName: string;
  architectureType: string;
  coreModulesCount: number;
  totalFilesConsidered: number;
}

export interface OnboardingPath {
  repoId: string;
  repoName: string;
  repoOwner?: string;
  summary: OnboardingSummary;
  startingPoint: OnboardingStep | null;
  steps: OnboardingStep[];
  isEmpty: boolean;
  emptyReason?: string;
}

import type { BadgeVariant } from "@/components/ui";

// Category visual metadata
export const CATEGORY_LABELS: Record<OnboardingCategory, string> = {
  entry: "Entry Point & API Gateway",
  core: "Application Core",
  domain: "Domain Logic & Models",
  data: "Data & Persistence Layer",
  integration: "External Integrations",
  support: "Supporting & Utilities",
};

export const CATEGORY_BADGES: Record<OnboardingCategory, BadgeVariant> = {
  entry: "cyan",
  core: "lime",
  domain: "blue",
  data: "amber",
  integration: "gray",
  support: "outline",
};

// ============================================================================
// ENTRY POINT DETECTION PATTERNS
// ============================================================================

const ENTRY_FILE_PATTERNS = [
  /^main\.(ts|js|dart|go|py|rs|cs|cpp|c|php)$/i,
  /^index\.(ts|js|tsx|jsx)$/i,
  /^app\.(ts|js|tsx|py)$/i,
  /^server\.(ts|js)$/i,
  /^program\.cs$/i,
  /^(app\/layout|app\/page|pages\/_app|pages\/index)\.(tsx|jsx|js|ts)$/i,
  /^bootstrap\.(ts|js|php)$/i,
  /^cli\.(ts|js|go|py)$/i,
];

const ENTRY_PATH_PREFIXES = [
  "src/main.",
  "src/index.",
  "src/app.",
  "src/server.",
  "lib/main.",
  "lib/index.",
  "cmd/",
  "bin/",
];

// ============================================================================
// CORE HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if a file path matches entry point heuristics.
 */
export function isLikelyEntryFile(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() || normalized;

  if (
    ENTRY_FILE_PATTERNS.some(
      (pattern) => pattern.test(fileName) || pattern.test(normalized)
    )
  ) {
    return true;
  }

  const lower = normalized.toLowerCase();
  if (ENTRY_PATH_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }

  return false;
}

/**
 * Infers an architectural category based on module type, name, and contained files.
 */
export function inferArchitecturalCategory(
  mod: KnowledgeNode,
  modFiles: KnowledgeNode[],
  isEntry: boolean
): OnboardingCategory {
  if (isEntry) return "entry";

  const nameLower = (mod.name || "").toLowerCase();
  const typeLower = ((mod.metadata?.type as string) || "").toLowerCase();

  // 1. Data & Persistence
  if (
    typeLower === "db" ||
    nameLower.includes("db") ||
    nameLower.includes("data") ||
    nameLower.includes("database") ||
    nameLower.includes("model") ||
    nameLower.includes("prisma") ||
    nameLower.includes("repo") ||
    nameLower.includes("store") ||
    nameLower.includes("storage") ||
    nameLower.includes("cache")
  ) {
    return "data";
  }

  // 2. External Integration
  if (
    typeLower === "ext" ||
    nameLower.includes("ext") ||
    nameLower.includes("client") ||
    nameLower.includes("integration") ||
    nameLower.includes("adapter") ||
    nameLower.includes("thirdparty") ||
    nameLower.includes("sdk")
  ) {
    return "integration";
  }

  // 3. Entry / Gateway
  if (
    typeLower === "api" ||
    nameLower.includes("api") ||
    nameLower.includes("gateway") ||
    nameLower.includes("route") ||
    nameLower.includes("controller") ||
    nameLower.includes("server") ||
    nameLower.includes("http") ||
    nameLower.includes("entry")
  ) {
    return "entry";
  }

  // 4. Domain & Features
  if (
    nameLower.includes("domain") ||
    nameLower.includes("feature") ||
    nameLower.includes("biz") ||
    nameLower.includes("logic") ||
    nameLower.includes("service") ||
    nameLower.includes("usecase") ||
    nameLower.includes("handler")
  ) {
    return "domain";
  }

  // 5. Support & Utilities
  if (
    nameLower.includes("util") ||
    nameLower.includes("helper") ||
    nameLower.includes("common") ||
    nameLower.includes("shared") ||
    nameLower.includes("config") ||
    nameLower.includes("ui") ||
    nameLower.includes("component")
  ) {
    return "support";
  }

  // Check file paths if name didn't provide strong signal
  const filePaths = modFiles.map((f) => (f.filePath || f.name).toLowerCase());
  const hasModels = filePaths.some((p) => p.includes("model") || p.includes("entity") || p.includes("schema"));
  if (hasModels) return "domain";

  const hasApi = filePaths.some((p) => p.includes("api") || p.includes("route") || p.includes("controller"));
  if (hasApi) return "entry";

  return "core";
}

/**
 * Builds a file -> module ID mapping from containment edges and metadata.
 */
export function buildFileToModuleMap(
  modules: KnowledgeNode[],
  files: KnowledgeNode[],
  edges: KnowledgeEdge[]
): Map<string, string> {
  const map = new Map<string, string>();

  // 1. Direct CONTAINS edges: module -> file
  for (const edge of edges) {
    if (
      edge.type === "CONTAINS" &&
      edge.source.startsWith("module:") &&
      edge.target.startsWith("file:")
    ) {
      map.set(edge.target, edge.source);
    }
  }

  // 2. Metadata fallback
  for (const file of files) {
    if (!map.has(file.id)) {
      const modSlug = file.metadata?.moduleId as string;
      if (modSlug) {
        const parentMod = modules.find(
          (m) =>
            m.id.endsWith(`:${modSlug}`) ||
            m.name.toLowerCase() === modSlug.toLowerCase()
        );
        if (parentMod) {
          map.set(file.id, parentMod.id);
        }
      }
    }
  }

  return map;
}

/**
 * Detects the most appropriate entry point module or file in the repository.
 */
export function detectRecommendedStartingPoint(
  modules: KnowledgeNode[],
  files: KnowledgeNode[],
  fileToModMap: Map<string, string>,
  moduleOutgoingEdges: Map<string, Set<string>>,
  moduleIncomingEdges: Map<string, Set<string>>
): {
  startingModuleId: string | null;
  startingFileId: string | null;
  reason: string;
} {
  // Case A: Find entry point file
  const entryFiles = files.filter((f) => isLikelyEntryFile(f.filePath || f.name));

  if (entryFiles.length > 0) {
    // Pick the most prominent entry file (prefer main.*, index.*, app.* in root/src)
    const sortedEntryFiles = [...entryFiles].sort((a, b) => {
      const pathA = (a.filePath || a.name).toLowerCase();
      const pathB = (b.filePath || b.name).toLowerCase();
      const isMainA = pathA.includes("main.") ? 2 : pathA.includes("index.") ? 1 : 0;
      const isMainB = pathB.includes("main.") ? 2 : pathB.includes("index.") ? 1 : 0;
      if (isMainB !== isMainA) return isMainB - isMainA;
      return pathA.length - pathB.length;
    });

    const primaryEntryFile = sortedEntryFiles[0];
    const parentModId = fileToModMap.get(primaryEntryFile.id);

    if (parentModId) {
      const parentMod = modules.find((m) => m.id === parentModId);
      return {
        startingModuleId: parentModId,
        startingFileId: primaryEntryFile.id,
        reason: `Contains primary entry file "${primaryEntryFile.name}" (${primaryEntryFile.filePath || primaryEntryFile.name}).`,
      };
    }

    if (modules.length === 0) {
      return {
        startingModuleId: null,
        startingFileId: primaryEntryFile.id,
        reason: `Primary repository entry file "${primaryEntryFile.name}".`,
      };
    }
  }

  // Case B: Search modules for entry/gateway/api patterns
  const candidateScores = new Map<string, { score: number; reason: string }>();

  for (const mod of modules) {
    let score = 0;
    let reason = "High-level architectural entry point";
    const nameLower = mod.name.toLowerCase();
    const typeLower = ((mod.metadata?.type as string) || "").toLowerCase();

    if (nameLower.includes("gateway") || nameLower.includes("router")) {
      score += 25;
      reason = "Acts as the central gateway/router routing incoming interactions.";
    } else if (nameLower.includes("entry") || nameLower.includes("bootstrap") || nameLower.includes("server")) {
      score += 20;
      reason = "Initializes system bootstrapping and server runtime.";
    } else if (typeLower === "api" || nameLower.includes("api") || nameLower.includes("controller")) {
      score += 15;
      reason = "Exposes public API endpoints and client communication boundaries.";
    } else if (typeLower === "core" || nameLower.includes("core") || nameLower.includes("app")) {
      score += 10;
      reason = "Contains core application orchestration logic.";
    }

    // High out-degree with low in-degree indicates an entry orchestrator
    const outCount = moduleOutgoingEdges.get(mod.id)?.size || 0;
    const inCount = moduleIncomingEdges.get(mod.id)?.size || 0;

    if (outCount > 0 && inCount === 0) {
      score += 10;
    } else if (outCount > inCount) {
      score += 5;
    }

    candidateScores.set(mod.id, { score, reason });
  }

  let bestModId: string | null = null;
  let bestScore = -1;
  let bestReason = "Primary architectural component";

  for (const [modId, { score, reason }] of candidateScores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestModId = modId;
      bestReason = reason;
    }
  }

  if (bestModId) {
    return {
      startingModuleId: bestModId,
      startingFileId: null,
      reason: bestReason,
    };
  }

  // Fallback to first module
  if (modules.length > 0) {
    return {
      startingModuleId: modules[0].id,
      startingFileId: null,
      reason: "Initial architectural module in repository.",
    };
  }

  return {
    startingModuleId: null,
    startingFileId: files[0]?.id || null,
    reason: "Repository root code entry.",
  };
}

/**
 * Computes architectural importance score for a module.
 */
export function calculateModuleImportance(
  mod: KnowledgeNode,
  modFiles: KnowledgeNode[],
  modClasses: KnowledgeNode[],
  modFunctions: KnowledgeNode[],
  incomingModIds: Set<string>,
  outgoingModIds: Set<string>,
  externalDepIds: Set<string>,
  isStartingPoint: boolean
): number {
  let score = 0;

  // 1. Foundational importance: modules that many other modules depend on
  score += incomingModIds.size * 5;

  // 2. Orchestration importance: modules coordinating many subsystems
  score += outgoingModIds.size * 3;

  // 3. Code volume & density
  score += Math.min(modFiles.length * 2, 20);
  score += Math.min(modClasses.length * 1.5, 15);
  score += Math.min(modFunctions.length * 0.5, 10);

  // 4. External dependencies
  score += Math.min(externalDepIds.size * 2, 10);

  // 5. Architectural category weight
  const typeLower = ((mod.metadata?.type as string) || "").toLowerCase();
  if (typeLower === "core") score += 8;
  else if (typeLower === "api") score += 6;
  else if (typeLower === "db") score += 5;
  else if (typeLower === "ext") score += 3;

  // 6. Starting point boost
  if (isStartingPoint) {
    score += 12;
  }

  return Math.round(score);
}

/**
 * Generates factual explanation of a module's role without fabricating details.
 */
export function generateRoleExplanation(
  mod: KnowledgeNode,
  category: OnboardingCategory,
  filesCount: number,
  classesCount: number,
  keyFileNames: string[]
): string {
  const metadataDesc = (mod.metadata?.desc as string) || "";
  const aiSummary = (mod.metadata?.aiSummary as string) || "";

  if (aiSummary && aiSummary.trim().length > 10) {
    return aiSummary.trim();
  }

  if (metadataDesc && metadataDesc.trim().length > 10 && !metadataDesc.toLowerCase().startsWith("contains ")) {
    return metadataDesc.trim();
  }

  const fileExamples = keyFileNames.length > 0 ? ` (${keyFileNames.slice(0, 3).join(", ")})` : "";

  switch (category) {
    case "entry":
      return `Serves as the entry point and API boundary across ${filesCount} files${fileExamples}, receiving requests and directing interactions into the internal architecture.`;
    case "core":
      return `Contains ${filesCount} core application files${fileExamples} coordinating business workflows and orchestrating domain operations.`;
    case "domain":
      return `Encapsulates domain logic and business entities across ${filesCount} files${fileExamples}${classesCount > 0 ? ` with ${classesCount} defined domain classes` : ""}.`;
    case "data":
      return `Manages data persistence, schema definitions, and storage queries across ${filesCount} files${fileExamples}.`;
    case "integration":
      return `Isolates external service integrations, third-party client communications, and adapter boundaries across ${filesCount} files${fileExamples}.`;
    case "support":
    default:
      return `Houses ${filesCount} utility and supporting files${fileExamples} providing shared capabilities across the codebase.`;
  }
}

/**
 * Generates concrete senior-engineer architectural reasoning for why this module matters.
 */
export function generateWhyItMatters(
  category: OnboardingCategory,
  isStartingPoint: boolean,
  incomingCount: number,
  outgoingCount: number,
  depsCount: number,
  modName: string
): string {
  if (isStartingPoint) {
    return `Recommended Starting Point: Understanding ${modName} first gives you the initial mental model of how the application is initialized and how user or API interactions enter the codebase.`;
  }

  if (incomingCount >= 2) {
    return `High Architectural Impact: ${incomingCount} other modules directly depend on ${modName}. Understanding its contracts and exported interfaces prevents unintended regressions when working elsewhere.`;
  }

  if (category === "data") {
    return `Data Backbone: Encapsulates the application's schema and persistence layer. Knowing how models are structured here makes following business logic significantly easier.`;
  }

  if (category === "domain") {
    return `Domain Core: Represents the actual problem domain the codebase solves. Features and API endpoints directly map to the models defined here.`;
  }

  if (category === "integration") {
    return `External Boundary: Isolates external network dependencies (${depsCount} packages) from the core logic, keeping the system modular and testable.`;
  }

  if (outgoingCount >= 2) {
    return `Subsystem Orchestration: Connects to ${outgoingCount} other modules, making it a key coordinator of multiple architectural areas.`;
  }

  return `System Component: Provides focused functionality that supports the wider architecture.`;
}

// ============================================================================
// MAIN GENERATOR ENTRYPOINT: generateOnboardingPath
// ============================================================================

/**
 * Generates a dynamic, dependency-aware developer onboarding path from RepositoryKnowledgeView.
 *
 * Requirements fulfilled:
 * 1. Recommended Starting Point detection.
 * 2. Architectural module importance scoring.
 * 3. Ordered onboarding sequence respecting dependencies.
 * 4. Architecture context (dependencies, dependents, related modules).
 * 5. Direct code navigation to files, classes, functions, and modules.
 * 6. Completely dynamic and repository-agnostic with zero hardcoded repos.
 */
export function generateOnboardingPath(
  graphData: RepositoryKnowledgeView,
  options?: {
    maxSteps?: number;
    repoIdOverride?: string;
  }
): OnboardingPath {
  const maxSteps = options?.maxSteps || 8;
  const repoNode = graphData?.repoNode;
  const repoId = options?.repoIdOverride || repoNode?.repoId || "unknown";
  const repoName = repoNode?.name || repoId;
  const repoOwner = (repoNode?.metadata?.owner as string) || undefined;

  // Handle empty or missing repository data gracefully
  if (!graphData || (!graphData.modules?.length && !graphData.files?.length)) {
    return {
      repoId,
      repoName,
      repoOwner,
      summary: {
        totalSteps: 0,
        estimatedMinutes: 0,
        startingPointName: "N/A",
        architectureType: "Empty Repository",
        coreModulesCount: 0,
        totalFilesConsidered: 0,
      },
      startingPoint: null,
      steps: [],
      isEmpty: true,
      emptyReason: "This repository has no indexed modules or files yet. Connect and ingest a repository to generate its onboarding curriculum.",
    };
  }

  const rawModules = graphData.modules || [];
  const rawFiles = graphData.files || [];
  const rawClasses = graphData.classes || [];
  const rawFunctions = graphData.functions || [];
  const rawMethods = graphData.methods || [];
  const rawDependencies = graphData.dependencies || [];
  const rawEdges = graphData.edges || [];

  // 1. Build File -> Module Map
  const fileToModMap = buildFileToModuleMap(rawModules, rawFiles, rawEdges);

  // Group files by module
  const filesByModule = new Map<string, KnowledgeNode[]>();
  for (const file of rawFiles) {
    const modId = fileToModMap.get(file.id);
    if (modId) {
      if (!filesByModule.has(modId)) filesByModule.set(modId, []);
      filesByModule.get(modId)!.push(file);
    }
  }

  // Group symbols by file path
  const classesByFile = new Map<string, KnowledgeNode[]>();
  for (const cls of rawClasses) {
    if (cls.filePath) {
      if (!classesByFile.has(cls.filePath)) classesByFile.set(cls.filePath, []);
      classesByFile.get(cls.filePath)!.push(cls);
    }
  }

  const functionsByFile = new Map<string, KnowledgeNode[]>();
  for (const fn of [...rawFunctions, ...rawMethods]) {
    if (fn.filePath) {
      if (!functionsByFile.has(fn.filePath)) functionsByFile.set(fn.filePath, []);
      functionsByFile.get(fn.filePath)!.push(fn);
    }
  }

  // 2. Derive Module-to-Module and Module-to-Dependency relationships
  const modOutgoingMods = new Map<string, Set<string>>();
  const modIncomingMods = new Map<string, Set<string>>();
  const modOutgoingDeps = new Map<string, Set<string>>();

  for (const m of rawModules) {
    modOutgoingMods.set(m.id, new Set<string>());
    modIncomingMods.set(m.id, new Set<string>());
    modOutgoingDeps.set(m.id, new Set<string>());
  }

  for (const edge of rawEdges) {
    if (edge.type === "IMPORTS" || edge.type === "DEPENDS_ON") {
      const sourceMod = fileToModMap.get(edge.source) || (edge.source.startsWith("module:") ? edge.source : null);
      const targetMod = fileToModMap.get(edge.target) || (edge.target.startsWith("module:") ? edge.target : null);

      if (sourceMod && targetMod && sourceMod !== targetMod) {
        modOutgoingMods.get(sourceMod)?.add(targetMod);
        modIncomingMods.get(targetMod)?.add(sourceMod);
      } else if (sourceMod && edge.target.startsWith("dep:")) {
        modOutgoingDeps.get(sourceMod)?.add(edge.target);
      }
    }
  }

  // 3. Detect Recommended Starting Point
  const { startingModuleId, startingFileId, reason: startingReason } = detectRecommendedStartingPoint(
    rawModules,
    rawFiles,
    fileToModMap,
    modOutgoingMods,
    modIncomingMods
  );

  // 4. Handle Case: Modules exist vs Flat Repository
  interface CandidateComponent {
    id: string;
    node: KnowledgeNode;
    type: "Module" | "File";
    containedFiles: KnowledgeNode[];
    containedClasses: KnowledgeNode[];
    containedFunctions: KnowledgeNode[];
    isStartingPoint: boolean;
    startingReason?: string;
  }

  const candidates: CandidateComponent[] = [];

  if (rawModules.length > 0) {
    for (const mod of rawModules) {
      const modFiles = filesByModule.get(mod.id) || [];
      const modClasses: KnowledgeNode[] = [];
      const modFunctions: KnowledgeNode[] = [];

      for (const f of modFiles) {
        if (f.filePath) {
          const fCls = classesByFile.get(f.filePath) || [];
          modClasses.push(...fCls);
          const fFns = functionsByFile.get(f.filePath) || [];
          modFunctions.push(...fFns);
        }
      }

      const isStarting = mod.id === startingModuleId;
      candidates.push({
        id: mod.id,
        node: mod,
        type: "Module",
        containedFiles: modFiles,
        containedClasses: modClasses,
        containedFunctions: modFunctions,
        isStartingPoint: isStarting,
        startingReason: isStarting ? startingReason : undefined,
      });
    }
  } else {
    // Flat repository without modules: create candidate steps from top files
    const sortedFiles = [...rawFiles].sort((a, b) => {
      const isStartA = a.id === startingFileId ? 1 : 0;
      const isStartB = b.id === startingFileId ? 1 : 0;
      if (isStartB !== isStartA) return isStartB - isStartA;
      const countA = (classesByFile.get(a.filePath || "")?.length || 0) + (functionsByFile.get(a.filePath || "")?.length || 0);
      const countB = (classesByFile.get(b.filePath || "")?.length || 0) + (functionsByFile.get(b.filePath || "")?.length || 0);
      return countB - countA;
    });

    for (const file of sortedFiles.slice(0, maxSteps)) {
      const fCls = classesByFile.get(file.filePath || "") || [];
      const fFns = functionsByFile.get(file.filePath || "") || [];
      const isStarting = file.id === startingFileId;

      candidates.push({
        id: file.id,
        node: file,
        type: "File",
        containedFiles: [file],
        containedClasses: fCls,
        containedFunctions: fFns,
        isStartingPoint: isStarting,
        startingReason: isStarting ? startingReason : undefined,
      });
    }
  }

  // 5. Score Candidates & Select the Most Critical (up to maxSteps)
  const scoredCandidates = candidates.map((cand) => {
    const incoming = cand.type === "Module" ? modIncomingMods.get(cand.id) || new Set() : new Set<string>();
    const outgoing = cand.type === "Module" ? modOutgoingMods.get(cand.id) || new Set() : new Set<string>();
    const extDeps = cand.type === "Module" ? modOutgoingDeps.get(cand.id) || new Set() : new Set<string>();

    const score = calculateModuleImportance(
      cand.node,
      cand.containedFiles,
      cand.containedClasses,
      cand.containedFunctions,
      incoming,
      outgoing,
      extDeps,
      cand.isStartingPoint
    );

    const category = inferArchitecturalCategory(cand.node, cand.containedFiles, cand.isStartingPoint);

    return {
      ...cand,
      score,
      category,
      incoming,
      outgoing,
      extDeps,
    };
  });

  // Ensure starting point is guaranteed in the selected set
  const startingCandidate = scoredCandidates.find((c) => c.isStartingPoint);
  let otherCandidates = scoredCandidates
    .filter((c) => !c.isStartingPoint)
    .sort((a, b) => b.score - a.score);

  // Take top candidates
  const selectedCandidates = startingCandidate
    ? [startingCandidate, ...otherCandidates.slice(0, maxSteps - 1)]
    : otherCandidates.slice(0, maxSteps);

  // 6. Dependency-Aware Ordering (Curriculum Sequencing)
  // Categories priority: entry -> core -> domain -> data -> integration -> support
  const categoryPriority: Record<OnboardingCategory, number> = {
    entry: 1,
    core: 2,
    domain: 3,
    data: 4,
    integration: 5,
    support: 6,
  };

  const orderedCandidates = [...selectedCandidates].sort((a, b) => {
    // Starting point is unconditionally Step 1
    if (a.isStartingPoint) return -1;
    if (b.isStartingPoint) return 1;

    // Architectural tier ordering
    const priorityA = categoryPriority[a.category];
    const priorityB = categoryPriority[b.category];
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Dependency ordering within same tier:
    // If B depends on A, A should come first
    if (a.incoming.has(b.id)) return -1;
    if (b.incoming.has(a.id)) return 1;

    // Fallback to score
    return b.score - a.score;
  });

  // Lookup dictionary for quick navigation linking
  const modLookup = new Map(rawModules.map((m) => [m.id, m]));
  const depLookup = new Map(rawDependencies.map((d) => [d.id, d]));

  // 7. Construct Final Onboarding Steps
  const steps: OnboardingStep[] = orderedCandidates.map((cand, idx) => {
    const stepNumber = idx + 1;
    const category = cand.category;
    const keyFileNames = cand.containedFiles.map((f) => f.name);

    const roleExplanation = generateRoleExplanation(
      cand.node,
      category,
      cand.containedFiles.length,
      cand.containedClasses.length,
      keyFileNames
    );

    const whyItMatters = cand.isStartingPoint && cand.startingReason
      ? `${cand.startingReason} ${generateWhyItMatters(category, true, cand.incoming.size, cand.outgoing.size, cand.extDeps.size, cand.node.name)}`
      : generateWhyItMatters(
          category,
          cand.isStartingPoint,
          cand.incoming.size,
          cand.outgoing.size,
          cand.extDeps.size,
          cand.node.name
        );

    // Dependencies (Outgoing)
    const dependencies: OnboardingRelatedEntity[] = [];
    for (const outId of cand.outgoing) {
      const targetMod = modLookup.get(outId);
      if (targetMod) {
        dependencies.push({
          id: targetMod.id,
          name: targetMod.name,
          type: "Module",
          relation: "DEPENDS_ON",
          relationLabel: "Imports & uses",
          desc: (targetMod.metadata?.desc as string) || undefined,
          href: `/app/modules/${encodeURIComponent(targetMod.id)}?repoId=${encodeURIComponent(repoId)}`,
        });
      }
    }
    for (const depId of cand.extDeps) {
      const depNode = depLookup.get(depId);
      if (depNode) {
        dependencies.push({
          id: depNode.id,
          name: depNode.name,
          type: "Dependency",
          relation: "DEPENDS_ON",
          relationLabel: "External package",
          desc: depNode.metadata?.version ? `v${depNode.metadata.version}` : undefined,
          href: `/app/deps?repoId=${encodeURIComponent(repoId)}`,
        });
      }
    }

    // Dependents (Incoming)
    const dependents: OnboardingRelatedEntity[] = [];
    for (const inId of cand.incoming) {
      const sourceMod = modLookup.get(inId);
      if (sourceMod) {
        dependents.push({
          id: sourceMod.id,
          name: sourceMod.name,
          type: "Module",
          relation: "REQUIRED_BY",
          relationLabel: "Depended on by",
          desc: (sourceMod.metadata?.desc as string) || undefined,
          href: `/app/modules/${encodeURIComponent(sourceMod.id)}?repoId=${encodeURIComponent(repoId)}`,
        });
      }
    }

    // Related Modules
    const relatedModules: OnboardingRelatedEntity[] = [...dependencies, ...dependents].filter(
      (rel, index, self) => rel.type === "Module" && self.findIndex((r) => r.id === rel.id) === index
    );

    // Code navigation: Files
    const files: OnboardingCodeLocation[] = cand.containedFiles.slice(0, 10).map((f) => ({
      id: f.id,
      name: f.name,
      type: "File",
      filePath: f.filePath || f.name,
      subLabel: f.language ? `${f.language} • ${f.filePath || f.name}` : f.filePath || f.name,
      href: `/app/files?repoId=${encodeURIComponent(repoId)}&search=${encodeURIComponent(f.name)}`,
    }));

    // Code navigation: Classes
    const classes: OnboardingCodeLocation[] = cand.containedClasses.slice(0, 8).map((cls) => ({
      id: cls.id,
      name: cls.name,
      type: "Class",
      filePath: cls.filePath,
      startLine: cls.startLine,
      endLine: cls.endLine,
      subLabel: cls.filePath ? `${cls.filePath}${cls.startLine ? `:${cls.startLine}` : ""}` : undefined,
      href: `/app/knowledge?repoId=${encodeURIComponent(repoId)}&tab=symbols&search=${encodeURIComponent(cls.name)}`,
    }));

    // Code navigation: Functions
    const functions: OnboardingCodeLocation[] = cand.containedFunctions.slice(0, 8).map((fn) => ({
      id: fn.id,
      name: fn.name,
      type: fn.type as "Function" | "Method",
      filePath: fn.filePath,
      startLine: fn.startLine,
      endLine: fn.endLine,
      subLabel: fn.filePath ? `${fn.filePath}${fn.startLine ? `:${fn.startLine}` : ""}` : undefined,
      href: `/app/knowledge?repoId=${encodeURIComponent(repoId)}&tab=symbols&search=${encodeURIComponent(fn.name)}`,
    }));

    const primaryHref = cand.type === "Module"
      ? `/app/modules/${encodeURIComponent(cand.id)}?repoId=${encodeURIComponent(repoId)}`
      : `/app/files?repoId=${encodeURIComponent(repoId)}&search=${encodeURIComponent(cand.node.name)}`;

    const mapHref = `/app/map?repoId=${encodeURIComponent(repoId)}&node=${encodeURIComponent(cand.id)}`;

    return {
      stepNumber,
      id: cand.id,
      title: cand.node.name,
      entityType: cand.type,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      roleExplanation,
      whyItMatters,
      importanceScore: cand.score,
      isStartingPoint: cand.isStartingPoint,
      dependencies,
      dependents,
      relatedModules,
      files,
      classes,
      functions,
      stats: {
        filesCount: cand.containedFiles.length,
        classesCount: cand.containedClasses.length,
        functionsCount: cand.containedFunctions.length,
        dependenciesCount: dependencies.length,
        dependentsCount: dependents.length,
      },
      primaryHref,
      mapHref,
    };
  });

  const startingPoint = steps.find((s) => s.isStartingPoint) || steps[0] || null;

  // Infer architecture type summary
  let architectureType = "Modular Layered Architecture";
  if (rawModules.length === 0) {
    architectureType = "Monolithic / Direct File Structure";
  } else if (rawModules.length > 10) {
    architectureType = "Multi-Package Micro-Component Architecture";
  } else if (rawModules.some((m) => m.name.toLowerCase().includes("feature"))) {
    architectureType = "Feature-First Modular Architecture";
  }

  const estimatedMinutes = Math.max(10, steps.length * 4);

  return {
    repoId,
    repoName,
    repoOwner,
    summary: {
      totalSteps: steps.length,
      estimatedMinutes,
      startingPointName: startingPoint ? startingPoint.title : "N/A",
      architectureType,
      coreModulesCount: steps.filter((s) => s.category === "core" || s.category === "entry").length,
      totalFilesConsidered: rawFiles.length,
    },
    startingPoint,
    steps,
    isEmpty: steps.length === 0,
  };
}
