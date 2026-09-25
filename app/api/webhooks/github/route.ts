import { NextRequest, NextResponse } from "next/server";
import {
  verifyGitHubWebhookSignature,
  findConnectedRepository,
} from "@/lib/server/sync/webhook";
import { enqueueSyncJob } from "@/lib/server/sync/queue";
import type { WebhookPushPayload } from "@/lib/server/sync/types";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-hub-signature-256");
    const event = req.headers.get("x-github-event") || "push";
    const deliveryId = req.headers.get("x-github-delivery") || undefined;

    // 1. Read raw text body for signature validation
    const rawBody = await req.text();

    // 2. Verify signature
    const isValidSignature = verifyGitHubWebhookSignature(rawBody, signature);
    if (!isValidSignature) {
      console.warn("[WEBHOOK] Invalid or missing GitHub webhook signature.");
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // 3. Handle GitHub ping event
    if (event === "ping") {
      return NextResponse.json(
        { success: true, message: "Webhook ping received successfully" },
        { status: 200 }
      );
    }

    // Accept only push events for sync
    if (event !== "push") {
      return NextResponse.json(
        { success: true, message: `Ignored unhandled event: ${event}` },
        { status: 200 }
      );
    }

    // 4. Parse payload
    let payload: WebhookPushPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: "Malformed JSON payload" },
        { status: 400 }
      );
    }

    const owner = payload.repository?.owner?.login || payload.repository?.owner?.name;
    const repoName = payload.repository?.name;
    const ref = payload.ref;
    const beforeSha = payload.before;
    const afterSha = payload.after || payload.head_commit?.id;

    if (!owner || !repoName || !afterSha) {
      return NextResponse.json(
        { success: false, error: "Missing required push payload fields" },
        { status: 400 }
      );
    }

    // Ignore branch deletion events (all zeroes)
    if (/^0+$/.test(afterSha)) {
      return NextResponse.json(
        { success: true, message: "Branch deletion ignored" },
        { status: 200 }
      );
    }

    // 5. Identify and validate connected DevMind repository
    const repo = await findConnectedRepository(owner, repoName);
    if (!repo) {
      console.warn(`[WEBHOOK] Push received for unknown/unconnected repository: ${owner}/${repoName}`);
      return NextResponse.json(
        {
          success: false,
          error: `Repository "${owner}/${repoName}" is not connected to DevMind`,
        },
        { status: 404 }
      );
    }

    // 6. Check if new commit is already synced and no duplicate needed
    if (
      repo.latestCommitSha === afterSha &&
      (repo.gitSyncStatus === "COMPLETED" || repo.syncStatus === "COMPLETED")
    ) {
      return NextResponse.json(
        {
          success: true,
          message: "Repository is already up to date with this commit",
          commitSha: afterSha,
        },
        { status: 200 }
      );
    }

    // 7. Extract commit details from payload
    const commits = Array.isArray(payload.commits)
      ? payload.commits.map((c) => ({
          sha: c.id,
          message: c.message || "Update",
          added: c.added || [],
          removed: c.removed || [],
          modified: c.modified || [],
        }))
      : [];

    // 8. Enqueue background sync job
    const enqueueResult = await enqueueSyncJob({
      repoId: repo.id,
      deliveryId,
      event,
      beforeSha,
      afterSha,
      ref,
      commits,
      pusher: payload.pusher?.name || payload.head_commit?.author?.name || "GitHub Webhook",
    });

    if (enqueueResult.duplicate) {
      return NextResponse.json(
        {
          success: true,
          message: "Duplicate webhook delivery ignored",
          duplicate: true,
          jobId: enqueueResult.job.id,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Sync job accepted and enqueued",
        jobId: enqueueResult.job.id,
        repoId: repo.id,
        commitSha: afterSha,
      },
      { status: 202 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Webhook handler error";
    console.error("API POST /api/webhooks/github error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
