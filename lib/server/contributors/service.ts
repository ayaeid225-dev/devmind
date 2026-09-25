import { db } from "../db";
import { getContributorIdentityKey, selectBetterName } from "./identity";
import type {
  AggregatedContributorStats,
  ContributorIdentity,
  ContributorQueryOptions,
  ContributorSyncOptions,
  ContributorSyncResult,
} from "./types";

export async function ingestContributors(
  repoId: string,
  options?: ContributorSyncOptions
): Promise<ContributorSyncResult> {
  const startTime = Date.now();

  // 1. Verify repository exists
  const repo = await db.repository.findUnique({
    where: { id: repoId },
  });

  if (!repo) {
    throw new Error(`Repository record not found in database: ${repoId}`);
  }

  // 2. Fetch existing Git commit and file change records
  const commits = await db.commitRecord.findMany({
    where: { repoId },
    include: {
      fileChanges: true,
    },
    orderBy: {
      committedAt: "asc",
    },
  });

  // 3. Handle repository with no commits
  if (commits.length === 0) {
    // Delete any stale contributors
    await db.contributorRecord.deleteMany({
      where: { repoId },
    });

    await db.repository.update({
      where: { id: repoId },
      data: {
        contributorsCount: 0,
      },
    });

    return {
      success: true,
      repoId,
      contributorsSynced: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // 4. Aggregate contributors and statistics
  const contributorsMap = new Map<string, AggregatedContributorStats>();

  function getOrCreateStats(
    identity: ContributorIdentity,
    initialDate: Date
  ): AggregatedContributorStats {
    let stat = contributorsMap.get(identity.identityKey);
    if (!stat) {
      stat = {
        identityKey: identity.identityKey,
        name: identity.normalizedName,
        email: identity.normalizedEmail,
        authoredCommitsCount: 0,
        committedCommitsCount: 0,
        totalCommitsCount: 0,
        additions: 0,
        deletions: 0,
        filesTouched: new Set<string>(),
        firstContributionAt: initialDate,
        lastContributionAt: initialDate,
        isAuthor: false,
        isCommitter: false,
        authoredCommitIds: [],
        committedCommitIds: [],
      };
      contributorsMap.set(identity.identityKey, stat);
    }
    return stat;
  }

  const commitLinks: Array<{
    commitId: string;
    authorKey: string;
    committerKey: string;
  }> = [];

  for (const commit of commits) {
    // Process Author
    const authorIdentity = getContributorIdentityKey(
      commit.authorName,
      commit.authorEmail
    );
    const authorStat = getOrCreateStats(authorIdentity, commit.authoredAt);

    authorStat.name = selectBetterName(
      authorStat.name,
      authorIdentity.normalizedName
    );
    if (!authorStat.email && authorIdentity.normalizedEmail) {
      authorStat.email = authorIdentity.normalizedEmail;
    }
    authorStat.isAuthor = true;
    authorStat.authoredCommitsCount += 1;
    authorStat.authoredCommitIds.push(commit.id);

    if (commit.authoredAt < authorStat.firstContributionAt) {
      authorStat.firstContributionAt = commit.authoredAt;
    }
    if (commit.authoredAt > authorStat.lastContributionAt) {
      authorStat.lastContributionAt = commit.authoredAt;
    }

    // Sum file changes (additions, deletions, files touched)
    for (const fc of commit.fileChanges) {
      authorStat.additions += fc.additions;
      authorStat.deletions += fc.deletions;
      if (fc.newPath) {
        authorStat.filesTouched.add(fc.newPath);
      }
      if (fc.oldPath) {
        authorStat.filesTouched.add(fc.oldPath);
      }
    }

    // Process Committer
    const committerName = commit.committerName || commit.authorName;
    const committerEmail = commit.committerEmail || commit.authorEmail;
    const committerIdentity = getContributorIdentityKey(
      committerName,
      committerEmail
    );
    const committerStat = getOrCreateStats(
      committerIdentity,
      commit.committedAt
    );

    committerStat.name = selectBetterName(
      committerStat.name,
      committerIdentity.normalizedName
    );
    if (!committerStat.email && committerIdentity.normalizedEmail) {
      committerStat.email = committerIdentity.normalizedEmail;
    }
    committerStat.isCommitter = true;
    committerStat.committedCommitsCount += 1;
    committerStat.committedCommitIds.push(commit.id);

    if (commit.committedAt < committerStat.firstContributionAt) {
      committerStat.firstContributionAt = commit.committedAt;
    }
    if (commit.committedAt > committerStat.lastContributionAt) {
      committerStat.lastContributionAt = commit.committedAt;
    }

    commitLinks.push({
      commitId: commit.id,
      authorKey: authorIdentity.identityKey,
      committerKey: committerIdentity.identityKey,
    });
  }

  // Calculate distinct total commits for each contributor
  for (const stat of contributorsMap.values()) {
    const distinctIds = new Set([
      ...stat.authoredCommitIds,
      ...stat.committedCommitIds,
    ]);
    stat.totalCommitsCount = distinctIds.size;
  }

  // 5. Persist Contributor Records into Database
  const identityKeyToId = new Map<string, string>();

  for (const stat of contributorsMap.values()) {
    const contributorRecord = await db.contributorRecord.upsert({
      where: {
        repoId_identityKey: {
          repoId,
          identityKey: stat.identityKey,
        },
      },
      update: {
        name: stat.name,
        email: stat.email,
        authoredCommitsCount: stat.authoredCommitsCount,
        committedCommitsCount: stat.committedCommitsCount,
        totalCommitsCount: stat.totalCommitsCount,
        additions: stat.additions,
        deletions: stat.deletions,
        filesTouchedCount: stat.filesTouched.size,
        filesTouchedJson: JSON.stringify(Array.from(stat.filesTouched).slice(0, 100)),
        firstContributionAt: stat.firstContributionAt,
        lastContributionAt: stat.lastContributionAt,
        isAuthor: stat.isAuthor,
        isCommitter: stat.isCommitter,
        updatedAt: new Date(),
      },
      create: {
        repoId,
        identityKey: stat.identityKey,
        name: stat.name,
        email: stat.email,
        authoredCommitsCount: stat.authoredCommitsCount,
        committedCommitsCount: stat.committedCommitsCount,
        totalCommitsCount: stat.totalCommitsCount,
        additions: stat.additions,
        deletions: stat.deletions,
        filesTouchedCount: stat.filesTouched.size,
        filesTouchedJson: JSON.stringify(Array.from(stat.filesTouched).slice(0, 100)),
        firstContributionAt: stat.firstContributionAt,
        lastContributionAt: stat.lastContributionAt,
        isAuthor: stat.isAuthor,
        isCommitter: stat.isCommitter,
      },
    });

    identityKeyToId.set(stat.identityKey, contributorRecord.id);
  }

  // Prune any removed or obsolete contributors
  const activeKeys = Array.from(contributorsMap.keys());
  await db.contributorRecord.deleteMany({
    where: {
      repoId,
      identityKey: {
        notIn: activeKeys,
      },
    },
  });

  // Link commits to contributors
  if (!options?.skipCommitLinking) {
    for (const link of commitLinks) {
      const authorContributorId = identityKeyToId.get(link.authorKey) ?? null;
      const committerContributorId =
        identityKeyToId.get(link.committerKey) ?? null;

      await db.commitRecord.update({
        where: { id: link.commitId },
        data: {
          authorContributorId,
          committerContributorId,
        },
      });
    }
  }

  // Update repository contributors count
  await db.repository.update({
    where: { id: repoId },
    data: {
      contributorsCount: contributorsMap.size,
    },
  });

  return {
    success: true,
    repoId,
    contributorsSynced: contributorsMap.size,
    durationMs: Date.now() - startTime,
  };
}

export async function getContributors(
  repoId: string,
  options?: ContributorQueryOptions
) {
  const where: Record<string, unknown> = { repoId };

  if (options?.role === "author") {
    where.isAuthor = true;
  } else if (options?.role === "committer") {
    where.isCommitter = true;
  }

  let orderBy: Record<string, "asc" | "desc"> = { totalCommitsCount: "desc" };
  if (options?.sortBy === "additions") {
    orderBy = { additions: "desc" };
  } else if (options?.sortBy === "recent") {
    orderBy = { lastContributionAt: "desc" };
  } else if (options?.sortBy === "name") {
    orderBy = { name: "asc" };
  }

  return db.contributorRecord.findMany({
    where,
    orderBy,
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: options?.includeCommits
      ? {
          authoredCommits: {
            take: 10,
            orderBy: { committedAt: "desc" },
          },
        }
      : undefined,
  });
}

export async function getContributor(
  repoId: string,
  idOrIdentityKey: string
) {
  // Try ID lookup first
  const byId = await db.contributorRecord.findFirst({
    where: {
      repoId,
      id: idOrIdentityKey,
    },
    include: {
      authoredCommits: {
        take: 20,
        orderBy: { committedAt: "desc" },
      },
      committedCommits: {
        take: 20,
        orderBy: { committedAt: "desc" },
      },
    },
  });

  if (byId) return byId;

  // Try identityKey lookup
  return db.contributorRecord.findUnique({
    where: {
      repoId_identityKey: {
        repoId,
        identityKey: idOrIdentityKey,
      },
    },
    include: {
      authoredCommits: {
        take: 20,
        orderBy: { committedAt: "desc" },
      },
      committedCommits: {
        take: 20,
        orderBy: { committedAt: "desc" },
      },
    },
  });
}

export async function getContributorCommits(
  repoId: string,
  contributorId: string,
  options?: { limit?: number; offset?: number }
) {
  return db.commitRecord.findMany({
    where: {
      repoId,
      OR: [
        { authorContributorId: contributorId },
        { committerContributorId: contributorId },
      ],
    },
    orderBy: {
      committedAt: "desc",
    },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      fileChanges: true,
    },
  });
}
