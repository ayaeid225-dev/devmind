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

/**
 * Checks whether a given relative file path is a supported dependency manifest.
 */
export function isDependencyManifest(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop()?.toLowerCase() || "";

  if (fileName === "package.json") return true;
  if (fileName === "requirements.txt" || (fileName.endsWith(".txt") && fileName.includes("requirements"))) return true;
  if (fileName === "pyproject.toml") return true;
  if (fileName === "pipfile") return true;
  if (fileName === "pubspec.yaml" || fileName === "pubspec.yml") return true;
  if (fileName === "go.mod") return true;
  if (fileName === "pom.xml") return true;
  if (fileName === "build.gradle" || fileName === "build.gradle.kts") return true;
  if (fileName === "cargo.toml") return true;

  return false;
}

/**
 * Universal dispatcher to parse dependencies from any recognized manifest file.
 */
export function parseManifestDependencies(filePath: string, content: string): ParsedDependency[] {
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop()?.toLowerCase() || "";

  try {
    if (fileName === "package.json") {
      return parsePackageJsonDependencies(content);
    }
    if (fileName === "requirements.txt" || (fileName.endsWith(".txt") && fileName.includes("requirements"))) {
      return parseRequirementsTxtDependencies(content);
    }
    if (fileName === "pyproject.toml") {
      return parsePyprojectTomlDependencies(content);
    }
    if (fileName === "pipfile") {
      return parsePipfileDependencies(content);
    }
    if (fileName === "pubspec.yaml" || fileName === "pubspec.yml") {
      return parsePubspecYamlDependencies(content);
    }
    if (fileName === "go.mod") {
      return parseGoModDependencies(content);
    }
    if (fileName === "pom.xml") {
      return parsePomXmlDependencies(content);
    }
    if (fileName === "build.gradle" || fileName === "build.gradle.kts") {
      return parseGradleDependencies(content);
    }
    if (fileName === "cargo.toml") {
      return parseCargoTomlDependencies(content);
    }
  } catch {
    // Non-fatal error isolation: corrupted manifest does not abort ingestion
  }

  return [];
}

/**
 * 1. Node.js / JavaScript / TypeScript (package.json)
 */
export function parsePackageJsonDependencies(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  try {
    const pkg = JSON.parse(content);
    const prodDeps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    const peerDeps = pkg.peerDependencies || {};

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

    for (const [name, version] of Object.entries<string>(peerDeps)) {
      deps.push({
        kind: "external",
        name,
        version: String(version),
        purpose: "Peer dependency",
        status: "active",
      });
    }
  } catch {
    // Ignore invalid JSON manifest
  }
  return deps;
}

/**
 * 2. Python (requirements.txt)
 */
export function parseRequirementsTxtDependencies(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    let line = rawLine.trim();
    // Strip comments
    if (line.includes("#")) {
      line = line.split("#")[0].trim();
    }
    if (!line) continue;

    // Ignore options like -r other.txt, -f, -i, --extra-index-url, -e
    if (line.startsWith("-") || line.startsWith("--")) continue;

    // Strip environment markers (e.g., ; python_version >= '3.8')
    if (line.includes(";")) {
      line = line.split(";")[0].trim();
    }

    // Match package name and optional version specifier
    // Format: name, name==1.0.0, name>=2.0.0, name[extra]<=3.0, name~=1.4
    const match = line.match(/^([A-Za-z0-9_.\-]+)(?:\[[^\]]+\])?\s*([<>=!~].*)?$/);
    if (match) {
      const name = match[1].trim();
      const version = match[2] ? match[2].trim() : "*";
      deps.push({
        kind: "external",
        name,
        version,
        purpose: "Python dependency",
        status: "active",
      });
    }
  }

  return deps;
}

/**
 * 3. Python (pyproject.toml)
 * Handles PEP 621 [project.dependencies] and Poetry [tool.poetry.dependencies]
 */
export function parsePyprojectTomlDependencies(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  const lines = content.split(/\r?\n/);

  let currentSection = "";
  let insideProjectDepsList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[(.*)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      insideProjectDepsList = false;
      continue;
    }

    // PEP 621: [project] dependencies = [ ... ]
    if (currentSection === "project") {
      if (line.startsWith("dependencies") && line.includes("[")) {
        insideProjectDepsList = true;
        if (line.includes("]")) {
          // Inline list
          const inner = line.substring(line.indexOf("[") + 1, line.lastIndexOf("]"));
          extractPep621DepStrings(inner, deps, "Production dependency");
          insideProjectDepsList = false;
        }
        continue;
      }
    }

    if (insideProjectDepsList) {
      if (line.includes("]")) {
        const inner = line.substring(0, line.lastIndexOf("]"));
        extractPep621DepStrings(inner, deps, "Production dependency");
        insideProjectDepsList = false;
      } else {
        extractPep621DepStrings(line, deps, "Production dependency");
      }
      continue;
    }

    // Poetry: [tool.poetry.dependencies] or [tool.poetry.group.dev.dependencies]
    if (
      currentSection === "tool.poetry.dependencies" ||
      currentSection.startsWith("tool.poetry.group.")
    ) {
      const isDev = currentSection.includes("dev") || currentSection.includes("test");
      const kvMatch = line.match(/^([A-Za-z0-9_.\-]+)\s*=\s*(.*)$/);
      if (kvMatch) {
        const name = kvMatch[1].trim();
        if (name.toLowerCase() === "python") continue; // Skip Python runtime specifier

        let rawVal = kvMatch[2].trim();
        let version = "*";

        if (rawVal.startsWith('"') || rawVal.startsWith("'")) {
          version = rawVal.replace(/^["']|["']$/g, "").trim();
        } else if (rawVal.startsWith("{")) {
          const vMatch = rawVal.match(/version\s*=\s*["']([^"']+)["']/);
          if (vMatch) version = vMatch[1].trim();
        }

        deps.push({
          kind: "external",
          name,
          version,
          purpose: isDev ? "Development dependency" : "Production dependency",
          status: "active",
        });
      }
    }
  }

  return deps;
}

function extractPep621DepStrings(chunk: string, deps: ParsedDependency[], purpose: string) {
  const stringMatches = chunk.matchAll(/["']([^"']+)["']/g);
  for (const match of stringMatches) {
    let depSpec = match[1].trim();
    if (depSpec.includes(";")) {
      depSpec = depSpec.split(";")[0].trim();
    }
    const parsed = depSpec.match(/^([A-Za-z0-9_.\-]+)(?:\[[^\]]+\])?\s*([<>=!~].*)?$/);
    if (parsed) {
      deps.push({
        kind: "external",
        name: parsed[1].trim(),
        version: parsed[2] ? parsed[2].trim() : "*",
        purpose,
        status: "active",
      });
    }
  }
}

/**
 * 4. Python (Pipfile)
 */
export function parsePipfileDependencies(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  const lines = content.split(/\r?\n/);
  let section = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const secMatch = line.match(/^\[(.*)\]$/);
    if (secMatch) {
      section = secMatch[1].trim();
      continue;
    }

    if (section === "packages" || section === "dev-packages") {
      const kvMatch = line.match(/^([A-Za-z0-9_.\-]+)\s*=\s*(.*)$/);
      if (kvMatch) {
        const name = kvMatch[1].trim();
        let version = kvMatch[2].trim().replace(/^["']|["']$/g, "");
        if (version.startsWith("{")) {
          const vMatch = version.match(/version\s*=\s*["']([^"']+)["']/);
          version = vMatch ? vMatch[1] : "*";
        }
        deps.push({
          kind: "external",
          name,
          version: version || "*",
          purpose: section === "dev-packages" ? "Development dependency" : "Production dependency",
          status: "active",
        });
      }
    }
  }

  return deps;
}

/**
 * 5. Dart / Flutter (pubspec.yaml)
 */
export function parsePubspecYamlDependencies(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  const lines = content.split(/\r?\n/);

  let currentSection: "dependencies" | "dev_dependencies" | null = null;
  let sectionIndent = 0;
  let lastDep: ParsedDependency | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const sectionMatch = rawLine.match(/^(\s*)(dependencies|dev_dependencies)\s*:/);
    if (sectionMatch) {
      currentSection = sectionMatch[2] as "dependencies" | "dev_dependencies";
      sectionIndent = sectionMatch[1].length;
      lastDep = null;
      continue;
    }

    // Any key at same or less indent than the section ends the section
    const lineIndent = rawLine.match(/^(\s*)/)?.[1].length || 0;
    if (currentSection && lineIndent <= sectionIndent && /^[A-Za-z0-9_\-]+:/.test(trimmed)) {
      currentSection = null;
      lastDep = null;
      continue;
    }

    if (currentSection && lineIndent > sectionIndent) {
      // Check if this is a sub-property of the previous dependency (more indented)
      if (lastDep && lineIndent > sectionIndent + 2) {
        if (trimmed.startsWith("sdk:")) {
          const sdkVal = trimmed.replace(/^sdk:\s*/, "");
          lastDep.version = `sdk: ${sdkVal}`;
        }
        continue;
      }

      const match = trimmed.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (match) {
        const name = match[1].trim();
        let version = match[2].trim();
        if (version.includes("#")) {
          version = version.split("#")[0].trim();
        }
        if (!version) {
          version = "*";
        }

        const dep: ParsedDependency = {
          kind: "external",
          name,
          version,
          purpose: currentSection === "dev_dependencies" ? "Development dependency" : "Flutter/Dart dependency",
          status: "active",
        };
        deps.push(dep);
        lastDep = dep;
      }
    }
  }

  return deps;
}

/**
 * 6. Go (go.mod)
 */
export function parseGoModDependencies(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  const lines = content.split(/\r?\n/);

  let insideRequireBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) continue;

    if (line === "require (") {
      insideRequireBlock = true;
      continue;
    }
    if (insideRequireBlock && line === ")") {
      insideRequireBlock = false;
      continue;
    }

    if (insideRequireBlock) {
      const isIndirect = line.includes("// indirect");
      const cleanLine = line.replace(/\/\/.*$/, "").trim();
      const parts = cleanLine.split(/\s+/);
      if (parts.length >= 2) {
        deps.push({
          kind: "external",
          name: parts[0],
          version: parts[1],
          purpose: isIndirect ? "Go dependency (indirect)" : "Go dependency",
          status: "active",
        });
      }
    } else if (line.startsWith("require ")) {
      const isIndirect = line.includes("// indirect");
      const cleanLine = line.replace(/^require\s+/, "").replace(/\/\/.*$/, "").trim();
      const parts = cleanLine.split(/\s+/);
      if (parts.length >= 2) {
        deps.push({
          kind: "external",
          name: parts[0],
          version: parts[1],
          purpose: isIndirect ? "Go dependency (indirect)" : "Go dependency",
          status: "active",
        });
      }
    }
  }

  return deps;
}

/**
 * 7. Java Maven (pom.xml)
 */
export function parsePomXmlDependencies(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  // Match each <dependency> ... </dependency> block
  const depBlockRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
  let match: RegExpExecArray | null;

  while ((match = depBlockRegex.exec(content)) !== null) {
    const block = match[1];
    const groupId = block.match(/<groupId>\s*([^<\s]+)\s*<\/groupId>/)?.[1];
    const artifactId = block.match(/<artifactId>\s*([^<\s]+)\s*<\/artifactId>/)?.[1];
    const version = block.match(/<version>\s*([^<\s]+)\s*<\/version>/)?.[1] || "*";
    const scope = block.match(/<scope>\s*([^<\s]+)\s*<\/scope>/)?.[1] || "compile";

    if (artifactId) {
      const fullName = groupId ? `${groupId}:${artifactId}` : artifactId;
      deps.push({
        kind: "external",
        name: fullName,
        version,
        purpose: scope === "test" ? "Test dependency" : "Java Maven dependency",
        status: "active",
      });
    }
  }

  return deps;
}

/**
 * 8. Java / Kotlin Gradle (build.gradle, build.gradle.kts)
 */
export function parseGradleDependencies(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  const lines = content.split(/\r?\n/);

  // Matches implementation 'group:name:version' or api("group:name:version")
  const gradleRegex =
    /(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s*(?:\(|\s)\s*['"]([^'"]+)['"]\s*\)?/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("/*")) continue;

    const match = line.match(gradleRegex);
    if (match) {
      const spec = match[1].trim();
      const isTest = line.includes("testImplementation");
      if (spec.includes(":")) {
        const parts = spec.split(":");
        const name = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : parts[0];
        const version = parts[2] || "*";
        deps.push({
          kind: "external",
          name,
          version,
          purpose: isTest ? "Test dependency" : "Gradle dependency",
          status: "active",
        });
      } else {
        deps.push({
          kind: "external",
          name: spec,
          version: "*",
          purpose: isTest ? "Test dependency" : "Gradle dependency",
          status: "active",
        });
      }
    }
  }

  return deps;
}

/**
 * 9. Rust (Cargo.toml)
 */
export function parseCargoTomlDependencies(content: string): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  const lines = content.split(/\r?\n/);
  let section = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const secMatch = line.match(/^\[(.*)\]$/);
    if (secMatch) {
      section = secMatch[1].trim();
      continue;
    }

    if (section === "dependencies" || section === "dev-dependencies" || section === "build-dependencies") {
      const kvMatch = line.match(/^([A-Za-z0-9_.\-]+)\s*=\s*(.*)$/);
      if (kvMatch) {
        const name = kvMatch[1].trim();
        let rawVal = kvMatch[2].trim();
        let version = "*";

        if (rawVal.startsWith('"') || rawVal.startsWith("'")) {
          version = rawVal.replace(/^["']|["']$/g, "").trim();
        } else if (rawVal.startsWith("{")) {
          const vMatch = rawVal.match(/version\s*=\s*["']([^"']+)["']/);
          if (vMatch) version = vMatch[1].trim();
        }

        deps.push({
          kind: "external",
          name,
          version,
          purpose: section === "dev-dependencies" ? "Development dependency" : "Rust Cargo dependency",
          status: "active",
        });
      }
    }
  }

  return deps;
}

/**
 * Resolves internal module-to-module dependencies using detected file imports.
 */
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
