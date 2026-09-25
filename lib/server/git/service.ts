import { db } from "../db";
import {
  extractGitHistory,
  isGitRepository,
  getDefaultBranch,
  getLatestCommitSha,
  normalizeGitPath,
} from "./extractor";
import type {
  GitSyncOptions,
  GitSyncResult,
  CommitHistoryQueryOptions,
  GitCommitInfo,
} from "./types";

export async function ingestGitHistory(
  repoId: string,
  localPath: string,
  options?: GitSyncOptions
): Promise<GitSyncResult> {
  const startTime = Date.now();

  // 1. Verify repository exists in database
  const repo = await db.repository.findUnique({
    where: { id: repoId },
  });

  if (!repo) {
    throw new Error(`Repository record not found in database: ${repoId}`);
  }

  // 2. Verify local path is a valid Git repository
  const isValidGit = await isGitRepository(localPath);
  if (!isValidGit) {
    const errorMsg = `Path is not a valid Git repository: ${localPath}`;
    await db.repository.update({
      where: { id: repoId },
      data: {
        localPath,
        gitSyncStatus: "FAILED",
        gitSyncError: errorMsg,
        lastGitSyncAt: new Date(),
      },
    });

    return {
      success: false,
      repoId,
      commitsSynced: 0,
      fileChangesSynced: 0,
      latestCommitSha: null,
      durationMs: Date.now() - startTime,
      error: errorMsg,
    };
  }

  // 3. Mark Repository git status as SYNCING
  await db.repository.update({
    where: { id: repoId },
    data: {
      localPath,
      gitSyncStatus: "SYNCING",
      gitSyncError: null,
    },
  });

  try {
    const defaultBranch = await getDefaultBranch(localPath);
    const activeBranch = options?.branch || defaultBranch || repo.defaultBranch || "main";

    // Check for incremental sync
    let sinceSha = options?.sinceSha;
    if (options?.incremental && !sinceSha && repo.latestCommitSha) {
      sinceSha = repo.latestCommitSha;
    }

    const commits: GitCommitInfo[] = await extractGitHistory(localPath, {
      ...options,
      branch: options?.branch || "HEAD",
      sinceSha,
    });

    let totalFileChanges = 0;

    // 4. Upsert Commits and File Changes into Database
    for (const commit of commits) {
      const commitRecord = await db.commitRecord.upsert({
        where: {
          repoId_sha: {
            repoId,
            sha: commit.sha,
          },
        },
        update: {
          shortSha: commit.shortSha,
          message: commit.message,
          authorName: commit.authorName,
          authorEmail: commit.authorEmail,
          committerName: commit.committerName,
          committerEmail: commit.committerEmail,
          authoredAt: commit.authoredAt,
          committedAt: commit.committedAt,
          parentShasJson: JSON.stringify(commit.parentShas),
          branch: activeBranch,
          updatedAt: new Date(),
        },
        create: {
          repoId,
          sha: commit.sha,
          shortSha: commit.shortSha,
          message: commit.message,
          authorName: commit.authorName,
          authorEmail: commit.authorEmail,
          committerName: commit.committerName,
          committerEmail: commit.committerEmail,
          authoredAt: commit.authoredAt,
          committedAt: commit.committedAt,
          parentShasJson: JSON.stringify(commit.parentShas),
          branch: activeBranch,
        },
      });

      // Clear existing file changes for idempotency
      await db.commitFileChangeRecord.deleteMany({
        where: { commitId: commitRecord.id },
      });

      if (commit.fileChanges.length > 0) {
        await db.commitFileChangeRecord.createMany({
          data: commit.fileChanges.map((fc) => ({
            repoId,
            commitId: commitRecord.id,
            commitSha: commit.sha,
            oldPath: fc.oldPath,
            newPath: fc.newPath,
            changeType: fc.changeType,
            additions: fc.additions,
            deletions: fc.deletions,
            similarity: fc.similarity,
            isBinary: fc.isBinary,
            fileMode: fc.fileMode,
          })),
        });
        totalFileChanges += commit.fileChanges.length;
      }
    }

    // 5. Update Repository summary stats
    const totalCommitsCount = await db.commitRecord.count({
      where: { repoId },
    });

    const latestCommitInDb = await db.commitRecord.findFirst({
      where: { repoId },
      orderBy: { committedAt: "desc" },
      select: { sha: true },
    });

    const currentHeadSha =
      (await getLatestCommitSha(localPath, activeBranch)) ||
      latestCommitInDb?.sha ||
      commits[0]?.sha ||
      null;

    const completedAt = new Date();
    await db.repository.update({
      where: { id: repoId },
      data: {
        gitSyncStatus: "COMPLETED",
        gitSyncError: null,
        lastGitSyncAt: completedAt,
        latestCommitSha: currentHeadSha,
        commitsCount: totalCommitsCount,
      },
    });

    return {
      success: true,
      repoId,
      commitsSynced: commits.length,
      fileChangesSynced: totalFileChanges,
      latestCommitSha: currentHeadSha,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Git history ingestion failed";

    await db.repository.update({
      where: { id: repoId },
      data: {
        gitSyncStatus: "FAILED",
        gitSyncError: errorMsg,
        lastGitSyncAt: new Date(),
      },
    });

    return {
      success: false,
      repoId,
      commitsSynced: 0,
      fileChangesSynced: 0,
      latestCommitSha: null,
      durationMs: Date.now() - startTime,
      error: errorMsg,
    };
  }
}

export async function getCommitHistory(
  repoId: string,
  options?: CommitHistoryQueryOptions
) {
  const whereClause: Record<string, unknown> = { repoId };

  if (options?.authorEmail) {
    whereClause.authorEmail = options.authorEmail;
  }

  if (options?.branch) {
    whereClause.branch = options.branch;
  }

  if (options?.since || options?.until) {
    const committedAtFilter: Record<string, Date> = {};
    if (options.since) committedAtFilter.gte = options.since;
    if (options.until) committedAtFilter.lte = options.until;
    whereClause.committedAt = committedAtFilter;
  }

  return db.commitRecord.findMany({
    where: whereClause,
    orderBy: { committedAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      fileChanges: true,
    },
  });
}

export async function getCommit(repoId: string, sha: string) {
  if (sha.length === 40) {
    return db.commitRecord.findUnique({
      where: {
        repoId_sha: {
          repoId,
          sha,
        },
      },
      include: {
        fileChanges: true,
      },
    });
  }

  // Support lookup by short SHA
  return db.commitRecord.findFirst({
    where: {
      repoId,
      sha: {
        startsWith: sha,
      },
    },
    include: {
      fileChanges: true,
    },
  });
}

export async function getFileHistory(repoId: string, filePath: string) {
  const normalized = normalizeGitPath(filePath);

  return db.commitFileChangeRecord.findMany({
    where: {
      repoId,
      OR: [{ newPath: normalized }, { oldPath: normalized }],
    },
    include: {
      commit: true,
    },
    orderBy: {
      commit: {
        committedAt: "desc",
      },
    },
  });
}

export async function getCommitChanges(repoId: string, sha: string) {
  return db.commitFileChangeRecord.findMany({
    where: {
      repoId,
      commitSha: sha,
    },
    orderBy: {
      newPath: "asc",
    },
  });
}
