import "server-only";
import { db } from "../db";
import {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  KnowledgeGraphOptions,
  KnowledgeEntityType,
  KnowledgeRelationType,
  FileKnowledgeView,
  SymbolKnowledgeView,
  ContributorKnowledgeView,
} from "./types";
import { extractSymbolsFromFile } from "./extractor";

const ALL_ENTITY_TYPES: KnowledgeEntityType[] = [
  "Repository",
  "Module",
  "File",
  "Class",
  "Function",
  "Method",
  "Commit",
  "Contributor",
  "Dependency",
];

const ALL_RELATION_TYPES: KnowledgeRelationType[] = [
  "CONTAINS",
  "IMPORTS",
  "DEPENDS_ON",
  "CHANGES",
  "AUTHORED_BY",
  "COMMITTED_BY",
  "EXTENDS",
  "IMPLEMENTS",
];

/**
 * Builds the complete project Knowledge Graph for a repository
 * from real existing database records.
 */
export async function buildRepositoryKnowledgeGraph(
  repoId: string,
  options?: KnowledgeGraphOptions
): Promise<KnowledgeGraph> {
  const repo = await db.repository.findUnique({
    where: { id: repoId },
  });

  if (!repo) {
    throw new Error(`Repository not found: ${repoId}`);
  }

  const includeSymbols = options?.includeSymbols !== false;
  const includeCommits = options?.includeCommits !== false;
  const includeContributors = options?.includeContributors !== false;
  const includeDependencies = options?.includeDependencies !== false;
  const commitLimit = options?.commitLimit ?? 100;

  // 1. Fetch real repository data concurrently
  const [modules, files, dependencies, contributors, commits] = await Promise.all([
    db.module.findMany({ where: { repoId }, orderBy: { name: "asc" } }),
    db.fileRecord.findMany({ where: { repoId }, orderBy: { path: "asc" } }),
    includeDependencies
      ? db.dependencyRecord.findMany({ where: { repoId } })
      : Promise.resolve([]),
    includeContributors
      ? db.contributorRecord.findMany({ where: { repoId } })
      : Promise.resolve([]),
    includeCommits
      ? db.commitRecord.findMany({
          where: { repoId },
          orderBy: { committedAt: "desc" },
          take: commitLimit,
          include: { fileChanges: true },
        })
      : Promise.resolve([]),
  ]);

  const nodesMap = new Map<string, KnowledgeNode>();
  const edgesMap = new Map<string, KnowledgeEdge>();

  function addNode(node: KnowledgeNode) {
    if (!nodesMap.has(node.id)) {
      nodesMap.set(node.id, node);
    }
  }

  function addEdge(edge: KnowledgeEdge) {
    if (!edgesMap.has(edge.id)) {
      edgesMap.set(edge.id, edge);
    }
  }

  // 2. Repository Root Node
  const repoNodeId = `repo:${repoId}`;
  addNode({
    id: repoNodeId,
    type: "Repository",
    name: repo.name,
    label: `Repository ${repo.owner}/${repo.name}`,
    repoId,
    metadata: {
      owner: repo.owner,
      defaultBranch: repo.defaultBranch,
      filesCount: repo.filesCount,
      modulesCount: repo.modulesCount,
      depsCount: repo.depsCount,
      commitsCount: repo.commitsCount,
      contributorsCount: repo.contributorsCount,
      latestCommitSha: repo.latestCommitSha,
    },
  });

  // 3. Module Nodes & Edges (Repository --CONTAINS--> Module)
  for (const mod of modules) {
    const modNodeId = `module:${repoId}:${mod.id}`;
    addNode({
      id: modNodeId,
      type: "Module",
      name: mod.name,
      label: `Module ${mod.name} (${mod.type})`,
      repoId,
      metadata: {
        type: mod.type,
        desc: mod.desc,
        aiSummary: mod.aiSummary,
        filesCount: mod.filesCount,
        depsCount: mod.depsCount,
      },
    });

    addEdge({
      id: `${repoNodeId}->${modNodeId}:CONTAINS`,
      source: repoNodeId,
      target: modNodeId,
      type: "CONTAINS",
      repoId,
    });
  }

  // 4. File Nodes, Symbols & Containment Edges
  for (const file of files) {
    const fileNodeId = `file:${repoId}:${file.path}`;
    addNode({
      id: fileNodeId,
      type: "File",
      name: file.path.split("/").pop() || file.path,
      label: file.path,
      repoId,
      filePath: file.path,
      language: file.language,
      metadata: {
        size: file.size,
        type: file.type,
        lineCount: file.lineCount,
        parsingStatus: file.parsingStatus,
        moduleId: file.moduleId,
      },
    });

    // Repository --CONTAINS--> File
    addEdge({
      id: `${repoNodeId}->${fileNodeId}:CONTAINS`,
      source: repoNodeId,
      target: fileNodeId,
      type: "CONTAINS",
      repoId,
    });

    // Module --CONTAINS--> File (if assigned to a module)
    if (file.moduleId) {
      const modNodeId = `module:${repoId}:${file.moduleId}`;
      if (nodesMap.has(modNodeId)) {
        addEdge({
          id: `${modNodeId}->${fileNodeId}:CONTAINS`,
          source: modNodeId,
          target: fileNodeId,
          type: "CONTAINS",
          repoId,
        });
      }
    }

    // Extract AST Code Symbols (Class, Method, Function)
    if (includeSymbols && file.symbolsJson) {
      const { nodes: symbolNodes, edges: symbolEdges } = extractSymbolsFromFile(
        repoId,
        file.path,
        file.symbolsJson,
        file.language
      );

      for (const sNode of symbolNodes) {
        addNode(sNode);
      }
      for (const sEdge of symbolEdges) {
        addEdge(sEdge);
      }
    }
  }

  // 5. Dependency Nodes & Edges (IMPORTS, DEPENDS_ON)
  for (const dep of dependencies) {
    // Internal file-to-file import: File --IMPORTS--> File
    if (dep.kind === "internal" && dep.sourceFile && dep.targetFile) {
      const sourceNodeId = `file:${repoId}:${dep.sourceFile}`;
      const targetNodeId = `file:${repoId}:${dep.targetFile}`;

      if (nodesMap.has(sourceNodeId) && nodesMap.has(targetNodeId)) {
        addEdge({
          id: `${sourceNodeId}->${targetNodeId}:IMPORTS`,
          source: sourceNodeId,
          target: targetNodeId,
          type: "IMPORTS",
          repoId,
          metadata: {
            dependencyType: dep.dependencyType,
            importSource: dep.importSource,
            resolutionStatus: dep.resolutionStatus,
            language: dep.language,
          },
        });
      }
    }

    // External manifest dependency: File --DEPENDS_ON--> Dependency
    if (dep.kind === "external" || dep.dependencyType === "manifest") {
      const depName = dep.name || dep.importSource || "external-package";
      const depNodeId = `dep:${repoId}:${depName}`;

      addNode({
        id: depNodeId,
        type: "Dependency",
        name: depName,
        label: `${depName}${dep.version ? `@${dep.version}` : ""}`,
        repoId,
        filePath: dep.sourceFile || undefined,
        metadata: {
          version: dep.version,
          purpose: dep.purpose,
          kind: dep.kind,
          dependencyType: dep.dependencyType,
        },
      });

      if (dep.sourceFile) {
        const sourceNodeId = `file:${repoId}:${dep.sourceFile}`;
        if (nodesMap.has(sourceNodeId)) {
          addEdge({
            id: `${sourceNodeId}->${depNodeId}:DEPENDS_ON`,
            source: sourceNodeId,
            target: depNodeId,
            type: "DEPENDS_ON",
            repoId,
          });
        }
      }
    }

    // Module-to-module edge: Module --DEPENDS_ON--> Module
    if (dep.fromModule && dep.toModule && dep.fromModule !== dep.toModule) {
      const fromModId = `module:${repoId}:${dep.fromModule}`;
      const toModId = `module:${repoId}:${dep.toModule}`;

      if (nodesMap.has(fromModId) && nodesMap.has(toModId)) {
        addEdge({
          id: `${fromModId}->${toModId}:DEPENDS_ON`,
          source: fromModId,
          target: toModId,
          type: "DEPENDS_ON",
          repoId,
        });
      }
    }
  }

  // 6. Contributor Nodes & Containment Edges
  const contributorIdToKey = new Map<string, string>();
  for (const contrib of contributors) {
    const contribNodeId = `contributor:${repoId}:${contrib.identityKey}`;
    contributorIdToKey.set(contrib.id, contrib.identityKey);

    addNode({
      id: contribNodeId,
      type: "Contributor",
      name: contrib.name,
      label: contrib.name,
      repoId,
      metadata: {
        identityKey: contrib.identityKey,
        email: contrib.email,
        authoredCommitsCount: contrib.authoredCommitsCount,
        committedCommitsCount: contrib.committedCommitsCount,
        totalCommitsCount: contrib.totalCommitsCount,
        additions: contrib.additions,
        deletions: contrib.deletions,
        filesTouchedCount: contrib.filesTouchedCount,
        isAuthor: contrib.isAuthor,
        isCommitter: contrib.isCommitter,
        firstContributionAt: contrib.firstContributionAt,
        lastContributionAt: contrib.lastContributionAt,
      },
    });

    addEdge({
      id: `${repoNodeId}->${contribNodeId}:CONTAINS`,
      source: repoNodeId,
      target: contribNodeId,
      type: "CONTAINS",
      repoId,
    });
  }

  // 7. Commit Nodes & Edges (CONTAINS, AUTHORED_BY, CHANGES)
  for (const commit of commits) {
    const commitNodeId = `commit:${repoId}:${commit.sha}`;

    addNode({
      id: commitNodeId,
      type: "Commit",
      name: commit.shortSha,
      label: `${commit.shortSha}: ${commit.message.split("\n")[0]}`,
      repoId,
      metadata: {
        sha: commit.sha,
        shortSha: commit.shortSha,
        message: commit.message,
        authorName: commit.authorName,
        authorEmail: commit.authorEmail,
        committerName: commit.committerName,
        committerEmail: commit.committerEmail,
        authoredAt: commit.authoredAt,
        committedAt: commit.committedAt,
        branch: commit.branch,
      },
    });

    // Repository --CONTAINS--> Commit
    addEdge({
      id: `${repoNodeId}->${commitNodeId}:CONTAINS`,
      source: repoNodeId,
      target: commitNodeId,
      type: "CONTAINS",
      repoId,
    });

    // Commit --AUTHORED_BY--> Contributor
    if (commit.authorContributorId && contributorIdToKey.has(commit.authorContributorId)) {
      const contribKey = contributorIdToKey.get(commit.authorContributorId)!;
      const contribNodeId = `contributor:${repoId}:${contribKey}`;

      if (nodesMap.has(contribNodeId)) {
        addEdge({
          id: `${commitNodeId}->${contribNodeId}:AUTHORED_BY`,
          source: commitNodeId,
          target: contribNodeId,
          type: "AUTHORED_BY",
          repoId,
        });
      }
    }

    // Commit --CHANGES--> File
    for (const change of commit.fileChanges) {
      const fileNodeId = `file:${repoId}:${change.newPath}`;
      if (!nodesMap.has(fileNodeId)) {
        addNode({
          id: fileNodeId,
          type: "File",
          name: change.newPath.split("/").pop() || change.newPath,
          label: change.newPath,
          repoId,
          filePath: change.newPath,
          metadata: {
            historical: true,
          },
        });
      }

      addEdge({
        id: `${commitNodeId}->${fileNodeId}:CHANGES`,
        source: commitNodeId,
        target: fileNodeId,
        type: "CHANGES",
        repoId,
        metadata: {
          changeType: change.changeType,
          additions: change.additions,
          deletions: change.deletions,
        },
      });
    }
  }

  // 8. Filter by requested entityTypes and relationTypes if specified
  let filteredNodes = Array.from(nodesMap.values());
  if (options?.entityTypes && options.entityTypes.length > 0) {
    const allowed = new Set(options.entityTypes);
    filteredNodes = filteredNodes.filter((n) => allowed.has(n.type));
  }

  const validNodeIdSet = new Set(filteredNodes.map((n) => n.id));

  let filteredEdges = Array.from(edgesMap.values()).filter(
    (e) => validNodeIdSet.has(e.source) && validNodeIdSet.has(e.target)
  );

  if (options?.relationTypes && options.relationTypes.length > 0) {
    const allowedRelations = new Set(options.relationTypes);
    filteredEdges = filteredEdges.filter((e) => allowedRelations.has(e.type));
  }

  // 9. Compute summary statistics
  const nodesByType: Record<KnowledgeEntityType, number> = {
    Repository: 0,
    Module: 0,
    File: 0,
    Class: 0,
    Function: 0,
    Method: 0,
    Commit: 0,
    Contributor: 0,
    Dependency: 0,
  };

  const edgesByType: Record<KnowledgeRelationType, number> = {
    CONTAINS: 0,
    IMPORTS: 0,
    DEPENDS_ON: 0,
    CHANGES: 0,
    AUTHORED_BY: 0,
    COMMITTED_BY: 0,
    EXTENDS: 0,
    IMPLEMENTS: 0,
  };

  for (const n of filteredNodes) {
    nodesByType[n.type] = (nodesByType[n.type] || 0) + 1;
  }

  for (const e of filteredEdges) {
    edgesByType[e.type] = (edgesByType[e.type] || 0) + 1;
  }

  return {
    repoId,
    nodes: filteredNodes,
    edges: filteredEdges,
    stats: {
      totalNodes: filteredNodes.length,
      totalEdges: filteredEdges.length,
      nodesByType,
      edgesByType,
    },
  };
}

/**
 * Retrieves focused knowledge for a specific repository file,
 * combining file symbols, imports, dependents, external dependencies,
 * and modifying commits with their authors.
 */
export async function getFileKnowledge(
  repoId: string,
  filePath: string
): Promise<FileKnowledgeView | null> {
  const normPath = filePath.replace(/\\/g, "/").replace(/^\/+/, "");

  const file = await db.fileRecord.findUnique({
    where: {
      repoId_path: {
        repoId,
        path: normPath,
      },
    },
    include: {
      module: true,
    },
  });

  if (!file) {
    return null;
  }

  const fileNode: KnowledgeNode = {
    id: `file:${repoId}:${file.path}`,
    type: "File",
    name: file.path.split("/").pop() || file.path,
    label: file.path,
    repoId,
    filePath: file.path,
    language: file.language,
    metadata: {
      size: file.size,
      type: file.type,
      lineCount: file.lineCount,
      parsingStatus: file.parsingStatus,
      moduleId: file.moduleId,
    },
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

  // Extract Symbols
  const { classes, functions, methods } = extractSymbolsFromFile(
    repoId,
    file.path,
    file.symbolsJson,
    file.language
  );

  // Query Outbound Dependencies & Inbound Dependents concurrently
  const [outboundDeps, inboundDeps, recentChanges] = await Promise.all([
    db.dependencyRecord.findMany({
      where: { repoId, sourceFile: normPath },
    }),
    db.dependencyRecord.findMany({
      where: { repoId, targetFile: normPath },
    }),
    db.commitFileChangeRecord.findMany({
      where: {
        repoId,
        OR: [{ newPath: normPath }, { oldPath: normPath }],
      },
      include: {
        commit: {
          include: {
            authorContributor: true,
          },
        },
      },
      orderBy: {
        commit: {
          committedAt: "desc",
        },
      },
      take: 20,
    }),
  ]);

  const imports: FileKnowledgeView["imports"] = [];
  const externalDependencies: FileKnowledgeView["externalDependencies"] = [];

  for (const dep of outboundDeps) {
    if (dep.kind === "internal" && dep.targetFile) {
      const targetFileId = `file:${repoId}:${dep.targetFile}`;
      imports.push({
        targetFile: dep.targetFile,
        edge: {
          id: `${fileNode.id}->${targetFileId}:IMPORTS`,
          source: fileNode.id,
          target: targetFileId,
          type: "IMPORTS",
          repoId,
          metadata: {
            dependencyType: dep.dependencyType,
            importSource: dep.importSource,
          },
        },
      });
    } else if (dep.kind === "external" || dep.dependencyType === "manifest") {
      const depName = dep.name || dep.importSource || "external-dep";
      const depNode: KnowledgeNode = {
        id: `dep:${repoId}:${depName}`,
        type: "Dependency",
        name: depName,
        label: `${depName}${dep.version ? `@${dep.version}` : ""}`,
        repoId,
        filePath: normPath,
        metadata: {
          version: dep.version,
          purpose: dep.purpose,
        },
      };

      externalDependencies.push({
        dependencyNode: depNode,
        edge: {
          id: `${fileNode.id}->${depNode.id}:DEPENDS_ON`,
          source: fileNode.id,
          target: depNode.id,
          type: "DEPENDS_ON",
          repoId,
        },
      });
    }
  }

  const dependents: FileKnowledgeView["dependents"] = [];
  for (const dep of inboundDeps) {
    if (dep.sourceFile) {
      const sourceFileId = `file:${repoId}:${dep.sourceFile}`;
      dependents.push({
        sourceFile: dep.sourceFile,
        edge: {
          id: `${sourceFileId}->${fileNode.id}:IMPORTS`,
          source: sourceFileId,
          target: fileNode.id,
          type: "IMPORTS",
          repoId,
        },
      });
    }
  }

  const recentCommits: FileKnowledgeView["recentCommits"] = [];
  for (const change of recentChanges) {
    const commit = change.commit;
    const commitNode: KnowledgeNode = {
      id: `commit:${repoId}:${commit.sha}`,
      type: "Commit",
      name: commit.shortSha,
      label: `${commit.shortSha}: ${commit.message.split("\n")[0]}`,
      repoId,
      metadata: {
        sha: commit.sha,
        message: commit.message,
        authorName: commit.authorName,
        committedAt: commit.committedAt,
      },
    };

    let contributorNode: KnowledgeNode | undefined;
    if (commit.authorContributor) {
      contributorNode = {
        id: `contributor:${repoId}:${commit.authorContributor.identityKey}`,
        type: "Contributor",
        name: commit.authorContributor.name,
        label: commit.authorContributor.name,
        repoId,
        metadata: {
          email: commit.authorContributor.email,
        },
      };
    }

    recentCommits.push({
      commitNode,
      contributorNode,
      edge: {
        id: `${commitNode.id}->${fileNode.id}:CHANGES`,
        source: commitNode.id,
        target: fileNode.id,
        type: "CHANGES",
        repoId,
        metadata: {
          changeType: change.changeType,
          additions: change.additions,
          deletions: change.deletions,
        },
      },
    });
  }

  return {
    fileNode,
    moduleNode,
    classes,
    functions,
    methods,
    imports,
    dependents,
    externalDependencies,
    recentCommits,
  };
}

/**
 * Searches and retrieves knowledge for a specific symbol (Class, Function, or Method).
 */
export async function getSymbolKnowledge(
  repoId: string,
  symbolName: string,
  filePath?: string
): Promise<SymbolKnowledgeView | null> {
  const whereClause: { repoId: string; path?: string } = { repoId };
  if (filePath) {
    whereClause.path = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  }

  const files = await db.fileRecord.findMany({
    where: whereClause,
    include: {
      module: true,
    },
  });

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

    // Check Class
    const matchingClass = classes.find(
      (c) => c.name.toLowerCase() === symbolName.toLowerCase()
    );
    if (matchingClass) {
      const classMethods = methods.filter(
        (m) => (m.metadata?.className as string) === matchingClass.name
      );

      return {
        symbolNode: matchingClass,
        fileNode,
        moduleNode,
        methods: classMethods,
        inboundEdges: edges.filter((e) => e.target === matchingClass.id),
        outboundEdges: edges.filter((e) => e.source === matchingClass.id),
      };
    }

    // Check Function
    const matchingFunc = functions.find(
      (f) => f.name.toLowerCase() === symbolName.toLowerCase()
    );
    if (matchingFunc) {
      return {
        symbolNode: matchingFunc,
        fileNode,
        moduleNode,
        methods: [],
        inboundEdges: edges.filter((e) => e.target === matchingFunc.id),
        outboundEdges: edges.filter((e) => e.source === matchingFunc.id),
      };
    }

    // Check Method
    const matchingMethod = methods.find(
      (m) => m.name.toLowerCase() === symbolName.toLowerCase()
    );
    if (matchingMethod) {
      const parentClassName = matchingMethod.metadata?.className as string;
      const parentClass = classes.find((c) => c.name === parentClassName);

      return {
        symbolNode: matchingMethod,
        fileNode,
        moduleNode,
        parentClass,
        methods: [],
        inboundEdges: edges.filter((e) => e.target === matchingMethod.id),
        outboundEdges: edges.filter((e) => e.source === matchingMethod.id),
      };
    }
  }

  return null;
}

/**
 * Retrieves focused knowledge for a specific contributor,
 * including touched files, touched modules, and authored commits.
 */
export async function getContributorKnowledge(
  repoId: string,
  idOrIdentityKey: string
): Promise<ContributorKnowledgeView | null> {
  const contributor = await db.contributorRecord.findFirst({
    where: {
      repoId,
      OR: [
        { id: idOrIdentityKey },
        { identityKey: idOrIdentityKey },
        { email: idOrIdentityKey },
        { name: idOrIdentityKey },
      ],
    },
    include: {
      authoredCommits: {
        take: 20,
        orderBy: { committedAt: "desc" },
      },
    },
  });

  if (!contributor) {
    return null;
  }

  const contributorNode: KnowledgeNode = {
    id: `contributor:${repoId}:${contributor.identityKey}`,
    type: "Contributor",
    name: contributor.name,
    label: contributor.name,
    repoId,
    metadata: {
      identityKey: contributor.identityKey,
      email: contributor.email,
      authoredCommitsCount: contributor.authoredCommitsCount,
      committedCommitsCount: contributor.committedCommitsCount,
      totalCommitsCount: contributor.totalCommitsCount,
      additions: contributor.additions,
      deletions: contributor.deletions,
      filesTouchedCount: contributor.filesTouchedCount,
    },
  };

  let filesTouched: string[] = [];
  try {
    filesTouched = JSON.parse(contributor.filesTouchedJson);
  } catch {
    filesTouched = [];
  }

  // Find modules corresponding to touched files
  const touchedFilesRecords = await db.fileRecord.findMany({
    where: {
      repoId,
      path: { in: filesTouched.slice(0, 50) },
      moduleId: { not: null },
    },
    select: {
      moduleId: true,
    },
  });

  const moduleIds = Array.from(
    new Set(touchedFilesRecords.map((f) => f.moduleId!).filter(Boolean))
  );

  const modules = await db.module.findMany({
    where: {
      id: { in: moduleIds },
    },
  });

  const touchedModules: KnowledgeNode[] = modules.map((m) => ({
    id: `module:${repoId}:${m.id}`,
    type: "Module",
    name: m.name,
    label: `Module ${m.name} (${m.type})`,
    repoId,
    metadata: {
      type: m.type,
      desc: m.desc,
    },
  }));

  const recentCommits: KnowledgeNode[] = contributor.authoredCommits.map((c) => ({
    id: `commit:${repoId}:${c.sha}`,
    type: "Commit",
    name: c.shortSha,
    label: `${c.shortSha}: ${c.message.split("\n")[0]}`,
    repoId,
    metadata: {
      sha: c.sha,
      message: c.message,
      committedAt: c.committedAt,
    },
  }));

  return {
    contributorNode,
    authoredCommitsCount: contributor.authoredCommitsCount,
    committedCommitsCount: contributor.committedCommitsCount,
    totalCommitsCount: contributor.totalCommitsCount,
    additions: contributor.additions,
    deletions: contributor.deletions,
    filesTouched,
    touchedModules,
    recentCommits,
  };
}

/**
 * Performs a breadth-first graph traversal from a starting node ID up to `maxDepth` hops.
 */
export async function traverseKnowledgeGraph(
  repoId: string,
  startNodeId: string,
  maxDepth: number = 2
): Promise<KnowledgeGraph> {
  const fullGraph = await buildRepositoryKnowledgeGraph(repoId);

  const nodeMap = new Map<string, KnowledgeNode>();
  for (const n of fullGraph.nodes) {
    nodeMap.set(n.id, n);
  }

  // Build adjacency list for bi-directional traversal
  const adjacency = new Map<string, Set<KnowledgeEdge>>();
  for (const edge of fullGraph.edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());

    adjacency.get(edge.source)!.add(edge);
    adjacency.get(edge.target)!.add(edge);
  }

  const visitedNodeIds = new Set<string>();
  const visitedEdgeIds = new Set<string>();

  let currentLevel = new Set<string>([startNodeId]);
  visitedNodeIds.add(startNodeId);

  for (let depth = 0; depth < maxDepth; depth++) {
    if (currentLevel.size === 0) break;
    const nextLevel = new Set<string>();

    for (const nodeId of currentLevel) {
      const edges = adjacency.get(nodeId);
      if (!edges) continue;

      for (const edge of edges) {
        visitedEdgeIds.add(edge.id);
        const neighborId = edge.source === nodeId ? edge.target : edge.source;

        if (!visitedNodeIds.has(neighborId)) {
          visitedNodeIds.add(neighborId);
          nextLevel.add(neighborId);
        }
      }
    }

    currentLevel = nextLevel;
  }

  const resultNodes = Array.from(visitedNodeIds)
    .map((id) => nodeMap.get(id)!)
    .filter(Boolean);

  const resultEdges = fullGraph.edges.filter((e) => visitedEdgeIds.has(e.id));

  const nodesByType: Record<KnowledgeEntityType, number> = {
    Repository: 0,
    Module: 0,
    File: 0,
    Class: 0,
    Function: 0,
    Method: 0,
    Commit: 0,
    Contributor: 0,
    Dependency: 0,
  };

  const edgesByType: Record<KnowledgeRelationType, number> = {
    CONTAINS: 0,
    IMPORTS: 0,
    DEPENDS_ON: 0,
    CHANGES: 0,
    AUTHORED_BY: 0,
    COMMITTED_BY: 0,
    EXTENDS: 0,
    IMPLEMENTS: 0,
  };

  for (const n of resultNodes) {
    nodesByType[n.type] = (nodesByType[n.type] || 0) + 1;
  }

  for (const e of resultEdges) {
    edgesByType[e.type] = (edgesByType[e.type] || 0) + 1;
  }

  return {
    repoId,
    nodes: resultNodes,
    edges: resultEdges,
    stats: {
      totalNodes: resultNodes.length,
      totalEdges: resultEdges.length,
      nodesByType,
      edgesByType,
    },
  };
}
