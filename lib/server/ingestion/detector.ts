export type LanguageCategory = "code" | "doc" | "config" | "markup" | "other";

export interface LanguageInfo {
  id: string; // Internal identifier e.g., "typescript", "python", "go", "unknown"
  name: string; // Display name e.g., "TypeScript", "Python", "Go", "Unknown"
  isSupportedForParsing: boolean; // Whether DevMind currently has an active parser for this language
  category: LanguageCategory;
  extension: string;
}

const EXTENSION_MAP: Record<string, { id: string; name: string; category: LanguageCategory; parseSupported?: boolean }> = {
  // Supported for parsing in DevMind Milestone 1
  ts: { id: "typescript", name: "TypeScript", category: "code", parseSupported: true },
  tsx: { id: "typescript", name: "TypeScript", category: "code", parseSupported: true },
  js: { id: "javascript", name: "JavaScript", category: "code", parseSupported: true },
  jsx: { id: "javascript", name: "JavaScript", category: "code", parseSupported: true },
  mjs: { id: "javascript", name: "JavaScript", category: "code", parseSupported: true },
  cjs: { id: "javascript", name: "JavaScript", category: "code", parseSupported: true },
  py: { id: "python", name: "Python", category: "code", parseSupported: true },
  pyw: { id: "python", name: "Python", category: "code", parseSupported: true },
  dart: { id: "dart", name: "Dart", category: "code", parseSupported: true },

  // Recognized languages (unsupported for deep AST parsing in current milestone)
  java: { id: "java", name: "Java", category: "code", parseSupported: true },
  c: { id: "c", name: "C", category: "code" },
  h: { id: "c", name: "C", category: "code" },
  cpp: { id: "cpp", name: "C++", category: "code" },
  hpp: { id: "cpp", name: "C++", category: "code" },
  cc: { id: "cpp", name: "C++", category: "code" },
  cxx: { id: "cpp", name: "C++", category: "code" },
  hh: { id: "cpp", name: "C++", category: "code" },
  cs: { id: "csharp", name: "C#", category: "code" },
  go: { id: "go", name: "Go", category: "code", parseSupported: true },
  rs: { id: "rust", name: "Rust", category: "code" },
  php: { id: "php", name: "PHP", category: "code" },
  rb: { id: "ruby", name: "Ruby", category: "code" },
  kt: { id: "kotlin", name: "Kotlin", category: "code" },
  kts: { id: "kotlin", name: "Kotlin", category: "code" },
  swift: { id: "swift", name: "Swift", category: "code" },

  // Common Markup, Data & Config
  json: { id: "json", name: "JSON", category: "config" },
  yaml: { id: "yaml", name: "YAML", category: "config" },
  yml: { id: "yaml", name: "YAML", category: "config" },
  md: { id: "markdown", name: "Markdown", category: "doc" },
  mdx: { id: "markdown", name: "Markdown", category: "doc" },
  html: { id: "html", name: "HTML", category: "markup" },
  htm: { id: "html", name: "HTML", category: "markup" },
  css: { id: "css", name: "CSS", category: "markup" },
  scss: { id: "css", name: "CSS", category: "markup" },
  sql: { id: "sql", name: "SQL", category: "code" },
};

export const UNKNOWN_LANGUAGE_INFO: LanguageInfo = {
  id: "unknown",
  name: "Unknown",
  isSupportedForParsing: false,
  category: "other",
  extension: "",
};

export function detectLanguage(filePath: string): LanguageInfo {
  if (!filePath || typeof filePath !== "string") {
    return UNKNOWN_LANGUAGE_INFO;
  }

  const cleanPath = filePath.trim();
  const parts = cleanPath.split("/");
  const fileName = parts[parts.length - 1] || cleanPath;

  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === 0 || dotIndex === fileName.length - 1) {
    return {
      ...UNKNOWN_LANGUAGE_INFO,
      name: "Plain Text / Configuration",
    };
  }

  const ext = fileName.substring(dotIndex + 1).toLowerCase();
  const matched = EXTENSION_MAP[ext];

  if (!matched) {
    return {
      id: "unknown",
      name: `Unknown (.${ext})`,
      isSupportedForParsing: false,
      category: "other",
      extension: ext,
    };
  }

  return {
    id: matched.id,
    name: matched.name,
    isSupportedForParsing: Boolean(matched.parseSupported),
    category: matched.category,
    extension: ext,
  };
}
