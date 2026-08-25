import "server-only";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { fetchRepoBranches, fetchRepoTree, fetchRawFileContent } from "../github";
import { filterTreeItems } from "./tree";
import { analyzeSourceCode } from "./parser";
import { inferModulesFromPaths } from "./modules";
import { parsePackageJsonDependencies, resolveInternalModuleEdges } from "./dependencies";

export interface IngestionParams {
  owner: string;
  repo: string;
  branch?: string;
}

export async function ingestRepository({ owner, repo, branch }: IngestionParams) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthenticated: User must be signed in to ingest repositories");
  }

  const repoId = repo;
  const startedAt = new Date();

  // 1. Get or create Project in User's primary Organization
  const org = user.organization;
  let projectId = "proj-clinic-management";

  if (org) {
    const dbProject = await db.project.findFirst({
      where: { orgId: org.id },
    });

    if (dbProject) {
      projectId = dbProject.id;
    } else {
      const newProj = await db.project.create({
        data: {
          orgId: org.id,
          name: `${repo} Project`,
          slug: `${repo.toLowerCase()}-proj`,
        },
      });
      projectId = newProj.id;
    }
  }

  // 2. Mark Repository status as INDEXING
  const repository = await db.repository.upsert({
    where: { id: repoId },
    update: {
      ingestionStatus: "INDEXING",
      ingestionError: null,
      startedAt,
      owner,
      name: repo,
      defaultBranch: branch || "main",
    },
    create: {
      id: repoId,
      projectId,
      name: repo,
      owner,
      defaultBranch: branch || "main",
      ingestionStatus: "INDEXING",
      startedAt,
    },
  });

  try {
    // 3. Fetch Branches
    const branches = await fetchRepoBranches(owner, repo);
    const activeBranch = branch || branches.find((b) => b.isDefault)?.name || "main";

    for (const b of branches) {
      await db.branch.upsert({
        where: {
          repoId_name: {
            repoId: repository.id,
            name: b.name,
          },
        },
        update: { isDefault: b.isDefault },
        create: {
          repoId: repository.id,
          name: b.name,
          isDefault: b.isDefault,
        },
      });
    }

    // 4. Fetch Repository Tree
    const rawTreeItems = await fetchRepoTree(owner, repo, activeBranch);
    const { validBlobs, ignoredCount } = filterTreeItems(rawTreeItems);

    // 5. Detect Modules from paths
    const validPaths = validBlobs.map((b) => b.path);
    const inferredModules = inferModulesFromPaths(validPaths);
    const pathToModuleMap = new Map<string, string>();

    for (const m of inferredModules) {
      await db.module.upsert({
        where: { id: m.id },
        update: {
          name: m.name,
          type: m.type,
          desc: m.desc,
          filesCount: m.filePaths.length,
        },
        create: {
          id: m.id,
          repoId: repository.id,
          name: m.name,
          type: m.type,
          desc: m.desc,
          filesCount: m.filePaths.length,
        },
      });

      for (const p of m.filePaths) {
        pathToModuleMap.set(p, m.id);
      }
    }

    // 6. Process Source Files
    const fileImportsList: Array<{ module: string; imports: string[] }> = [];
    let packageJsonContent: string | null = null;
    let totalLines = 0;

    for (const blob of validBlobs) {
      const content = await fetchRawFileContent(owner, repo, blob.path, activeBranch);
      const analysis = analyzeSourceCode(blob.path, content);
      const moduleId = pathToModuleMap.get(blob.path) ?? null;
      totalLines += analysis.lineCount;

      if (blob.path === "package.json") {
        packageJsonContent = content;
      }

      if (moduleId && analysis.imports.length > 0) {
        fileImportsList.push({ module: moduleId, imports: analysis.imports });
      }

      const sizeFormatted = `${(blob.size ?? 0 / 1024).toFixed(1)} KB`;

      await db.fileRecord.upsert({
        where: {
          repoId_path: {
            repoId: repository.id,
            path: blob.path,
          },
        },
        update: {
          moduleId,
          size: sizeFormatted,
          updatedText: "Just now",
        },
        create: {
          repoId: repository.id,
          moduleId,
          path: blob.path,
          size: sizeFormatted,
          type: "code",
          updatedText: "Just now",
        },
      });
    }

    // 7. Process Dependencies
    const dependenciesList = [
      ...(packageJsonContent ? parsePackageJsonDependencies(packageJsonContent) : []),
      ...resolveInternalModuleEdges(fileImportsList, pathToModuleMap),
    ];

    for (const dep of dependenciesList) {
      await db.dependencyRecord.create({
        data: {
          repoId: repository.id,
          kind: dep.kind,
          fromModule: dep.fromModule,
          toModule: dep.toModule,
          name: dep.name,
          version: dep.version,
          purpose: dep.purpose,
          status: dep.status,
        },
      });
    }

    // 8. Record Activity Event
    await db.activityRecord.create({
      data: {
        repoId: repository.id,
        text: `Indexed ${validBlobs.length} files across ${inferredModules.length} modules (${totalLines} lines)`,
        byUser: user.name,
        category: "git",
        icon: "spark",
        timestampText: "Just now",
      },
    });

    // 9. Update Repository status to COMPLETED
    const completedAt = new Date();
    await db.repository.update({
      where: { id: repository.id },
      data: {
        ingestionStatus: "COMPLETED",
        filesCount: validBlobs.length,
        modulesCount: inferredModules.length,
        depsCount: dependenciesList.length,
        lastIndexedAt: completedAt,
        completedAt,
      },
    });

    return {
      success: true,
      repoId: repository.id,
      filesCount: validBlobs.length,
      modulesCount: inferredModules.length,
      ignoredFilesCount: ignoredCount,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Ingestion failed";
    console.error(`Repository ingestion error for ${owner}/${repo}:`, error);

    await db.repository.update({
      where: { id: repository.id },
      data: {
        ingestionStatus: "FAILED",
        ingestionError: errorMsg,
        completedAt: new Date(),
      },
    });

    throw error;
  }
}
