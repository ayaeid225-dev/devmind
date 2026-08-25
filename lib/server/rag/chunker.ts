import "server-only";
import crypto from "crypto";

export interface CodeChunkInput {
  repoId: string;
  fileId: string;
  moduleId?: string | null;
  path: string;
  content: string;
  chunkSize?: number;
  overlap?: number;
}

export interface GeneratedChunk {
  repoId: string;
  fileId: string;
  moduleId?: string | null;
  path: string;
  language: string;
  content: string;
  startLine: number;
  endLine: number;
  chunkIndex: number;
  contentHash: string;
}

export function chunkFileContent({
  repoId,
  fileId,
  moduleId,
  path,
  content,
  chunkSize = 30,
  overlap = 5,
}: CodeChunkInput): GeneratedChunk[] {
  const lines = content.split("\n");
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const language = getLanguageFromExtension(ext);
  const chunks: GeneratedChunk[] = [];

  if (lines.length === 0 || content.trim().length === 0) {
    return chunks;
  }

  let start = 0;
  let chunkIndex = 0;

  while (start < lines.length) {
    const end = Math.min(start + chunkSize, lines.length);
    const chunkLines = lines.slice(start, end);
    const chunkContent = chunkLines.join("\n");

    const contentHash = crypto.createHash("sha256").update(chunkContent).digest("hex");

    chunks.push({
      repoId,
      fileId,
      moduleId,
      path,
      language,
      content: chunkContent,
      startLine: start + 1, // 1-indexed
      endLine: end,
      chunkIndex,
      contentHash,
    });

    chunkIndex++;
    if (end >= lines.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

function getLanguageFromExtension(ext: string): string {
  switch (ext) {
    case "ts":
    case "tsx":
      return "TypeScript";
    case "js":
    case "jsx":
      return "JavaScript";
    case "py":
      return "Python";
    case "dart":
      return "Dart";
    case "go":
      return "Go";
    case "rs":
      return "Rust";
    case "java":
      return "Java";
    case "json":
      return "JSON";
    case "yaml":
    case "yml":
      return "YAML";
    case "md":
      return "Markdown";
    case "css":
      return "CSS";
    case "html":
      return "HTML";
    case "sql":
      return "SQL";
    default:
      return "Text";
  }
}
