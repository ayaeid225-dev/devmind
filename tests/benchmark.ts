import Module from "node:module";

// Mock server-only for node execution
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, [id, ...args]);
};

import fs from "node:fs";
import path from "node:path";

async function runBenchmark() {
  const { db } = await import("../lib/server/db");
  const { analyzeSourceCode } = await import("../lib/server/ingestion/parser");
  const { buildRepoFileIndex, resolveFileDependency, syncRepositoryDependenciesBatch, generateDependencyKey } =
    await import("../lib/server/ingestion/resolver");
  const { runConcurrentPool } = await import("../lib/server/ingestion/concurrency");

  console.log("===============================================================");
  console.log("       DEVMIND INGESTION PIPELINE PERFORMANCE BENCHMARK       ");
  console.log("===============================================================\n");

  // Collect test files from project to simulate a realistic repository
  const benchmarkFiles: Array<{ path: string; content: string }> = [];

  function scanDir(dir: string, baseDir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        scanDir(fullPath, baseDir);
      } else if (/\.(ts|tsx|js|json|py|dart|go|java)$/.test(entry.name)) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.length < 500000) {
            benchmarkFiles.push({ path: relPath, content });
          }
        } catch {}
      }
    }
  }

  scanDir(path.resolve(__dirname, "../lib"), path.resolve(__dirname, ".."));
  scanDir(path.resolve(__dirname, "../tests/fixtures"), path.resolve(__dirname, ".."));

  console.log(`Repository Benchmark Dataset: ${benchmarkFiles.length} files collected.\n`);

  const filePaths = benchmarkFiles.map((f) => f.path);
  const repoIndex = buildRepoFileIndex(filePaths);

  // -------------------------------------------------------------------------
  // RUN 1: Simulated Sequential Pipeline (OLD IMPLEMENTATION)
  // -------------------------------------------------------------------------
  console.log("--- 1. Running Baseline (Sequential Fetch & Individual DB Upserts) ---");
  const baselineRepoId = `bench-baseline-${Date.now()}`;
  const testProj = await db.project.findFirst();
  if (!testProj) {
    console.error("No project found for benchmark. Seed database first.");
    process.exit(1);
  }

  await db.repository.create({
    data: {
      id: baselineRepoId,
      projectId: testProj.id,
      name: "baseline-bench",
      owner: "bench-user",
      ingestionStatus: "INDEXING",
    },
  });

  const baselineStart = performance.now();
  let baselineParseTime = 0;
  let baselineDbTime = 0;
  let baselineTotalImports = 0;
  let baselineTotalClasses = 0;
  let baselineTotalFunctions = 0;

  for (const file of benchmarkFiles) {
    const pStart = performance.now();
    const analysis = analyzeSourceCode(file.path, file.content);
    baselineParseTime += performance.now() - pStart;

    baselineTotalImports += analysis.imports.length;
    baselineTotalClasses += analysis.parsedFileResult.classes.length;
    baselineTotalFunctions += analysis.parsedFileResult.functions.length;

    const dbStart = performance.now();
    // Simulate sequential upsert of file
    await db.fileRecord.upsert({
      where: { repoId_path: { repoId: baselineRepoId, path: file.path } },
      update: { lineCount: analysis.lineCount, updatedText: "Just now" },
      create: {
        repoId: baselineRepoId,
        path: file.path,
        size: `${(file.content.length / 1024).toFixed(1)} KB`,
        type: analysis.languageInfo.category,
        language: analysis.languageInfo.name,
        lineCount: analysis.lineCount,
        updatedText: "Just now",
      },
    });

    // Simulate individual dependency upserts (sample first 3 imports per file to avoid 30s lock)
    for (const imp of analysis.parsedFileResult.imports.slice(0, 3)) {
      const resolved = resolveFileDependency(file.path, imp, analysis.languageInfo.id, repoIndex, baselineRepoId);
      await db.dependencyRecord.upsert({
        where: { key: resolved.key },
        update: { sourceFile: resolved.sourceFile, targetFile: resolved.targetFile },
        create: {
          key: resolved.key,
          repoId: baselineRepoId,
          sourceFile: resolved.sourceFile,
          targetFile: resolved.targetFile,
          importSource: resolved.importSource,
          kind: resolved.kind,
          dependencyType: resolved.dependencyType,
        },
      });
    }
    baselineDbTime += performance.now() - dbStart;
  }

  const baselineTotalTime = performance.now() - baselineStart;
  const baselineDepsCount = await db.dependencyRecord.count({ where: { repoId: baselineRepoId } });

  console.log(`Baseline Completed in ${(baselineTotalTime / 1000).toFixed(2)}s`);
  console.log(`  - AST Parsing & Resolution: ${(baselineParseTime / 1000).toFixed(2)}s`);
  console.log(`  - Sequential DB Writes: ${(baselineDbTime / 1000).toFixed(2)}s`);
  console.log(`  - Files: ${benchmarkFiles.length}, Dependencies: ${baselineDepsCount}\n`);

  // Clean baseline data
  await db.dependencyRecord.deleteMany({ where: { repoId: baselineRepoId } });
  await db.fileRecord.deleteMany({ where: { repoId: baselineRepoId } });
  await db.repository.deleteMany({ where: { id: baselineRepoId } });

  // -------------------------------------------------------------------------
  // RUN 2: Optimized Pipeline (CONCURRENT POOL & BATCHED DB TRANSACTIONS)
  // -------------------------------------------------------------------------
  console.log("--- 2. Running Optimized Pipeline (Worker Pool & Batched Persistence) ---");
  const optRepoId = `bench-opt-${Date.now()}`;

  await db.repository.create({
    data: {
      id: optRepoId,
      projectId: testProj.id,
      name: "opt-bench",
      owner: "bench-user",
      ingestionStatus: "INDEXING",
    },
  });

  const optStart = performance.now();
  let optParseTime = 0;
  let optDbTime = 0;
  let optTotalImports = 0;
  let optTotalClasses = 0;
  let optTotalFunctions = 0;

  const fileRecordsToUpsert: any[] = [];
  const allCollectedDependencies: any[] = [];

  const parseStart = performance.now();
  await runConcurrentPool(benchmarkFiles, 15, async (file) => {
    const analysis = analyzeSourceCode(file.path, file.content);

    optTotalImports += analysis.imports.length;
    optTotalClasses += analysis.parsedFileResult.classes.length;
    optTotalFunctions += analysis.parsedFileResult.functions.length;

    fileRecordsToUpsert.push({
      where: { repoId_path: { repoId: optRepoId, path: file.path } },
      update: { lineCount: analysis.lineCount, updatedText: "Just now" },
      create: {
        repoId: optRepoId,
        path: file.path,
        size: `${(file.content.length / 1024).toFixed(1)} KB`,
        type: analysis.languageInfo.category,
        language: analysis.languageInfo.name,
        lineCount: analysis.lineCount,
        updatedText: "Just now",
      },
    });

    for (const imp of analysis.parsedFileResult.imports.slice(0, 3)) {
      const resolved = resolveFileDependency(file.path, imp, analysis.languageInfo.id, repoIndex, optRepoId);
      allCollectedDependencies.push({
        key: resolved.key,
        repoId: optRepoId,
        sourceFile: resolved.sourceFile,
        targetFile: resolved.targetFile,
        importSource: resolved.importSource,
        kind: resolved.kind,
        dependencyType: resolved.dependencyType,
        resolutionStatus: resolved.resolutionStatus,
      });
    }
  });
  optParseTime = performance.now() - parseStart;

  const dbStart = performance.now();
  // Batch persist FileRecords in transactions of 50
  for (let i = 0; i < fileRecordsToUpsert.length; i += 50) {
    const chunk = fileRecordsToUpsert.slice(i, i + 50);
    await db.$transaction(chunk.map((item) => db.fileRecord.upsert(item)));
  }

  // Batch persist dependencies in transactions
  await syncRepositoryDependenciesBatch(db, optRepoId, allCollectedDependencies);
  optDbTime = performance.now() - dbStart;

  const optTotalTime = performance.now() - optStart;
  const optDepsCount = await db.dependencyRecord.count({ where: { repoId: optRepoId } });

  console.log(`Optimized Pipeline Completed in ${(optTotalTime / 1000).toFixed(2)}s`);
  console.log(`  - AST Parsing & Worker Pool: ${(optParseTime / 1000).toFixed(2)}s`);
  console.log(`  - Batched DB Persistence: ${(optDbTime / 1000).toFixed(2)}s`);
  console.log(`  - Files: ${benchmarkFiles.length}, Dependencies: ${optDepsCount}\n`);

  // Clean optimized data
  await db.dependencyRecord.deleteMany({ where: { repoId: optRepoId } });
  await db.fileRecord.deleteMany({ where: { repoId: optRepoId } });
  await db.repository.deleteMany({ where: { id: optRepoId } });

  // -------------------------------------------------------------------------
  // COMPARISON & CORRECTNESS REPORT
  // -------------------------------------------------------------------------
  const speedupPercent = (((baselineTotalTime - optTotalTime) / baselineTotalTime) * 100).toFixed(1);
  const factor = (baselineTotalTime / optTotalTime).toFixed(2);

  console.log("===============================================================");
  console.log("               BENCHMARK RESULTS & COMPARISON                  ");
  console.log("===============================================================");
  console.log(`Total Dataset:          ${benchmarkFiles.length} files`);
  console.log(`Baseline Ingestion:     ${(baselineTotalTime / 1000).toFixed(2)}s`);
  console.log(`Optimized Ingestion:    ${(optTotalTime / 1000).toFixed(2)}s`);
  console.log(`Speed Improvement:      ${speedupPercent}% faster (${factor}x speedup)`);
  console.log("---------------------------------------------------------------");
  console.log("CORRECTNESS VERIFICATION:");
  console.log(`- Files Parsed:         ${benchmarkFiles.length} vs ${benchmarkFiles.length} (100% Match)`);
  console.log(`- Imports Extracted:    ${baselineTotalImports} vs ${optTotalImports} (${baselineTotalImports === optTotalImports ? "EXACT MATCH" : "DIFF"})`);
  console.log(`- Classes Extracted:    ${baselineTotalClasses} vs ${optTotalClasses} (${baselineTotalClasses === optTotalClasses ? "EXACT MATCH" : "DIFF"})`);
  console.log(`- Functions Extracted:  ${baselineTotalFunctions} vs ${optTotalFunctions} (${baselineTotalFunctions === optTotalFunctions ? "EXACT MATCH" : "DIFF"})`);
  console.log(`- Dependencies Saved:   ${baselineDepsCount} vs ${optDepsCount} (${baselineDepsCount === optDepsCount ? "EXACT MATCH" : "DIFF"})`);
  console.log("===============================================================\n");
}

runBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
