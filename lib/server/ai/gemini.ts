import "server-only";
import { buildSystemPrompt, buildUserPrompt, type GenerateAnswerInput } from "./prompt";
import { validateCitations, type EvidenceCitation } from "./validate";
import type { AIAnswerResponse, LLMProvider } from "./provider";

export class GeminiLLMProvider implements LLMProvider {
  name = "Google Gemini 3.6 Flash";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gemini-3.6-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateAnswer(input: GenerateAnswerInput): Promise<AIAnswerResponse> {
    const { question, evidence } = input;

    const isNotFound =
      input.evidenceState === "NOT_FOUND" ||
      (evidence.length === 0 &&
        (!input.dependencies || input.dependencies.length === 0) &&
        (!input.commits || input.commits.length === 0) &&
        (!input.modules || input.modules.length === 0) &&
        input.intent !== "GENERAL");

    if (isNotFound) {
      return {
        answer: `### Answer\n\nI couldn't verify this from the indexed repository data. No matching code files, modules, dependencies, or commits were found for "${question}".\n\n### Evidence\n\nNo matching indexed repository evidence was found.\n\n### Confidence\n\nNot Found — The requested entity or concept is not present in the indexed repository knowledge.`,
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

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: fullPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
          },
        }),
      });
    } catch (networkErr: any) {
      console.warn("Gemini network error. Falling back to local synthesis:", networkErr?.message);
      const { DevelopmentMockLLMProvider } = await import("./provider");
      return new DevelopmentMockLLMProvider().generateAnswer(input);
    }

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Gemini API returned error (${res.status}): ${errText}. Falling back to local synthesis.`);
      const { DevelopmentMockLLMProvider } = await import("./provider");
      return new DevelopmentMockLLMProvider().generateAnswer(input);
    }

    const data = await res.json();
    const rawAnswer: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate answer from Gemini API.";

    // Build citations from evidence
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
    const avgScore =
      evidence.length > 0 ? evidence.reduce((sum, item) => sum + item.score, 0) / evidence.length : 0.5;

    const evidenceState =
      input.evidenceState || (avgScore >= 0.55 ? "VERIFIED" : avgScore >= 0.3 ? "PARTIAL" : "NOT_FOUND");
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

  async generateText(promptText: string): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API text generation error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}
