import "server-only";
import { REPO, REPOS } from "@/data/fixtures";
import type { Repo } from "@/data/types";
import { getRepositories, getRepositoryByName } from "./repositories";

export interface IRepositoryDataSource {
  getRepositories(): Promise<Repo[]>;
  getActiveRepository(): Promise<Repo>;
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
          desc: r.name,
        }));
      }
    } catch {
      // Fallback to fixtures silently
    }
    return REPOS;
  }

  async getActiveRepository(): Promise<Repo> {
    try {
      const dbRepo = await getRepositoryByName(REPO.name);
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
          desc: dbRepo.name,
        };
      }
    } catch {
      // Fallback to fixture
    }
    return REPO;
  }
}

export const repositoryDataSource = new RepositoryDataSource();
