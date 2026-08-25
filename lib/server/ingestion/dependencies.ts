import "server-only";

export interface ParsedDependency {
  kind: "internal" | "external";
  fromModule?: string;
  toModule?: string;
  name?: string;
  version?: string;
  purpose?: string;
  status?: string;
}

export function parsePackageJsonDependencies(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  try {
    const pkg = JSON.parse(content);
    const prodDeps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};

    for (const [name, version] of Object.entries<string>(prodDeps)) {
      deps.push({
        kind: "external",
        name,
        version: String(version),
        purpose: "Production dependency",
        status: "active",
      });
    }

    for (const [name, version] of Object.entries<string>(devDeps)) {
      deps.push({
        kind: "external",
        name,
        version: String(version),
        purpose: "Development dependency",
        status: "active",
      });
    }
  } catch {
    // Ignore invalid JSON manifest
  }
  return deps;
}

export function resolveInternalModuleEdges(
  fileImports: Array<{ module: string; imports: string[] }>,
  pathToModuleMap: Map<string, string>
): ParsedDependency[] {
  const edges: ParsedDependency[] = [];
  const edgeSet = new Set<string>();

  for (const { module: fromMod, imports } of fileImports) {
    for (const imp of imports) {
      if (imp.startsWith(".")) {
        // Resolve relative import to matching module
        for (const [path, toMod] of pathToModuleMap.entries()) {
          if (fromMod !== toMod && path.includes(imp.replace(/^\.\.\//, "").replace(/^\.\//, ""))) {
            const edgeKey = `${fromMod}->${toMod}`;
            if (!edgeSet.has(edgeKey)) {
              edgeSet.add(edgeKey);
              edges.push({
                kind: "internal",
                fromModule: fromMod,
                toModule: toMod,
              });
            }
          }
        }
      }
    }
  }

  return edges;
}
