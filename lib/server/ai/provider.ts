import "server-only";
import type { EvidenceResultItem } from "../rag/search";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { validateCitations, type EvidenceCitation } from "./validate";
import { GeminiLLMProvider } from "./gemini";

export interface AIAnswerResponse {
  answer: string;
  confidence: number;
  citations: EvidenceCitation[];
  relatedFiles: string[];
  insufficientEvidence: boolean;
}

export interface LLMProvider {
  name: string;
  generateAnswer(input: {
    question: string;
    evidence: EvidenceResultItem[];
  }): Promise<AIAnswerResponse>;
}

export class OpenAILLMProvider implements LLMProvider {
  name = "OpenAI Chat Completions";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o-mini") {
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
        answer: "No relevant repository code evidence was found for your question. Please try asking with specific module or file keywords.",
        confidence: 0,
        citations: [],
        relatedFiles: [],
        insufficientEvidence: true,
      };
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(question, evidence);

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
}

/**
 * Development fallback synthesizing structured, RAG-grounded answers
 * directly from evidence items when no external LLM API key is present.
 */
export class DevelopmentMockLLMProvider implements LLMProvider {
  name = "Development Mock LLM Provider";

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

    const topEvidence = evidence.slice(0, 3);
    const relatedFiles = Array.from(new Set(topEvidence.map((e) => e.path)));
    const avgScore = topEvidence.reduce((sum, item) => sum + item.score, 0) / topEvidence.length;

    const unvalidatedCitations: EvidenceCitation[] = topEvidence.map((item, idx) => ({
      id: `ev-${idx + 1}`,
      path: item.path,
      startLine: item.startLine,
      endLine: item.endLine,
      snippet: item.content.slice(0, 120),
      relevance: item.score,
    }));

    const citations = validateCitations(unvalidatedCitations, evidence);

    const answerLines = [
      `Based on the indexed repository evidence for **"${question}"**:`,
      ...topEvidence.map(
        (e) => `• **${e.path}** (lines ${e.startLine}–${e.endLine}): ${e.content.slice(0, 180).replace(/\n/g, " ")}…`
      ),
      `\n*Note: Running in local development mode grounded in ${topEvidence.length} RAG evidence chunks.*`,
    ];

    return {
      answer: answerLines.join("\n\n"),
      confidence: parseFloat(avgScore.toFixed(2)),
      citations,
      relatedFiles,
      insufficientEvidence: false,
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
