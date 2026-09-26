import "server-only";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import {
  fetchRepoBranches,
  fetchRepoTree,
  fetchRawFileContent,
  fetchRepoCommits,
  fetchRepoContributors,
  getUserAccessToken,
} from "../github";
import { filterTreeItems } from "./tree";
import { analyzeSourceCode } from "./parser";
import { inferModulesFromPaths } from "./modules";
import {
  isDependencyManifest,
  parseManifestDependencies,
  resolveInternalModuleEdges,
} from "./dependencies";
import {
  buildRepoFileIndex,
  resolveFileDependency,
  syncRepositoryDependenciesBatch,
  generateDependencyKey,
  handleDeletedFiles,
  type BatchDependencyInput,
} from "./resolver";
import { runConcurrentPool } from "./concurrency";
import { ingestionProgressTracker } from "./progress";
import { ingestGitHistory } from "../git";
import { ingestContributors } from "../contributors";
import { syncRepositoryStats } from "../repositories/stats";
import { notifyRepoMembers, createNotification } from "../notifications";
import { detectIncrementalChanges, processIncrementalSync } from "../sync/incremental";

export interface IngestionParams {
  owner: string;
  repo: string;
  branch?: string;
  localPath?: string;
  user?: any;
  token?: string;
  targetCommitSha?: string;
  force?: boolean;
}

const INGESTION_CONCURRENCY = Math.max(
  1,
  Number(process.env.INGESTION_CONCURRENCY ?? 15)
);

export async function ingestRepository({
  owner,
  repo,
  branch,
  localPath,
  user: explicitUser,
  token,
  targetCommitSha,
  force = false,
}: IngestionParams) {
  let user = explicitUser;

  if (!user) {
    user = await getCurrentUser();
  }

  if (!user) {
    const existingRepo = await db.repository.findFirst({
      where: { OR: [{ id: repo }, { name: repo, owner }] },
      include: {
        project: {
          include: {
            org: {
              include: {
                members: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (existingRepo?.project?.org?.members?.[0]?.user) {
      user = {
        id: existingRepo.project.org.members[0].user.id,
        name: existingRepo.project.org.members[0].user.name,
        email: existingRepo.project.org.members[0].user.email,
        organization: existingRepo.project.org,
      };
    } else {
      user = {
        id: "system-sync",
        name: "DevMind Sync Worker",
        email: "worker@devmind.ai",
        organization: null,
      };
    }
  }

  const repoId = repo;
  const startedAt = new Date();

  // Resolve GitHub token ONCE for entire ingestion lifecycle.
  let resolvedToken = token;

  if (!resolvedToken && user?.id && user.id !== "system-sync") {
    try {
      resolvedToken = (await getUserAccessToken(user.id)) || undefined;
    } catch {
      resolvedToken = undefined;
    }
  }

  // Initialize progress state.
  ingestionProgressTracker.start(
    repoId,
    `Connecting to repository ${owner}/${repo}...`
  );

  // 1. Get or create Project in User's primary Organization.
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

  // 2. Check if repository is newly connected.
  const existingRepoBefore = await db.repository.findUnique({
    where: { id: repoId },
  });

  const isNewlyConnected = !existingRepoBefore;

  // Incremental ingestion fast path.
  if (
    !force &&
    existingRepoBefore &&
    existingRepoBefore.ingestionStatus === "COMPLETED" &&
    targetCommitSha &&
    existingRepoBefore.latestCommitSha === targetCommitSha
  ) {
    const repoStats = await syncRepositoryStats(repoId);
    ingestionProgressTracker.complete(repoId, repoStats.filesCount);

    return {
      success: true,
      repoId,
      filesCount: repoStats.filesCount,
      modulesCount: repoStats.modulesCount,
      depsCount: repoStats.depsCount,
      ignoredFilesCount: 0,
      gitSyncStatus: "COMPLETED",
      commitsCount: repoStats.commitsCount,
      contributorsCount: repoStats.contributorsCount,
      isIncremental: true,
      alreadyUpToDate: true,
    };
  }

  // Try incremental change detection if previous commit exists.
  if (
    !force &&
    existingRepoBefore &&
    existingRepoBefore.ingestionStatus === "COMPLETED" &&
    targetCommitSha &&
    existingRepoBefore.latestCommitSha &&
    existingRepoBefore.latestCommitSha !== targetCommitSha
  ) {
    try {
      const detection = await detectIncrementalChanges(
        repoId,
        existingRepoBefore.latestCommitSha,
        targetCommitSha,
        {
          branch: branch || existingRepoBefore.defaultBranch,
          token: resolvedToken,
        }
      );

      if (
        detection.canIncremental &&
        detection.changes.length > 0 &&
        detection.changes.length < 50
      ) {
        ingestionProgressTracker.update(repoId, {
          stage: "PARSING_FILES",
          totalFiles: detection.changes.length,
          processedFiles: 0,
          message: `Applying incremental update (${detection.changes.length} changed files)...`,
        });

        const syncResult = await processIncrementalSync(
          repoId,
          targetCommitSha,
          detection.changes,
          {
            branch: branch || existingRepoBefore.defaultBranch,
            token: resolvedToken,
          }
        );

        const repoStats = await syncRepositoryStats(repoId);
        ingestionProgressTracker.complete(repoId, repoStats.filesCount);

        return {
          success: true,
          repoId,
          filesCount: repoStats.filesCount,
          modulesCount: repoStats.modulesCount,
          depsCount: repoStats.depsCount,
          ignoredFilesCount: 0,
          gitSyncStatus: "COMPLETED",
          commitsCount: repoStats.commitsCount,
          contributorsCount: repoStats.contributorsCount,
          isIncremental: true,
          summary: syncResult.summary,
        };
      }
    } catch (incErr) {
      console.warn(
        "Incremental sync failed, safely falling back to full ingestion:",
        incErr
      );
    }
  }

  // Mark Repository status as INDEXING.
  const repository = await db.repository.upsert({
    where: { id: repoId },
    update: {
      ingestionStatus: "INDEXING",
      ingestionError: null,
      startedAt,
      owner,
      name: repo,
      defaultBranch: branch || "main",
      ...(localPath ? { localPath } : {}),
    },
    create: {
      id: repoId,
      projectId,
      name: repo,
      owner,
      defaultBranch: branch || "main",
      ingestionStatus: "INDEXING",
      startedAt,
      ...(localPath ? { localPath } : {}),
    },
  });

  if (isNewlyConnected && user?.id && user.id !== "system-sync") {
    try {
      await createNotification({
        userId: user.id,
        repoId: repository.id,
        orgId: org?.id,
        projectId,
        type: "REPO_CONNECTED",
        title: "Repository connected",
        message: `Connected ${owner}/${repo} to workspace.`,
        entityId: repository.id,
        link: `/app/overview?repoId=${encodeURIComponent(repository.id)}`,
        dedupeKey: `${user.id}:repo-connected:${repository.id}`,
      });
    } catch (notifErr) {
      console.warn(
        "Non-fatal: Failed to create REPO_CONNECTED notification:",
        notifErr
      );
    }
  }

  try {
    // 3. Fetch Branches.
    const branches = await fetchRepoBranches(owner, repo, resolvedToken);
    const activeBranch =
      branch || branches.find((b) => b.isDefault)?.name || "main";

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

    // 4. Fetch Repository Tree.
    ingestionProgressTracker.update(repoId, {
      stage: "FETCHING_TREE",
      message: "Scanning repository file tree & applying safety limits...",
    });

    const rawTreeItems = await fetchRepoTree(
      owner,
      repo,
      activeBranch,
      resolvedToken
    );

    const { validBlobs, ignoredCount } = filterTreeItems(rawTreeItems);

    // 5. Detect Modules from paths.
    const validPaths = validBlobs.map((b) => b.path);
    const validPathsSet = new Set(validPaths);
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

    await handleDeletedFiles(db, repository.id, validPathsSet);

    // Pre-fetch configuration files for path alias & package resolution.
    let tsconfigContent: string | null = null;
    let pubspecContent: string | null = null;
    let goModContent: string | null = null;

    if (validPathsSet.has("tsconfig.json")) {
      try {
        tsconfigContent = await fetchRawFileContent(
          owner,
          repo,
          "tsconfig.json",
          activeBranch,
          resolvedToken
        );
      } catch {}
    } else if (validPathsSet.has("jsconfig.json")) {
      try {
        tsconfigContent = await fetchRawFileContent(
          owner,
          repo,
          "jsconfig.json",
          activeBranch,
          resolvedToken
        );
      } catch {}
    }

    if (validPathsSet.has("pubspec.yaml")) {
      try {
        pubspecContent = await fetchRawFileContent(
          owner,
          repo,
          "pubspec.yaml",
          activeBranch,
          resolvedToken
        );
      } catch {}
    }

    if (validPathsSet.has("go.mod")) {
      try {
        goModContent = await fetchRawFileContent(
          owner,
          repo,
          "go.mod",
          activeBranch,
          resolvedToken
        );
      } catch {}
    }

    const repoFileIndex = buildRepoFileIndex(validPaths, {
      tsconfigContent,
      pubspecContent,
      goModContent,
    });

    // 6. Stage: PARSING_FILES with Controlled Concurrency.
    ingestionProgressTracker.update(repoId, {
      stage: "PARSING_FILES",
      processedFiles: 0,
      totalFiles: validBlobs.length,
      message: `Parsing source code & mapping dependencies (0/${validBlobs.length} files)`,
    });

    const fileImportsList: Array<{
      module: string;
      imports: string[];
    }> = [];

    const fileRecordsToUpsert: Array<{
      where: any;
      update: any;
      create: any;
    }> = [];

    const allCollectedDependencies: BatchDependencyInput[] = [];
    let totalLines = 0;
    let processedFilesCount = 0;

    await runConcurrentPool(
      validBlobs,
      INGESTION_CONCURRENCY,
      async (blob) => {
        const moduleId = pathToModuleMap.get(blob.path) ?? null;
        const sizeFormatted = `${((blob.size ?? 0) / 1024).toFixed(1)} KB`;

        try {
          const content = await fetchRawFileContent(
            owner,
            repo,
            blob.path,
            activeBranch,
            resolvedToken
          );

          const analysis = analyzeSourceCode(blob.path, content);
          totalLines += analysis.lineCount;

          // Resolve File-Level Dependencies in memory.
          if (analysis.parsedFileResult.imports.length > 0) {
            for (const imp of analysis.parsedFileResult.imports) {
              const resolved = resolveFileDependency(
                blob.path,
                imp,
                analysis.languageInfo.id,
                repoFileIndex,
                repository.id
              );

              allCollectedDependencies.push({
                key: resolved.key,
                repoId: repository.id,
                sourceFile: resolved.sourceFile,
                targetFile: resolved.targetFile,
                importSource: resolved.importSource,
                dependencyType: resolved.dependencyType,
                kind: resolved.kind,
                language: resolved.language,
                resolutionStatus: resolved.resolutionStatus,
                name: resolved.name,
                version: resolved.version,
                purpose: resolved.purpose,
                status: "active",
              });
            }
          }

          // Multi-language manifest parsing in memory.
          if (isDependencyManifest(blob.path)) {
            const manifestDeps = parseManifestDependencies(
              blob.path,
              content
            );

            const normManifest = blob.path.replace(/\\/g, "/");

            for (const mDep of manifestDeps) {
              if (mDep.name) {
                const key = generateDependencyKey(
                  repository.id,
                  normManifest,
                  mDep.name,
                  "manifest"
                );

                allCollectedDependencies.push({
                  key,
                  repoId: repository.id,
                  sourceFile: normManifest,
                  targetFile: null,
                  importSource: mDep.name,
                  dependencyType: "manifest",
                  kind: "external",
                  resolutionStatus: "RESOLVED_EXTERNAL",
                  name: mDep.name,
                  version: mDep.version || "*",
                  purpose: mDep.purpose || "Manifest dependency",
                  status: "active",
                });
              }
            }
          }

          if (moduleId && analysis.imports.length > 0) {
            fileImportsList.push({
              module: moduleId,
              imports: analysis.imports,
            });
          }

          const symbolsJson = JSON.stringify(analysis.parsedFileResult);

          fileRecordsToUpsert.push({
            where: {
              repoId_path: {
                repoId: repository.id,
                path: blob.path,
              },
            },
            update: {
              moduleId,
              size: sizeFormatted,
              language: analysis.languageInfo.name,
              parsingStatus: analysis.parsedFileResult.parsingStatus,
              parsingError: analysis.parsingError || null,
              lineCount: analysis.lineCount,
              symbolsJson,
              updatedText: "Just now",
            },
            create: {
              repoId: repository.id,
              moduleId,
              path: blob.path,
              size: sizeFormatted,
              type: analysis.languageInfo.category,
              language: analysis.languageInfo.name,
              parsingStatus: analysis.parsedFileResult.parsingStatus,
              parsingError: analysis.parsingError || null,
              lineCount: analysis.lineCount,
              symbolsJson,
              updatedText: "Just now",
            },
          });
        } catch (fileError) {
          const errorMsg =
            fileError instanceof Error
              ? fileError.message
              : "Failed to ingest file";

          console.error(
            `Failed to ingest file ${blob.path}:`,
            fileError
          );

          fileRecordsToUpsert.push({
            where: {
              repoId_path: {
                repoId: repository.id,
                path: blob.path,
              },
            },
            update: {
              moduleId,
              size: sizeFormatted,
              language: "Unknown",
              parsingStatus: "FAILED",
              parsingError: errorMsg,
              updatedText: "Failed",
            },
            create: {
              repoId: repository.id,
              moduleId,
              path: blob.path,
              size: sizeFormatted,
              type: "other",
              language: "Unknown",
              parsingStatus: "FAILED",
              parsingError: errorMsg,
              updatedText: "Failed",
            },
          });
        } finally {
          processedFilesCount++;

          ingestionProgressTracker.update(repoId, {
            stage: "PARSING_FILES",
            processedFiles: processedFilesCount,
            totalFiles: validBlobs.length,
            currentFile: blob.path,
            message: `Parsing source files (${processedFilesCount}/${validBlobs.length})`,
          });
        }
      }
    );

    // 7. Stage: RESOLVING_DEPENDENCIES & Batch Database Writes.
    ingestionProgressTracker.update(repoId, {
      stage: "RESOLVING_DEPENDENCIES",
      message:
        "Persisting file records and linking dependency graph in database...",
    });

    // Batch persist FileRecords in chunked transactions.
    const FILE_TX_CHUNK = 50;

    for (
      let i = 0;
      i < fileRecordsToUpsert.length;
      i += FILE_TX_CHUNK
    ) {
      const chunk = fileRecordsToUpsert.slice(i, i + FILE_TX_CHUNK);

      await db.$transaction(
        chunk.map((item) => db.fileRecord.upsert(item))
      );
    }

    // Process Internal Module Edges.
    const moduleEdges = resolveInternalModuleEdges(
      fileImportsList,
      pathToModuleMap
    );

    for (const edge of moduleEdges) {
      if (edge.fromModule && edge.toModule) {
        const key = generateDependencyKey(
          repository.id,
          "module",
          `${edge.fromModule}->${edge.toModule}`,
          "module_edge"
        );

        allCollectedDependencies.push({
          key,
          repoId: repository.id,
          fromModule: edge.fromModule,
          toModule: edge.toModule,
          kind: "internal",
          dependencyType: "module_edge",
          resolutionStatus: "RESOLVED_INTERNAL",
          status: "active",
        });
      }
    }

    // Batch persist all dependencies.
    await syncRepositoryDependenciesBatch(
      db,
      repository.id,
      allCollectedDependencies
    );

    const totalDepsCount = await db.dependencyRecord.count({
      where: { repoId: repository.id },
    });

    // 8. Stage: SYNCING_GIT.
    ingestionProgressTracker.update(repoId, {
      stage: "SYNCING_GIT",
      message: "Extracting contributors & commit history from GitHub...",
    });

    let contributorsCount = 0;

    try {
      const contributors = await fetchRepoContributors(
        owner,
        repo,
        20,
        resolvedToken
      );

      if (contributors.length > 0) {
        contributorsCount = contributors.length;

        const colorPalette = [
          "#C8D62B",
          "#4A90E2",
          "#9B51E0",
          "#E67E22",
          "#2ECC71",
          "#E74C3C",
          "#1ABC9C",
        ];

        const totalContributions = contributors.reduce(
          (acc, c) => acc + (c.contributions || 1),
          0
        );

        for (let i = 0; i < contributors.length; i++) {
          const contrib = contributors[i];
          const color = colorPalette[i % colorPalette.length];

          const coveragePercent = Math.min(
            100,
            Math.max(
              10,
              Math.round(
                ((contrib.contributions || 1) / totalContributions) * 100
              )
            )
          );

          await db.developerRecord.upsert({
            where: { id: `dev-${contrib.id}` },
            update: {
              name: contrib.login,
              coverage: coveragePercent,
              blurb: `${contrib.contributions} contributions to ${repo}`,
            },
            create: {
              id: `dev-${contrib.id}`,
              repoId: repository.id,
              name: contrib.login,
              role: i === 0 ? "Lead Contributor" : "Contributor",
              color,
              coverage: coveragePercent,
              blurb: `${contrib.contributions} contributions to ${repo}`,
              recentContribution: `Committed code to ${activeBranch}`,
            },
          });
        }
      }
    } catch (contribError) {
      console.warn(
        `Non-fatal warning: Failed to fetch contributors for ${owner}/${repo}:`,
        contribError
      );
    }

    try {
      const commits = await fetchRepoCommits(
        owner,
        repo,
        activeBranch,
        15,
        resolvedToken
      );

      for (const commit of commits) {
        await db.activityRecord.create({
          data: {
            repoId: repository.id,
            text: commit.message,
            byUser: commit.authorName,
            category: "git",
            icon: "git",
            timestampText: formatRelativeDate(commit.authorDate),
          },
        });
      }
    } catch (commitsError) {
      console.warn(
        `Non-fatal warning: Failed to fetch commits for ${owner}/${repo}:`,
        commitsError
      );
    }

    // Record Indexing Summary Activity Event.
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

    // 9. Ingest Real Git History.
    const effectiveLocalPath = localPath || repository.localPath;
    let gitSyncResult = null;

    if (effectiveLocalPath) {
      try {
        gitSyncResult = await ingestGitHistory(
          repository.id,
          effectiveLocalPath,
          {
            branch: activeBranch,
          }
        );
      } catch (gitErr) {
        console.warn(
          `Non-fatal warning: Git history ingestion failed for ${repository.id}:`,
          gitErr
        );
      }
    }

    // 10. Ingest Contributors from Git History.
    let contributorSyncResult = null;

    try {
      contributorSyncResult = await ingestContributors(repository.id);
    } catch (contribErr) {
      console.warn(
        `Non-fatal warning: Contributor ingestion failed for ${repository.id}:`,
        contribErr
      );
    }

    // 11. Stage: FINALIZING.
    ingestionProgressTracker.update(repoId, {
      stage: "FINALIZING",
      message:
        "Finalizing repository context & synchronizing statistics...",
    });

    const completedAt = new Date();
    const repoStats = await syncRepositoryStats(repository.id);

    const finalCommitSha =
      targetCommitSha ||
      gitSyncResult?.latestCommitSha ||
      repoStats.latestCommitSha;

    await db.repository.update({
      where: { id: repository.id },
      data: {
        ingestionStatus: "COMPLETED",
        gitSyncStatus: "COMPLETED",
        syncStatus: "COMPLETED",
        gitSyncError: null,
        syncError: null,
        lastIndexedAt: completedAt,
        completedAt,
        lastGitSyncAt: completedAt,
        lastSuccessfulSyncAt: completedAt,
        latestCommitSha: finalCommitSha,
        lastSyncedCommitSha: finalCommitSha,
        lastSyncSummary: `Full sync completed (${repoStats.filesCount} files, ${repoStats.modulesCount} modules)`,
      },
    });

    // Create Ingestion Completed Notification.
    try {
      await notifyRepoMembers(repository.id, {
        type: "INGESTION_COMPLETED",
        title: "Repository ingestion completed",
        message: `Repository ${owner}/${repo} indexed successfully (${repoStats.filesCount} files, ${repoStats.modulesCount} modules).`,
        entityId: repository.id,
        link: `/app/overview?repoId=${encodeURIComponent(repository.id)}`,
        dedupeKey: `ingestion-completed:${
          repository.id
        }:${finalCommitSha || completedAt.getTime()}`,
        targetUserId:
          user?.id && user.id !== "system-sync"
            ? user.id
            : undefined,
      });
    } catch (notifErr) {
      console.warn(
        "Non-fatal: Failed to create INGESTION_COMPLETED notification:",
        notifErr
      );
    }

    ingestionProgressTracker.complete(repoId, repoStats.filesCount);

    return {
      success: true,
      repoId: repository.id,
      filesCount: repoStats.filesCount,
      modulesCount: repoStats.modulesCount,
      depsCount: repoStats.depsCount,
      ignoredFilesCount: ignoredCount,
      gitSyncStatus: "COMPLETED",
      commitsCount: repoStats.commitsCount,
      contributorsCount: repoStats.contributorsCount,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Ingestion failed";

    console.error(
      `Repository ingestion error for ${owner}/${repo}:`,
      error
    );

    ingestionProgressTracker.fail(repoId, errorMsg);

    await db.repository.update({
      where: { id: repository.id },
      data: {
        ingestionStatus: "FAILED",
        ingestionError: errorMsg,
        completedAt: new Date(),
      },
    });

    // Create Ingestion Failed Notification.
    try {
      await notifyRepoMembers(repository.id, {
        type: "INGESTION_FAILED",
        title: "Repository ingestion failed",
        message: `Failed to index repository ${owner}/${repo}: ${errorMsg}`,
        entityId: repository.id,
        link: `/app/overview?repoId=${encodeURIComponent(repository.id)}`,
        dedupeKey: `ingestion-failed:${repository.id}:${Date.now()}`,
        targetUserId:
          user?.id && user.id !== "system-sync"
            ? user.id
            : undefined,
      });
    } catch (notifErr) {
      console.warn(
        "Non-fatal: Failed to create INGESTION_FAILED notification:",
        notifErr
      );
    }

    throw error;
  }
}

function formatRelativeDate(isoDate: string): string {
  try {
    const diffMs = Date.now() - new Date(isoDate).getTime();

    if (isNaN(diffMs)) return "Recently";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 1) return "1 day ago";
    if (diffDays < 30) return `${diffDays} days ago`;

    return new Date(isoDate).toLocaleDateString();
  } catch {
    return "Recently";
  }
}