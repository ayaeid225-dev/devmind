import "server-only";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { getEmbeddingProvider } from "./provider";

export interface EvidenceSearchQueryParams {
  repoId: string;
  query: string;
  limit?: number;
}

export interface EvidenceResultItem {
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

export async function searchEvidence({
  repoId,
  query,
  limit = 5,
}: EvidenceSearchQueryParams): Promise<EvidenceResultItem[]> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthenticated: User must be signed in to search code evidence");
  }

  // Verify Repository access / existence
  const repo = await db.repository.findFirst({
    where: { id: repoId },
  });

  if (!repo) {
    throw new Error(`Repository "${repoId}" not found or unauthorized`);
  }

  // Get stored chunks
  const chunks = await db.documentChunk.findMany({
    where: { repoId },
  });

  if (chunks.length === 0) {
    return [];
  }

  const provider = getEmbeddingProvider();
  const queryVector = await provider.embedText(query);
  const queryLower = query.toLowerCase();
  const queryKeywords = queryLower.split(/\W+/).filter((w) => w.length > 2);

  const scoredResults: EvidenceResultItem[] = [];

  for (const chunk of chunks) {
    let similarityScore = 0;

    if (chunk.embeddingJson) {
      try {
        const chunkVector: number[] = JSON.parse(chunk.embeddingJson);
        similarityScore = calculateCosineSimilarity(queryVector, chunkVector);
      } catch {
        similarityScore = 0;
      }
    }

    // Hybrid keyword & path boost
    let keywordBoost = 0;
    const contentLower = chunk.content.toLowerCase();
    const pathLower = chunk.path.toLowerCase();

    for (const kw of queryKeywords) {
      if (pathLower.includes(kw)) {
        keywordBoost += 0.25;
      }
      if (contentLower.includes(kw)) {
        keywordBoost += 0.1;
      }
    }

    const finalScore = Math.min(1.0, similarityScore + keywordBoost);

    scoredResults.push({
      score: parseFloat(finalScore.toFixed(4)),
      repoId: chunk.repoId,
      fileId: chunk.fileId,
      path: chunk.path,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      language: chunk.language,
      content: chunk.content,
      moduleId: chunk.moduleId,
    });
  }

  // Sort by score descending
  scoredResults.sort((a, b) => b.score - a.score);

  // Return top N diverse evidence items
  return scoredResults.slice(0, limit);
}

function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

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
