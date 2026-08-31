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
          name: r.name,
          owner: r.owner,
          files: r.filesCount,
          modules: r.modulesCount,
          deps: r.depsCount,
          contributors: r.contributorsCount,
          branch: r.defaultBranch,
          branches: r.branches.map((b) => b.name),
          desc: `Repository ${r.owner}/${r.name}`,
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
          name: dbRepo.name,
          owner: dbRepo.owner,
          files: dbRepo.filesCount,
          modules: dbRepo.modulesCount,
          deps: dbRepo.depsCount,
          contributors: dbRepo.contributorsCount,
          branch: dbRepo.defaultBranch,
          branches: dbRepo.branches.map((b) => b.name),
          desc: `Repository ${dbRepo.owner}/${dbRepo.name}`,
        };
      }
    } catch {
      // ignore error
    }
    return null;
  }
}

export const repositoryDataSource = new RepositoryDataSource();
