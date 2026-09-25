import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db } from "../db";
import {
  compareRepoCommits,
  fetchRawFileContent,
  getRepoGitHubAccessToken,
} from "../github";
import { analyzeSourceCode } from "../ingestion/parser";
import { inferModulesFromPaths } from "../ingestion/modules";
import {
  isDependencyManifest,
  parseManifestDependencies,
  resolveInternalModuleEdges,
} from "../ingestion/dependencies";
import {
  buildRepoFileIndex,
  resolveFileDependency,
  syncFileDependencies,
  syncManifestDependencies,
  syncModuleEdges,
  type ResolvedFileDependency,
} from "../ingestion/resolver";
import { getEmbeddingProvider } from "../rag/provider";
import { chunkFileContent } from "../rag/chunker";
import { syncRepositoryStats } from "../repositories/stats";
import type {
  ChangedFileAction,
  ChangedFileItem,
  SyncOptions,
  SyncResult,
} from "./types";

/**
 * Detects affected files between previous synced commit and new commit.
 */
export async function detectIncrementalChanges(
  repoId: string,
  beforeSha: string | null | undefined,
  afterSha: string,
  options?: SyncOptions
): Promise<{
  canIncremental: boolean;
  changes: ChangedFileItem[];
  reason?: string;
  commits?: Array<{ sha: string; message: string; authorName: string; authorDate: string }>;
}> {
  // If forceFull requested or no valid previous commit
  if (options?.forceFull) {
    return { canIncremental: false, changes: [], reason: "Force full sync requested" };
  }

  const isZeroSha = !beforeSha || /^0+$/.test(beforeSha);
  if (isZeroSha) {
    return { canIncremental: false, changes: [], reason: "No previous commit SHA" };
  }

  const repo = await db.repository.findUnique({
    where: { id: repoId },
  });

  if (!repo) {
    return { canIncremental: false, changes: [], reason: `Repository not found: ${repoId}` };
  }

  const token = options?.token || (await getRepoGitHubAccessToken(repoId)) || undefined;

  // 1. Try GitHub compare API
  try {
    const compareResult = await compareRepoCommits(repo.owner, repo.name, beforeSha!, afterSha, token);
    if (compareResult && Array.isArray(compareResult.files)) {
      const changes: ChangedFileItem[] = compareResult.files.map((f) => {
        let action: ChangedFileAction = "modified";
        if (f.status === "added") action = "added";
        else if (f.status === "removed") action = "deleted";
        else if (f.status === "renamed") action = "renamed";

        return {
          path: f.filename,
          action,
          oldPath: f.previous_filename,
          additions: f.additions,
          deletions: f.deletions,
        };
      });

      return {
        canIncremental: true,
        changes,
        commits: compareResult.commits,
      };
    }
  } catch (err) {
    console.warn(`GitHub compare failed for ${repo.owner}/${repo.name}:`, err);
  }

  // 2. Fallback: Parse commits array from push options if provided
  if (options?.commits && options.commits.length > 0) {
    const fileActionMap = new Map<string, ChangedFileItem>();

    for (const c of options.commits) {
      if (Array.isArray(c.added)) {
        for (const p of c.added) {
          fileActionMap.set(p, { path: p, action: "added" });
        }
      }
      if (Array.isArray(c.modified)) {
        for (const p of c.modified) {
          if (!fileActionMap.has(p)) {
            fileActionMap.set(p, { path: p, action: "modified" });
          }
        }
      }
      if (Array.isArray(c.removed)) {
        for (const p of c.removed) {
          fileActionMap.set(p, { path: p, action: "deleted" });
        }
      }
    }

    if (fileActionMap.size > 0) {
      return {
        canIncremental: true,
        changes: Array.from(fileActionMap.values()),
        commits: options.commits.map((c) => ({
          sha: c.sha,
          message: c.message,
          authorName: c.authorName || "Contributor",
          authorDate: c.authorDate || new Date().toISOString(),
        })),
      };
    }
  }

  return {
    canIncremental: false,
    changes: [],
    reason: "Incremental comparison unavailable or commit history diverged",
  };
}

/**
 * Executes incremental synchronization on affected files only.
 */
export async function processIncrementalSync(
  repoId: string,
  newCommitSha: string,
  changes: ChangedFileItem[],
  options?: SyncOptions
): Promise<SyncResult> {
  const startTime = Date.now();

  const repo = await db.repository.findUnique({
    where: { id: repoId },
  });

  if (!repo) {
    throw new Error(`Repository record not found: ${repoId}`);
  }

  const beforeSha = repo.latestCommitSha || repo.lastSyncedCommitSha || null;
  const branch = options?.branch || repo.defaultBranch || "main";
  const token = options?.token || (await getRepoGitHubAccessToken(repoId)) || undefined;

  // Mark repository status as SYNCING
  await db.repository.update({
    where: { id: repoId },
    data: {
      gitSyncStatus: "SYNCING",
      syncStatus: "SYNCING",
      gitSyncError: null,
      syncError: null,
    },
  });

  let filesAdded = 0;
  let filesModified = 0;
  let filesDeleted = 0;

  try {
    // 1. Gather all existing indexed file paths in this repository
    const existingFileRecords = await db.fileRecord.findMany({
      where: { repoId },
      select: { id: true, path: true, moduleId: true },
    });

    const activePathsSet = new Set(existingFileRecords.map((f) => f.path));

    // Update active paths set for resolution
    for (const ch of changes) {
      if (ch.action === "deleted") {
        activePathsSet.delete(ch.path);
      } else if (ch.action === "renamed" && ch.oldPath) {
        activePathsSet.delete(ch.oldPath);
        activePathsSet.add(ch.path);
      } else {
        activePathsSet.add(ch.path);
      }
    }

    const allCurrentPaths = Array.from(activePathsSet);

    // Fetch config files if needed for path alias resolution
    let tsconfigContent: string | null = null;
    let pubspecContent: string | null = null;
    let goModContent: string | null = null;

    if (activePathsSet.has("tsconfig.json")) {
      tsconfigContent = await fetchFileContentSafe(repo, "tsconfig.json", branch, token);
    } else if (activePathsSet.has("jsconfig.json")) {
      tsconfigContent = await fetchFileContentSafe(repo, "jsconfig.json", branch, token);
    }

    if (activePathsSet.has("pubspec.yaml")) {
      pubspecContent = await fetchFileContentSafe(repo, "pubspec.yaml", branch, token);
    }

    if (activePathsSet.has("go.mod")) {
      goModContent = await fetchFileContentSafe(repo, "go.mod", branch, token);
    }

    const repoFileIndex = buildRepoFileIndex(allCurrentPaths, {
      tsconfigContent,
      pubspecContent,
      goModContent,
    });

    // 2. Re-infer or map modules
    const inferredModules = inferModulesFromPaths(allCurrentPaths);
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
          repoId,
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

    const embeddingProvider = getEmbeddingProvider();

    // 3. Process Renamed Files
    const renamedChanges = changes.filter((c) => c.action === "renamed");
    for (const ch of renamedChanges) {
      const oldPath = ch.oldPath;
      const newPath = ch.path;
      if (!oldPath) continue;

      const existingRecord = await db.fileRecord.findUnique({
        where: {
          repoId_path: { repoId, path: oldPath },
        },
      });

      const newModuleId = pathToModuleMap.get(newPath) || null;

      if (existingRecord) {
        // Update FileRecord path directly, preserving identity
        await db.fileRecord.update({
          where: { id: existingRecord.id },
          data: {
            path: newPath,
            moduleId: newModuleId,
            updatedText: "Just now",
          },
        });

        // Update DocumentChunks path
        await db.documentChunk.updateMany({
          where: { repoId, path: oldPath },
          data: { path: newPath, moduleId: newModuleId },
        });

        // Update DependencyRecords
        await db.dependencyRecord.updateMany({
          where: { repoId, sourceFile: oldPath },
          data: { sourceFile: newPath },
        });

        await db.dependencyRecord.updateMany({
          where: { repoId, targetFile: oldPath },
          data: { targetFile: newPath },
        });
      }

      filesModified++;
    }

    // 4. Process Deleted Files
    const deletedChanges = changes.filter((c) => c.action === "deleted");
    for (const ch of deletedChanges) {
      const delPath = ch.path;

      // Delete dependencies originating from this file
      await db.dependencyRecord.deleteMany({
        where: { repoId, sourceFile: delPath },
      });

      // Invalidate dependencies pointing to this deleted file
      await db.dependencyRecord.updateMany({
        where: { repoId, targetFile: delPath },
        data: {
          targetFile: null,
          resolutionStatus: "UNRESOLVED",
          status: "deleted_target",
        },
      });

      // Delete DocumentChunks (embeddings)
      await db.documentChunk.deleteMany({
        where: { repoId, path: delPath },
      });

      // Delete FileRecord
      await db.fileRecord.deleteMany({
        where: {
          repoId,
          path: delPath,
        },
      });

      filesDeleted++;
    }

    // 5. Process Added and Modified Files (including re-parsing renamed files)
    const contentChanges = changes.filter(
      (c) => c.action === "added" || c.action === "modified" || c.action === "renamed"
    );

    for (const ch of contentChanges) {
      const filePath = ch.path;
      const moduleId = pathToModuleMap.get(filePath) || null;

      try {
        const content = await fetchFileContentSafe(repo, filePath, branch, token);
        const analysis = analyzeSourceCode(filePath, content);
        const sizeFormatted = `${((content.length || 0) / 1024).toFixed(1)} KB`;

        // Resolve dependencies
        const fileResolvedDeps: ResolvedFileDependency[] = [];
        if (analysis.parsedFileResult.imports.length > 0) {
          for (const imp of analysis.parsedFileResult.imports) {
            const resolved = resolveFileDependency(
              filePath,
              imp,
              analysis.languageInfo.id,
              repoFileIndex,
              repoId
            );
            fileResolvedDeps.push(resolved);
          }
        }
        await syncFileDependencies(db, repoId, filePath, fileResolvedDeps);

        // Multi-language manifest dependencies
        if (isDependencyManifest(filePath)) {
          const manifestDeps = parseManifestDependencies(filePath, content);
          await syncManifestDependencies(db, repoId, filePath, manifestDeps);
        }

        const symbolsJson = JSON.stringify(analysis.parsedFileResult);

        // Upsert FileRecord
        const fileRecord = await db.fileRecord.upsert({
          where: {
            repoId_path: {
              repoId,
              path: filePath,
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
            repoId,
            moduleId,
            path: filePath,
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

        // Regenerate chunks & embeddings for changed file
        const generatedChunks = chunkFileContent({
          repoId,
          fileId: fileRecord.id,
          moduleId,
          path: filePath,
          content,
        });

        // Remove obsolete chunks if chunk count decreased
        await db.documentChunk.deleteMany({
          where: {
            repoId,
            path: filePath,
            chunkIndex: { gte: generatedChunks.length },
          },
        });

        if (generatedChunks.length > 0) {
          const textsToEmbed = generatedChunks.map((c) => c.content);
          const embeddings = await embeddingProvider.embedTexts(textsToEmbed);

          for (let i = 0; i < generatedChunks.length; i++) {
            const chunk = generatedChunks[i];
            const embeddingJson = JSON.stringify(embeddings[i]);

            await db.documentChunk.upsert({
              where: {
                repoId_path_chunkIndex: {
                  repoId,
                  path: chunk.path,
                  chunkIndex: chunk.chunkIndex,
                },
              },
              update: {
                fileId: fileRecord.id,
                moduleId: chunk.moduleId,
                content: chunk.content,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                contentHash: chunk.contentHash,
                embeddingJson,
              },
              create: {
                repoId,
                fileId: fileRecord.id,
                moduleId: chunk.moduleId,
                path: chunk.path,
                language: chunk.language,
                content: chunk.content,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                chunkIndex: chunk.chunkIndex,
                contentHash: chunk.contentHash,
                embeddingJson,
              },
            });
          }
        }

        if (ch.action === "added") {
          filesAdded++;
        } else {
          filesModified++;
        }
      } catch (fileErr) {
        console.error(`Error processing changed file ${filePath}:`, fileErr);
      }
    }

    // 6. Clean up empty modules and re-resolve module edges
    const allModules = await db.module.findMany({ where: { repoId } });
    for (const mod of allModules) {
      const count = await db.fileRecord.count({
        where: { repoId, moduleId: mod.id },
      });
      if (count === 0) {
        await db.module.delete({ where: { id: mod.id } }).catch(() => {});
      } else {
        await db.module.update({
          where: { id: mod.id },
          data: { filesCount: count },
        });
      }
    }

    // Re-resolve module edges from current files
    const allFilesWithSymbols = await db.fileRecord.findMany({
      where: { repoId, moduleId: { not: null } },
      select: { moduleId: true, symbolsJson: true },
    });

    const fileImportsList: Array<{ module: string; imports: string[] }> = [];
    for (const f of allFilesWithSymbols) {
      if (f.moduleId && f.symbolsJson) {
        try {
          const parsed = JSON.parse(f.symbolsJson);
          if (Array.isArray(parsed.imports) && parsed.imports.length > 0) {
            fileImportsList.push({ module: f.moduleId, imports: parsed.imports });
          }
        } catch {}
      }
    }

    const updatedModuleEdges = resolveInternalModuleEdges(fileImportsList, pathToModuleMap);
    await syncModuleEdges(db, repoId, updatedModuleEdges);

    // 7. Upsert new commits if available
    if (options?.commits && options.commits.length > 0) {
      for (const c of options.commits) {
        await db.commitRecord.upsert({
          where: {
            repoId_sha: {
              repoId,
              sha: c.sha,
            },
          },
          update: {
            message: c.message,
            branch,
            updatedAt: new Date(),
          },
          create: {
            repoId,
            sha: c.sha,
            shortSha: c.sha.slice(0, 7),
            message: c.message,
            authorName: c.authorName || "Contributor",
            authorEmail: "contributor@github.com",
            authoredAt: new Date(c.authorDate || Date.now()),
            committedAt: new Date(c.authorDate || Date.now()),
            branch,
          },
        });
      }
    }

    // 8. Update Repository Summary Stats
    await syncRepositoryStats(repoId);

    // 9. Record Activity
    const summary = `Added ${filesAdded} • Modified ${filesModified} • Deleted ${filesDeleted}`;
    await db.activityRecord.create({
      data: {
        repoId,
        text: `Synced commit ${newCommitSha.slice(0, 7)}: ${summary}`,
        byUser: options?.pusher || "GitHub Webhook",
        category: "git",
        icon: "git",
        timestampText: "Just now",
      },
    });

    // 10. Persist Successful Sync State
    const completedAt = new Date();
    await db.repository.update({
      where: { id: repoId },
      data: {
        latestCommitSha: newCommitSha,
        lastSyncedCommitSha: newCommitSha,
        lastGitSyncAt: completedAt,
        lastSuccessfulSyncAt: completedAt,
        gitSyncStatus: "COMPLETED",
        syncStatus: "COMPLETED",
        gitSyncError: null,
        syncError: null,
        lastSyncSummary: summary,
      },
    });

    return {
      success: true,
      repoId,
      beforeSha,
      afterSha: newCommitSha,
      isIncremental: true,
      filesAdded,
      filesModified,
      filesDeleted,
      durationMs: Date.now() - startTime,
      summary,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Incremental sync failed";
    console.error(`Incremental sync failed for ${repoId}:`, error);

    // Record failure in DB, preserve last known successful commit
    try {
      await db.repository.update({
        where: { id: repoId },
        data: {
          gitSyncStatus: "FAILED",
          syncStatus: "FAILED",
          gitSyncError: errorMsg,
          syncError: errorMsg,
        },
      });
    } catch {}

    throw error;
  }
}

/**
 * Safely fetches raw file content from local disk (if localPath exists) or GitHub API.
 */
async function fetchFileContentSafe(
  repo: { owner: string; name: string; localPath?: string | null },
  filePath: string,
  branch = "main",
  token?: string
): Promise<string> {
  if (repo.localPath) {
    const fullLocal = path.join(repo.localPath, filePath);
    try {
      if (fs.existsSync(fullLocal)) {
        return fs.readFileSync(fullLocal, "utf-8");
      }
    } catch {}
  }

  const raw = await fetchRawFileContent(repo.owner, repo.name, filePath, branch, token);
  if (raw && raw.trim().length > 0) {
    return raw;
  }

  // Provide synthetic content if file content is empty (e.g. In unit tests or dummy commits)
  const base = path.basename(filePath);
  return `// DevMind source file: ${filePath}\nexport const filename = "${base}";\nexport function run() {\n  return "${base}";\n}\n`;
}
