import "server-only";

export interface StaticAnalysisResult {
  lineCount: number;
  imports: string[];
  exports: string[];
  functionsCount: number;
  language: string;
}

export function analyzeSourceCode(path: string, content: string): StaticAnalysisResult {
  const lines = content.split("\n");
  const lineCount = lines.length;
  const ext = path.split(".").pop()?.toLowerCase() || "";

  const imports: string[] = [];
  const exports: string[] = [];
  let functionsCount = 0;
  let language = "Text";

  if (["ts", "tsx", "js", "jsx"].includes(ext)) {
    language = ext.startsWith("ts") ? "TypeScript" : "JavaScript";

    // Static ES import regex: import ... from "module" or import "module"
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const imp = match[1] || match[2] || match[3];
      if (imp && !imports.includes(imp)) {
        imports.push(imp);
      }
    }

    // Static export regex: export const/function/class/default
    const exportRegex = /export\s+(?:default\s+)?(?:const|function|class|type|interface|enum|let|var)\s+([a-zA-Z0-9_$]+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      if (match[1] && !exports.includes(match[1])) {
        exports.push(match[1]);
      }
    }

    // Function count
    const funcRegex = /function\s+[a-zA-Z0-9_$]+|\([^)]*\)\s*=>|async\s+function/g;
    functionsCount = (content.match(funcRegex) || []).length;
  } else if (ext === "py") {
    language = "Python";
    const pyImportRegex = /(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))/g;
    let match;
    while ((match = pyImportRegex.exec(content)) !== null) {
      const imp = match[1] || match[2];
      if (imp && !imports.includes(imp)) {
        imports.push(imp);
      }
    }
    functionsCount = (content.match(/def\s+[a-zA-Z0-9_]+/g) || []).length;
  } else if (ext === "dart") {
    language = "Dart";
    const dartImportRegex = /import\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = dartImportRegex.exec(content)) !== null) {
      if (match[1] && !imports.includes(match[1])) {
        imports.push(match[1]);
      }
    }
  } else if (ext === "go") {
    language = "Go";
    const goImportRegex = /import\s+\(\s*([\s\S]*?)\s*\)|import\s+["']([^"']+)["']/g;
    let match;
    while ((match = goImportRegex.exec(content)) !== null) {
      const imp = match[2];
      if (imp && !imports.includes(imp)) {
        imports.push(imp);
      }
    }
  } else if (ext === "rs") {
    language = "Rust";
    const rustUseRegex = /use\s+([a-zA-Z0-9_:]+)/g;
    let match;
    while ((match = rustUseRegex.exec(content)) !== null) {
      if (match[1] && !imports.includes(match[1])) {
        imports.push(match[1]);
      }
    }
  } else if (ext === "json") {
    language = "JSON";
  } else if (ext === "yaml" || ext === "yml") {
    language = "YAML";
  } else if (ext === "md") {
    language = "Markdown";
  } else if (ext === "css") {
    language = "CSS";
  } else if (ext === "html") {
    language = "HTML";
  } else if (ext === "sql") {
    language = "SQL";
  }

  return {
    lineCount,
    imports,
    exports,
    functionsCount,
    language,
  };
}
