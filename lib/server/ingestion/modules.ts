import "server-only";

export interface InferredModule {
  id: string;
  name: string;
  type: "core" | "api" | "db" | "ext";
  desc: string;
  filePaths: string[];
}

export function inferModulesFromPaths(filePaths: string[]): InferredModule[] {
  const moduleMap = new Map<string, string[]>();

  for (const path of filePaths) {
    const parts = path.split("/");
    let moduleKey = "root";

    if (parts.length > 1) {
      const first = parts[0].toLowerCase();
      if (["src", "lib", "app", "packages"].includes(first) && parts.length > 2) {
        moduleKey = `${parts[0]}/${parts[1]}`;
      } else {
        moduleKey = parts[0];
      }
    }

    if (!moduleMap.has(moduleKey)) {
      moduleMap.set(moduleKey, []);
    }
    moduleMap.get(moduleKey)!.push(path);
  }

  const modules: InferredModule[] = [];

  for (const [key, paths] of moduleMap.entries()) {
    const cleanName = key.replace(/^mod-/, "").replace(/[^a-zA-Z0-9_-]/g, "-");
    const id = `mod-${cleanName}`;
    let type: "core" | "api" | "db" | "ext" = "core";

    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("api") || lowerKey.includes("route") || lowerKey.includes("controller")) {
      type = "api";
    } else if (lowerKey.includes("db") || lowerKey.includes("data") || lowerKey.includes("model") || lowerKey.includes("prisma")) {
      type = "db";
    } else if (lowerKey.includes("ext") || lowerKey.includes("integration") || lowerKey.includes("client")) {
      type = "ext";
    }

    modules.push({
      id,
      name: cleanName === "root" ? "Root Module" : cleanName,
      type,
      desc: `Contains ${paths.length} files in ${key}`,
      filePaths: paths,
    });
  }

  return modules;
}
