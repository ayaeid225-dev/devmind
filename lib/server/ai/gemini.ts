import "server-only";
import type { EvidenceResultItem } from "../rag/search";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
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

  async generateAnswer(input: {
    question: string;
    evidence: EvidenceResultItem[];
  }): Promise<AIAnswerResponse> {
    const { question, evidence } = input;

    if (evidence.length === 0) {
      return {
        answer: "No relevant repository code evidence was found for your question. Try asking about authentication, appointment controllers, or patient modules.",
        confidence: 0,
        citations: [],
        relatedFiles: [],
        insufficientEvidence: true,
      };
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(question, evidence);

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(endpoint, {
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
          maxOutputTokens: 1500,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawAnswer: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate answer from Gemini API.";

    // Build citations from evidence
    const unvalidatedCitations: EvidenceCitation[] = evidence.map((item, idx) => ({
      id: `ev-${idx + 1}`,
      path: item.path,
      startLine: item.startLine,
      endLine: item.endLine,
      snippet: item.content.slice(0, 150),
      relevance: item.score,
    }));

    const citations = validateCitations(unvalidatedCitations, evidence);
    const relatedFiles = Array.from(new Set(citations.map((c) => c.path)));
    const avgScore = evidence.reduce((sum, item) => sum + item.score, 0) / evidence.length;

    return {
      answer: rawAnswer,
      confidence: parseFloat(avgScore.toFixed(2)),
      citations,
      relatedFiles,
      insufficientEvidence: false,
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
