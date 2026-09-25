import "server-only";
import crypto from "crypto";
import { db } from "../db";
import type { WebhookPushPayload } from "./types";

/**
 * Validates the HMAC-SHA256 signature from GitHub's X-Hub-Signature-256 header.
 */
export function verifyGitHubWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret?: string
): boolean {
  const webhookSecret = secret || process.env.GITHUB_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    console.error("[SECURITY] GITHUB_WEBHOOK_SECRET is not configured.");
    return false;
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const providedHex = signatureHeader.slice(7).trim();
  const computedHex = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  if (providedHex.length !== computedHex.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedHex, "hex"),
      Buffer.from(computedHex, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Resolves and validates a connected DevMind repository from GitHub webhook payload.
 */
export async function findConnectedRepository(ownerLogin: string, repoName: string) {
  if (!ownerLogin || !repoName) return null;

  const repo = await db.repository.findFirst({
    where: {
      OR: [
        {
          name: repoName,
          owner: ownerLogin,
        },
        {
          id: repoName,
          owner: ownerLogin,
        },
        {
          name: repoName,
        },
        {
          id: repoName,
        },
      ],
    },
    include: {
      project: {
        include: {
          org: {
            include: {
              members: {
                include: {
                  user: {
                    include: {
                      githubAccount: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return repo;
}
