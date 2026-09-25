import "server-only";
import {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphOptions,
  RepositoryKnowledgeView,
  FileKnowledgeView,
  SymbolKnowledgeView,
  ContributorKnowledgeView,
} from "./types";
import {
  buildRepositoryKnowledgeGraph,
  getFileKnowledge,
  getSymbolKnowledge,
  getContributorKnowledge,
  traverseKnowledgeGraph,
} from "./service";
import { extractSymbolsFromFile } from "./extractor";
import { db } from "../db";

/**
 * Reusable query for retrieving structured repository knowledge.
 * Partitions the full knowledge graph into discrete entity collections.
 */
export async function getRepositoryKnowledge(
  repoId: string,
  options?: KnowledgeGraphOptions
): Promise<RepositoryKnowledgeView> {
  const graph = await buildRepositoryKnowledgeGraph(repoId, options);

  let repoNode = graph.nodes.find((n) => n.type === "Repository");
  if (!repoNode) {
    repoNode = {
      id: `repo:${repoId}`,
      type: "Repository",
      name: repoId,
      label: repoId,
      repoId,
    };
  }

  const modules: KnowledgeNode[] = [];
  const files: KnowledgeNode[] = [];
  const classes: KnowledgeNode[] = [];
  const functions: KnowledgeNode[] = [];
  const methods: KnowledgeNode[] = [];
  const dependencies: KnowledgeNode[] = [];
  const commits: KnowledgeNode[] = [];
  const contributors: KnowledgeNode[] = [];

  for (const node of graph.nodes) {
    switch (node.type) {
      case "Module":
        modules.push(node);
        break;
      case "File":
        files.push(node);
        break;
      case "Class":
        classes.push(node);
        break;
      case "Function":
        functions.push(node);
        break;
      case "Method":
        methods.push(node);
        break;
      case "Dependency":
        dependencies.push(node);
        break;
      case "Commit":
        commits.push(node);
        break;
      case "Contributor":
        contributors.push(node);
        break;
    }
  }

  return {
    repoNode,
    modules,
    files,
    classes,
    functions,
    methods,
    dependencies,
    commits,
    contributors,
    edges: graph.edges,
    stats: graph.stats,
  };
}

/**
 * Re-exports the file knowledge query.
 */
export { getFileKnowledge };

/**
 * Re-exports the symbol knowledge query.
 */
export { getSymbolKnowledge };

/**
 * Re-exports the contributor knowledge query.
 */
export { getContributorKnowledge };

/**
 * Re-exports the graph traversal query.
 */
export { traverseKnowledgeGraph };

/**
 * Finds all matching symbols across files when duplicate symbol names exist.
 */
export async function findSymbolsByName(
  repoId: string,
  symbolName: string
): Promise<SymbolKnowledgeView[]> {
  const files = await db.fileRecord.findMany({
    where: { repoId },
    include: { module: true },
  });

  const results: SymbolKnowledgeView[] = [];
  const lowerQuery = symbolName.toLowerCase();

  for (const file of files) {
    if (!file.symbolsJson) continue;

    const { classes, functions, methods, edges } = extractSymbolsFromFile(
      repoId,
      file.path,
      file.symbolsJson,
      file.language
    );

    const fileNode: KnowledgeNode = {
      id: `file:${repoId}:${file.path}`,
      type: "File",
      name: file.path.split("/").pop() || file.path,
      label: file.path,
      repoId,
      filePath: file.path,
      language: file.language,
    };

    const moduleNode: KnowledgeNode | undefined = file.module
      ? {
          id: `module:${repoId}:${file.module.id}`,
          type: "Module",
          name: file.module.name,
          label: `Module ${file.module.name} (${file.module.type})`,
          repoId,
          metadata: {
            type: file.module.type,
            desc: file.module.desc,
          },
        }
      : undefined;

    // Check Classes
    for (const cls of classes) {
      if (cls.name.toLowerCase() === lowerQuery) {
        const classMethods = methods.filter(
          (m) => (m.metadata?.className as string) === cls.name
        );
        results.push({
          symbolNode: cls,
          fileNode,
          moduleNode,
          methods: classMethods,
          inboundEdges: edges.filter((e) => e.target === cls.id),
          outboundEdges: edges.filter((e) => e.source === cls.id),
        });
      }
    }

    // Check Functions
    for (const fn of functions) {
      if (fn.name.toLowerCase() === lowerQuery) {
        results.push({
          symbolNode: fn,
          fileNode,
          moduleNode,
          methods: [],
          inboundEdges: edges.filter((e) => e.target === fn.id),
          outboundEdges: edges.filter((e) => e.source === fn.id),
        });
      }
    }

    // Check Methods
    for (const method of methods) {
      if (method.name.toLowerCase() === lowerQuery) {
        const parentClassName = method.metadata?.className as string;
        const parentClass = classes.find((c) => c.name === parentClassName);

        results.push({
          symbolNode: method,
          fileNode,
          moduleNode,
          parentClass,
          methods: [],
          inboundEdges: edges.filter((e) => e.target === method.id),
          outboundEdges: edges.filter((e) => e.source === method.id),
        });
      }
    }
  }

  return results;
}

/**
 * Returns which files a given file imports (internal dependencies).
 */
export async function getFileImports(
  repoId: string,
  filePath: string
): Promise<string[]> {
  const fileKnowledge = await getFileKnowledge(repoId, filePath);
  if (!fileKnowledge) {
    return [];
  }

  const targets = fileKnowledge.imports
    .map((i) => i.targetFile)
    .filter(Boolean) as string[];

  return Array.from(new Set(targets));
}

/**
 * Returns which files depend on (import) a given file.
 */
export async function getFileDependents(
  repoId: string,
  filePath: string
): Promise<string[]> {
  const fileKnowledge = await getFileKnowledge(repoId, filePath);
  if (!fileKnowledge) {
    return [];
  }

  const sources = fileKnowledge.dependents
    .map((d) => d.sourceFile)
    .filter(Boolean);

  return Array.from(new Set(sources));
}

/**
 * Returns which commits changed a given file.
 */
export async function getFileCommits(
  repoId: string,
  filePath: string
): Promise<KnowledgeNode[]> {
  const fileKnowledge = await getFileKnowledge(repoId, filePath);
  if (!fileKnowledge) {
    return [];
  }

  return fileKnowledge.recentCommits.map((c) => c.commitNode);
}

/**
 * Returns distinct contributors who modified a given file across its commit history.
 */
export async function getFileContributors(
  repoId: string,
  filePath: string
): Promise<KnowledgeNode[]> {
  const fileKnowledge = await getFileKnowledge(repoId, filePath);
  if (!fileKnowledge) {
    return [];
  }

  const seenIds = new Set<string>();
  const contributors: KnowledgeNode[] = [];

  for (const c of fileKnowledge.recentCommits) {
    if (c.contributorNode && !seenIds.has(c.contributorNode.id)) {
      seenIds.add(c.contributorNode.id);
      contributors.push(c.contributorNode);
    }
  }

  return contributors;
}

/**
 * Returns all files touched/modified by a contributor.
 */
export async function getContributorFiles(
  repoId: string,
  contributorIdOrKey: string
): Promise<string[]> {
  const contribKnowledge = await getContributorKnowledge(repoId, contributorIdOrKey);
  if (!contribKnowledge) {
    return [];
  }

  return contribKnowledge.filesTouched;
}

/**
 * Returns all modules associated with a contributor's changed files.
 */
export async function getContributorModules(
  repoId: string,
  contributorIdOrKey: string
): Promise<KnowledgeNode[]> {
  const contribKnowledge = await getContributorKnowledge(repoId, contributorIdOrKey);
  if (!contribKnowledge) {
    return [];
  }

  return contribKnowledge.touchedModules;
}

/**
 * Returns all methods belonging to a specific class.
 */
export async function getClassMethods(
  repoId: string,
  className: string,
  filePath?: string
): Promise<KnowledgeNode[]> {
  const symbolKnowledge = await getSymbolKnowledge(repoId, className, filePath);
  if (!symbolKnowledge || symbolKnowledge.symbolNode.type !== "Class") {
    return [];
  }

  return symbolKnowledge.methods;
}

/**
 * Returns all classes, standalone functions, and methods defined in a given file.
 */
export async function getFileSymbols(
  repoId: string,
  filePath: string
): Promise<{
  classes: KnowledgeNode[];
  functions: KnowledgeNode[];
  methods: KnowledgeNode[];
}> {
  const fileKnowledge = await getFileKnowledge(repoId, filePath);
  if (!fileKnowledge) {
    return { classes: [], functions: [], methods: [] };
  }

  return {
    classes: fileKnowledge.classes,
    functions: fileKnowledge.functions,
    methods: fileKnowledge.methods,
  };
}
