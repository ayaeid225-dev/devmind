import "server-only";
import crypto from "crypto";

export interface EmbeddingProvider {
  name: string;
  dimensions: number;
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = "OpenAI text-embedding-3-small";
  dimensions = 1536;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embedText(text: string): Promise<number[]> {
    const results = await this.embedTexts([text]);
    return results[0];
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: texts,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI Embedding API error: ${res.statusText}`);
    }

    const data = await res.json();
    return data.data.map((item: { embedding: number[] }) => item.embedding);
  }
}

/**
 * Development fallback provider generating deterministic vector embeddings
 * for local testing when no external API key is configured.
 */
export class DevelopmentMockEmbeddingProvider implements EmbeddingProvider {
  name = "Development Mock Embedding Provider";
  dimensions = 128;

  async embedText(text: string): Promise<number[]> {
    const vector = new Array(this.dimensions).fill(0);
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const hash = crypto.createHash("md5").update(words[i]).digest();
      for (let j = 0; j < Math.min(hash.length, this.dimensions); j++) {
        vector[j] += (hash[j] - 128) / 128;
      }
    }

    // L2 Normalize Vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
    return vector.map((val) => val / magnitude);
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedText(t)));
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;

  if (apiKey && apiKey !== "mock_key") {
    return new OpenAIEmbeddingProvider(apiKey);
  }

  return new DevelopmentMockEmbeddingProvider();
}
