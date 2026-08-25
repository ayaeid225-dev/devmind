import "server-only";
import type { EvidenceResultItem } from "../rag/search";

export function buildSystemPrompt(): string {
  return `You are DevMind, an expert engineering intelligence AI assistant.
Your goal is to answer technical questions about software codebases based ONLY on the provided code evidence.

RULES:
1. Answer the user's question using ONLY the provided repository evidence code chunks.
2. Every technical claim, function reference, or architectural explanation MUST cite a valid evidence item using its exact file path and line numbers.
3. Do NOT invent unsupported facts, files, line numbers, or external dependencies.
4. Do NOT pretend to have executed code or modified files.
5. If the provided evidence is insufficient or irrelevant to answer the question, clearly state that evidence is insufficient.
6. Be concise, technical, and precise.`;
}

export function buildUserPrompt(question: string, evidence: EvidenceResultItem[]): string {
  if (evidence.length === 0) {
    return `User Question: ${question}\n\nNo repository code evidence was found for this query. State that evidence is insufficient.`;
  }

  const evidenceFormatted = evidence
    .map(
      (item, idx) =>
        `--- EVIDENCE ITEM #${idx + 1} ---
File: ${item.path}
Lines: ${item.startLine}-${item.endLine}
Language: ${item.language}
Relevance Score: ${item.score}
Code Content:
\`\`\`${item.language.toLowerCase()}
${item.content}
\`\`\``
    )
    .join("\n\n");

  return `User Question: ${question}

REPOSITORY EVIDENCE CHUNKS:
${evidenceFormatted}

Instructions: Answer the question using the evidence above. Include citations for the code files referenced.`;
}
