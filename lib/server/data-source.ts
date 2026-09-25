import "server-only";
import type { Repo } from "@/data/types";
import { getRepositories, getRepositoryByName } from "./repositories";

export interface IRepositoryDataSource {
  getRepositories(): Promise<Repo[]>;
  getActiveRepository(repoId?: string): Promise<Repo | null>;
}

export class RepositoryDataSource implements IRepositoryDataSource {
  async getRepositories(): Promise<Repo[]> {
    try {
      const dbRepos = await getRepositories();
      if (dbRepos && dbRepos.length > 0) {
        return dbRepos.map((r) => ({
          id: r.id,
          name: r.name,
          owner: r.owner,
          files: r.filesCount,
          filesCount: r.filesCount,
          modules: r.modulesCount,
          modulesCount: r.modulesCount,
          deps: r.depsCount,
          depsCount: r.depsCount,
          contributors: r.contributorsCount,
          contributorsCount: r.contributorsCount,
          branch: r.defaultBranch,
          defaultBranch: r.defaultBranch,
          branches: r.branches.map((b) => b.name),
          desc: `Repository ${r.owner}/${r.name}`,
          gitSyncStatus: r.gitSyncStatus,
          syncStatus: r.syncStatus,
          latestCommitSha: r.latestCommitSha,
          lastSyncedCommitSha: r.lastSyncedCommitSha,
          lastGitSyncAt: r.lastGitSyncAt ? r.lastGitSyncAt.toISOString() : null,
          lastSuccessfulSyncAt: r.lastSuccessfulSyncAt ? r.lastSuccessfulSyncAt.toISOString() : null,
          lastSyncSummary: r.lastSyncSummary,
          lastIndexedAt: r.lastIndexedAt ? r.lastIndexedAt.toISOString() : undefined,
        }));
      }
    } catch {
      // ignore error
    }
    return [];
  }

  async getActiveRepository(repoId?: string): Promise<Repo | null> {
    if (!repoId) {
      const all = await this.getRepositories();
      return all.length > 0 ? all[0] : null;
    }

    try {
      const dbRepo = await getRepositoryByName(repoId);
      if (dbRepo) {
        return {
          id: dbRepo.id,
          name: dbRepo.name,
          owner: dbRepo.owner,
          files: dbRepo.filesCount,
          filesCount: dbRepo.filesCount,
          modules: dbRepo.modulesCount,
          modulesCount: dbRepo.modulesCount,
          deps: dbRepo.depsCount,
          depsCount: dbRepo.depsCount,
          contributors: dbRepo.contributorsCount,
          contributorsCount: dbRepo.contributorsCount,
          branch: dbRepo.defaultBranch,
          defaultBranch: dbRepo.defaultBranch,
          branches: dbRepo.branches.map((b) => b.name),
          desc: `Repository ${dbRepo.owner}/${dbRepo.name}`,
          gitSyncStatus: dbRepo.gitSyncStatus,
          syncStatus: dbRepo.syncStatus,
          latestCommitSha: dbRepo.latestCommitSha,
          lastSyncedCommitSha: dbRepo.lastSyncedCommitSha,
          lastGitSyncAt: dbRepo.lastGitSyncAt ? dbRepo.lastGitSyncAt.toISOString() : null,
          lastSuccessfulSyncAt: dbRepo.lastSuccessfulSyncAt ? dbRepo.lastSuccessfulSyncAt.toISOString() : null,
          lastSyncSummary: dbRepo.lastSyncSummary,
          lastIndexedAt: dbRepo.lastIndexedAt ? dbRepo.lastIndexedAt.toISOString() : undefined,
        };
      }
    } catch {
      // ignore error
    }
    return null;
  }
}

export const repositoryDataSource = new RepositoryDataSource();
