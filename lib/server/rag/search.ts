import "server-only";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { getEmbeddingProvider } from "./provider";

export interface EvidenceSearchQueryParams {
  repoId: string;
  query: string;
  limit?: number;
  userId?: string;
}

export interface EvidenceResultItem {
  id?: string;
  score: number;
  repoId: string;
  fileId: string;
  path: string;
  startLine: number;
  endLine: number;
  language: string;
  content: string;
  moduleId: string | null;
}

export interface SearchRepositoryParams {
  repoId: string;
  query: string;
  limit?: number;
  type?: "all" | "file" | "chunk" | "module" | "doc" | "symbol";
  userId?: string;
}

export interface SearchResultItem {
  id: string;
  type: "file" | "chunk" | "module" | "doc" | "symbol";
  title: string;
  path: string;
  snippet?: string;
  startLine?: number;
  endLine?: number;
  language?: string;
  moduleId?: string | null;
  moduleName?: string;
  score: number;
  url: string;
  icon: "file" | "code" | "modules" | "fileText" | "spark";
  cat: string;
}

export interface GeneralSearchResult {
  indexed: boolean;
  repoId: string;
  repoName: string;
  query: string;
  results: SearchResultItem[];
  message?: string;
}

/**
 * Checks whether a given file path points to a sensitive configuration,
 * secret, token, key, or environment file that should NEVER be exposed in search.
 */
export function isSensitiveFile(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.toLowerCase().replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() || "";

  // Environment variable files (.env, .env.local, .env.production, etc.)
  if (fileName === ".env" || fileName.startsWith(".env.")) return true;

  // Private keys and certificates
  if (
    fileName.endsWith(".pem") ||
    fileName.endsWith(".key") ||
    fileName.endsWith(".pfx") ||
    fileName.endsWith(".p12") ||
    fileName.endsWith(".pkcs12") ||
    fileName.endsWith(".crt") ||
    fileName.endsWith(".der")
  ) {
    return true;
  }

  // SSH keys
  if (
    fileName.includes("id_rsa") ||
    fileName.includes("id_ed25519") ||
    fileName.includes("id_ecdsa") ||
    fileName.includes("id_dsa")
  ) {
    return true;
  }

  // Common credential files
  if (
    fileName === "credentials.json" ||
    fileName === "service-account.json" ||
    fileName === "secrets.json" ||
    fileName === "secret.json"
  ) {
    return true;
  }

  if (
    fileName.includes("secret") &&
    (fileName.endsWith(".yaml") || fileName.endsWith(".yml") || fileName.endsWith(".json"))
  ) {
    return true;
  }

  return false;
}

/**
 * Redacts any accidental high-entropy tokens or credentials from snippet text.
 */
export function sanitizeSnippet(content: string): string {
  if (!content) return "";
  return content
    .replace(/(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/(sk-[a-zA-Z0-9]{48}|sk-proj-[a-zA-Z0-9_-]{48,})/g, "[REDACTED_API_KEY]")
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/password\s*[:=]\s*["'][^"']+["']/gi, 'password: "[REDACTED]"')
    .replace(/client_secret\s*[:=]\s*["'][^"']+["']/gi, 'client_secret: "[REDACTED]"');
}

/**
 * Validates that the requested repository exists and that the user is authorized to access it.
 */
export async function verifyRepositoryAccess(repoIdOrName: string, userId?: string) {
  const repo = await db.repository.findFirst({
    where: {
      OR: [
        { id: repoIdOrName },
        { name: repoIdOrName },
      ],
    },
    include: {
      project: {
        include: {
          org: {
            include: {
              members: true,
            },
          },
        },
      },
    },
  });

  if (!repo) {
    return { authorized: false, notFound: true, forbidden: false, repo: null };
  }

  if (userId) {
    const orgMembers = repo.project?.org?.members || [];
    if (orgMembers.length > 0) {
      const isMember = orgMembers.some((m) => m.userId === userId);
      if (!isMember) {
        return { authorized: false, notFound: false, forbidden: true, repo };
      }
    }
  }

  return { authorized: true, notFound: false, forbidden: false, repo };
}

/**
 * Calculates the cosine similarity between two float vectors.
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export const COMMON_ALIASES: Record<string, string[]> = {
  auth: ["authentication", "authenticate", "authorize", "authorization"],
  authentication: ["auth"],
  doc: ["docs", "documentation"],
  docs: ["doc", "documentation"],
  documentation: ["doc", "docs"],
  dep: ["deps", "dependencies", "dependency"],
  deps: ["dep", "dependencies", "dependency"],
  config: ["configuration", "configure", "configs"],
  repo: ["repository", "repositories"],
  msg: ["message", "messages"],
  db: ["database", "databases"],
  database: ["db"],
};

export function getSearchTerms(kw: string): string[] {
  const clean = (kw || "").toLowerCase().trim();
  const terms = [clean];
  const aliases = COMMON_ALIASES[clean];
  if (aliases) {
    terms.push(...aliases);
  }
  return terms;
}

/**
 * Search code evidence chunks for the AI Assistant (preserved for backwards-compatibility).
 */
export async function searchEvidence({
  repoId,
  query,
  limit = 5,
  userId,
}: EvidenceSearchQueryParams): Promise<EvidenceResultItem[]> {
  const currentUserId = userId || (await getCurrentUser())?.id;
  if (!currentUserId) {
    throw new Error("Unauthenticated: User must be signed in to search code evidence");
  }

  // Resolve repository by ID or Name
  const { authorized, notFound, forbidden, repo } = await verifyRepositoryAccess(repoId, currentUserId);
  if (notFound || !repo) {
    throw new Error(`Repository "${repoId}" not found`);
  }
  if (forbidden) {
    throw new Error(`Unauthorized: User cannot access repository "${repoId}"`);
  }

  // Get stored chunks for this repository
  const chunks = await db.documentChunk.findMany({
    where: { repoId: repo.id },
  });

  // Filter out any sensitive files
  const safeChunks = chunks.filter((c) => !isSensitiveFile(c.path));
  if (safeChunks.length === 0) {
    return [];
  }

  const STOP_WORDS = new Set([
    "the", "what", "where", "when", "which", "how", "why", "who", "whom",
    "this", "that", "these", "those", "from", "with", "about", "into",
    "through", "during", "before", "after", "above", "below", "to", "in",
    "on", "at", "by", "for", "of", "and", "or", "not", "is", "are", "was",
    "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "can", "could", "will", "would", "shall", "should", "may", "might", "must",
    "env",
  ]);

  const provider = getEmbeddingProvider();
  const queryVector = await provider.embedText(query);
  const queryLower = query.toLowerCase();
  const queryKeywords = queryLower
    .split(/\W+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const scoredResults: EvidenceResultItem[] = [];

  for (const chunk of safeChunks) {
    let similarityScore = 0;

    if (chunk.embeddingJson) {
      try {
        const chunkVector: number[] = JSON.parse(chunk.embeddingJson);
        similarityScore = calculateCosineSimilarity(queryVector, chunkVector);
      } catch {
        similarityScore = 0;
      }
    }

    // Hybrid keyword & path boost with prefix stemming (e.g. auth <-> authentication)
    let keywordBoost = 0;
    const contentLower = chunk.content.toLowerCase();
    const pathLower = chunk.path.toLowerCase();

    for (const kw of queryKeywords) {
      const terms = getSearchTerms(kw);
      if (terms.some((t) => pathLower.includes(t))) {
        keywordBoost += 0.25;
      }
      if (terms.some((t) => contentLower.includes(t))) {
        keywordBoost += 0.20;
      }
    }

    const nonNegativeSim = Math.max(0, similarityScore);
    const finalScore = Math.min(1.0, nonNegativeSim + keywordBoost);

    // Only include results that have actual relevance (keyword match or high semantic similarity)
    if (keywordBoost > 0 || finalScore >= 0.65) {
      scoredResults.push({
        id: chunk.id,
        score: parseFloat(finalScore.toFixed(4)),
        repoId: chunk.repoId,
        fileId: chunk.fileId,
        path: chunk.path,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        language: chunk.language,
        content: sanitizeSnippet(chunk.content),
        moduleId: chunk.moduleId,
      });
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults.slice(0, limit);
}

/**
 * P8: Real Semantic General Search
 * Hybrid search over repository-scoped data:
 * - Semantic vector similarity on DocumentChunks
 * - Exact and substring matching on FileRecords
 * - AST symbol matching (classes, functions, methods)
 * - Module matching
 * - DocumentRecord matching
 */
export async function searchRepository({
  repoId,
  query,
  limit = 20,
  type = "all",
  userId,
}: SearchRepositoryParams): Promise<GeneralSearchResult> {
  const currentUserId = userId || (await getCurrentUser())?.id;
  if (!currentUserId) {
    throw new Error("Unauthenticated: User must be signed in to perform general search");
  }

  const { authorized, notFound, forbidden, repo } = await verifyRepositoryAccess(repoId, currentUserId);
  if (notFound || !repo) {
    throw new Error(`Repository "${repoId}" not found`);
  }
  if (forbidden) {
    throw new Error(`Unauthorized: You do not have access to repository "${repoId}"`);
  }

  // 1. Check whether repository has indexed data
  const [filesCount, chunksCount] = await Promise.all([
    db.fileRecord.count({ where: { repoId: repo.id } }),
    db.documentChunk.count({ where: { repoId: repo.id } }),
  ]);

  if (filesCount === 0 && chunksCount === 0) {
    return {
      indexed: false,
      repoId: repo.id,
      repoName: repo.name,
      query,
      results: [],
      message: "This repository has not been indexed yet. Sync the repository before searching.",
    };
  }

  const cleanQuery = (query || "").trim();
  if (cleanQuery.length === 0) {
    return {
      indexed: true,
      repoId: repo.id,
      repoName: repo.name,
      query,
      results: [],
    };
  }

  const cleanQueryLower = cleanQuery.toLowerCase();
  const queryKeywords = cleanQueryLower.split(/[\s,./\\_-]+/).filter((w) => w.length >= 2);

  const results: SearchResultItem[] = [];

  // 2. Exact & Keyword FileRecord Search
  const includeFiles = type === "all" || type === "file";
  const fileRecords = await db.fileRecord.findMany({
    where: { repoId: repo.id },
    include: {
      module: {
        select: { id: true, name: true },
      },
    },
  });

  const safeFileRecords = fileRecords.filter((f) => !isSensitiveFile(f.path));
  const fileMapById = new Map(safeFileRecords.map((f) => [f.id, f]));

  if (includeFiles) {
    for (const f of safeFileRecords) {
      const fileName = f.path.split("/").pop() || f.path;
      const fileNameLower = fileName.toLowerCase();
      const pathLower = f.path.toLowerCase();

      let fileScore = 0;

      // Exact match on full path or filename
      if (pathLower === cleanQueryLower || fileNameLower === cleanQueryLower) {
        fileScore = 0.99;
      } else if (f.path.endsWith("/" + cleanQueryLower)) {
        fileScore = 0.95;
      } else if (fileNameLower.includes(cleanQueryLower)) {
        fileScore = 0.88;
      } else if (pathLower.includes(cleanQueryLower)) {
        fileScore = 0.78;
      } else {
        // Keyword match across path segments
        const matchedKw = queryKeywords.filter((kw) => pathLower.includes(kw));
        if (matchedKw.length > 0) {
          fileScore = 0.5 + 0.1 * Math.min(matchedKw.length, 3);
        }
      }

      if (fileScore >= 0.5) {
        results.push({
          id: `file:${f.id}`,
          type: "file",
          title: fileName,
          path: f.path,
          snippet: f.module?.name
            ? `Module: ${f.module.name} • ${f.language || f.type} file (${f.lineCount || 0} lines)`
            : `${f.language || f.type} source file (${f.lineCount || 0} lines)`,
          moduleId: f.moduleId,
          moduleName: f.module?.name,
          score: parseFloat(fileScore.toFixed(4)),
          url: `/app/evidence/${f.id}?repoId=${encodeURIComponent(repo.id)}`,
          icon: "file",
          cat: "File",
        });
      }

      // Check AST symbols inside file
      if (f.symbolsJson) {
        try {
          const symbols = JSON.parse(f.symbolsJson);
          if (Array.isArray(symbols)) {
            for (const sym of symbols) {
              if (!sym.name) continue;
              const symNameLower = sym.name.toLowerCase();
              let symScore = 0;

              if (symNameLower === cleanQueryLower) {
                symScore = 0.96;
              } else if (symNameLower.includes(cleanQueryLower)) {
                symScore = 0.82;
              }

              if (symScore > 0.6) {
                results.push({
                  id: `symbol:${f.id}:${sym.name}`,
                  type: "symbol",
                  title: `${sym.name}`,
                  path: f.path,
                  snippet: `${sym.kind || "symbol"} ${sym.name} in ${f.path}${sym.line ? ` (line ${sym.line})` : ""}`,
                  startLine: sym.line,
                  moduleId: f.moduleId,
                  moduleName: f.module?.name,
                  score: parseFloat(symScore.toFixed(4)),
                  url: `/app/evidence/${f.id}?repoId=${encodeURIComponent(repo.id)}${sym.line ? `&line=${sym.line}` : ""}`,
                  icon: "spark",
                  cat: "Symbol",
                });
              }
            }
          }
        } catch {
          // ignore corrupted symbols json
        }
      }
    }
  }

  // 3. Semantic Vector Search on DocumentChunks
  const includeChunks = type === "all" || type === "chunk";
  if (includeChunks) {
    const chunks = await db.documentChunk.findMany({
      where: { repoId: repo.id },
    });

    const safeChunks = chunks.filter((c) => !isSensitiveFile(c.path));

    if (safeChunks.length > 0) {
      const provider = getEmbeddingProvider();
      const queryVector = await provider.embedText(cleanQuery);

      // Best chunk per file to ensure result diversity
      const bestChunkByFile = new Map<string, { chunk: typeof safeChunks[0]; score: number }>();

      for (const chunk of safeChunks) {
        let similarityScore = 0;

        if (chunk.embeddingJson) {
          try {
            const chunkVector: number[] = JSON.parse(chunk.embeddingJson);
            similarityScore = calculateCosineSimilarity(queryVector, chunkVector);
          } catch {
            similarityScore = 0;
          }
        }

        // Hybrid keyword matching
        let keywordBoost = 0;
        const pathLower = chunk.path.toLowerCase();
        const contentLower = chunk.content.toLowerCase();
        const fileName = chunk.path.split("/").pop()?.toLowerCase() || "";

        if (fileName === cleanQueryLower || pathLower === cleanQueryLower) {
          keywordBoost += 0.45;
        } else if (pathLower.includes(cleanQueryLower)) {
          keywordBoost += 0.25;
        }

        if (contentLower.includes(cleanQueryLower)) {
          keywordBoost += 0.35;
        } else {
          for (const kw of queryKeywords) {
            if (pathLower.includes(kw)) keywordBoost += 0.12;
            if (contentLower.includes(kw)) keywordBoost += 0.08;
          }
        }

        const nonNegativeSim = Math.max(0, similarityScore);
        const totalScore = Math.min(1.0, nonNegativeSim + keywordBoost);

        // Retain chunks with meaningful similarity or keyword matches
        if (totalScore >= 0.15 || keywordBoost >= 0.15) {
          const existing = bestChunkByFile.get(chunk.path);
          if (!existing || existing.score < totalScore) {
            bestChunkByFile.set(chunk.path, { chunk, score: Math.max(totalScore, 0.3) });
          }
        }
      }

      for (const { chunk, score } of bestChunkByFile.values()) {
        const fileRec = fileMapById.get(chunk.fileId);
        const fileName = chunk.path.split("/").pop() || chunk.path;

        // Extract a clean preview snippet
        const lines = chunk.content.split("\n").filter((l) => l.trim().length > 0);
        const snippetLines = lines.slice(0, 3).map((l) => l.trim()).join(" ");
        const snippet = sanitizeSnippet(
          `Lines ${chunk.startLine}–${chunk.endLine}: ${snippetLines.slice(0, 140)}${snippetLines.length > 140 ? "…" : ""}`
        );

        results.push({
          id: `chunk:${chunk.id}`,
          type: "chunk",
          title: fileName,
          path: chunk.path,
          snippet,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          language: chunk.language,
          moduleId: chunk.moduleId,
          moduleName: fileRec?.module?.name,
          score: parseFloat(score.toFixed(4)),
          url: `/app/evidence/${chunk.fileId}?repoId=${encodeURIComponent(repo.id)}&line=${chunk.startLine}`,
          icon: "code",
          cat: "Code",
        });
      }
    }
  }

  // 4. Module Search
  const includeModules = type === "all" || type === "module";
  if (includeModules) {
    const modules = await db.module.findMany({
      where: { repoId: repo.id },
    });

    for (const m of modules) {
      const nameLower = m.name.toLowerCase();
      const descLower = (m.desc || "").toLowerCase();

      let modScore = 0;
      if (nameLower === cleanQueryLower) {
        modScore = 0.98;
      } else if (nameLower.includes(cleanQueryLower)) {
        modScore = 0.85;
      } else if (descLower.includes(cleanQueryLower)) {
        modScore = 0.72;
      } else {
        const matchedKw = queryKeywords.filter((kw) => nameLower.includes(kw) || descLower.includes(kw));
        if (matchedKw.length > 0) {
          modScore = 0.5 + 0.08 * matchedKw.length;
        }
      }

      if (modScore >= 0.5) {
        results.push({
          id: `module:${m.id}`,
          type: "module",
          title: m.name,
          path: `${m.type} module`,
          snippet: m.desc || `Architecture module with ${m.filesCount} indexed files`,
          moduleId: m.id,
          moduleName: m.name,
          score: parseFloat(modScore.toFixed(4)),
          url: `/app/modules/${m.id}?repoId=${encodeURIComponent(repo.id)}`,
          icon: "modules",
          cat: "Module",
        });
      }
    }
  }

  // 5. Documentation Search
  const includeDocs = type === "all" || type === "doc";
  if (includeDocs) {
    const docs = await db.documentRecord.findMany({
      where: { repoId: repo.id },
    });

    for (const d of docs) {
      const titleLower = d.title.toLowerCase();
      const summaryLower = (d.summary || "").toLowerCase();

      let docScore = 0;
      if (titleLower === cleanQueryLower) {
        docScore = 0.95;
      } else if (titleLower.includes(cleanQueryLower)) {
        docScore = 0.82;
      } else if (summaryLower.includes(cleanQueryLower)) {
        docScore = 0.7;
      } else {
        const matchedKw = queryKeywords.filter((kw) => titleLower.includes(kw) || summaryLower.includes(kw));
        if (matchedKw.length > 0) {
          docScore = 0.45 + 0.08 * matchedKw.length;
        }
      }

      if (docScore >= 0.45) {
        results.push({
          id: `doc:${d.id}`,
          type: "doc",
          title: d.title,
          path: `${d.category} documentation`,
          snippet: d.summary || `Authored by ${d.author} • Status: ${d.status}`,
          score: parseFloat(docScore.toFixed(4)),
          url: `/app/docs/${d.id}?repoId=${encodeURIComponent(repo.id)}`,
          icon: "fileText",
          cat: "Doc",
        });
      }
    }
  }

  // 6. Deduplicate & Rank
  const uniqueResults = new Map<string, SearchResultItem>();
  for (const item of results) {
    const existing = uniqueResults.get(item.id);
    if (!existing || existing.score < item.score) {
      uniqueResults.set(item.id, item);
    }
  }

  const sortedResults = Array.from(uniqueResults.values()).sort((a, b) => b.score - a.score);

  return {
    indexed: true,
    repoId: repo.id,
    repoName: repo.name,
    query: cleanQuery,
    results: sortedResults.slice(0, limit),
  };
}
