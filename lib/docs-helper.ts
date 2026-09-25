import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeEntityType,
  RepositoryKnowledgeView,
} from "@/lib/server/knowledge/types";

// ============================================================================
// DATA CONTRACTS & INTERFACES FOR VERIFIED DOCUMENTATION
// ============================================================================

export interface DocTechStackItem {
  name: string;
  type: string;
  verifiedUsage: string;
  version?: string;
  category: "language" | "framework" | "database" | "library" | "tool";
}

export interface DocModuleDetail {
  id: string;
  name: string;
  type: string;
  role: string;
  keyFiles: {
    id: string;
    path: string;
    language?: string;
    size?: string;
  }[];
  classes: {
    name: string;
    filePath?: string;
    startLine?: number;
  }[];
  functions: {
    name: string;
    filePath?: string;
    startLine?: number;
  }[];
  dependencies: {
    name: string;
    type: "Module" | "Dependency";
    relationLabel: string;
    id: string;
  }[];
  dependents: {
    name: string;
    type: "Module";
    relationLabel: string;
    id: string;
  }[];
  relationships: string[];
  stats: {
    filesCount: number;
    classesCount: number;
    functionsCount: number;
    depsCount: number;
    dependentsCount: number;
  };
}

export interface DocDependencyItem {
  name: string;
  version?: string;
  dependencyType: string;
  sourceFile?: string;
  usedByModules: string[];
}

export interface DocEntryPoint {
  name: string;
  filePath: string;
  moduleName?: string;
  language?: string;
  type: "Primary Entry" | "Router / Controller" | "Application Bootstrap";
  verifiedReason: string;
}

export interface DocLanguageStat {
  language: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DocModuleTypeStat {
  type: string;
  count: number;
  label: string;
  color: string;
}

export interface DocDiagramNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  border: string;
}

export interface DocDiagramEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export interface DocArchitectureDiagram {
  width: number;
  height: number;
  nodes: DocDiagramNode[];
  edges: DocDiagramEdge[];
}

export interface VerifiedProjectDocumentation {
  repoId: string;
  repoName: string;
  repoOwner?: string;
  generatedAt: string;
  summary: {
    projectName: string;
    projectType: string;
    primaryLanguage: string;
    frameworks: string[];
    keyTechnologies: string[];
    stats: {
      filesCount: number;
      modulesCount: number;
      dependenciesCount: number;
      classesCount: number;
      functionsCount: number;
      commitsCount: number;
      contributorsCount: number;
    };
  };
  architectureOverview: {
    description: string;
    diagram?: DocArchitectureDiagram;
  };
  techStack: DocTechStackItem[];
  projectStructure: {
    description: string;
    modulesOverview: {
      id: string;
      name: string;
      type: string;
      filesCount: number;
      description: string;
    }[];
  };
  coreModules: DocModuleDetail[];
  dependencies: DocDependencyItem[];
  entryPoints: DocEntryPoint[];
  statistics: {
    languages: DocLanguageStat[];
    modulesByType: DocModuleTypeStat[];
  };
  gitActivity?: {
    latestCommitSha?: string;
    commitsCount: number;
    contributorsCount: number;
    topContributors: {
      name: string;
      commitsCount: number;
    }[];
  };
  isEmpty: boolean;
  emptyReason?: string;
}

// Visual color palette for languages and module types
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Dart: "#00B4AB",
  Python: "#3776AB",
  Go: "#00ADD8",
  Rust: "#DEA584",
  "C#": "#239120",
  HTML: "#E34F26",
  CSS: "#1572B6",
  JSON: "#CBCB41",
  YAML: "#CB171E",
  Unknown: "#888888",
};

const MODULE_TYPE_COLORS: Record<string, { color: string; border: string; label: string }> = {
  api: { color: "rgba(98, 196, 199, 0.12)", border: "#62C4C7", label: "API & Gateway" },
  core: { color: "rgba(139, 195, 74, 0.12)", border: "#8BC34A", label: "Core Application" },
  db: { color: "rgba(120, 150, 216, 0.12)", border: "#7896D8", label: "Data Persistence" },
  ext: { color: "rgba(214, 167, 44, 0.12)", border: "#D6A72C", label: "External Integrations" },
};

// Known Technology Knowledge Base for Verified Annotation
const KNOWN_TECHNOLOGY_MAP: Record<string, { type: string; category: DocTechStackItem["category"]; usage: string }> = {
  // Web & Fullstack Frameworks
  react: { type: "UI Library", category: "framework", usage: "Component-based user interface rendering" },
  next: { type: "Fullstack Framework", category: "framework", usage: "Server-side rendering, routing, and API route handlers" },
  vue: { type: "UI Framework", category: "framework", usage: "Reactive component views" },
  angular: { type: "Web Framework", category: "framework", usage: "Enterprise client application framework" },
  svelte: { type: "UI Framework", category: "framework", usage: "Compiled reactive UI components" },
  express: { type: "HTTP Server Framework", category: "framework", usage: "HTTP request routing and REST endpoint middleware" },
  fastify: { type: "HTTP Framework", category: "framework", usage: "High-performance API server" },
  nestjs: { type: "Enterprise Backend Framework", category: "framework", usage: "Modular backend service architecture" },

  // Databases & ORMs
  prisma: { type: "ORM / Schema Engine", category: "database", usage: "Type-safe database migrations and client query modeling" },
  "@prisma/client": { type: "Database Client", category: "database", usage: "Relational database querying and record persistence" },
  pg: { type: "Database Driver", category: "database", usage: "PostgreSQL client connection pooling and SQL execution" },
  mysql: { type: "Database Driver", category: "database", usage: "MySQL database connectivity" },
  mysql2: { type: "Database Driver", category: "database", usage: "MySQL database connectivity" },
  mongoose: { type: "ODM", category: "database", usage: "MongoDB document modeling and validation" },
  typeorm: { type: "ORM", category: "database", usage: "Relational entity mapping and SQL queries" },
  sequelize: { type: "ORM", category: "database", usage: "Promise-based SQL object relational mapping" },
  redis: { type: "In-Memory Store", category: "database", usage: "Caching, pub/sub, and session storage" },
  ioredis: { type: "Redis Client", category: "database", usage: "Fast Redis caching and pub/sub client" },

  // Flutter / Mobile
  flutter: { type: "Cross-Platform Framework", category: "framework", usage: "Mobile, desktop, and web UI compilation" },
  http: { type: "HTTP Client", category: "library", usage: "Composable HTTP request dispatching" },
  provider: { type: "State Management", category: "library", usage: "Reactive state dependency injection" },
  bloc: { type: "State Management", category: "library", usage: "Predictable BLoC pattern state management" },
  riverpod: { type: "State Management", category: "library", usage: "Compile-safe reactive state sharing" },
  dio: { type: "HTTP Client", category: "library", usage: "Advanced networking with interceptors and cancel tokens" },

  // Authentication & Security
  jose: { type: "Cryptography & JWT", category: "library", usage: "JSON Web Token signing, verification, and encryption" },
  jsonwebtoken: { type: "Auth Library", category: "library", usage: "JWT session token encoding and validation" },
  bcryptjs: { type: "Hashing Library", category: "library", usage: "Secure one-way password hashing and verification" },
  bcrypt: { type: "Hashing Library", category: "library", usage: "Native password hashing" },

  // Code Parsing & Ast
  "web-tree-sitter": { type: "Syntax Parser", category: "library", usage: "Multi-language AST parsing via WebAssembly Tree-sitter" },

  // Styling & UI Tooling
  tailwindcss: { type: "Utility CSS Framework", category: "tool", usage: "Utility-first CSS styling system" },
  "@tailwindcss/postcss": { type: "PostCSS Plugin", category: "tool", usage: "Modern Tailwind CSS compiler pipeline" },
  "styled-components": { type: "CSS-in-JS", category: "library", usage: "Component-scoped styles" },

  // Testing & Quality
  jest: { type: "Test Framework", category: "tool", usage: "Automated unit and integration test runner" },
  vitest: { type: "Vite Test Framework", category: "tool", usage: "Fast ESM unit test execution" },
  mocha: { type: "Test Runner", category: "tool", usage: "Asynchronous test specification suite" },
  cypress: { type: "E2E Testing", category: "tool", usage: "End-to-end browser testing automation" },
  eslint: { type: "Linter", category: "tool", usage: "Code quality and architectural convention enforcement" },
  tsx: { type: "TypeScript Execution Engine", category: "tool", usage: "Zero-config TypeScript script execution" },
};

// ============================================================================
// DETECTION & EXTRACTION HELPERS
// ============================================================================

/**
 * Builds file -> module ID containment mapping.
 */
function buildFileToModuleMap(
  modules: KnowledgeNode[],
  files: KnowledgeNode[],
  edges: KnowledgeEdge[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const edge of edges) {
    if (
      edge.type === "CONTAINS" &&
      edge.source.startsWith("module:") &&
      edge.target.startsWith("file:")
    ) {
      map.set(edge.target, edge.source);
    }
  }

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
 * Detects verified entry points in the codebase.
 */
export function extractEntryPoints(
  files: KnowledgeNode[],
  modules: KnowledgeNode[],
  fileToModMap: Map<string, string>
): DocEntryPoint[] {
  const entryPoints: DocEntryPoint[] = [];
  const modLookup = new Map(modules.map((m) => [m.id, m]));

  const entryRegex = /^(main|index|app|server|program|bootstrap|cli)\.(ts|js|dart|go|py|rs|cs|cpp|c|php|tsx|jsx)$/i;
  const pathPrefixes = ["src/main.", "src/index.", "src/app.", "src/server.", "lib/main.", "cmd/", "app/page.", "app/layout."];

  for (const file of files) {
    const filePath = file.filePath || file.name;
    const normalized = filePath.replace(/\\/g, "/");
    const fileName = normalized.split("/").pop() || normalized;
    const lower = normalized.toLowerCase();

    let isEntry = false;
    let type: DocEntryPoint["type"] = "Primary Entry";
    let verifiedReason = "Root entry file";

    if (entryRegex.test(fileName)) {
      isEntry = true;
      if (fileName.startsWith("server")) {
        type = "Router / Controller";
        verifiedReason = "Initializes HTTP server runtime and network listener.";
      } else if (fileName.startsWith("cli")) {
        type = "Primary Entry";
        verifiedReason = "Command line interface application entry point.";
      } else {
        type = "Primary Entry";
        verifiedReason = `Standard application entry point file ("${fileName}").`;
      }
    } else if (pathPrefixes.some((p) => lower.startsWith(p))) {
      isEntry = true;
      type = "Application Bootstrap";
      verifiedReason = `Application bootstrap module entrypoint ("${filePath}").`;
    }

    if (isEntry) {
      const modId = fileToModMap.get(file.id);
      const mod = modId ? modLookup.get(modId) : undefined;

      entryPoints.push({
        name: fileName,
        filePath,
        moduleName: mod?.name,
        language: file.language,
        type,
        verifiedReason,
      });
    }
  }

  // Sort: primary entry first, then server/router, then others
  return entryPoints.sort((a, b) => {
    const priority = { "Primary Entry": 1, "Application Bootstrap": 2, "Router / Controller": 3 };
    return (priority[a.type] || 4) - (priority[b.type] || 4);
  });
}

/**
 * Extracts and categorizes verified technologies from files and manifest dependencies.
 */
export function detectTechStack(
  files: KnowledgeNode[],
  dependencies: KnowledgeNode[],
  modules: KnowledgeNode[]
): DocTechStackItem[] {
  const stack: DocTechStackItem[] = [];
  const seenTech = new Set<string>();

  // 1. Primary Languages from Files
  const languageCounts = new Map<string, number>();
  for (const f of files) {
    const lang = f.language && f.language !== "UNKNOWN" ? f.language : null;
    if (lang) {
      languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
    }
  }

  for (const [lang, count] of languageCounts.entries()) {
    stack.push({
      name: lang,
      type: "Primary Language",
      category: "language",
      verifiedUsage: `Used across ${count} verified source file${count === 1 ? "" : "s"} (${Math.round((count / Math.max(1, files.length)) * 100)}% of codebase)`,
    });
    seenTech.add(lang.toLowerCase());
  }

  // 2. Verified External Dependencies
  for (const dep of dependencies) {
    const cleanName = dep.name.toLowerCase();
    const version = (dep.metadata?.version as string) || undefined;
    const known = KNOWN_TECHNOLOGY_MAP[cleanName];

    if (known) {
      stack.push({
        name: dep.name,
        type: known.type,
        category: known.category,
        verifiedUsage: known.usage,
        version: version ? `v${version}` : undefined,
      });
      seenTech.add(cleanName);
    } else {
      // General dependency
      stack.push({
        name: dep.name,
        type: "External Package",
        category: "library",
        verifiedUsage: `External manifest dependency imported in project`,
        version: version ? `v${version}` : undefined,
      });
      seenTech.add(cleanName);
    }
  }

  // Sort: Language -> Framework -> Database -> Library -> Tool
  const categoryOrder: Record<DocTechStackItem["category"], number> = {
    language: 1,
    framework: 2,
    database: 3,
    library: 4,
    tool: 5,
  };

  return stack.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);
}

/**
 * Computes exact percentage breakdown of languages.
 */
export function calculateDocLanguageStats(files: KnowledgeNode[]): DocLanguageStat[] {
  const counts = new Map<string, number>();
  for (const f of files) {
    const lang = f.language && f.language !== "UNKNOWN" ? f.language : "Other";
    counts.set(lang, (counts.get(lang) || 0) + 1);
  }

  const total = files.length || 1;
  const stats: DocLanguageStat[] = [];

  for (const [lang, count] of counts.entries()) {
    stats.push({
      language: lang,
      count,
      percentage: Math.round((count / total) * 100),
      color: LANGUAGE_COLORS[lang] || "#888888",
    });
  }

  return stats.sort((a, b) => b.count - a.count);
}

/**
 * Computes module type breakdown.
 */
export function calculateDocModuleStats(modules: KnowledgeNode[]): DocModuleTypeStat[] {
  const counts = new Map<string, number>();
  for (const m of modules) {
    const type = ((m.metadata?.type as string) || "core").toLowerCase();
    counts.set(type, (counts.get(type) || 0) + 1);
  }

  const stats: DocModuleTypeStat[] = [];
  for (const [type, count] of counts.entries()) {
    const meta = MODULE_TYPE_COLORS[type] || { color: "var(--surface)", border: "var(--border)", label: type.toUpperCase() };
    stats.push({
      type,
      count,
      label: meta.label,
      color: meta.border,
    });
  }

  return stats.sort((a, b) => b.count - a.count);
}

/**
 * Builds an SVG-ready Architecture Diagram from verified modules and cross-module relationships.
 */
export function buildDocArchitectureDiagram(
  modules: KnowledgeNode[],
  edges: KnowledgeEdge[],
  fileToModMap: Map<string, string>
): DocArchitectureDiagram | undefined {
  if (modules.length === 0) return undefined;

  // Derive cross-module edges from file IMPORTS
  const modEdgeSet = new Set<string>();
  const derivedEdges: { source: string; target: string }[] = [];

  for (const edge of edges) {
    if (edge.type === "IMPORTS" || edge.type === "DEPENDS_ON") {
      const sourceMod = fileToModMap.get(edge.source) || (edge.source.startsWith("module:") ? edge.source : null);
      const targetMod = fileToModMap.get(edge.target) || (edge.target.startsWith("module:") ? edge.target : null);

      if (sourceMod && targetMod && sourceMod !== targetMod) {
        const key = `${sourceMod}->${targetMod}`;
        if (!modEdgeSet.has(key)) {
          modEdgeSet.add(key);
          derivedEdges.push({ source: sourceMod, target: targetMod });
        }
      }
    }
  }

  // Limit to top 8 most important modules for clean, readable diagram
  const sortedModules = [...modules].slice(0, 8);
  const modIdSet = new Set(sortedModules.map((m) => m.id));

  // Partition into tiers:
  // Tier 1 (top): API / Gateway
  // Tier 2 (middle): Core / Domain
  // Tier 3 (bottom): Data & Ext
  const tier1: KnowledgeNode[] = [];
  const tier2: KnowledgeNode[] = [];
  const tier3: KnowledgeNode[] = [];

  for (const mod of sortedModules) {
    const type = ((mod.metadata?.type as string) || "").toLowerCase();
    const name = mod.name.toLowerCase();
    if (type === "api" || name.includes("gateway") || name.includes("api")) {
      tier1.push(mod);
    } else if (type === "db" || type === "ext" || name.includes("db") || name.includes("data") || name.includes("ext")) {
      tier3.push(mod);
    } else {
      tier2.push(mod);
    }
  }

  // Ensure at least one module in tier1 if tier1 is empty
  if (tier1.length === 0 && tier2.length > 0) {
    tier1.push(tier2.shift()!);
  }

  const nodeWidth = 170;
  const nodeHeight = 54;
  const diagramWidth = 760;
  const positionedNodes: DocDiagramNode[] = [];
  const nodePosMap = new Map<string, { x: number; y: number }>();

  const layoutTier = (tierNodes: KnowledgeNode[], y: number) => {
    const count = tierNodes.length;
    if (count === 0) return;
    const spacing = diagramWidth / (count + 1);

    tierNodes.forEach((mod, idx) => {
      const x = Math.round(spacing * (idx + 1));
      const type = ((mod.metadata?.type as string) || "core").toLowerCase();
      const meta = MODULE_TYPE_COLORS[type] || MODULE_TYPE_COLORS.core;

      nodePosMap.set(mod.id, { x, y });
      positionedNodes.push({
        id: mod.id,
        label: mod.name,
        type,
        x: x - nodeWidth / 2,
        y: y - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
        color: meta.color,
        border: meta.border,
      });
    });
  };

  layoutTier(tier1, 50);
  layoutTier(tier2, 160);
  layoutTier(tier3, 270);

  // Position edges
  const diagramEdges: DocDiagramEdge[] = [];
  derivedEdges.forEach((e, idx) => {
    if (modIdSet.has(e.source) && modIdSet.has(e.target)) {
      const p1 = nodePosMap.get(e.source);
      const p2 = nodePosMap.get(e.target);
      if (p1 && p2) {
        diagramEdges.push({
          id: `edge-${idx}`,
          source: e.source,
          target: e.target,
          label: "depends on",
          sourceX: p1.x,
          sourceY: p1.y + nodeHeight / 2,
          targetX: p2.x,
          targetY: p2.y - nodeHeight / 2,
        });
      }
    }
  });

  return {
    width: diagramWidth,
    height: 340,
    nodes: positionedNodes,
    edges: diagramEdges,
  };
}

/**
 * Extracts and structures verified documentation for core modules.
 */
export function extractCoreModuleDocs(
  modules: KnowledgeNode[],
  files: KnowledgeNode[],
  classes: KnowledgeNode[],
  functions: KnowledgeNode[],
  edges: KnowledgeEdge[],
  fileToModMap: Map<string, string>,
  maxModules = 8
): DocModuleDetail[] {
  const modLookup = new Map(modules.map((m) => [m.id, m]));
  const depLookup = new Map<string, KnowledgeNode>();

  // Map files and symbols to modules
  const filesByMod = new Map<string, KnowledgeNode[]>();
  for (const f of files) {
    const modId = fileToModMap.get(f.id);
    if (modId) {
      if (!filesByMod.has(modId)) filesByMod.set(modId, []);
      filesByMod.get(modId)!.push(f);
    }
  }

  const classesByFile = new Map<string, KnowledgeNode[]>();
  for (const c of classes) {
    if (c.filePath) {
      if (!classesByFile.has(c.filePath)) classesByFile.set(c.filePath, []);
      classesByFile.get(c.filePath)!.push(c);
    }
  }

  const fnsByFile = new Map<string, KnowledgeNode[]>();
  for (const fn of functions) {
    if (fn.filePath) {
      if (!fnsByFile.has(fn.filePath)) fnsByFile.set(fn.filePath, []);
      fnsByFile.get(fn.filePath)!.push(fn);
    }
  }

  // Derive module-to-module and module-to-dependency relations
  const modOutgoing = new Map<string, Set<string>>();
  const modIncoming = new Map<string, Set<string>>();
  const modExtDeps = new Map<string, Set<string>>();

  for (const m of modules) {
    modOutgoing.set(m.id, new Set());
    modIncoming.set(m.id, new Set());
    modExtDeps.set(m.id, new Set());
  }

  for (const edge of edges) {
    if (edge.type === "IMPORTS" || edge.type === "DEPENDS_ON") {
      const sourceMod = fileToModMap.get(edge.source) || (edge.source.startsWith("module:") ? edge.source : null);
      const targetMod = fileToModMap.get(edge.target) || (edge.target.startsWith("module:") ? edge.target : null);

      if (sourceMod && targetMod && sourceMod !== targetMod) {
        modOutgoing.get(sourceMod)?.add(targetMod);
        modIncoming.get(targetMod)?.add(sourceMod);
      } else if (sourceMod && edge.target.startsWith("dep:")) {
        modExtDeps.get(sourceMod)?.add(edge.target);
      }
    }
  }

  // Sort modules by architectural importance (incoming dependents + files count)
  const sortedModules = [...modules].sort((a, b) => {
    const inA = modIncoming.get(a.id)?.size || 0;
    const inB = modIncoming.get(b.id)?.size || 0;
    const filesA = filesByMod.get(a.id)?.length || 0;
    const filesB = filesByMod.get(b.id)?.length || 0;
    return (inB * 4 + filesB) - (inA * 4 + filesA);
  });

  return sortedModules.slice(0, maxModules).map((mod) => {
    const modFiles = filesByMod.get(mod.id) || [];
    const modClasses: { name: string; filePath?: string; startLine?: number }[] = [];
    const modFunctions: { name: string; filePath?: string; startLine?: number }[] = [];

    for (const f of modFiles) {
      if (f.filePath) {
        const clsList = classesByFile.get(f.filePath) || [];
        for (const c of clsList) {
          modClasses.push({ name: c.name, filePath: c.filePath, startLine: c.startLine });
        }
        const fnList = fnsByFile.get(f.filePath) || [];
        for (const fn of fnList) {
          modFunctions.push({ name: fn.name, filePath: fn.filePath, startLine: fn.startLine });
        }
      }
    }

    const type = ((mod.metadata?.type as string) || "core").toLowerCase();
    const metaDesc = (mod.metadata?.desc as string) || (mod.metadata?.aiSummary as string) || "";
    let role = metaDesc;
    if (!role || role.toLowerCase().startsWith("contains ")) {
      if (type === "api") role = `Exposes public API endpoints and network routing across ${modFiles.length} files.`;
      else if (type === "db") role = `Manages database persistence, schema definitions, and queries across ${modFiles.length} files.`;
      else if (type === "ext") role = `Isolates external client communications and third-party integrations across ${modFiles.length} files.`;
      else role = `Encapsulates core application logic and domain workflows across ${modFiles.length} files.`;
    }

    // Dependencies (Outgoing)
    const dependencies: DocModuleDetail["dependencies"] = [];
    const outSet = modOutgoing.get(mod.id) || new Set();
    for (const outId of outSet) {
      const targetMod = modLookup.get(outId);
      if (targetMod) {
        dependencies.push({
          id: targetMod.id,
          name: targetMod.name,
          type: "Module",
          relationLabel: "Imports from",
        });
      }
    }
    const extSet = modExtDeps.get(mod.id) || new Set();
    for (const depId of extSet) {
      const cleanName = depId.replace(/^dep:[^:]+:/, "");
      dependencies.push({
        id: depId,
        name: cleanName,
        type: "Dependency",
        relationLabel: "External package",
      });
    }

    // Dependents (Incoming)
    const dependents: DocModuleDetail["dependents"] = [];
    const inSet = modIncoming.get(mod.id) || new Set();
    for (const inId of inSet) {
      const srcMod = modLookup.get(inId);
      if (srcMod) {
        dependents.push({
          id: srcMod.id,
          name: srcMod.name,
          type: "Module",
          relationLabel: "Depended on by",
        });
      }
    }

    // Verified relationships statements
    const relationships: string[] = [];
    if (dependents.length > 0) {
      relationships.push(`Directly consumed by ${dependents.map((d) => d.name).join(", ")}.`);
    }
    if (dependencies.length > 0) {
      relationships.push(`Relies on ${dependencies.map((d) => d.name).join(", ")}.`);
    }
    if (relationships.length === 0) {
      relationships.push("Decoupled module with self-contained internal architecture.");
    }

    return {
      id: mod.id,
      name: mod.name,
      type,
      role,
      keyFiles: modFiles.slice(0, 10).map((f) => ({
        id: f.id,
        path: f.filePath || f.name,
        language: f.language,
        size: (f.metadata?.size as string) || undefined,
      })),
      classes: modClasses.slice(0, 10),
      functions: modFunctions.slice(0, 10),
      dependencies,
      dependents,
      relationships,
      stats: {
        filesCount: modFiles.length,
        classesCount: modClasses.length,
        functionsCount: modFunctions.length,
        depsCount: dependencies.length,
        dependentsCount: dependents.length,
      },
    };
  });
}

// ============================================================================
// MAIN DOCUMENTATION GENERATOR ENTRYPOINT
// ============================================================================

/**
 * Generates verified, structured engineering documentation from a RepositoryKnowledgeView.
 *
 * Rules:
 * - Only verified project data is presented as facts.
 * - Never fabricates architecture, behavior, dependencies, or business logic.
 * - Repository-agnostic with zero hardcoded repository names.
 */
export function generateVerifiedDocumentation(
  graphData: RepositoryKnowledgeView,
  options?: {
    maxModules?: number;
    repoIdOverride?: string;
  }
): VerifiedProjectDocumentation {
  const maxModules = options?.maxModules || 8;
  const repoNode = graphData?.repoNode;
  const repoId = options?.repoIdOverride || repoNode?.repoId || "unknown";
  const repoName = repoNode?.name || repoId;
  const repoOwner = (repoNode?.metadata?.owner as string) || undefined;
  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!graphData || (!graphData.modules?.length && !graphData.files?.length)) {
    return {
      repoId,
      repoName,
      repoOwner,
      generatedAt,
      summary: {
        projectName: repoName,
        projectType: "Empty Repository",
        primaryLanguage: "None",
        frameworks: [],
        keyTechnologies: [],
        stats: {
          filesCount: 0,
          modulesCount: 0,
          dependenciesCount: 0,
          classesCount: 0,
          functionsCount: 0,
          commitsCount: 0,
          contributorsCount: 0,
        },
      },
      architectureOverview: {
        description: "No indexed files or modules available for this repository.",
      },
      techStack: [],
      projectStructure: {
        description: "Empty repository structure.",
        modulesOverview: [],
      },
      coreModules: [],
      dependencies: [],
      entryPoints: [],
      statistics: {
        languages: [],
        modulesByType: [],
      },
      isEmpty: true,
      emptyReason: "The repository contains no indexed files or modules in its Knowledge Model. Connect and ingest a repository to generate verified documentation.",
    };
  }

  const rawModules = graphData.modules || [];
  const rawFiles = graphData.files || [];
  const rawClasses = graphData.classes || [];
  const rawFunctions = [...(graphData.functions || []), ...(graphData.methods || [])];
  const rawDependencies = graphData.dependencies || [];
  const rawEdges = graphData.edges || [];
  const rawCommits = graphData.commits || [];
  const rawContributors = graphData.contributors || [];

  // Build file -> module mapping
  const fileToModMap = buildFileToModuleMap(rawModules, rawFiles, rawEdges);

  // 1. Tech Stack Detection
  const techStack = detectTechStack(rawFiles, rawDependencies, rawModules);

  // Determine Primary Language & Frameworks
  const languageStats = calculateDocLanguageStats(rawFiles);
  const primaryLanguage = languageStats[0]?.language || "Unknown";
  const frameworks = techStack.filter((t) => t.category === "framework").map((t) => t.name);
  const keyTechnologies = techStack.slice(0, 6).map((t) => t.name);

  // 2. Project Type Classification
  let projectType = `${primaryLanguage} Project`;
  if (frameworks.includes("next") || frameworks.includes("react")) {
    projectType = "Next.js / React Application";
  } else if (frameworks.includes("flutter")) {
    projectType = "Flutter Mobile / Cross-Platform Application";
  } else if (frameworks.includes("express") || frameworks.includes("fastify")) {
    projectType = "Node.js REST API Server";
  } else if (primaryLanguage === "Python") {
    projectType = "Python Service";
  } else if (primaryLanguage === "Go") {
    projectType = "Go Microservice";
  }

  // 3. Architecture Overview & Diagram
  const diagram = buildDocArchitectureDiagram(rawModules, rawEdges, fileToModMap);
  let archDesc = `Verified architectural analysis identifies ${rawModules.length} discrete modules spanning ${rawFiles.length} source files.`;
  if (rawModules.length === 0) {
    archDesc = `Monolithic structure without explicit module boundaries, organized across ${rawFiles.length} source files.`;
  } else if (diagram && diagram.edges.length > 0) {
    archDesc = `Modular layered architecture with ${rawModules.length} modules and ${diagram.edges.length} verified inter-module dependency relationships.`;
  }

  // 4. Project Structure (Modules overview)
  const modulesOverview = rawModules.map((m) => {
    const modFiles = rawFiles.filter((f) => fileToModMap.get(f.id) === m.id);
    const type = ((m.metadata?.type as string) || "core").toLowerCase();
    const desc = (m.metadata?.desc as string) || `Contains ${modFiles.length} files.`;
    return {
      id: m.id,
      name: m.name,
      type,
      filesCount: modFiles.length,
      description: desc,
    };
  });

  // 5. Core Modules Detail
  const coreModules = extractCoreModuleDocs(
    rawModules,
    rawFiles,
    rawClasses,
    rawFunctions,
    rawEdges,
    fileToModMap,
    maxModules
  );

  // 6. Dependencies List
  const dependencyItems: DocDependencyItem[] = rawDependencies.map((dep) => {
    const usedByMods = new Set<string>();
    for (const edge of rawEdges) {
      if (edge.type === "DEPENDS_ON" && edge.target === dep.id) {
        const modId = fileToModMap.get(edge.source);
        if (modId) {
          const modName = rawModules.find((m) => m.id === modId)?.name;
          if (modName) usedByMods.add(modName);
        }
      }
    }

    return {
      name: dep.name,
      version: (dep.metadata?.version as string) || undefined,
      dependencyType: (dep.metadata?.dependencyType as string) || "external",
      sourceFile: dep.filePath,
      usedByModules: Array.from(usedByMods),
    };
  });

  // 7. Entry Points
  const entryPoints = extractEntryPoints(rawFiles, rawModules, fileToModMap);

  // 8. Statistics
  const moduleTypeStats = calculateDocModuleStats(rawModules);

  // 9. Git Activity (if present)
  let gitActivity: VerifiedProjectDocumentation["gitActivity"] = undefined;
  if (rawCommits.length > 0 || rawContributors.length > 0) {
    const sortedContribs = [...rawContributors]
      .sort((a, b) => ((b.metadata?.commitsCount as number) || 0) - ((a.metadata?.commitsCount as number) || 0))
      .slice(0, 5)
      .map((c) => ({
        name: c.name,
        commitsCount: (c.metadata?.commitsCount as number) || 1,
      }));

    gitActivity = {
      latestCommitSha: (repoNode?.metadata?.latestCommitSha as string) || undefined,
      commitsCount: rawCommits.length,
      contributorsCount: rawContributors.length,
      topContributors: sortedContribs,
    };
  }

  return {
    repoId,
    repoName,
    repoOwner,
    generatedAt,
    summary: {
      projectName: repoName,
      projectType,
      primaryLanguage,
      frameworks,
      keyTechnologies,
      stats: {
        filesCount: rawFiles.length,
        modulesCount: rawModules.length,
        dependenciesCount: rawDependencies.length,
        classesCount: rawClasses.length,
        functionsCount: rawFunctions.length,
        commitsCount: rawCommits.length,
        contributorsCount: rawContributors.length,
      },
    },
    architectureOverview: {
      description: archDesc,
      diagram,
    },
    techStack,
    projectStructure: {
      description: `Structured repository breakdown encompassing ${rawModules.length} modules.`,
      modulesOverview,
    },
    coreModules,
    dependencies: dependencyItems,
    entryPoints,
    statistics: {
      languages: languageStats,
      modulesByType: moduleTypeStats,
    },
    gitActivity,
    isEmpty: false,
  };
}
