import "server-only";
import type { EvidenceResultItem } from "../rag/search";
import { buildSystemPrompt, buildUserPrompt, type GenerateAnswerInput } from "./prompt";
import { validateCitations, type EvidenceCitation } from "./validate";
import { GeminiLLMProvider } from "./gemini";

export type { GenerateAnswerInput };

export interface AIAnswerResponse {
  answer: string;
  confidence: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  evidenceState: "VERIFIED" | "PARTIAL" | "NOT_FOUND";
  citations: EvidenceCitation[];
  relatedFiles: string[];
  insufficientEvidence: boolean;
  intent?: string;
  impactAnalysis?: {
    directlyAffected: string[];
    potentiallyAffected: string[];
    affectedModules: string[];
    affectedRoutes: string[];
    affectedComponents: string[];
    reason?: string;
    validation?: string[];
  };
  gitHistory?: Array<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
    changeType?: string;
  }>;
}

export interface LLMProvider {
  name: string;
  generateAnswer(input: GenerateAnswerInput): Promise<AIAnswerResponse>;
}

export class OpenAILLMProvider implements LLMProvider {
  name = "OpenAI Chat Completions";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateAnswer(input: GenerateAnswerInput): Promise<AIAnswerResponse> {
    const { question, evidence } = input;
    const isNotFound = input.evidenceState === "NOT_FOUND" || (evidence.length === 0 && !input.dependencies?.length && !input.commits?.length && !input.modules?.length);

    if (isNotFound) {
      return {
        answer: `### Answer\n\nI couldn't verify this from the indexed repository data. No matching files, functions, or dependencies were found for "${question}".\n\n### Evidence\n\nNo matching code chunks found.\n\n### Confidence\n\nNot Found — Insufficient repository evidence.`,
        confidence: 0,
        confidenceLevel: "LOW",
        evidenceState: "NOT_FOUND",
        citations: [],
        relatedFiles: [],
        insufficientEvidence: true,
        intent: input.intent,
      };
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(input);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.statusText}`);
    }

    const data = await res.json();
    const rawAnswer: string = data.choices[0]?.message?.content || "";

    const unvalidatedCitations: EvidenceCitation[] = evidence.map((item, idx) => ({
      id: item.id || item.fileId || `ev-${idx + 1}`,
      path: item.path,
      startLine: item.startLine,
      endLine: item.endLine,
      snippet: item.content.slice(0, 150),
      relevance: item.score,
    }));

    const citations = validateCitations(unvalidatedCitations, evidence);
    const relatedFiles = Array.from(new Set(citations.map((c) => c.path)));
    const avgScore = evidence.length > 0 ? evidence.reduce((sum, item) => sum + item.score, 0) / evidence.length : 0.5;

    const evidenceState = input.evidenceState || (avgScore >= 0.55 ? "VERIFIED" : avgScore >= 0.3 ? "PARTIAL" : "NOT_FOUND");
    const confidenceLevel: "HIGH" | "MEDIUM" | "LOW" =
      evidenceState === "VERIFIED" && citations.length >= 2 ? "HIGH" : evidenceState === "PARTIAL" ? "MEDIUM" : "LOW";

    return {
      answer: rawAnswer,
      confidence: parseFloat(avgScore.toFixed(2)),
      confidenceLevel,
      evidenceState,
      citations,
      relatedFiles,
      insufficientEvidence: evidenceState === "NOT_FOUND",
      intent: input.intent,
      impactAnalysis: input.impactAnalysis,
      gitHistory: input.commits?.map((c) => ({
        sha: c.sha,
        shortSha: c.shortSha,
        message: c.message,
        author: c.authorName,
        date: new Date(c.committedAt).toISOString(),
        changeType: c.changeType,
      })),
    };
  }
}

/**
 * Development fallback synthesizing structured, repository-grounded engineering answers
 * directly from evidence items, dependency graphs, modules, and Git history when no external LLM API key is present.
 */
export class DevelopmentMockLLMProvider implements LLMProvider {
  name = "Development Mock LLM Provider";

  async generateAnswer(input: GenerateAnswerInput): Promise<AIAnswerResponse> {
    const { question, evidence, intent, impactAnalysis, dependencies, modules, commits } = input;
    const repoLabel = input.repoName || input.repoId || "this repository";

    const isNotFound =
      input.evidenceState === "NOT_FOUND" ||
      (evidence.length === 0 &&
        (!dependencies || dependencies.length === 0) &&
        (!commits || commits.length === 0) &&
        (!modules || modules.length === 0) &&
        intent !== "GENERAL");

    if (isNotFound) {
      return {
        answer: `### Answer\n\nI couldn't verify this from the indexed repository data. No matching code files, modules, dependencies, or commits were found for this query in repository ${repoLabel}.\n\n### Evidence\n\nNo matching indexed repository evidence was found.\n\n### Confidence\n\nNot Found — The requested entity or concept is not present in the indexed repository knowledge.`,
        confidence: 0,
        confidenceLevel: "LOW",
        evidenceState: "NOT_FOUND",
        citations: [],
        relatedFiles: [],
        insufficientEvidence: true,
        intent,
      };
    }

    const topEvidence = evidence.slice(0, 4);
    const relatedFiles = Array.from(new Set(topEvidence.map((e) => e.path)));
    const avgScore =
      topEvidence.length > 0
        ? topEvidence.reduce((sum, item) => sum + item.score, 0) / topEvidence.length
        : 0.5;

    const unvalidatedCitations: EvidenceCitation[] = topEvidence.map((item, idx) => ({
      id: item.id || item.fileId || `ev-${idx + 1}`,
      path: item.path,
      startLine: item.startLine,
      endLine: item.endLine,
      snippet: item.content.slice(0, 150),
      relevance: item.score,
    }));

    const citations = validateCitations(unvalidatedCitations, evidence);

    // Build intent-specific structured answers
    let answerText = "";
    let evidenceState: "VERIFIED" | "PARTIAL" | "NOT_FOUND" = input.evidenceState || "VERIFIED";
    let confidenceLevel: "HIGH" | "MEDIUM" | "LOW" = "HIGH";

    if (intent === "GENERAL") {
      evidenceState = "PARTIAL";
      confidenceLevel = "MEDIUM";

      let conceptDef = "This is a standard software engineering concept.";
      const qLower = question.toLowerCase();
      if (qLower.includes("dependency injection")) {
        conceptDef = "Dependency injection is a software design pattern where an object receives other objects that it depends on (its dependencies), rather than creating them internally.";
      } else if (qLower.includes("oauth")) {
        conceptDef = "OAuth is an open standard for token-based authentication and authorization that allows third-party services to access user resources without exposing credentials.";
      } else if (qLower.includes("webhook")) {
        conceptDef = "A webhook is an automated HTTP callback triggered by specific events in a source system to deliver real-time data payloads to a destination URL.";
      }

      answerText = [
        `### Answer\n\n${conceptDef}`,
        `### How it works\n\nIn software engineering, this pattern decouples concerns and enables modular, testable architectures.\n\n${
          topEvidence.length > 0
            ? `Within **${repoLabel}**, relevant implementations can be found in:\n` +
              topEvidence.map((e) => `• \`${e.path}\` (lines ${e.startLine}–${e.endLine})`).join("\n")
            : `*Note: No specific repository implementation was directly queried.*`
        }`,
        `### Evidence\n\n${
          topEvidence.length > 0
            ? topEvidence.map((e) => `• **${e.path}** (lines ${e.startLine}–${e.endLine})`).join("\n")
            : "General engineering knowledge (no repository code chunks cited)."
        }`,
        `### Confidence\n\nPartial — General software engineering concept explanation.`,
      ].join("\n\n");
    } else if (intent === "IMPACT") {
      evidenceState = "VERIFIED";
      confidenceLevel = "HIGH";

      const directlyAffected = impactAnalysis?.directlyAffected || [];
      const potentiallyAffected = impactAnalysis?.potentiallyAffected || [];
      const affectedModules = impactAnalysis?.affectedModules || [];

      const impactDesc =
        directlyAffected.length > 0
          ? `Modifying or deleting this entity will directly impact **${directlyAffected.length}** dependent file(s)${
              affectedModules.length > 0 ? ` across module(s) **${affectedModules.join(", ")}**` : ""
            }.`
          : `No direct dependents were found in the indexed repository data for this entity. The direct blast radius appears contained.`;

      answerText = [
        `### Impact\n\n${impactDesc}`,
        `### Directly affected\n\n${
          directlyAffected.length > 0
            ? directlyAffected.map((f) => `• \`${f}\``).join("\n")
            : "No direct dependents found in indexed dependency relationships."
        }`,
        `### Potentially affected\n\n${
          potentiallyAffected.length > 0
            ? potentiallyAffected.map((f) => `• \`${f}\``).join("\n")
            : affectedModules.length > 0
            ? affectedModules.map((m) => `• Module \`${m}\``).join("\n")
            : "None identified in downstream dependency graph."
        }`,
        `### Why\n\n${
          impactAnalysis?.reason ||
          (directlyAffected.length > 0
            ? `The listed files maintain direct import dependencies on this target in the repository's dependency graph.`
            : `No inbound imports were resolved for this target in indexed repository dependencies.`)
        }`,
        `### Validation\n\n${
          impactAnalysis?.validation && impactAnalysis.validation.length > 0
            ? impactAnalysis.validation.map((v) => `• ${v}`).join("\n")
            : `• Run unit and integration tests covering ${directlyAffected.slice(0, 3).join(", ") || "the affected area"}.\n• Check type checking and compiler diagnostics for breaking import changes.`
        }`,
        `### Evidence\n\n${
          topEvidence.length > 0
            ? topEvidence.map((e) => `• **${e.path}** (lines ${e.startLine}–${e.endLine})`).join("\n")
            : `• Grounded in ${directlyAffected.length} indexed dependency graph record(s).`
        }`,
        `### Confidence\n\nVerified — Grounded in verified repository dependency graph relationships.`,
      ].join("\n\n");
    } else if (intent === "LOCATION") {
      evidenceState = "VERIFIED";
      confidenceLevel = "HIGH";

      const target = topEvidence[0];
      answerText = [
        `### Answer\n\nThe requested component is located in **${target.path}** (lines ${target.startLine}–${target.endLine}).`,
        `### How it works\n\nImplementation snippet from \`${target.path}\`:\n\`\`\`${(target.language || "").toLowerCase()}\n${target.content.slice(0, 300)}\n\`\`\``,
        `### Evidence\n\n• **${target.path}** (lines ${target.startLine}–${target.endLine})${
          topEvidence.length > 1
            ? "\n" + topEvidence.slice(1).map((e) => `• **${e.path}** (lines ${e.startLine}–${e.endLine})`).join("\n")
            : ""
        }`,
        `### Confidence\n\nVerified — Directly located in indexed repository source file.`,
      ].join("\n\n");
    } else if (intent === "DEPENDENCY") {
      evidenceState = "VERIFIED";
      confidenceLevel = "HIGH";

      const depLines =
        dependencies && dependencies.length > 0
          ? dependencies.map((d) => `• \`${d.sourceFile || "target"}\` → \`${d.targetFile || d.toModule || "dependency"}\` (${d.kind})`).join("\n")
          : topEvidence.map((e) => `• Inbound reference in \`${e.path}\` (lines ${e.startLine}–${e.endLine})`).join("\n");

      answerText = [
        `### Answer\n\nIdentified repository dependency relationships:`,
        `### How it works\n\n${depLines}`,
        `### Evidence\n\n${
          topEvidence.length > 0
            ? topEvidence.map((e) => `• **${e.path}** (lines ${e.startLine}–${e.endLine})`).join("\n")
            : "Verified from indexed dependency records."
        }`,
        `### Confidence\n\nVerified — Grounded in indexed repository dependency relationships.`,
      ].join("\n\n");
    } else if (intent === "GIT_HISTORY") {
      evidenceState = commits && commits.length > 0 ? "VERIFIED" : "PARTIAL";
      confidenceLevel = commits && commits.length > 0 ? "HIGH" : "LOW";

      if (commits && commits.length > 0) {
        const commitItems = commits
          .map(
            (c) =>
              `• **[${c.shortSha}]** ${c.message} — *${c.authorName}* (${new Date(c.committedAt).toISOString().split("T")[0]})`
          )
          .join("\n");

        answerText = [
          `### Answer\n\nRecent Git commit history for this repository:`,
          `### How it works\n\n${commitItems}`,
          `### Evidence\n\n${commits.map((c) => `• Commit \`${c.shortSha}\` (${c.authorName})`).join("\n")}`,
          `### Confidence\n\nVerified — Grounded in indexed Git commit history.`,
        ].join("\n\n");
      } else {
        answerText = [
          `### Answer\n\nI couldn't verify recent Git commit history from the indexed repository data.`,
          `### How it works\n\nNo commit history records matching this file or repository were found in indexed data.`,
          `### Evidence\n\nNo indexed Git commit records found.`,
          `### Confidence\n\nNot Found — No Git history available for this query.`,
        ].join("\n\n");
      }
    } else if (intent === "ARCHITECTURE") {
      evidenceState = "VERIFIED";
      confidenceLevel = "HIGH";

      const moduleItems =
        modules && modules.length > 0
          ? modules
              .map(
                (m) =>
                  `• **${m.name}** (${m.type}): ${m.desc || "Architecture module"} — ${m.filesCount} file(s)`
              )
              .join("\n")
          : topEvidence.map((e) => `• Structure represented by \`${e.path}\``).join("\n");

      answerText = [
        `### Answer\n\nThe project architecture in **${repoLabel}** is organized into structured modules:`,
        `### How it works\n\n${moduleItems}`,
        `### Evidence\n\n${
          modules && modules.length > 0
            ? modules.map((m) => `• Module: **${m.name}**`).join("\n")
            : topEvidence.map((e) => `• **${e.path}** (lines ${e.startLine}–${e.endLine})`).join("\n")
        }`,
        `### Confidence\n\nVerified — Grounded in indexed project architecture.`,
      ].join("\n\n");
    } else {
      // Default: Technical Explanation
      evidenceState = avgScore >= 0.5 ? "VERIFIED" : "PARTIAL";
      confidenceLevel = evidenceState === "VERIFIED" && citations.length >= 2 ? "HIGH" : "MEDIUM";

      answerText = [
        `### Answer\n\nBased on the indexed repository evidence for **"${question}"**:`,
        `### How it works\n\n${topEvidence
          .map((e) => `• In **\`${e.path}\`** (lines ${e.startLine}–${e.endLine}):\n  ${e.content.slice(0, 180).replace(/\n/g, " ")}…`)
          .join("\n\n")}`,
        `### Evidence\n\n${topEvidence.map((e) => `• **${e.path}** (lines ${e.startLine}–${e.endLine})`).join("\n")}`,
        `### Confidence\n\n${evidenceState === "VERIFIED" ? "Verified" : "Partial"} — Grounded in ${topEvidence.length} indexed repository code chunk(s).`,
      ].join("\n\n");
    }

    return {
      answer: answerText,
      confidence: parseFloat(avgScore.toFixed(2)),
      confidenceLevel,
      evidenceState,
      citations,
      relatedFiles,
      insufficientEvidence: (evidenceState as string) === "NOT_FOUND",
      intent,
      impactAnalysis: input.impactAnalysis,
      gitHistory: commits?.map((c) => ({
        sha: c.sha,
        shortSha: c.shortSha,
        message: c.message,
        author: c.authorName,
        date: new Date(c.committedAt).toISOString(),
        changeType: c.changeType,
      })),
    };
  }
}

export function getLLMProvider(): LLMProvider {
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  if (geminiKey && geminiKey !== "mock_key") {
    return new GeminiLLMProvider(geminiKey, geminiModel);
  }

  const openaiKey = process.env.OPENAI_API_KEY || process.env.EMBEDDING_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (openaiKey && openaiKey !== "mock_key") {
    return new OpenAILLMProvider(openaiKey, openaiModel);
  }

  return new DevelopmentMockLLMProvider();
}
