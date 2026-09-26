import "server-only";
import path from "node:path";
import { CommonImport } from "./common-model";

export type DependencyResolutionStatus = "RESOLVED_INTERNAL" | "RESOLVED_EXTERNAL" | "UNRESOLVED";

export interface ResolvedFileDependency {
  sourceFile: string;
  targetFile?: string | null;
  importSource: string;
  dependencyType: "import" | "export_from" | "require" | "manifest" | "module_edge";
  kind: "internal" | "external";
  language: string;
  resolutionStatus: DependencyResolutionStatus;
  name?: string | null;
  version?: string | null;
  purpose?: string | null;
  fromModule?: string | null;
  toModule?: string | null;
  error?: string | null;
  key: string;
}

export interface PathAliasMapping {
  prefix: string;
  targets: string[];
}

export interface RepoFileIndex {
  paths: Set<string>;
  caseInsensitiveMap: Map<string, string>;
  directoryFiles: Map<string, string[]>;
  tsAliases: PathAliasMapping[];
  dartPackageName?: string;
  goModuleName?: string;
}

/**
 * Generates a stable unique key for upserting and deduplicating dependencies.
 */
export function generateDependencyKey(
  repoId: string,
  sourceFile: string | null | undefined,
  importSource: string | null | undefined,
  dependencyType = "import"
): string {
  const src = (sourceFile || "global").replace(/\\/g, "/");
  const imp = (importSource || "").replace(/\\/g, "/");
  return `${repoId}::${src}::${imp}::${dependencyType}`;
}

/**
 * Builds an in-memory file index from the repository blob tree.
 * Built once per repository scan for O(1) resolution without disk hits.
 */
export function buildRepoFileIndex(
  filePaths: string[],
  configs?: {
    tsconfigContent?: string | null;
    pubspecContent?: string | null;
    goModContent?: string | null;
  }
): RepoFileIndex {
  const paths = new Set<string>();
  const caseInsensitiveMap = new Map<string, string>();
  const directoryFiles = new Map<string, string[]>();

  for (const rawPath of filePaths) {
    const normalized = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
    paths.add(normalized);
    caseInsensitiveMap.set(normalized.toLowerCase(), normalized);

    const dir = path.posix.dirname(normalized);
    const existing = directoryFiles.get(dir) || [];
    existing.push(normalized);
    directoryFiles.set(dir, existing);
  }

  // Parse tsconfig.json / jsconfig.json path aliases
  const tsAliases: PathAliasMapping[] = [];
  if (configs?.tsconfigContent) {
    parseTsconfigAliases(configs.tsconfigContent, tsAliases);
  }

  // Parse pubspec.yaml package name
  let dartPackageName: string | undefined;
  if (configs?.pubspecContent) {
    const nameMatch = configs.pubspecContent.match(/^name\s*:\s*([a-zA-Z0-9_]+)/m);
    if (nameMatch) {
      dartPackageName = nameMatch[1].trim();
    }
  }

  // Parse go.mod module path
  let goModuleName: string | undefined;
  if (configs?.goModContent) {
    const modMatch = configs.goModContent.match(/^module\s+([^\s\r\n]+)/m);
    if (modMatch) {
      goModuleName = modMatch[1].trim();
    }
  }

  return {
    paths,
    caseInsensitiveMap,
    directoryFiles,
    tsAliases,
    dartPackageName,
    goModuleName,
  };
}

/**
 * Strips comments from JSONC (tsconfig.json) and extracts compilerOptions.paths and baseUrl
 */
export function parseTsconfigAliases(content: string, outAliases: PathAliasMapping[]) {
  try {
    // Strip single-line and multi-line comments
    const cleanJson = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^\\:])\/\/.*$/gm, "$1")
      .replace(/,(\s*[}\]])/g, "$1"); // remove trailing commas

    const parsed = JSON.parse(cleanJson);
    const compilerOptions = parsed?.compilerOptions || {};
    const baseUrl = (compilerOptions.baseUrl || ".").replace(/\\/g, "/").replace(/^\.\/?/, "");
    const rawPaths = compilerOptions.paths || {};

    for (const [pattern, targetList] of Object.entries<string[]>(rawPaths)) {
      if (!Array.isArray(targetList) || targetList.length === 0) continue;
      const normalizedTargets = targetList.map((t) => {
        let clean = t.replace(/\\/g, "/");
        if (clean.startsWith("./")) clean = clean.slice(2);
        if (baseUrl && baseUrl !== ".") {
          clean = path.posix.join(baseUrl, clean);
        }
        return clean;
      });

      outAliases.push({
        prefix: pattern,
        targets: normalizedTargets,
      });
    }
  } catch {
    // Non-fatal if tsconfig is malformed
  }
}

/**
 * Resolves a single imported specifier from a source file into a structured FileDependency.
 */
export function resolveFileDependency(
  sourcePath: string,
  imp: CommonImport,
  languageId: string,
  index: RepoFileIndex,
  repoId: string
): ResolvedFileDependency {
  const normSource = sourcePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const importSource = imp.source.trim();
  const depType = imp.importType === "export_from" ? "export_from" : "import";

  const baseResult: Omit<ResolvedFileDependency, "resolutionStatus" | "kind" | "key"> = {
    sourceFile: normSource,
    importSource,
    dependencyType: depType,
    language: languageId,
    targetFile: null,
    name: null,
    version: null,
    purpose: null,
    error: null,
  };

  // Language specific resolution
  switch (languageId.toLowerCase()) {
    case "typescript":
    case "javascript":
      return resolveTypeScriptDependency(normSource, importSource, baseResult, index, repoId);

    case "python":
      return resolvePythonDependency(normSource, importSource, baseResult, index, repoId);

    case "dart":
      return resolveDartDependency(normSource, importSource, baseResult, index, repoId);

    case "java":
      return resolveJavaDependency(normSource, importSource, baseResult, index, repoId);

    case "go":
      return resolveGoDependency(normSource, importSource, baseResult, index, repoId);

    default:
      // Generic fallback for other languages: check relative path or mark unresolved
      return resolveGenericDependency(normSource, importSource, baseResult, index, repoId);
  }
}

/**
 * 1. TypeScript / JavaScript Resolution
 */
function resolveTypeScriptDependency(
  sourceFile: string,
  importSource: string,
  base: any,
  index: RepoFileIndex,
  repoId: string
): ResolvedFileDependency {
  const tsExtensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs", ".d.ts"];
  const indexFiles = [
    "index.ts",
    "index.tsx",
    "index.js",
    "index.jsx",
    "index.mts",
    "index.mjs",
    "index.cjs",
  ];

  // A. Relative imports: ./... or ../...
  if (importSource.startsWith("./") || importSource.startsWith("../")) {
    const sourceDir = path.posix.dirname(sourceFile);
    const candidatePath = path.posix.normalize(path.posix.join(sourceDir, importSource));

    // Security check: cannot escape repo root
    if (candidatePath.startsWith("..") || candidatePath.startsWith("/")) {
      return {
        ...base,
        kind: "internal",
        resolutionStatus: "UNRESOLVED",
        error: "Path escapes repository root",
        key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
      };
    }

    const resolved = tryResolvePathWithExtensions(candidatePath, index, tsExtensions, indexFiles);
    if (resolved) {
      return {
        ...base,
        targetFile: resolved,
        kind: "internal",
        resolutionStatus: "RESOLVED_INTERNAL",
        key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
      };
    }

    return {
      ...base,
      kind: "internal",
      resolutionStatus: "UNRESOLVED",
      error: `Could not resolve local file ${candidatePath}`,
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // B. TypeScript Path Aliases (tsconfig.json / jsconfig.json)
  if (index.tsAliases.length > 0) {
    for (const alias of index.tsAliases) {
      if (alias.prefix.endsWith("/*")) {
        const prefixBase = alias.prefix.slice(0, -2);
        if (importSource === prefixBase || importSource.startsWith(prefixBase + "/")) {
          const remainder = importSource.slice(prefixBase.length + 1);
          for (const targetPattern of alias.targets) {
            const mapped = targetPattern.replace(/\*/g, remainder);
            const resolved = tryResolvePathWithExtensions(mapped, index, tsExtensions, indexFiles);
            if (resolved) {
              return {
                ...base,
                targetFile: resolved,
                kind: "internal",
                resolutionStatus: "RESOLVED_INTERNAL",
                key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
              };
            }
          }
        }
      } else if (alias.prefix === importSource) {
        for (const targetPattern of alias.targets) {
          const resolved = tryResolvePathWithExtensions(targetPattern, index, tsExtensions, indexFiles);
          if (resolved) {
            return {
              ...base,
              targetFile: resolved,
              kind: "internal",
              resolutionStatus: "RESOLVED_INTERNAL",
              key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
            };
          }
        }
      }
    }
  }

  // C. Node.js built-ins
  const nodeBuiltins = new Set([
    "assert",
    "async_hooks",
    "buffer",
    "child_process",
    "cluster",
    "console",
    "constants",
    "crypto",
    "dgram",
    "diagnostics_channel",
    "dns",
    "domain",
    "events",
    "fs",
    "fs/promises",
    "http",
    "http2",
    "https",
    "inspector",
    "module",
    "net",
    "os",
    "path",
    "path/posix",
    "path/win32",
    "perf_hooks",
    "process",
    "punycode",
    "querystring",
    "readline",
    "repl",
    "stream",
    "stream/promises",
    "string_decoder",
    "timers",
    "timers/promises",
    "tls",
    "trace_events",
    "tty",
    "url",
    "util",
    "v8",
    "vm",
    "wasi",
    "worker_threads",
    "zlib",
  ]);

  const cleanModule = importSource.startsWith("node:") ? importSource.slice(5) : importSource;
  if (nodeBuiltins.has(cleanModule) || importSource.startsWith("node:")) {
    return {
      ...base,
      name: importSource,
      kind: "external",
      resolutionStatus: "RESOLVED_EXTERNAL",
      purpose: "Node.js standard library",
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // D. External npm package
  // e.g. "react", "@prisma/client", "lodash/get"
  let packageName = importSource;
  if (importSource.startsWith("@")) {
    const parts = importSource.split("/");
    packageName = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importSource;
  } else {
    packageName = importSource.split("/")[0];
  }

  return {
    ...base,
    name: packageName,
    kind: "external",
    resolutionStatus: "RESOLVED_EXTERNAL",
    purpose: "NPM package dependency",
    key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
  };
}

/**
 * 2. Python Resolution
 */
function resolvePythonDependency(
  sourceFile: string,
  importSource: string,
  base: any,
  index: RepoFileIndex,
  repoId: string
): ResolvedFileDependency {
  const pyExtensions = ["", ".py"];
  const indexFiles = ["__init__.py"];

  // A. Explicit relative imports: from . import x, from .utils import y, from ..services import z
  if (importSource.startsWith(".")) {
    const sourceDir = path.posix.dirname(sourceFile);
    // Count leading dots
    const dotsMatch = importSource.match(/^(\.+)(.*)$/);
    const dotCount = dotsMatch ? dotsMatch[1].length : 1;
    const remainder = dotsMatch && dotsMatch[2] ? dotsMatch[2].replace(/^\./, "").replace(/\./g, "/") : "";

    // 1 dot = current dir, 2 dots = parent dir (go up 1 level), 3 dots = parent of parent
    let targetDir = sourceDir;
    for (let i = 1; i < dotCount; i++) {
      targetDir = path.posix.dirname(targetDir);
    }

    const candidate = remainder ? path.posix.join(targetDir, remainder) : targetDir;
    const resolved = tryResolvePathWithExtensions(candidate, index, pyExtensions, indexFiles);
    if (resolved) {
      return {
        ...base,
        targetFile: resolved,
        kind: "internal",
        resolutionStatus: "RESOLVED_INTERNAL",
        key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
      };
    }

    return {
      ...base,
      kind: "internal",
      resolutionStatus: "UNRESOLVED",
      error: `Could not resolve Python relative module ${candidate}`,
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // B. Sibling module without leading dot (common in local Python packages)
  // e.g. In app/services/user.py, "import auth" or "from auth import check"
  const sourceDir = path.posix.dirname(sourceFile);
  const siblingPath = path.posix.join(sourceDir, importSource.replace(/\./g, "/"));
  const siblingResolved = tryResolvePathWithExtensions(siblingPath, index, pyExtensions, indexFiles);
  if (siblingResolved) {
    return {
      ...base,
      targetFile: siblingResolved,
      kind: "internal",
      resolutionStatus: "RESOLVED_INTERNAL",
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // C. Absolute internal import: app.services.user -> app/services/user.py
  const asPath = importSource.replace(/\./g, "/");
  const directResolved = tryResolvePathWithExtensions(asPath, index, pyExtensions, indexFiles);
  if (directResolved) {
    return {
      ...base,
      targetFile: directResolved,
      kind: "internal",
      resolutionStatus: "RESOLVED_INTERNAL",
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // Also check if prefix is a file (e.g. app/services.py when importing app.services.UserService)
  const segments = importSource.split(".");
  for (let i = segments.length - 1; i >= 1; i--) {
    const partialPath = segments.slice(0, i).join("/");
    const partialResolved = tryResolvePathWithExtensions(partialPath, index, pyExtensions, indexFiles);
    if (partialResolved) {
      return {
        ...base,
        targetFile: partialResolved,
        kind: "internal",
        resolutionStatus: "RESOLVED_INTERNAL",
        key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
      };
    }
  }

  // Also try with common python roots (src/, lib/)
  for (const root of ["src", "lib"]) {
    const rootPath = path.posix.join(root, asPath);
    const rootResolved = tryResolvePathWithExtensions(rootPath, index, pyExtensions, indexFiles);
    if (rootResolved) {
      return {
        ...base,
        targetFile: rootResolved,
        kind: "internal",
        resolutionStatus: "RESOLVED_INTERNAL",
        key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
      };
    }
  }

  // D. Python Standard Library
  const pythonStdlib = new Set([
    "sys",
    "os",
    "re",
    "math",
    "typing",
    "json",
    "datetime",
    "collections",
    "itertools",
    "functools",
    "pathlib",
    "logging",
    "subprocess",
    "unittest",
    "dataclasses",
    "abc",
    "io",
    "time",
    "hashlib",
    "random",
    "copy",
    "traceback",
    "asyncio",
    "multiprocessing",
    "threading",
    "socket",
    "http",
    "urllib",
    "email",
    "sqlite3",
    "csv",
    "xml",
    "shutil",
    "tempfile",
    "glob",
    "enum",
    "inspect",
    "contextlib",
    "uuid",
    "queue",
    "base64",
    "struct",
    "platform",
    "warnings",
  ]);

  const rootPkg = segments[0];
  if (pythonStdlib.has(rootPkg)) {
    return {
      ...base,
      name: rootPkg,
      kind: "external",
      resolutionStatus: "RESOLVED_EXTERNAL",
      purpose: "Python standard library",
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // E. External package (e.g. requests, numpy, fastapi)
  return {
    ...base,
    name: rootPkg,
    kind: "external",
    resolutionStatus: "RESOLVED_EXTERNAL",
    purpose: "Python package dependency",
    key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
  };
}

/**
 * 3. Dart / Flutter Resolution
 */
function resolveDartDependency(
  sourceFile: string,
  importSource: string,
  base: any,
  index: RepoFileIndex,
  repoId: string
): ResolvedFileDependency {
  // A. Relative imports: ../services/api.dart or ./models/user.dart
  if (importSource.startsWith("./") || importSource.startsWith("../")) {
    const sourceDir = path.posix.dirname(sourceFile);
    const candidatePath = path.posix.normalize(path.posix.join(sourceDir, importSource));

    if (index.paths.has(candidatePath)) {
      return {
        ...base,
        targetFile: candidatePath,
        kind: "internal",
        resolutionStatus: "RESOLVED_INTERNAL",
        key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
      };
    }

    return {
      ...base,
      kind: "internal",
      resolutionStatus: "UNRESOLVED",
      error: `Could not resolve Dart relative file ${candidatePath}`,
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // B. Local package import: package:<local_package>/... -> lib/...
  if (index.dartPackageName && importSource.startsWith(`package:${index.dartPackageName}/`)) {
    const remainder = importSource.replace(`package:${index.dartPackageName}/`, "");
    const localCandidate = path.posix.join("lib", remainder);

    if (index.paths.has(localCandidate)) {
      return {
        ...base,
        targetFile: localCandidate,
        kind: "internal",
        resolutionStatus: "RESOLVED_INTERNAL",
        key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
      };
    }

    return {
      ...base,
      kind: "internal",
      resolutionStatus: "UNRESOLVED",
      error: `Could not find local package file ${localCandidate}`,
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // C. Dart / Flutter SDK imports
  if (
    importSource.startsWith("dart:") ||
    importSource.startsWith("package:flutter/") ||
    importSource.startsWith("package:flutter_test/")
  ) {
    return {
      ...base,
      name: importSource.split("/")[0],
      kind: "external",
      resolutionStatus: "RESOLVED_EXTERNAL",
      purpose: "Flutter / Dart SDK",
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // D. External Dart package
  if (importSource.startsWith("package:")) {
    const pkgName = importSource.slice(8).split("/")[0];
    return {
      ...base,
      name: pkgName,
      kind: "external",
      resolutionStatus: "RESOLVED_EXTERNAL",
      purpose: "Dart pub dependency",
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  return {
    ...base,
    kind: "internal",
    resolutionStatus: "UNRESOLVED",
    key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
  };
}

/**
 * 4. Java Resolution
 */
function resolveJavaDependency(
  sourceFile: string,
  importSource: string,
  base: any,
  index: RepoFileIndex,
  repoId: string
): ResolvedFileDependency {
  // A. Java standard library
  if (
    importSource.startsWith("java.") ||
    importSource.startsWith("javax.") ||
    importSource.startsWith("jakarta.") ||
    importSource.startsWith("sun.") ||
    importSource.startsWith("org.w3c.") ||
    importSource.startsWith("org.xml.")
  ) {
    return {
      ...base,
      name: importSource.split(".").slice(0, 2).join("."),
      kind: "external",
      resolutionStatus: "RESOLVED_EXTERNAL",
      purpose: "Java standard library",
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // B. Internal Java file resolution: com.example.services.UserService -> com/example/services/UserService.java
  const relativeJavaPath = importSource.replace(/\./g, "/") + ".java";

  for (const knownPath of index.paths) {
    if (knownPath.endsWith(relativeJavaPath)) {
      return {
        ...base,
        targetFile: knownPath,
        kind: "internal",
        resolutionStatus: "RESOLVED_INTERNAL",
        key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
      };
    }
  }

  // Wildcard import: com.example.services.*
  if (importSource.endsWith(".*")) {
    const pkgDir = importSource.slice(0, -2).replace(/\./g, "/");
    for (const knownPath of index.paths) {
      if (knownPath.includes(pkgDir) && knownPath.endsWith(".java")) {
        return {
          ...base,
          targetFile: knownPath,
          kind: "internal",
          resolutionStatus: "RESOLVED_INTERNAL",
          key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
        };
      }
    }
  }

  // C. External library (e.g. org.springframework.boot, org.junit)
  const rootPkg = importSource.split(".").slice(0, 3).join(".");
  return {
    ...base,
    name: rootPkg,
    kind: "external",
    resolutionStatus: "RESOLVED_EXTERNAL",
    purpose: "Java package dependency",
    key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
  };
}

/**
 * 5. Go Resolution
 */
function resolveGoDependency(
  sourceFile: string,
  importSource: string,
  base: any,
  index: RepoFileIndex,
  repoId: string
): ResolvedFileDependency {
  // A. Local repository package: matches go.mod module path
  if (index.goModuleName && importSource.startsWith(index.goModuleName)) {
    let remainder = importSource.slice(index.goModuleName.length).replace(/^\/+/, "");
    if (!remainder) remainder = ".";

    // Find any Go file in that directory
    const candidates = index.directoryFiles.get(remainder) || [];
    const targetGoFile = candidates.find((f) => f.endsWith(".go"));

    if (targetGoFile) {
      return {
        ...base,
        targetFile: targetGoFile,
        kind: "internal",
        resolutionStatus: "RESOLVED_INTERNAL",
        key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
      };
    }

    // Try finding any file that starts with remainder + "/"
    for (const p of index.paths) {
      if (p.startsWith(remainder + "/") && p.endsWith(".go")) {
        return {
          ...base,
          targetFile: p,
          kind: "internal",
          resolutionStatus: "RESOLVED_INTERNAL",
          key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
        };
      }
    }

    return {
      ...base,
      kind: "internal",
      resolutionStatus: "UNRESOLVED",
      error: `Could not find Go package ${remainder}`,
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // B. Go standard library: no dot in the first path segment (e.g. fmt, net/http, sync)
  const firstSegment = importSource.split("/")[0];
  if (!firstSegment.includes(".")) {
    return {
      ...base,
      name: importSource,
      kind: "external",
      resolutionStatus: "RESOLVED_EXTERNAL",
      purpose: "Go standard library",
      key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
    };
  }

  // C. External Go module (e.g. github.com/gin-gonic/gin)
  return {
    ...base,
    name: importSource,
    kind: "external",
    resolutionStatus: "RESOLVED_EXTERNAL",
    purpose: "Go module dependency",
    key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
  };
}

/**
 * 6. Generic Fallback Resolution
 */
function resolveGenericDependency(
  sourceFile: string,
  importSource: string,
  base: any,
  index: RepoFileIndex,
  repoId: string
): ResolvedFileDependency {
  if (importSource.startsWith("./") || importSource.startsWith("../")) {
    const sourceDir = path.posix.dirname(sourceFile);
    const candidate = path.posix.normalize(path.posix.join(sourceDir, importSource));
    if (index.paths.has(candidate)) {
      return {
        ...base,
        targetFile: candidate,
        kind: "internal",
        resolutionStatus: "RESOLVED_INTERNAL",
        key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
      };
    }
  }

  return {
    ...base,
    kind: "external",
    resolutionStatus: "UNRESOLVED",
    key: generateDependencyKey(repoId, sourceFile, importSource, base.dependencyType),
  };
}

/**
 * Helper to match a candidate path against known index paths with extensions and index files
 */
function tryResolvePathWithExtensions(
  basePath: string,
  index: RepoFileIndex,
  extensions: string[],
  indexFiles: string[]
): string | null {
  const normalized = basePath.replace(/\\/g, "/").replace(/^\/+/, "");

  // 1. Try exact or with extensions
  for (const ext of extensions) {
    const candidate = ext ? `${normalized}${ext}` : normalized;
    if (index.paths.has(candidate)) {
      return candidate;
    }
    // Case-insensitive fallback
    const caseMatch = index.caseInsensitiveMap.get(candidate.toLowerCase());
    if (caseMatch) {
      return caseMatch;
    }
  }

  // 2. Try directory index files (e.g. normalized/index.ts)
  for (const idx of indexFiles) {
    const candidate = path.posix.join(normalized, idx);
    if (index.paths.has(candidate)) {
      return candidate;
    }
    const caseMatch = index.caseInsensitiveMap.get(candidate.toLowerCase());
    if (caseMatch) {
      return caseMatch;
    }
  }

  return null;
}

/**
 * Persists resolved file dependencies for a specific source file,
 * removing obsolete dependencies if the file imports changed,
 * and upserting newly discovered dependencies.
 */
export async function syncFileDependencies(
  prisma: any,
  repoId: string,
  sourcePath: string,
  resolvedDeps: ResolvedFileDependency[]
): Promise<number> {
  const normSource = sourcePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const currentKeys = new Set(resolvedDeps.map((d) => d.key));

  // 1. Remove dependencies for this file that are no longer present
  const existing = await prisma.dependencyRecord.findMany({
    where: {
      repoId,
      sourceFile: normSource,
      dependencyType: "import",
    },
    select: { id: true, key: true },
  });

  const obsoleteIds = existing
    .filter((d: any) => d.key && !currentKeys.has(d.key))
    .map((d: any) => d.id);

  if (obsoleteIds.length > 0) {
    await prisma.dependencyRecord.deleteMany({
      where: { id: { in: obsoleteIds } },
    });
  }

  // 2. Upsert current dependencies
  for (const dep of resolvedDeps) {
    await prisma.dependencyRecord.upsert({
      where: { key: dep.key },
      update: {
        sourceFile: dep.sourceFile,
        targetFile: dep.targetFile,
        importSource: dep.importSource,
        dependencyType: dep.dependencyType,
        kind: dep.kind,
        language: dep.language,
        resolutionStatus: dep.resolutionStatus,
        name: dep.name,
        version: dep.version,
        purpose: dep.purpose,
        status: "active",
      },
      create: {
        key: dep.key,
        repoId,
        sourceFile: dep.sourceFile,
        targetFile: dep.targetFile,
        importSource: dep.importSource,
        dependencyType: dep.dependencyType,
        kind: dep.kind,
        language: dep.language,
        resolutionStatus: dep.resolutionStatus,
        name: dep.name,
        version: dep.version,
        purpose: dep.purpose,
        status: "active",
      },
    });
  }

  return resolvedDeps.length;
}

/**
 * Persists manifest-extracted external dependencies with deduplication.
 */
export async function syncManifestDependencies(
  prisma: any,
  repoId: string,
  manifestPath: string,
  manifestDeps: Array<{ name?: string; version?: string; purpose?: string; kind: "internal" | "external" }>
): Promise<number> {
  const normManifest = manifestPath.replace(/\\/g, "/");
  let count = 0;

  for (const dep of manifestDeps) {
    if (!dep.name) continue;
    const key = generateDependencyKey(repoId, normManifest, dep.name, "manifest");
    await prisma.dependencyRecord.upsert({
      where: { key },
      update: {
        sourceFile: normManifest,
        targetFile: null,
        importSource: dep.name,
        dependencyType: "manifest",
        kind: "external",
        resolutionStatus: "RESOLVED_EXTERNAL",
        name: dep.name,
        version: dep.version || "*",
        purpose: dep.purpose || "Manifest dependency",
        status: "active",
      },
      create: {
        key,
        repoId,
        sourceFile: normManifest,
        targetFile: null,
        importSource: dep.name,
        dependencyType: "manifest",
        kind: "external",
        resolutionStatus: "RESOLVED_EXTERNAL",
        name: dep.name,
        version: dep.version || "*",
        purpose: dep.purpose || "Manifest dependency",
        status: "active",
      },
    });
    count++;
  }

  return count;
}

/**
 * Persists resolved module-level dependency edges with deduplication.
 */
export async function syncModuleEdges(
  prisma: any,
  repoId: string,
  moduleEdges: Array<{ fromModule?: string; toModule?: string }>
): Promise<number> {
  let count = 0;
  for (const edge of moduleEdges) {
    if (!edge.fromModule || !edge.toModule) continue;
    const key = generateDependencyKey(repoId, "module", `${edge.fromModule}->${edge.toModule}`, "module_edge");
    await prisma.dependencyRecord.upsert({
      where: { key },
      update: {
        fromModule: edge.fromModule,
        toModule: edge.toModule,
        kind: "internal",
        dependencyType: "module_edge",
        resolutionStatus: "RESOLVED_INTERNAL",
        status: "active",
      },
      create: {
        key,
        repoId,
        fromModule: edge.fromModule,
        toModule: edge.toModule,
        kind: "internal",
        dependencyType: "module_edge",
        resolutionStatus: "RESOLVED_INTERNAL",
        status: "active",
      },
    });
    count++;
  }
  return count;
}

/**
 * Handles cleanup when files have been deleted from the repository:
 * - Deletes dependencies originating from deleted files
 * - Invalidates dependencies pointing to deleted files (marks as UNRESOLVED)
 * - Deletes obsolete FileRecords
 */
export async function handleDeletedFiles(
  prisma: any,
  repoId: string,
  currentPaths: Set<string>
): Promise<number> {
  const existingFiles = await prisma.fileRecord.findMany({
    where: { repoId },
    select: { id: true, path: true },
  });

  const deletedPaths = existingFiles
    .map((f: any) => f.path)
    .filter((p: string) => !currentPaths.has(p));

  if (deletedPaths.length === 0) return 0;

  for (const delPath of deletedPaths) {
    // 1. Remove dependencies from this source file
    await prisma.dependencyRecord.deleteMany({
      where: { repoId, sourceFile: delPath },
    });

    // 2. Invalidate dependencies targeting this deleted file
    await prisma.dependencyRecord.updateMany({
      where: { repoId, targetFile: delPath },
      data: {
        targetFile: null,
        resolutionStatus: "UNRESOLVED",
        status: "deleted_target",
      },
    });

    // 3. Remove obsolete FileRecord
    await prisma.fileRecord.deleteMany({
      where: { repoId, path: delPath },
    });
  }

  return deletedPaths.length;
}

export interface BatchDependencyInput {
  key: string;
  repoId: string;
  sourceFile?: string | null;
  targetFile?: string | null;
  importSource?: string | null;
  dependencyType: string;
  kind: "internal" | "external";
  language?: string | null;
  resolutionStatus: string;
  name?: string | null;
  version?: string | null;
  purpose?: string | null;
  status?: string;
  fromModule?: string | null;
  toModule?: string | null;
}

/**
 * High-performance batched persistence for all repository dependencies.
 * Consolidates file imports, manifest dependencies, and module edges into
 * chunked transactions, reducing hundreds/thousands of DB round-trips to <5.
 */
export async function syncRepositoryDependenciesBatch(
  prisma: any,
  repoId: string,
  dependencies: BatchDependencyInput[]
): Promise<number> {
  if (dependencies.length === 0) {
    await prisma.dependencyRecord.deleteMany({ where: { repoId } });
    return 0;
  }

  // Deduplicate in memory by key
  const uniqueDepMap = new Map<string, BatchDependencyInput>();
  for (const dep of dependencies) {
    if (dep.key) {
      uniqueDepMap.set(dep.key, dep);
    }
  }

  // Fetch all existing dependency keys for this repository
  const existingRecords = await prisma.dependencyRecord.findMany({
    where: { repoId },
    select: { id: true, key: true },
  });

  const existingMap = new Map<string, string>(); // key -> id
  const obsoleteIds: string[] = [];

  for (const rec of existingRecords) {
    if (rec.key) {
      if (uniqueDepMap.has(rec.key)) {
        existingMap.set(rec.key, rec.id);
      } else {
        obsoleteIds.push(rec.id);
      }
    }
  }

  // Delete obsolete dependencies in batches
  if (obsoleteIds.length > 0) {
    const CHUNK_SIZE = 500;
    for (let i = 0; i < obsoleteIds.length; i += CHUNK_SIZE) {
      const slice = obsoleteIds.slice(i, i + CHUNK_SIZE);
      await prisma.dependencyRecord.deleteMany({
        where: { id: { in: slice } },
      });
    }
  }

  // Prepare batch operations
  const operations: any[] = [];
  for (const dep of uniqueDepMap.values()) {
    const existingId = existingMap.get(dep.key);
    if (existingId) {
      operations.push(
        prisma.dependencyRecord.update({
          where: { id: existingId },
          data: {
            sourceFile: dep.sourceFile,
            targetFile: dep.targetFile,
            importSource: dep.importSource,
            dependencyType: dep.dependencyType,
            kind: dep.kind,
            language: dep.language,
            resolutionStatus: dep.resolutionStatus,
            name: dep.name,
            version: dep.version,
            purpose: dep.purpose,
            status: dep.status || "active",
            fromModule: dep.fromModule,
            toModule: dep.toModule,
          },
        })
      );
    } else {
      operations.push(
        prisma.dependencyRecord.create({
          data: {
            key: dep.key,
            repoId,
            sourceFile: dep.sourceFile,
            targetFile: dep.targetFile,
            importSource: dep.importSource,
            dependencyType: dep.dependencyType,
            kind: dep.kind,
            language: dep.language,
            resolutionStatus: dep.resolutionStatus,
            name: dep.name,
            version: dep.version,
            purpose: dep.purpose,
            status: dep.status || "active",
            fromModule: dep.fromModule,
            toModule: dep.toModule,
          },
        })
      );
    }
  }

  // Execute in transactions of 80 operations to prevent SQLite statement limit issues
  const TX_CHUNK_SIZE = 80;
  for (let i = 0; i < operations.length; i += TX_CHUNK_SIZE) {
    const batch = operations.slice(i, i + TX_CHUNK_SIZE);
    await prisma.$transaction(batch);
  }

  return uniqueDepMap.size;
}
