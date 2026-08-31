import type { ModuleFixture, GraphEdge, WorldDimensions, ModuleType } from "@/data/types";

interface DbModule {
  id: string;
  name: string;
  type: string;
  desc: string;
  aiSummary?: string | null;
  filesCount: number;
}

interface DbDep {
  fromModule?: string | null;
  toModule?: string | null;
  name?: string | null;
}

export function buildDynamicMapData(
  dbModules: DbModule[],
  dbDeps: DbDep[]
): { nodes: ModuleFixture[]; edges: GraphEdge[]; world: WorldDimensions } {
  if (!dbModules || dbModules.length === 0) {
    return {
      nodes: [],
      edges: [],
      world: { w: 1200, h: 800 },
    };
  }

  // Calculate layout dimensions
  const cols = Math.ceil(Math.sqrt(dbModules.length));
  const spacingX = 240;
  const spacingY = 160;
  const startX = 140;
  const startY = 120;

  const nodes: ModuleFixture[] = dbModules.map((m, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const x = startX + col * spacingX;
    const y = startY + row * spacingY;

    let mType: ModuleType = "core";
    if (m.type === "api" || m.type === "db" || m.type === "ext") {
      mType = m.type as ModuleType;
    }

    return {
      id: m.id,
      name: m.name,
      type: mType,
      files: m.filesCount || 0,
      x,
      y,
      desc: m.desc || `Module ${m.name}`,
      keyFns: [["main()", "entrypoint"], ["parse()", "handler"]],
      deps: [],
      dependents: [],
      related: [],
      ai: m.aiSummary || `Module ${m.name} is part of the system architecture.`,
    };
  });

  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, ModuleFixture>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  dbDeps.forEach((dep) => {
    if (dep.fromModule && dep.toModule && nodeMap.has(dep.fromModule) && nodeMap.has(dep.toModule)) {
      edges.push([dep.fromModule, dep.toModule]);
      const fromNode = nodeMap.get(dep.fromModule);
      const toNode = nodeMap.get(dep.toModule);
      if (fromNode && toNode) {
        if (!fromNode.deps.includes(toNode.id)) fromNode.deps.push(toNode.id);
        if (!toNode.dependents.includes(fromNode.id)) toNode.dependents.push(fromNode.id);
      }
    }
  });

  const width = Math.max(1200, startX * 2 + cols * spacingX);
  const height = Math.max(800, startY * 2 + Math.ceil(dbModules.length / cols) * spacingY);

  return {
    nodes,
    edges,
    world: { w: width, h: height },
  };
}
