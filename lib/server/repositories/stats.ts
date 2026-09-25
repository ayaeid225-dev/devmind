import { db } from "../db";

export interface RepositoryStatsSummary {
  repoId: string;
  filesCount: number;
  modulesCount: number;
  depsCount: number;
  commitsCount: number;
  contributorsCount: number;
  latestCommitSha: string | null;
}

export interface StatsConsistencyReport {
  isConsistent: boolean;
  repoId: string;
  discrepancies: Record<
    string,
    {
      stored: number | string | null;
      actual: number | string | null;
    }
  >;
}

/**
 * Synchronizes the cached summary aggregate fields on the Repository model
 * with the actual counts from the underlying relational database records.
 */
export async function syncRepositoryStats(
  repoId: string
): Promise<RepositoryStatsSummary> {
  const [
    filesCount,
    modulesCount,
    depsCount,
    commitsCount,
    contributorRecordsCount,
    developerRecordsCount,
    latestCommit,
  ] = await Promise.all([
    db.fileRecord.count({ where: { repoId } }),
    db.module.count({ where: { repoId } }),
    db.dependencyRecord.count({ where: { repoId } }),
    db.commitRecord.count({ where: { repoId } }),
    db.contributorRecord.count({ where: { repoId } }),
    db.developerRecord.count({ where: { repoId } }),
    db.commitRecord.findFirst({
      where: { repoId },
      orderBy: { committedAt: "desc" },
      select: { sha: true },
    }),
  ]);

  const contributorsCount =
    contributorRecordsCount > 0 ? contributorRecordsCount : developerRecordsCount;
  const latestCommitSha = latestCommit?.sha ?? null;

  await db.repository.update({
    where: { id: repoId },
    data: {
      filesCount,
      modulesCount,
      depsCount,
      commitsCount,
      contributorsCount,
      latestCommitSha,
    },
  });

  return {
    repoId,
    filesCount,
    modulesCount,
    depsCount,
    commitsCount,
    contributorsCount,
    latestCommitSha,
  };
}

/**
 * Verifies that the aggregate statistics on the Repository row match
 * the true count of underlying relational child records.
 */
export async function verifyRepositoryStatsConsistency(
  repoId: string
): Promise<StatsConsistencyReport> {
  const repo = await db.repository.findUnique({
    where: { id: repoId },
  });

  if (!repo) {
    throw new Error(`Repository record not found: ${repoId}`);
  }

  const [
    actualFiles,
    actualModules,
    actualDeps,
    actualCommits,
    actualContribRecords,
    actualDevRecords,
    latestCommit,
  ] = await Promise.all([
    db.fileRecord.count({ where: { repoId } }),
    db.module.count({ where: { repoId } }),
    db.dependencyRecord.count({ where: { repoId } }),
    db.commitRecord.count({ where: { repoId } }),
    db.contributorRecord.count({ where: { repoId } }),
    db.developerRecord.count({ where: { repoId } }),
    db.commitRecord.findFirst({
      where: { repoId },
      orderBy: { committedAt: "desc" },
      select: { sha: true },
    }),
  ]);

  const expectedContributors =
    actualContribRecords > 0 ? actualContribRecords : actualDevRecords;

  const discrepancies: StatsConsistencyReport["discrepancies"] = {};

  if (repo.filesCount !== actualFiles) {
    discrepancies.filesCount = { stored: repo.filesCount, actual: actualFiles };
  }
  if (repo.modulesCount !== actualModules) {
    discrepancies.modulesCount = { stored: repo.modulesCount, actual: actualModules };
  }
  if (repo.depsCount !== actualDeps) {
    discrepancies.depsCount = { stored: repo.depsCount, actual: actualDeps };
  }
  if (repo.commitsCount !== actualCommits) {
    discrepancies.commitsCount = { stored: repo.commitsCount, actual: actualCommits };
  }
  if (repo.contributorsCount !== expectedContributors) {
    discrepancies.contributorsCount = {
      stored: repo.contributorsCount,
      actual: expectedContributors,
    };
  }
  if (repo.latestCommitSha !== (latestCommit?.sha ?? null)) {
    discrepancies.latestCommitSha = {
      stored: repo.latestCommitSha,
      actual: latestCommit?.sha ?? null,
    };
  }

  return {
    isConsistent: Object.keys(discrepancies).length === 0,
    repoId,
    discrepancies,
  };
}
