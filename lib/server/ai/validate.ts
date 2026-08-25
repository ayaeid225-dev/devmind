import "server-only";
import type { EvidenceResultItem } from "../rag/search";

export interface EvidenceCitation {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  relevance?: number;
}

export function validateCitations(
  citations: EvidenceCitation[],
  evidence: EvidenceResultItem[]
): EvidenceCitation[] {
  const validCitations: EvidenceCitation[] = [];
  const evidencePathMap = new Map<string, EvidenceResultItem>();

  for (const item of evidence) {
    evidencePathMap.set(item.path.toLowerCase(), item);
  }

  for (const citation of citations) {
    const matchedEvidence = evidencePathMap.get(citation.path.toLowerCase());

    if (matchedEvidence) {
      // Validate that line numbers are realistic
      const validStart = Math.max(1, citation.startLine || matchedEvidence.startLine);
      const validEnd = Math.max(validStart, citation.endLine || matchedEvidence.endLine);

      validCitations.push({
        id: citation.id || `ev-${validCitations.length + 1}`,
        path: matchedEvidence.path, // Use exact canonical path
        startLine: validStart,
        endLine: validEnd,
        snippet: citation.snippet || matchedEvidence.content.slice(0, 150),
        relevance: matchedEvidence.score,
      });
    }
  }

  return validCitations;
}
