export type KnowledgeEntityType =
  | "Repository"
  | "Module"
  | "File"
  | "Class"
  | "Function"
  | "Method"
  | "Commit"
  | "Contributor"
  | "Dependency";

export type KnowledgeRelationType =
  | "CONTAINS"
  | "IMPORTS"
  | "DEPENDS_ON"
  | "CHANGES"
  | "AUTHORED_BY"
  | "COMMITTED_BY"
  | "EXTENDS"
  | "IMPLEMENTS";

export interface KnowledgeNode {
  id: string;
  type: KnowledgeEntityType;
  name: string;
  label: string;
  repoId: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  type: KnowledgeRelationType;
  repoId: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeGraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<KnowledgeEntityType, number>;
  edgesByType: Record<KnowledgeRelationType, number>;
}

export interface KnowledgeGraph {
  repoId: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  stats: KnowledgeGraphStats;
}

export interface KnowledgeGraphOptions {
  entityTypes?: KnowledgeEntityType[];
  relationTypes?: KnowledgeRelationType[];
  maxDepth?: number;
  limitNodes?: number;
  includeSymbols?: boolean;
  includeCommits?: boolean;
  includeContributors?: boolean;
  includeDependencies?: boolean;
  commitLimit?: number;
}

export interface FileKnowledgeView {
  fileNode: KnowledgeNode;
  moduleNode?: KnowledgeNode;
  classes: KnowledgeNode[];
  functions: KnowledgeNode[];
  methods: KnowledgeNode[];
  imports: {
    targetFile?: string;
    dependencyNode?: KnowledgeNode;
    edge: KnowledgeEdge;
  }[];
  dependents: {
    sourceFile: string;
    sourceNode?: KnowledgeNode;
    edge: KnowledgeEdge;
  }[];
  externalDependencies: {
    dependencyNode: KnowledgeNode;
    edge: KnowledgeEdge;
  }[];
  recentCommits: {
    commitNode: KnowledgeNode;
    contributorNode?: KnowledgeNode;
    edge: KnowledgeEdge;
  }[];
}

export interface SymbolKnowledgeView {
  symbolNode: KnowledgeNode;
  fileNode?: KnowledgeNode;
  moduleNode?: KnowledgeNode;
  classNode?: KnowledgeNode;
  methods: KnowledgeNode[];
  parentClass?: KnowledgeNode;
  inboundEdges: KnowledgeEdge[];
  outboundEdges: KnowledgeEdge[];
}

export interface RepositoryKnowledgeView {
  repoNode: KnowledgeNode;
  modules: KnowledgeNode[];
  files: KnowledgeNode[];
  classes: KnowledgeNode[];
  functions: KnowledgeNode[];
  methods: KnowledgeNode[];
  dependencies: KnowledgeNode[];
  commits: KnowledgeNode[];
  contributors: KnowledgeNode[];
  edges: KnowledgeEdge[];
  stats: KnowledgeGraphStats;
}

export interface ContributorKnowledgeView {
  contributorNode: KnowledgeNode;
  authoredCommitsCount: number;
  committedCommitsCount: number;
  totalCommitsCount: number;
  additions: number;
  deletions: number;
  filesTouched: string[];
  touchedModules: KnowledgeNode[];
  recentCommits: KnowledgeNode[];
}
