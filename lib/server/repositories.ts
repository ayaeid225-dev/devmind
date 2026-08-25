import "server-only";
import { db } from "./db";

export async function getRepositories() {
  try {
    return await db.repository.findMany({
      include: {
        branches: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch repositories from database:", error);
    return [];
  }
}

export async function getRepositoryByName(name: string) {
  try {
    return await db.repository.findFirst({
      where: { name },
      include: {
        branches: true,
        modules: true,
        developerRecords: true,
      },
    });
  } catch (error) {
    console.error(`Failed to fetch repository "${name}":`, error);
    return null;
  }
}

export async function getRepositoryBranches(repoId: string) {
  try {
    return await db.branch.findMany({
      where: { repoId },
      orderBy: { isDefault: "desc" },
    });
  } catch (error) {
    console.error(`Failed to fetch branches for repo ${repoId}:`, error);
    return [];
  }
}
