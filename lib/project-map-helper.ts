import type {
  KnowledgeEntityType,
  KnowledgeRelationType,
  KnowledgeNode,
  KnowledgeEdge,
  RepositoryKnowledgeView,
} from "@/lib/server/knowledge/types";

export type MapViewMode = "architecture" | "modules" | "files" | "dependencies" | "all";

export interface MapNode {
  id: string;
  type: KnowledgeEntityType;
  name: string;
  label: string;
  repoId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clusterId?: string;
  filePath?: string;
  language?: string;
  subLabel?: string;
  color: string;
  icon: string;
  badgeVariant: "lime" | "cyan" | "blue" | "amber" | "gray" | "purple" | "red";
  incomingCount: number;
  outgoingCount: number;
  isFocal?: boolean;
  metadata?: Record<string, unknown>;
}

export interface DrillDownScope {
  id: string;
  name: string;
  type: KnowledgeEntityType;
  filePath?: string;
}

export interface DrillDownCounts {
  files: number;
  modules: number;
  classes: number;
  functions: number;
  methods: number;
  dependencies: number;
  incoming: number;
  outgoing: number;
}

export interface DrillDownResult {
  focalNode: KnowledgeNode;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  hasChildren: boolean;
  counts: DrillDownCounts;
  isCapped?: boolean;
  totalChildCount?: number;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  relationType: KnowledgeRelationType;
  label: string;
  repoId: string;
  metadata?: Record<string, unknown>;
}

export interface MapWorld {
  w: number;
  h: number;
}

export interface ProjectMapData {
  nodes: MapNode[];
  edges: MapEdge[];
  world: MapWorld;
  stats: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<KnowledgeEntityType, number>;
    edgesByType: Record<KnowledgeRelationType, number>;
  };
}

/**
 * Human-readable display labels for all Knowledge Graph relation types.
 * Preserves the exact KnowledgeRelationType while providing clear UI presentation.
 */
export const RELATION_LABELS: Record<KnowledgeRelationType, string> = {
  CONTAINS: "Contains",
  IMPORTS: "Imports",
  DEPENDS_ON: "Depends on",
  CHANGES: "Changes",
  AUTHORED_BY: "Authored by",
  COMMITTED_BY: "Committed by",
  EXTENDS: "Extends",
  IMPLEMENTS: "Implements",
};

/**
 * Brand-aligned color palette for all Knowledge Graph entity types.
 */
export const ENTITY_COLORS: Record<KnowledgeEntityType, string> = {
  Repository: "#8BC34A",
  Module: "#62C4C7",
  File: "#7896D8",
  Dependency: "#D6A72C",
  Class: "#BA68C8",
  Function: "#E57373",
  Method: "#FF8A65",
  Commit: "#90A4AE",
  Contributor: "#4DB6AC",
};

/**
 * Semantic icon mappings for Knowledge Graph entity types.
 */
export const ENTITY_ICONS: Record<KnowledgeEntityType, string> = {
  Repository: "overview",
  Module: "modules",
  File: "file",
  Dependency: "packages",
  Class: "puzzle",
  Function: "code",
  Method: "code",
  Commit: "git",
  Contributor: "user",
};

/**
 * Badge variant styling for Knowledge Graph entity types.
 */
export const ENTITY_BADGES: Record<
  KnowledgeEntityType,
  "lime" | "cyan" | "blue" | "amber" | "gray" | "purple" | "red"
> = {
  Repository: "lime",
  Module: "cyan",
  File: "blue",
  Dependency: "amber",
  Class: "purple",
  Function: "red",
  Method: "red",
  Commit: "gray",
  Contributor: "lime",
};

/**
 * Default dimensions for each node entity type.
 */
export const NODE_DIMENSIONS: Record<
  KnowledgeEntityType,
  { width: number; height: number }
> = {
  Repository: { width: 220, height: 68 },
  Module: { width: 190, height: 64 },
  File: { width: 170, height: 56 },
  Dependency: { width: 160, height: 52 },
  Class: { width: 150, height: 48 },
  Function: { width: 150, height: 48 },
  Method: { width: 140, height: 44 },
  Commit: { width: 150, height: 48 },
  Contributor: { width: 160, height: 52 },
};

/**
 * Filter Knowledge Graph entities and edges based on the selected MapViewMode.
 * Pure and side-effect free.
 */
export function filterMapByViewMode(
  graphData: RepositoryKnowledgeView,
  viewMode: MapViewMode = "architecture"
): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
  const {
    repoNode,
    modules = [],
    files = [],
    dependencies = [],
    classes = [],
    functions = [],
    methods = [],
    commits = [],
    contributors = [],
    edges = [],
  } = graphData;

  // Build file -> module containment mapping for relationship aggregation
  const fileToModuleMap = new Map<string, string>();
  for (const edge of edges) {
    if (
      edge.type === "CONTAINS" &&
      edge.source.startsWith("module:") &&
      edge.target.startsWith("file:")
    ) {
      fileToModuleMap.set(edge.target, edge.source);
    }
  }
  for (const f of files) {
    if (!fileToModuleMap.has(f.id)) {
      const modSlug = f.metadata?.moduleId as string;
      if (modSlug) {
        const parentMod = modules.find(
          (m) =>
            m.id.endsWith(`:${modSlug}`) ||
            m.name.toLowerCase() === modSlug.toLowerCase()
        );
        if (parentMod) fileToModuleMap.set(f.id, parentMod.id);
      }
    }
  }

  let selectedNodes: KnowledgeNode[] = [];

  switch (viewMode) {
    case "architecture": {
      // High-level architecture: Repository + Modules + High-level external dependencies
      if (modules.length > 0) {
        selectedNodes = [repoNode, ...modules].filter(Boolean);

        // Include high-level external dependencies (capped at 20 to prevent clutter)
        if (dependencies.length > 0) {
          const depConnectivity = new Map<string, number>();
          for (const edge of edges) {
            if (edge.type === "DEPENDS_ON" && edge.target.startsWith("dep:")) {
              depConnectivity.set(
                edge.target,
                (depConnectivity.get(edge.target) || 0) + 1
              );
            }
          }
          const sortedDeps = [...dependencies].sort((a, b) => {
            const scoreB = depConnectivity.get(b.id) || 0;
            const scoreA = depConnectivity.get(a.id) || 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            return a.name.localeCompare(b.name);
          });
          selectedNodes.push(...sortedDeps.slice(0, 20));
        }
      } else {
        // Fallback for repositories without modules: Repository + top files
        selectedNodes = [repoNode, ...files.slice(0, 40)].filter(Boolean);
      }
      break;
    }

    case "modules": {
      // High-level architecture: Repository and Modules only (backward compatibility)
      selectedNodes = [repoNode, ...modules].filter(Boolean);
      break;
    }

    case "files": {
      // File-level code dependency graph: Modules and Files (no symbols)
      selectedNodes = [...modules, ...files].filter(Boolean);
      break;
    }

    case "dependencies": {
      // Third-party and manifest package dependencies: Modules, Files, Dependencies
      selectedNodes = [...modules, ...files, ...dependencies].filter(Boolean);
      break;
    }

    case "all":
    default: {
      // Complete engineering architecture graph:
      // Repository, Modules, Files, Dependencies, Classes, Functions
      selectedNodes = [
        repoNode,
        ...modules,
        ...files,
        ...dependencies,
        ...classes,
        ...functions,
      ].filter(Boolean);
      break;
    }
  }

  const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

  // Retain only edges whose source and target are both in the selected nodes
  let selectedEdges = edges.filter(
    (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
  );

  // In high-level view modes ("architecture", "modules", "dependencies"),
  // aggregate cross-module and module-to-dependency relationships
  if (
    (viewMode === "architecture" || viewMode === "modules" || viewMode === "dependencies") &&
    modules.length > 0
  ) {
    const derivedEdges = new Map<string, KnowledgeEdge>();

    // 1. Cross-module dependencies: derived from file-level IMPORTS / DEPENDS_ON across modules
    for (const edge of edges) {
      if (edge.type === "IMPORTS" || edge.type === "DEPENDS_ON") {
        const sourceMod = fileToModuleMap.get(edge.source) || (edge.source.startsWith("module:") ? edge.source : null);
        const targetMod = fileToModuleMap.get(edge.target) || (edge.target.startsWith("module:") ? edge.target : null);
        if (sourceMod && targetMod && sourceMod !== targetMod) {
          const edgeId = `${sourceMod}->${targetMod}:DEPENDS_ON`;
          if (
            !derivedEdges.has(edgeId) &&
            selectedNodeIds.has(sourceMod) &&
            selectedNodeIds.has(targetMod)
          ) {
            derivedEdges.set(edgeId, {
              id: edgeId,
              source: sourceMod,
              target: targetMod,
              type: "DEPENDS_ON",
              repoId: repoNode?.repoId || "",
              metadata: { derivedFromImports: true },
            });
          }
        }
      }
    }

    // 2. Module-to-dependency relationships: derived from file dependencies
    if (viewMode === "architecture" || viewMode === "dependencies") {
      for (const edge of edges) {
        if (edge.type === "DEPENDS_ON" && edge.target.startsWith("dep:")) {
          const sourceMod = fileToModuleMap.get(edge.source) || (edge.source.startsWith("module:") ? edge.source : null);
          if (
            sourceMod &&
            selectedNodeIds.has(sourceMod) &&
            selectedNodeIds.has(edge.target)
          ) {
            const edgeId = `${sourceMod}->${edge.target}:DEPENDS_ON`;
            if (!derivedEdges.has(edgeId)) {
              derivedEdges.set(edgeId, {
                id: edgeId,
                source: sourceMod,
                target: edge.target,
                type: "DEPENDS_ON",
                repoId: repoNode?.repoId || "",
                metadata: { derivedFromImports: true },
              });
            }
          }
        }
      }
    }

    // Add derived edges if not already present
    for (const dEdge of derivedEdges.values()) {
      if (
        !selectedEdges.some(
          (e) => e.source === dEdge.source && e.target === dEdge.target
        )
      ) {
        selectedEdges.push(dEdge);
      }
    }
  }

  return { nodes: selectedNodes, edges: selectedEdges };
}

/**
 * Generate sub-labels for MapNodes based on their real Knowledge Graph metadata.
 */
function getNodeSubLabel(node: KnowledgeNode): string {
  switch (node.type) {
    case "Repository":
      return `${(node.metadata?.fileCount as number) || 0} files • ${(node.metadata?.moduleCount as number) || 0} modules`;
    case "Module":
      return `${(node.metadata?.filesCount as number) || 0} files • ${(node.metadata?.type as string) || "core"}`;
    case "File":
      return node.language ? `${node.language}` : (node.filePath || "source");
    case "Dependency":
      return (node.metadata?.version as string) || "package";
    case "Class":
      return (node.metadata?.methodsCount as number) !== undefined
        ? `${node.metadata?.methodsCount} methods`
        : "class";
    case "Function":
      return (node.metadata?.returnType as string) || "function";
    case "Method":
      return (node.metadata?.parentClass as string) || "method";
    case "Contributor":
      return `${(node.metadata?.commitsCount as number) || 0} commits`;
    case "Commit":
      return node.name.slice(0, 7);
    default:
      return node.type;
  }
}

/**
 * Deterministic, hierarchical, clustered layout engine designed for software architecture.
 *
 * Visual hierarchy:
 * 1. Repository: Centered root context at the top.
 * 2. Modules: Prominent architectural clusters arranged in a balanced grid.
 * 3. Files: Positioned inside or radially adjacent to their owning module cluster.
 * 4. External Dependencies: Positioned outward along the right boundary.
 * 5. Symbols: Positioned immediately below their defining file.
 */
export function calculateMapLayout(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  focalNodeId?: string
): { positionedNodes: MapNode[]; world: MapWorld } {
  if (nodes.length === 0) {
    return {
      positionedNodes: [],
      world: { w: 1200, h: 800 },
    };
  }

  // Count incoming & outgoing edges per node
  const incomingMap = new Map<string, number>();
  const outgoingMap = new Map<string, number>();
  for (const edge of edges) {
    outgoingMap.set(edge.source, (outgoingMap.get(edge.source) || 0) + 1);
    incomingMap.set(edge.target, (incomingMap.get(edge.target) || 0) + 1);
  }

  // Specialized focal drill-down layout when focalNodeId is provided and focal node is not Repository
  const focalNode = focalNodeId ? nodes.find((n) => n.id === focalNodeId) : undefined;
  if (focalNode && focalNode.type !== "Repository") {
    const positionedNodes: MapNode[] = [];
    const worldCenterX = 680;
    const focalDims = NODE_DIMENSIONS[focalNode.type] || { width: 220, height: 60 };

    // 1. Position Focal Root Node at top center
    positionedNodes.push({
      id: focalNode.id,
      type: focalNode.type,
      name: focalNode.name,
      label: focalNode.label || focalNode.name,
      repoId: focalNode.repoId,
      filePath: focalNode.filePath,
      language: focalNode.language,
      x: worldCenterX,
      y: 90,
      width: Math.max(focalDims.width, 210),
      height: Math.max(focalDims.height, 58),
      subLabel: getNodeSubLabel(focalNode),
      color: ENTITY_COLORS[focalNode.type] || "#7896D8",
      icon: ENTITY_ICONS[focalNode.type] || "code",
      badgeVariant: ENTITY_BADGES[focalNode.type] || "blue",
      incomingCount: incomingMap.get(focalNode.id) || 0,
      outgoingCount: outgoingMap.get(focalNode.id) || 0,
      isFocal: true,
      metadata: focalNode.metadata,
    });

    // 2. Partition other nodes
    const otherNodes = nodes.filter((n) => n.id !== focalNode.id);
    let primaryChildren: KnowledgeNode[] = [];
    let secondaryNodes: KnowledgeNode[] = [];

    if (focalNode.type === "Module") {
      primaryChildren = otherNodes
        .filter((n) => n.type === "File")
        .sort((a, b) => (a.filePath || a.name).localeCompare(b.filePath || b.name));
      secondaryNodes = otherNodes
        .filter((n) => n.type !== "File")
        .sort((a, b) => a.name.localeCompare(b.name));
    } else if (focalNode.type === "File") {
      primaryChildren = otherNodes
        .filter((n) => n.type === "Class" || n.type === "Function" || n.type === "Method")
        .sort((a, b) => a.name.localeCompare(b.name));
      secondaryNodes = otherNodes
        .filter((n) => n.type !== "Class" && n.type !== "Function" && n.type !== "Method")
        .sort((a, b) => a.name.localeCompare(b.name));
    } else if (focalNode.type === "Class") {
      primaryChildren = otherNodes
        .filter((n) => n.type === "Method")
        .sort((a, b) => a.name.localeCompare(b.name));
      secondaryNodes = otherNodes
        .filter((n) => n.type !== "Method")
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      primaryChildren = otherNodes;
      secondaryNodes = [];
    }

    // 3. Position Primary Children in balanced grid beneath focal node
    const numPrimary = primaryChildren.length;
    if (numPrimary > 0) {
      const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(numPrimary))));
      const colSpacing = 220;
      const rowSpacing = 85;
      const startY = 240;
      const totalW = (cols - 1) * colSpacing;
      const startX = worldCenterX - totalW / 2;

      primaryChildren.forEach((child, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = startX + col * colSpacing;
        const cy = startY + row * rowSpacing;
        const dims = NODE_DIMENSIONS[child.type] || { width: 170, height: 56 };

        positionedNodes.push({
          id: child.id,
          type: child.type,
          name: child.name,
          label: child.label || child.name,
          repoId: child.repoId,
          filePath: child.filePath,
          language: child.language,
          x: cx,
          y: cy,
          width: dims.width,
          height: dims.height,
          clusterId: focalNode.id,
          subLabel: getNodeSubLabel(child),
          color: ENTITY_COLORS[child.type] || "#7896D8",
          icon: ENTITY_ICONS[child.type] || "code",
          badgeVariant: ENTITY_BADGES[child.type] || "blue",
          incomingCount: incomingMap.get(child.id) || 0,
          outgoingCount: outgoingMap.get(child.id) || 0,
          metadata: child.metadata,
        });
      });
    }

    // 4. Position Secondary Nodes (Dependencies, etc.) on the right side
    if (secondaryNodes.length > 0) {
      const primaryMaxX = positionedNodes.length > 0
        ? Math.max(...positionedNodes.map((n) => n.x + n.width / 2))
        : worldCenterX + 200;
      const secBaseX = Math.max(primaryMaxX + 160, worldCenterX + 360);
      const secCols = Math.max(1, Math.min(3, Math.ceil(secondaryNodes.length / 6)));
      const secSpacingX = 190;
      const secSpacingY = 75;
      const secStartY = 160;

      secondaryNodes.forEach((sec, idx) => {
        const col = idx % secCols;
        const row = Math.floor(idx / secCols);
        const sx = secBaseX + col * secSpacingX;
        const sy = secStartY + row * secSpacingY;
        const dims = NODE_DIMENSIONS[sec.type] || { width: 170, height: 56 };

        positionedNodes.push({
          id: sec.id,
          type: sec.type,
          name: sec.name,
          label: sec.label || sec.name,
          repoId: sec.repoId,
          filePath: sec.filePath,
          language: sec.language,
          x: sx,
          y: sy,
          width: dims.width,
          height: dims.height,
          subLabel: getNodeSubLabel(sec),
          color: ENTITY_COLORS[sec.type] || "#7896D8",
          icon: ENTITY_ICONS[sec.type] || "code",
          badgeVariant: ENTITY_BADGES[sec.type] || "blue",
          incomingCount: incomingMap.get(sec.id) || 0,
          outgoingCount: outgoingMap.get(sec.id) || 0,
          metadata: sec.metadata,
        });
      });
    }

    // 5. Calculate World Dimensions
    let maxX = 1000;
    let maxY = 700;
    for (const n of positionedNodes) {
      const right = n.x + n.width / 2;
      const bottom = n.y + n.height / 2;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }

    const paddingX = 180;
    const paddingY = 160;
    return {
      positionedNodes,
      world: {
        w: Math.max(1400, Math.ceil(maxX + paddingX)),
        h: Math.max(900, Math.ceil(maxY + paddingY)),
      },
    };
  }

  // Partition nodes by entity type
  const repoNode = nodes.find((n) => n.type === "Repository");
  const moduleNodes = nodes
    .filter((n) => n.type === "Module")
    .sort((a, b) => a.name.localeCompare(b.name));
  const fileNodes = nodes
    .filter((n) => n.type === "File")
    .sort((a, b) => (a.filePath || a.name).localeCompare(b.filePath || b.name));
  const depNodes = nodes
    .filter((n) => n.type === "Dependency")
    .sort((a, b) => a.name.localeCompare(b.name));
  const symbolNodes = nodes
    .filter((n) => n.type === "Class" || n.type === "Function" || n.type === "Method")
    .sort((a, b) => a.name.localeCompare(b.name));
  const otherNodes = nodes
    .filter(
      (n) =>
        n.type !== "Repository" &&
        n.type !== "Module" &&
        n.type !== "File" &&
        n.type !== "Dependency" &&
        n.type !== "Class" &&
        n.type !== "Function" &&
        n.type !== "Method"
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  // Determine file-to-module containment
  const fileModuleMap = new Map<string, string>();
  for (const edge of edges) {
    if (edge.type === "CONTAINS" && edge.source.startsWith("module:") && edge.target.startsWith("file:")) {
      fileModuleMap.set(edge.target, edge.source);
    }
  }

  // Fallback containment from file metadata if edge not explicitly present
  for (const file of fileNodes) {
    if (!fileModuleMap.has(file.id)) {
      const modSlug = (file.metadata?.moduleId as string) || "";
      if (modSlug) {
        const parentMod = moduleNodes.find(
          (m) => m.id.endsWith(`:${modSlug}`) || m.name.toLowerCase() === modSlug.toLowerCase()
        );
        if (parentMod) {
          fileModuleMap.set(file.id, parentMod.id);
        }
      }
    }
  }

  // Determine symbol-to-file containment
  const symbolFileMap = new Map<string, string>();
  for (const edge of edges) {
    if (edge.type === "CONTAINS" && edge.source.startsWith("file:")) {
      symbolFileMap.set(edge.target, edge.source);
    }
  }
  for (const sym of symbolNodes) {
    if (!symbolFileMap.has(sym.id) && sym.filePath) {
      const parentFile = fileNodes.find((f) => f.filePath === sym.filePath);
      if (parentFile) {
        symbolFileMap.set(sym.id, parentFile.id);
      }
    }
  }

  const positionedNodes: MapNode[] = [];
  const startX = 140;
  const startY = 180;

  // 1. Position Module Clusters
  const numModules = Math.max(1, moduleNodes.length);
  const cols = Math.ceil(Math.sqrt(numModules));
  const clusterWidth = 460;
  const clusterHeight = 360;
  const clusterSpacingX = 80;
  const clusterSpacingY = 100;

  const modulePositions = new Map<string, { x: number; y: number }>();

  moduleNodes.forEach((mod, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = startX + col * (clusterWidth + clusterSpacingX);
    const cy = startY + row * (clusterHeight + clusterSpacingY);
    modulePositions.set(mod.id, { x: cx, y: cy });

    const dims = NODE_DIMENSIONS.Module;
    positionedNodes.push({
      id: mod.id,
      type: "Module",
      name: mod.name,
      label: mod.label || mod.name,
      repoId: mod.repoId,
      x: cx,
      y: cy,
      width: dims.width,
      height: dims.height,
      clusterId: mod.id,
      subLabel: getNodeSubLabel(mod),
      color: ENTITY_COLORS.Module,
      icon: ENTITY_ICONS.Module,
      badgeVariant: ENTITY_BADGES.Module,
      incomingCount: incomingMap.get(mod.id) || 0,
      outgoingCount: outgoingMap.get(mod.id) || 0,
      metadata: mod.metadata,
    });
  });

  // Calculate cluster bounds
  const maxClusterCol = Math.max(0, cols - 1);
  const maxClusterRow = Math.max(0, Math.ceil(numModules / cols) - 1);
  const maxModuleX = startX + maxClusterCol * (clusterWidth + clusterSpacingX) + clusterWidth;
  const maxModuleY = startY + maxClusterRow * (clusterHeight + clusterSpacingY) + clusterHeight;

  // 2. Position Repository Root Context
  if (repoNode) {
    const dims = NODE_DIMENSIONS.Repository;
    const repoX = Math.max(startX + 100, (startX + maxModuleX) / 2);
    const repoY = 70;
    positionedNodes.push({
      id: repoNode.id,
      type: "Repository",
      name: repoNode.name,
      label: repoNode.label || repoNode.name,
      repoId: repoNode.repoId,
      x: repoX,
      y: repoY,
      width: dims.width,
      height: dims.height,
      subLabel: getNodeSubLabel(repoNode),
      color: ENTITY_COLORS.Repository,
      icon: ENTITY_ICONS.Repository,
      badgeVariant: ENTITY_BADGES.Repository,
      incomingCount: incomingMap.get(repoNode.id) || 0,
      outgoingCount: outgoingMap.get(repoNode.id) || 0,
      metadata: repoNode.metadata,
    });
  }

  // 3. Position Files
  // Group files by module
  const filesByModule = new Map<string, KnowledgeNode[]>();
  const unassignedFiles: KnowledgeNode[] = [];

  for (const file of fileNodes) {
    const modId = fileModuleMap.get(file.id);
    if (modId && modulePositions.has(modId)) {
      if (!filesByModule.has(modId)) {
        filesByModule.set(modId, []);
      }
      filesByModule.get(modId)!.push(file);
    } else {
      unassignedFiles.push(file);
    }
  }

  // Position files grouped inside their module cluster
  const filePositions = new Map<string, { x: number; y: number }>();

  for (const [modId, mFiles] of filesByModule.entries()) {
    const modPos = modulePositions.get(modId)!;
    const fileDims = NODE_DIMENSIONS.File;

    mFiles.forEach((file, fIdx) => {
      const fCol = fIdx % 2;
      const fRow = Math.floor(fIdx / 2);
      // Place files below module node
      const fx = modPos.x - 90 + fCol * 190;
      const fy = modPos.y + 80 + fRow * 80;
      filePositions.set(file.id, { x: fx, y: fy });

      positionedNodes.push({
        id: file.id,
        type: "File",
        name: file.name,
        label: file.label || file.name,
        repoId: file.repoId,
        filePath: file.filePath,
        language: file.language,
        x: fx,
        y: fy,
        width: fileDims.width,
        height: fileDims.height,
        clusterId: modId,
        subLabel: getNodeSubLabel(file),
        color: ENTITY_COLORS.File,
        icon: ENTITY_ICONS.File,
        badgeVariant: ENTITY_BADGES.File,
        incomingCount: incomingMap.get(file.id) || 0,
        outgoingCount: outgoingMap.get(file.id) || 0,
        metadata: file.metadata,
      });
    });
  }

  // Position unassigned files in a dedicated area below or alongside
  if (unassignedFiles.length > 0) {
    const unassignedBaseY = moduleNodes.length > 0 ? maxModuleY + 60 : startY;
    const uCols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(unassignedFiles.length))));
    const fileDims = NODE_DIMENSIONS.File;

    unassignedFiles.forEach((file, uIdx) => {
      const uCol = uIdx % uCols;
      const uRow = Math.floor(uIdx / uCols);
      const fx = startX + uCol * 210;
      const fy = unassignedBaseY + uRow * 85;
      filePositions.set(file.id, { x: fx, y: fy });

      positionedNodes.push({
        id: file.id,
        type: "File",
        name: file.name,
        label: file.label || file.name,
        repoId: file.repoId,
        filePath: file.filePath,
        language: file.language,
        x: fx,
        y: fy,
        width: fileDims.width,
        height: fileDims.height,
        subLabel: getNodeSubLabel(file),
        color: ENTITY_COLORS.File,
        icon: ENTITY_ICONS.File,
        badgeVariant: ENTITY_BADGES.File,
        incomingCount: incomingMap.get(file.id) || 0,
        outgoingCount: outgoingMap.get(file.id) || 0,
        metadata: file.metadata,
      });
    });
  }

  // 4. Position Symbols (Classes / Functions / Methods)
  // Group symbols by their owning file
  const symbolsByFile = new Map<string, KnowledgeNode[]>();
  const unassignedSymbols: KnowledgeNode[] = [];

  for (const sym of symbolNodes) {
    const fileId = symbolFileMap.get(sym.id);
    if (fileId && filePositions.has(fileId)) {
      if (!symbolsByFile.has(fileId)) {
        symbolsByFile.set(fileId, []);
      }
      symbolsByFile.get(fileId)!.push(sym);
    } else {
      unassignedSymbols.push(sym);
    }
  }

  for (const [fileId, fSymbols] of symbolsByFile.entries()) {
    const filePos = filePositions.get(fileId)!;
    fSymbols.forEach((sym, sIdx) => {
      const dims = NODE_DIMENSIONS[sym.type] || NODE_DIMENSIONS.Class;
      // Position closely below or next to owning file
      const sx = filePos.x + 30 + (sIdx % 2) * 160;
      const sy = filePos.y + 50 + Math.floor(sIdx / 2) * 55;

      positionedNodes.push({
        id: sym.id,
        type: sym.type,
        name: sym.name,
        label: sym.label || sym.name,
        repoId: sym.repoId,
        filePath: sym.filePath,
        language: sym.language,
        x: sx,
        y: sy,
        width: dims.width,
        height: dims.height,
        subLabel: getNodeSubLabel(sym),
        color: ENTITY_COLORS[sym.type] || ENTITY_COLORS.Class,
        icon: ENTITY_ICONS[sym.type] || ENTITY_ICONS.Class,
        badgeVariant: ENTITY_BADGES[sym.type] || ENTITY_BADGES.Class,
        incomingCount: incomingMap.get(sym.id) || 0,
        outgoingCount: outgoingMap.get(sym.id) || 0,
        metadata: sym.metadata,
      });
    });
  }

  // Position unassigned symbols if any
  if (unassignedSymbols.length > 0) {
    const sBaseY = maxModuleY + 120;
    unassignedSymbols.forEach((sym, sIdx) => {
      const dims = NODE_DIMENSIONS[sym.type] || NODE_DIMENSIONS.Class;
      const sx = startX + (sIdx % 3) * 170;
      const sy = sBaseY + Math.floor(sIdx / 3) * 60;

      positionedNodes.push({
        id: sym.id,
        type: sym.type,
        name: sym.name,
        label: sym.label || sym.name,
        repoId: sym.repoId,
        filePath: sym.filePath,
        language: sym.language,
        x: sx,
        y: sy,
        width: dims.width,
        height: dims.height,
        subLabel: getNodeSubLabel(sym),
        color: ENTITY_COLORS[sym.type] || ENTITY_COLORS.Class,
        icon: ENTITY_ICONS[sym.type] || ENTITY_ICONS.Class,
        badgeVariant: ENTITY_BADGES[sym.type] || ENTITY_BADGES.Class,
        incomingCount: incomingMap.get(sym.id) || 0,
        outgoingCount: outgoingMap.get(sym.id) || 0,
        metadata: sym.metadata,
      });
    });
  }

  // 5. Position External Dependencies along the outer boundary
  // Place dependencies in a clean column on the right side of all internal clusters
  const currentMaxX = Math.max(
    maxModuleX,
    ...positionedNodes.map((n) => n.x + n.width / 2)
  );
  const depBaseX = currentMaxX + 160;
  const depBaseY = 140;
  const depDims = NODE_DIMENSIONS.Dependency;
  const depCols = Math.max(1, Math.min(3, Math.ceil(depNodes.length / 8)));

  depNodes.forEach((dep, dIdx) => {
    const dCol = dIdx % depCols;
    const dRow = Math.floor(dIdx / depCols);
    const dx = depBaseX + dCol * 180;
    const dy = depBaseY + dRow * 75;

    positionedNodes.push({
      id: dep.id,
      type: "Dependency",
      name: dep.name,
      label: dep.label || dep.name,
      repoId: dep.repoId,
      x: dx,
      y: dy,
      width: depDims.width,
      height: depDims.height,
      subLabel: getNodeSubLabel(dep),
      color: ENTITY_COLORS.Dependency,
      icon: ENTITY_ICONS.Dependency,
      badgeVariant: ENTITY_BADGES.Dependency,
      incomingCount: incomingMap.get(dep.id) || 0,
      outgoingCount: outgoingMap.get(dep.id) || 0,
      metadata: dep.metadata,
    });
  });

  // 6. Position other miscellaneous nodes (Commits, Contributors if explicitly passed)
  if (otherNodes.length > 0) {
    const otherBaseY = Math.max(...positionedNodes.map((n) => n.y)) + 120;
    otherNodes.forEach((node, oIdx) => {
      const dims = NODE_DIMENSIONS[node.type] || { width: 160, height: 50 };
      const ox = startX + (oIdx % 4) * 180;
      const oy = otherBaseY + Math.floor(oIdx / 4) * 70;

      positionedNodes.push({
        id: node.id,
        type: node.type,
        name: node.name,
        label: node.label || node.name,
        repoId: node.repoId,
        x: ox,
        y: oy,
        width: dims.width,
        height: dims.height,
        subLabel: getNodeSubLabel(node),
        color: ENTITY_COLORS[node.type] || "#888888",
        icon: ENTITY_ICONS[node.type] || "file",
        badgeVariant: ENTITY_BADGES[node.type] || "gray",
        incomingCount: incomingMap.get(node.id) || 0,
        outgoingCount: outgoingMap.get(node.id) || 0,
        metadata: node.metadata,
      });
    });
  }

  // Calculate world bounding box with generous padding
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of positionedNodes) {
    const left = node.x - node.width / 2;
    const right = node.x + node.width / 2;
    const top = node.y - node.height / 2;
    const bottom = node.y + node.height / 2;

    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }

  const paddingX = 180;
  const paddingY = 160;
  const worldWidth = Math.max(1400, Math.ceil(maxX + paddingX));
  const worldHeight = Math.max(900, Math.ceil(maxY + paddingY));

  return {
    positionedNodes,
    world: { w: worldWidth, h: worldHeight },
  };
}

/**
 * Main transformation entrypoint:
 * Converts RepositoryKnowledgeView into ready-to-render ProjectMapData.
 *
 * 1. Filters entities and edges according to the selected MapViewMode.
 * 2. Computes hierarchical, clustered spatial layout.
 * 3. Preserves all original Knowledge Graph relation types and directions.
 * 4. Augments edges with human-readable labels and directional metadata.
 */
export function transformKnowledgeToMap(
  graphData: RepositoryKnowledgeView,
  viewMode: MapViewMode = "architecture",
  focalNodeId?: string
): ProjectMapData {
  if (!graphData || !graphData.repoNode) {
    return {
      nodes: [],
      edges: [],
      world: { w: 1200, h: 800 },
      stats: {
        totalNodes: 0,
        totalEdges: 0,
        nodesByType: {
          Repository: 0,
          Module: 0,
          File: 0,
          Class: 0,
          Function: 0,
          Method: 0,
          Commit: 0,
          Contributor: 0,
          Dependency: 0,
        },
        edgesByType: {
          CONTAINS: 0,
          IMPORTS: 0,
          DEPENDS_ON: 0,
          CHANGES: 0,
          AUTHORED_BY: 0,
          COMMITTED_BY: 0,
          EXTENDS: 0,
          IMPLEMENTS: 0,
        },
      },
    };
  }

  // If focalNodeId is provided and different from repository, use drill-down scope transformation
  if (focalNodeId && focalNodeId !== graphData.repoNode.id) {
    const scopeResult = extractDrillDownScope(graphData, focalNodeId);
    return transformScopeToMap(scopeResult, viewMode);
  }

  // 1. Filter by view mode
  const { nodes: rawNodes, edges: rawEdges } = filterMapByViewMode(
    graphData,
    viewMode
  );

  // 2. Compute spatial layout
  const { positionedNodes, world } = calculateMapLayout(rawNodes, rawEdges);

  // 3. Map edges with preserved relation types and human-readable labels
  const nodeIds = new Set(positionedNodes.map((n) => n.id));
  const mappedEdges: MapEdge[] = [];

  for (const edge of rawEdges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      mappedEdges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relationType: edge.type,
        label: RELATION_LABELS[edge.type] || edge.type,
        repoId: edge.repoId,
        metadata: edge.metadata,
      });
    }
  }

  // 4. Compute statistics
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
  for (const node of positionedNodes) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

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
  for (const edge of mappedEdges) {
    edgesByType[edge.relationType] = (edgesByType[edge.relationType] || 0) + 1;
  }

  return {
    nodes: positionedNodes,
    edges: mappedEdges,
    world,
    stats: {
      totalNodes: positionedNodes.length,
      totalEdges: mappedEdges.length,
      nodesByType,
      edgesByType,
    },
  };
}

/**
 * Returns a Set of all node IDs connected to a given node (both incoming and outgoing),
 * including the target node itself.
 */
export function getConnectedNodeIds(
  nodeId: string,
  edges: MapEdge[]
): Set<string> {
  const connected = new Set<string>([nodeId]);
  for (const edge of edges) {
    if (edge.source === nodeId) {
      connected.add(edge.target);
    } else if (edge.target === nodeId) {
      connected.add(edge.source);
    }
  }
  return connected;
}

/**
 * Returns all edges where the given node is either the source or the target.
 */
export function getConnectedEdges(
  nodeId: string,
  edges: MapEdge[]
): MapEdge[] {
  return edges.filter(
    (edge) => edge.source === nodeId || edge.target === nodeId
  );
}

/**
 * Returns the incoming and outgoing neighbor MapNodes for a given node.
 */
export function getNodeNeighbors(
  nodeId: string,
  nodes: MapNode[],
  edges: MapEdge[]
): { incoming: MapNode[]; outgoing: MapNode[] } {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const incomingIds = new Set<string>();
  const outgoingIds = new Set<string>();

  for (const edge of edges) {
    if (edge.target === nodeId) {
      incomingIds.add(edge.source);
    }
    if (edge.source === nodeId) {
      outgoingIds.add(edge.target);
    }
  }

  const incoming: MapNode[] = [];
  for (const id of incomingIds) {
    const node = nodeMap.get(id);
    if (node) incoming.push(node);
  }

  const outgoing: MapNode[] = [];
  for (const id of outgoingIds) {
    const node = nodeMap.get(id);
    if (node) outgoing.push(node);
  }

  return { incoming, outgoing };
}

/**
 * Checks whether an entity has deeper child relationships within the real Knowledge Graph.
 */
export function checkHasChildren(
  graphData: RepositoryKnowledgeView,
  nodeId: string
): boolean {
  if (!graphData || !nodeId) return false;

  // 1. Repository
  if (
    nodeId.startsWith("repo:") ||
    (graphData.repoNode && graphData.repoNode.id === nodeId)
  ) {
    return (
      (graphData.modules && graphData.modules.length > 0) ||
      (graphData.files && graphData.files.length > 0) ||
      (graphData.dependencies && graphData.dependencies.length > 0)
    );
  }

  // 2. Direct outgoing CONTAINS edges
  const outgoingContains = (graphData.edges || []).filter(
    (e) => e.source === nodeId && e.type === "CONTAINS"
  );
  if (outgoingContains.length > 0) return true;

  // 3. Module: check if any file belongs to this module
  if (nodeId.startsWith("module:")) {
    const modSlug = nodeId.split(":").pop()?.toLowerCase();
    const hasFiles = (graphData.files || []).some(
      (f) =>
        f.metadata?.moduleId === modSlug ||
        f.id.includes(`:${modSlug}:`) ||
        (f.filePath && f.filePath.toLowerCase().includes(`/${modSlug}/`))
    );
    if (hasFiles) return true;
  }

  // 4. File: check if any symbol or dependency belongs to this file
  if (nodeId.startsWith("file:")) {
    const filePath = nodeId.replace(/^file:[^:]+:/, "");
    const allSymbols = [
      ...(graphData.classes || []),
      ...(graphData.functions || []),
      ...(graphData.methods || []),
    ];
    const hasSymbols = allSymbols.some((s) => s.filePath === filePath);
    if (hasSymbols) return true;

    const hasOutbound = (graphData.edges || []).some(
      (e) =>
        e.source === nodeId &&
        (e.type === "IMPORTS" || e.type === "DEPENDS_ON" || e.type === "CONTAINS")
    );
    if (hasOutbound) return true;
  }

  // 5. Class: check if any methods belong to this class
  if (nodeId.startsWith("class:")) {
    const className = nodeId.split(":").pop();
    const hasMethods = (graphData.methods || []).some(
      (m) =>
        (m.metadata?.parentClass as string) === className ||
        (m.metadata?.className as string) === className
    );
    if (hasMethods) return true;
  }

  // 6. Function / Method / Dependency: check outgoing edges (callees, sub-entities, etc.)
  const hasOutboundEdges = (graphData.edges || []).some(
    (e) => e.source === nodeId
  );
  return hasOutboundEdges;
}

/**
 * Computes real counts of contained files, symbols, and dependencies for an entity.
 */
export function computeEntityContents(
  graphData: RepositoryKnowledgeView,
  nodeId: string
): DrillDownCounts {
  const counts: DrillDownCounts = {
    files: 0,
    modules: 0,
    classes: 0,
    functions: 0,
    methods: 0,
    dependencies: 0,
    incoming: 0,
    outgoing: 0,
  };

  if (!graphData) return counts;

  // Count incoming and outgoing relationships
  for (const edge of graphData.edges || []) {
    if (edge.target === nodeId) counts.incoming++;
    if (edge.source === nodeId) counts.outgoing++;
  }

  // If Repository
  if (
    nodeId.startsWith("repo:") ||
    (graphData.repoNode && graphData.repoNode.id === nodeId)
  ) {
    counts.modules = (graphData.modules || []).length;
    counts.files = (graphData.files || []).length;
    counts.classes = (graphData.classes || []).length;
    counts.functions = (graphData.functions || []).length;
    counts.methods = (graphData.methods || []).length;
    counts.dependencies = (graphData.dependencies || []).length;
    return counts;
  }

  // If Module
  if (nodeId.startsWith("module:")) {
    const modSlug = nodeId.split(":").pop()?.toLowerCase();
    const modFiles = (graphData.files || []).filter((f) => {
      if (f.metadata?.moduleId === modSlug) return true;
      return (graphData.edges || []).some(
        (e) => e.source === nodeId && e.target === f.id && e.type === "CONTAINS"
      );
    });
    counts.files = modFiles.length;

    const fileIds = new Set(modFiles.map((f) => f.id));
    const filePaths = new Set(modFiles.map((f) => f.filePath).filter(Boolean));

    counts.classes = (graphData.classes || []).filter(
      (c) => filePaths.has(c.filePath) || fileIds.has(c.id)
    ).length;
    counts.functions = (graphData.functions || []).filter(
      (fn) => filePaths.has(fn.filePath) || fileIds.has(fn.id)
    ).length;
    counts.methods = (graphData.methods || []).filter(
      (m) => filePaths.has(m.filePath) || fileIds.has(m.id)
    ).length;

    // Dependencies connected to module or its files
    const connectedDepIds = new Set<string>();
    for (const edge of graphData.edges || []) {
      if (
        edge.type === "DEPENDS_ON" &&
        (edge.source === nodeId || fileIds.has(edge.source))
      ) {
        connectedDepIds.add(edge.target);
      }
    }
    counts.dependencies = connectedDepIds.size;
    return counts;
  }

  // If File
  if (nodeId.startsWith("file:")) {
    const filePath = nodeId.replace(/^file:[^:]+:/, "");
    counts.classes = (graphData.classes || []).filter(
      (c) =>
        c.filePath === filePath ||
        (graphData.edges || []).some(
          (e) => e.source === nodeId && e.target === c.id
        )
    ).length;
    counts.functions = (graphData.functions || []).filter(
      (fn) =>
        fn.filePath === filePath ||
        (graphData.edges || []).some(
          (e) => e.source === nodeId && e.target === fn.id
        )
    ).length;
    counts.methods = (graphData.methods || []).filter(
      (m) =>
        m.filePath === filePath ||
        (graphData.edges || []).some(
          (e) => e.source === nodeId && e.target === m.id
        )
    ).length;

    // Direct dependencies of this file
    const depIds = new Set<string>();
    for (const edge of graphData.edges || []) {
      if (edge.source === nodeId && edge.type === "DEPENDS_ON") {
        depIds.add(edge.target);
      }
    }
    counts.dependencies = depIds.size;
    return counts;
  }

  // If Class
  if (nodeId.startsWith("class:")) {
    const className = nodeId.split(":").pop();
    counts.methods = (graphData.methods || []).filter(
      (m) =>
        (m.metadata?.parentClass as string) === className ||
        (m.metadata?.className as string) === className ||
        (graphData.edges || []).some(
          (e) => e.source === nodeId && e.target === m.id
        )
    ).length;
    return counts;
  }

  return counts;
}

/**
 * Extracts a focused drill-down subgraph around a target entity from the full Knowledge Graph.
 * Ensures zero duplicate nodes and zero duplicate edges.
 */
export function extractDrillDownScope(
  graphData: RepositoryKnowledgeView,
  targetNodeId: string,
  options?: { expandAll?: boolean }
): DrillDownResult {
  const dummyCounts: DrillDownCounts = {
    files: 0,
    modules: 0,
    classes: 0,
    functions: 0,
    methods: 0,
    dependencies: 0,
    incoming: 0,
    outgoing: 0,
  };

  if (!graphData || !targetNodeId) {
    return {
      focalNode: {
        id: targetNodeId || "unknown",
        type: "Repository",
        name: "unknown",
        label: "unknown",
        repoId: "unknown",
      },
      nodes: [],
      edges: [],
      hasChildren: false,
      counts: dummyCounts,
    };
  }

  // 1. Locate the target node across all entities
  const allNodes: KnowledgeNode[] = [
    graphData.repoNode,
    ...(graphData.modules || []),
    ...(graphData.files || []),
    ...(graphData.classes || []),
    ...(graphData.functions || []),
    ...(graphData.methods || []),
    ...(graphData.dependencies || []),
    ...(graphData.commits || []),
    ...(graphData.contributors || []),
  ].filter(Boolean) as KnowledgeNode[];

  const targetNode = allNodes.find((n) => n.id === targetNodeId);
  if (!targetNode) {
    return {
      focalNode: {
        id: targetNodeId,
        type: "Repository",
        name: targetNodeId,
        label: targetNodeId,
        repoId: graphData.repoNode?.repoId || "unknown",
      },
      nodes: [],
      edges: [],
      hasChildren: false,
      counts: dummyCounts,
    };
  }

  const counts = computeEntityContents(graphData, targetNodeId);

  // 2. Case: Repository Root Scope
  if (targetNode.type === "Repository") {
    const { nodes: scopedNodes, edges: scopedEdges } = filterMapByViewMode(
      graphData,
      "architecture"
    );
    return {
      focalNode: targetNode,
      nodes: scopedNodes,
      edges: scopedEdges,
      hasChildren: (graphData.modules || []).length > 0 || (graphData.files || []).length > 0,
      counts,
    };
  }

  // 3. Case: Module Scope
  if (targetNode.type === "Module") {
    const modSlug = targetNode.id.split(":").pop()?.toLowerCase() || "";
    const allModFiles = (graphData.files || []).filter((f) => {
      if (f.metadata?.moduleId === modSlug) return true;
      return (graphData.edges || []).some(
        (e) =>
          e.source === targetNode.id && e.target === f.id && e.type === "CONTAINS"
      );
    });

    const totalChildCount = allModFiles.length;
    let isCapped = false;
    let modFiles = allModFiles;

    if (!options?.expandAll && allModFiles.length > 40) {
      isCapped = true;
      const connectivity = new Map<string, number>();
      for (const edge of graphData.edges || []) {
        if (edge.type === "IMPORTS" || edge.type === "DEPENDS_ON") {
          connectivity.set(edge.source, (connectivity.get(edge.source) || 0) + 1);
          connectivity.set(edge.target, (connectivity.get(edge.target) || 0) + 1);
        }
      }
      modFiles = [...allModFiles]
        .sort((a, b) => {
          const scoreB = connectivity.get(b.id) || 0;
          const scoreA = connectivity.get(a.id) || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return (a.filePath || a.name).localeCompare(b.filePath || b.name);
        })
        .slice(0, 40);
    }

    const fileIds = new Set(modFiles.map((f) => f.id));

    // Connected dependencies
    const connectedDepIds = new Set<string>();
    for (const edge of graphData.edges || []) {
      if (
        edge.type === "DEPENDS_ON" &&
        (edge.source === targetNode.id || fileIds.has(edge.source))
      ) {
        connectedDepIds.add(edge.target);
      }
    }
    const connectedDeps = (graphData.dependencies || []).filter((d) =>
      connectedDepIds.has(d.id)
    );

    // Build deduplicated nodes
    const nodeMap = new Map<string, KnowledgeNode>();
    nodeMap.set(targetNode.id, targetNode);
    for (const f of modFiles) nodeMap.set(f.id, f);
    for (const d of connectedDeps) nodeMap.set(d.id, d);
    const scopedNodes = Array.from(nodeMap.values());
    const scopedNodeIds = new Set(nodeMap.keys());

    // Build deduplicated edges
    const edgeMap = new Map<string, KnowledgeEdge>();
    for (const file of modFiles) {
      const edgeId = `${targetNode.id}->${file.id}:CONTAINS`;
      edgeMap.set(edgeId, {
        id: edgeId,
        source: targetNode.id,
        target: file.id,
        type: "CONTAINS",
        repoId: targetNode.repoId,
      });
    }

    for (const edge of graphData.edges || []) {
      if (scopedNodeIds.has(edge.source) && scopedNodeIds.has(edge.target)) {
        const key = `${edge.source}->${edge.target}:${edge.type}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, edge);
        }
      }
    }

    return {
      focalNode: targetNode,
      nodes: scopedNodes,
      edges: Array.from(edgeMap.values()),
      hasChildren: allModFiles.length > 0 || connectedDeps.length > 0,
      counts,
      isCapped,
      totalChildCount,
    };
  }

  // 4. Case: File Scope
  if (targetNode.type === "File") {
    const filePath =
      targetNode.filePath || targetNode.id.replace(/^file:[^:]+:/, "");

    const allFileSymbols = [
      ...(graphData.classes || []),
      ...(graphData.functions || []),
      ...(graphData.methods || []),
    ].filter((s) => {
      if (s.filePath === filePath) return true;
      return (graphData.edges || []).some(
        (e) =>
          e.source === targetNode.id && e.target === s.id && e.type === "CONTAINS"
      );
    });

    const totalChildCount = allFileSymbols.length;
    let isCapped = false;
    let fileSymbols = allFileSymbols;

    if (!options?.expandAll && allFileSymbols.length > 40) {
      isCapped = true;
      fileSymbols = allFileSymbols.slice(0, 40);
    }

    const connectedDepIds = new Set<string>();
    for (const edge of graphData.edges || []) {
      if (edge.source === targetNode.id && edge.type === "DEPENDS_ON") {
        connectedDepIds.add(edge.target);
      }
    }
    const connectedDeps = (graphData.dependencies || []).filter((d) =>
      connectedDepIds.has(d.id)
    );

    const importedFileIds = new Set<string>();
    for (const edge of graphData.edges || []) {
      if (edge.source === targetNode.id && edge.type === "IMPORTS") {
        importedFileIds.add(edge.target);
      }
    }
    const importedFiles = (graphData.files || []).filter((f) =>
      importedFileIds.has(f.id)
    );

    const nodeMap = new Map<string, KnowledgeNode>();
    nodeMap.set(targetNode.id, targetNode);
    for (const s of fileSymbols) nodeMap.set(s.id, s);
    for (const d of connectedDeps) nodeMap.set(d.id, d);
    for (const f of importedFiles) nodeMap.set(f.id, f);

    const scopedNodes = Array.from(nodeMap.values());
    const scopedNodeIds = new Set(nodeMap.keys());

    const edgeMap = new Map<string, KnowledgeEdge>();
    for (const sym of fileSymbols) {
      const edgeId = `${targetNode.id}->${sym.id}:CONTAINS`;
      edgeMap.set(edgeId, {
        id: edgeId,
        source: targetNode.id,
        target: sym.id,
        type: "CONTAINS",
        repoId: targetNode.repoId,
      });
    }

    for (const edge of graphData.edges || []) {
      if (scopedNodeIds.has(edge.source) && scopedNodeIds.has(edge.target)) {
        const key = `${edge.source}->${edge.target}:${edge.type}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, edge);
        }
      }
    }

    return {
      focalNode: targetNode,
      nodes: scopedNodes,
      edges: Array.from(edgeMap.values()),
      hasChildren:
        allFileSymbols.length > 0 ||
        connectedDeps.length > 0 ||
        importedFiles.length > 0,
      counts,
      isCapped,
      totalChildCount,
    };
  }

  // 5. Case: Class Scope
  if (targetNode.type === "Class") {
    const className = targetNode.name;
    const classMethods = (graphData.methods || []).filter((m) => {
      if (
        (m.metadata?.parentClass as string) === className ||
        (m.metadata?.className as string) === className
      ) {
        return true;
      }
      return (graphData.edges || []).some(
        (e) =>
          e.source === targetNode.id && e.target === m.id && e.type === "CONTAINS"
      );
    });

    const nodeMap = new Map<string, KnowledgeNode>();
    nodeMap.set(targetNode.id, targetNode);
    for (const m of classMethods) nodeMap.set(m.id, m);

    const scopedNodes = Array.from(nodeMap.values());
    const scopedNodeIds = new Set(nodeMap.keys());

    const edgeMap = new Map<string, KnowledgeEdge>();
    for (const method of classMethods) {
      const edgeId = `${targetNode.id}->${method.id}:CONTAINS`;
      edgeMap.set(edgeId, {
        id: edgeId,
        source: targetNode.id,
        target: method.id,
        type: "CONTAINS",
        repoId: targetNode.repoId,
      });
    }

    for (const edge of graphData.edges || []) {
      if (scopedNodeIds.has(edge.source) && scopedNodeIds.has(edge.target)) {
        const key = `${edge.source}->${edge.target}:${edge.type}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, edge);
        }
      }
    }

    return {
      focalNode: targetNode,
      nodes: scopedNodes,
      edges: Array.from(edgeMap.values()),
      hasChildren: classMethods.length > 0,
      counts,
    };
  }

  // 6. Case: Function, Method, Dependency, or other entity types
  const childNodeIds = new Set<string>();
  for (const edge of graphData.edges || []) {
    if (edge.source === targetNode.id) {
      childNodeIds.add(edge.target);
    }
  }

  const childNodes = allNodes.filter((n) => childNodeIds.has(n.id));
  const nodeMap = new Map<string, KnowledgeNode>();
  nodeMap.set(targetNode.id, targetNode);
  for (const n of childNodes) nodeMap.set(n.id, n);

  const scopedNodes = Array.from(nodeMap.values());
  const scopedNodeIds = new Set(nodeMap.keys());

  const scopedEdges = (graphData.edges || []).filter(
    (e) => scopedNodeIds.has(e.source) && scopedNodeIds.has(e.target)
  );

  return {
    focalNode: targetNode,
    nodes: scopedNodes,
    edges: scopedEdges,
    hasChildren: childNodes.length > 0,
    counts,
  };
}

/**
 * Transforms a focused DrillDownResult into ready-to-render ProjectMapData.
 */
export function transformScopeToMap(
  scopeResult: DrillDownResult,
  viewMode: MapViewMode = "architecture"
): ProjectMapData {
  const { focalNode, nodes: rawNodes, edges: rawEdges } = scopeResult;
  if (!rawNodes || rawNodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      world: { w: 1200, h: 800 },
      stats: {
        totalNodes: 0,
        totalEdges: 0,
        nodesByType: {
          Repository: 0,
          Module: 0,
          File: 0,
          Class: 0,
          Function: 0,
          Method: 0,
          Commit: 0,
          Contributor: 0,
          Dependency: 0,
        },
        edgesByType: {
          CONTAINS: 0,
          IMPORTS: 0,
          DEPENDS_ON: 0,
          CHANGES: 0,
          AUTHORED_BY: 0,
          COMMITTED_BY: 0,
          EXTENDS: 0,
          IMPLEMENTS: 0,
        },
      },
    };
  }

  // 1. Calculate focused layout with focalNodeId
  const { positionedNodes, world } = calculateMapLayout(
    rawNodes,
    rawEdges,
    focalNode.id
  );

  // 2. Map edges with preserved relation types and human-readable labels
  const nodeIds = new Set(positionedNodes.map((n) => n.id));
  const mappedEdges: MapEdge[] = [];

  for (const edge of rawEdges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      mappedEdges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relationType: edge.type,
        label: RELATION_LABELS[edge.type] || edge.type,
        repoId: edge.repoId,
        metadata: edge.metadata,
      });
    }
  }

  // 3. Compute statistics
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
  for (const node of positionedNodes) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

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
  for (const edge of mappedEdges) {
    edgesByType[edge.relationType] = (edgesByType[edge.relationType] || 0) + 1;
  }

  return {
    nodes: positionedNodes,
    edges: mappedEdges,
    world,
    stats: {
      totalNodes: positionedNodes.length,
      totalEdges: mappedEdges.length,
      nodesByType,
      edgesByType,
    },
  };
}

/**
 * Merges a traversal API response into the current scoped nodes and edges,
 * strictly preventing duplicate nodes and duplicate edges.
 */
export function mergeTraversalIntoScope(
  currentNodes: KnowledgeNode[],
  currentEdges: KnowledgeEdge[],
  traversal: { nodes?: KnowledgeNode[]; edges?: KnowledgeEdge[] }
): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
  const nodeMap = new Map<string, KnowledgeNode>();
  for (const n of currentNodes) {
    nodeMap.set(n.id, n);
  }
  for (const n of traversal.nodes || []) {
    if (!nodeMap.has(n.id)) {
      nodeMap.set(n.id, n);
    }
  }

  const mergedNodes = Array.from(nodeMap.values());
  const validNodeIds = new Set(nodeMap.keys());

  const edgeMap = new Map<string, KnowledgeEdge>();
  for (const e of currentEdges) {
    if (validNodeIds.has(e.source) && validNodeIds.has(e.target)) {
      const key = `${e.source}->${e.target}:${e.type}`;
      edgeMap.set(key, e);
    }
  }
  for (const e of traversal.edges || []) {
    if (validNodeIds.has(e.source) && validNodeIds.has(e.target)) {
      const key = `${e.source}->${e.target}:${e.type}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, e);
      }
    }
  }

  return {
    nodes: mergedNodes,
    edges: Array.from(edgeMap.values()),
  };
}

/**
 * Builds a structured breadcrumb trail from the current drill-down navigation stack.
 */
export function buildBreadcrumbTrail(
  stack: DrillDownScope[]
): { id: string; label: string; type: KnowledgeEntityType; isCurrent: boolean }[] {
  if (!stack || stack.length === 0) return [];
  return stack.map((item, index) => ({
    id: item.id,
    label: index === 0 ? "Project" : item.name,
    type: item.type,
    isCurrent: index === stack.length - 1,
  }));
}

