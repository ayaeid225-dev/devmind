import "server-only";
import { db } from "../db";
import { detectIncrementalChanges, processIncrementalSync } from "./incremental";
import { ingestRepository } from "../ingestion";
import { notifyRepoMembers } from "../notifications";
import type { SyncOptions, SyncResult } from "./types";

// In-memory map of actively syncing repository promises to prevent concurrent sync executions
const activeRepoSyncLocks = new Map<string, Promise<void>>();

export interface EnqueueJobParams {
  repoId: string;
  deliveryId?: string;
  event?: string;
  beforeSha?: string | null;
  afterSha: string;
  ref?: string;
  commits?: Array<{
    sha: string;
    message: string;
    authorName?: string;
    authorDate?: string;
    added?: string[];
    removed?: string[];
    modified?: string[];
  }>;
  pusher?: string;
  token?: string;
  forceFull?: boolean;
}

/**
 * Enqueues a synchronization job into the database and triggers the worker.
 * Guarantees idempotency via deliveryId deduplication.
 */
export async function enqueueSyncJob(params: EnqueueJobParams): Promise<{
  enqueued: boolean;
  duplicate: boolean;
  job: any;
}> {
  const { repoId, deliveryId, event = "push", beforeSha, afterSha, ref } = params;

  // 1. Check for duplicate delivery
  if (deliveryId) {
    const existingJob = await db.syncJob.findUnique({
      where: { deliveryId },
    });

    if (existingJob) {
      return {
        enqueued: false,
        duplicate: true,
        job: existingJob,
      };
    }
  }

  // 2. Persist new PENDING job in database
  const job = await db.syncJob.create({
    data: {
      repoId,
      deliveryId: deliveryId || null,
      event,
      status: "PENDING",
      beforeSha: beforeSha || null,
      afterSha,
      ref: ref || null,
      commitsJson: params.commits ? JSON.stringify(params.commits) : null,
    },
  });

  // 3. Trigger queue processor asynchronously
  setImmediate(() => {
    processSyncQueue(repoId, params).catch((err) => {
      console.error(`Background queue processor error for repo ${repoId}:`, err);
    });
  });

  return {
    enqueued: true,
    duplicate: false,
    job,
  };
}

/**
 * Sequential queue worker for a single repository.
 * Ensures that two sync operations for the same repository never run concurrently.
 */
export async function processSyncQueue(
  repoId: string,
  runtimeOptions?: Partial<EnqueueJobParams>
): Promise<void> {
  // Wait if another worker is already processing this repo
  while (activeRepoSyncLocks.has(repoId)) {
    await activeRepoSyncLocks.get(repoId);
  }

  const workerPromise = (async () => {
    while (true) {
      const nextJob = await db.syncJob.findFirst({
        where: {
          repoId,
          status: "PENDING",
        },
        orderBy: { createdAt: "asc" },
      });

      if (!nextJob) {
        break; // Queue is empty for this repository
      }

      // Mark job as PROCESSING
      await db.syncJob.update({
        where: { id: nextJob.id },
        data: {
          status: "PROCESSING",
          startedAt: new Date(),
        },
      });

      try {
        await executeSyncJob(nextJob.id, runtimeOptions);
      } catch (jobErr) {
        console.error(`Sync job ${nextJob.id} failed:`, jobErr);
      }
    }
  })();

  activeRepoSyncLocks.set(repoId, workerPromise);
  try {
    await workerPromise;
  } finally {
    activeRepoSyncLocks.delete(repoId);
  }
}

/**
 * Executes a single sync job by ID.
 * Decides whether to perform incremental sync or safe full sync fallback.
 */
export async function executeSyncJob(
  jobId: string,
  runtimeOptions?: Partial<EnqueueJobParams>
): Promise<SyncResult> {
  const startTime = Date.now();

  const job = await db.syncJob.findUnique({
    where: { id: jobId },
    include: { repo: true },
  });

  if (!job) {
    throw new Error(`Sync job not found: ${jobId}`);
  }

  const repo = job.repo;
  const newCommitSha = job.afterSha;
  const beforeSha =
    job.beforeSha || repo.lastSyncedCommitSha || repo.latestCommitSha || null;

  let commits = runtimeOptions?.commits;
  if (!commits && job.commitsJson) {
    try {
      commits = JSON.parse(job.commitsJson);
    } catch {}
  }

  const syncOptions: SyncOptions = {
    branch:
      job.ref?.replace(/^refs\/heads\//, "") ||
      repo.defaultBranch ||
      "main",
    pusher: runtimeOptions?.pusher,
    token: runtimeOptions?.token,
    commits,
    forceFull: runtimeOptions?.forceFull,
    deliveryId: job.deliveryId || undefined,
  };

  try {
    // 1. Detect if incremental change detection is possible
    const detection = await detectIncrementalChanges(
      repo.id,
      beforeSha,
      newCommitSha,
      syncOptions
    );

    let result: SyncResult;

    if (detection.canIncremental && detection.changes.length > 0) {
      // 2. Incremental Sync Execution
      result = await processIncrementalSync(
        repo.id,
        newCommitSha,
        detection.changes,
        syncOptions
      );

      await db.syncJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          isIncremental: true,
          filesAdded: result.filesAdded,
          filesModified: result.filesModified,
          filesDeleted: result.filesDeleted,
          summary: result.summary,
          completedAt: new Date(),
        },
      });

      try {
        await notifyRepoMembers(repo.id, {
          type: "SYNC_COMPLETED",
          title: "Synchronization completed",
          message: `Synced commit ${newCommitSha.slice(0, 7)}: ${result.summary}`,
          entityId: jobId,
          link: `/app/overview?repoId=${encodeURIComponent(repo.id)}`,
          dedupeKey: `sync-job:${jobId}:COMPLETED`,
        });
      } catch (notifErr) {
        console.warn(
          "Non-fatal: Failed to create incremental sync notification:",
          notifErr
        );
      }
    } else {
      // 3. Full Sync Fallback
      console.log(
        `[Sync] Falling back to full sync for ${repo.owner}/${repo.name}: ${
          detection.reason || "Full sync requested"
        }`
      );

      const fullResult = await ingestRepository({
        owner: repo.owner,
        repo: repo.name,
        branch: syncOptions.branch,
        localPath: repo.localPath || undefined,
        targetCommitSha: newCommitSha,
      });

      const summary = `Full sync fallback: ${fullResult.filesCount} files, ${fullResult.modulesCount} modules`;

      result = {
        success: true,
        repoId: repo.id,
        beforeSha,
        afterSha: newCommitSha,
        isIncremental: false,
        filesAdded: fullResult.filesCount,
        filesModified: 0,
        filesDeleted: 0,
        durationMs: Date.now() - startTime,
        summary,
      };

      await db.syncJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          isIncremental: false,
          filesAdded: fullResult.filesCount,
          filesModified: 0,
          filesDeleted: 0,
          summary,
          completedAt: new Date(),
        },
      });

      try {
        await notifyRepoMembers(repo.id, {
          type: "SYNC_COMPLETED",
          title: "Synchronization completed",
          message: `Full sync completed: ${summary}`,
          entityId: jobId,
          link: `/app/overview?repoId=${encodeURIComponent(repo.id)}`,
          dedupeKey: `sync-job:${jobId}:COMPLETED`,
        });
      } catch (notifErr) {
        console.warn(
          "Non-fatal: Failed to create full sync notification:",
          notifErr
        );
      }
    }

    return result;
  } catch (error) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : "Sync job execution failed";

    try {
      await db.syncJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          error: errorMsg,
          completedAt: new Date(),
        },
      });
    } catch {}

    try {
      await notifyRepoMembers(repo.id, {
        type: "SYNC_FAILED",
        title: "Synchronization failed",
        message: `Synchronization failed for ${repo.owner}/${repo.name}: ${errorMsg}`,
        entityId: jobId,
        link: `/app/overview?repoId=${encodeURIComponent(repo.id)}`,
        dedupeKey: `sync-job:${jobId}:FAILED`,
      });
    } catch (notifErr) {
      console.warn(
        "Non-fatal: Failed to create sync failure notification:",
        notifErr
      );
    }

    throw error;
  }
}