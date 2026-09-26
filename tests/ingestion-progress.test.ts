import assert from "node:assert";
import { test, describe, before, after } from "node:test";
import Module from "node:module";

// Mock server-only for node:test runner outside Next.js compiler
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, [id, ...args]);
};

import {
  calculateProgressPercent,
  STAGE_BASE_WEIGHTS,
  type IngestionStage,
} from "../lib/server/ingestion/progress";
import { runConcurrentPool } from "../lib/server/ingestion/concurrency";

let db: typeof import("../lib/server/db").db;
let resolverModule: typeof import("../lib/server/ingestion/resolver");

before(async () => {
  db = (await import("../lib/server/db")).db;
  resolverModule = await import("../lib/server/ingestion/resolver");
});

describe("DevMind Ingestion Progress & Telemetry Test Suite", () => {
  describe("1. Real Progress Percent Calculation & Monotonicity", () => {
    test("Clamps progress strictly between 0 and 100", () => {
      assert.strictEqual(calculateProgressPercent("CONNECTING", -10, 100, 0), 2);
      assert.strictEqual(calculateProgressPercent("PARSING_FILES", 200, 100, 0), 75);
      assert.strictEqual(calculateProgressPercent("FINALIZING", 100, 100, 0), 98);
    });

    test("File processing proportionally scales between 15% and 75%", () => {
      // 0 of 100 files -> 15%
      const p0 = calculateProgressPercent("PARSING_FILES", 0, 100, 0);
      assert.strictEqual(p0, 15);

      // 50 of 100 files -> 15 + Math.round(0.5 * 60) = 45%
      const p50 = calculateProgressPercent("PARSING_FILES", 50, 100, 0);
      assert.strictEqual(p50, 45);

      // 100 of 100 files -> 15 + 60 = 75%
      const p100 = calculateProgressPercent("PARSING_FILES", 100, 100, 0);
      assert.strictEqual(p100, 75);
    });

    test("Monotonicity guarantee: percent never moves backward", () => {
      let currentPercent = 45;
      // If a worker reports smaller count or re-reports, percent must not decrease
      currentPercent = calculateProgressPercent("PARSING_FILES", 30, 100, currentPercent);
      assert.strictEqual(currentPercent, 45);

      currentPercent = calculateProgressPercent("PARSING_FILES", 80, 100, currentPercent);
      assert.strictEqual(currentPercent, 63);

      // Stage transition forwards
      currentPercent = calculateProgressPercent("RESOLVING_DEPENDENCIES", 100, 100, currentPercent);
      assert.strictEqual(currentPercent, 75);
    });

    test("All stages follow ascending base weights", () => {
      const stages: IngestionStage[] = [
        "CONNECTING",
        "FETCHING_TREE",
        "PARSING_FILES",
        "RESOLVING_DEPENDENCIES",
        "SYNCING_GIT",
        "FINALIZING",
      ];

      for (let i = 0; i < stages.length - 1; i++) {
        const cur = STAGE_BASE_WEIGHTS[stages[i]].base;
        const next = STAGE_BASE_WEIGHTS[stages[i + 1]].base;
        assert.ok(cur <= next, `Stage ${stages[i]} base (${cur}) should be <= ${stages[i + 1]} base (${next})`);
      }
    });
  });

  describe("2. Controlled Concurrency Worker Pool", () => {
    test("Strictly honors concurrency limits", async () => {
      const concurrencyLimit = 5;
      let activeWorkers = 0;
      let maxObservedConcurrency = 0;

      const items = Array.from({ length: 30 }, (_, i) => i);

      const results = await runConcurrentPool(items, concurrencyLimit, async (item) => {
        activeWorkers++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeWorkers);
        // Small async delay simulating I/O
        await new Promise((r) => setTimeout(r, 10));
        activeWorkers--;
        return item * 2;
      });

      assert.ok(
        maxObservedConcurrency <= concurrencyLimit,
        `Max observed concurrency (${maxObservedConcurrency}) exceeded limit (${concurrencyLimit})`
      );
      assert.strictEqual(results.length, 30);
      assert.strictEqual(results[0], 0);
      assert.strictEqual(results[29], 58);
    });

    test("Handles empty and single-item arrays gracefully", async () => {
      const emptyResults = await runConcurrentPool([], 10, async (x) => x);
      assert.deepStrictEqual(emptyResults, []);

      const singleResult = await runConcurrentPool([42], 10, async (x) => x + 1);
      assert.deepStrictEqual(singleResult, [43]);
    });
  });

  describe("3. Batched Dependency Persistence", () => {
    test("Batch sync creates, updates, and prunes obsolete dependencies cleanly", async () => {
      const testRepoId = "test-repo-batch-" + Date.now();

      // Ensure a dummy project and repo exists
      const testOrg = await db.organization.findFirst();
      const testProj = await db.project.findFirst();
      if (!testProj) return; // skip if DB not seeded

      await db.repository.create({
        data: {
          id: testRepoId,
          projectId: testProj.id,
          name: "batch-test",
          owner: "test-owner",
          ingestionStatus: "INDEXING",
        },
      });

      try {
        // Initial Batch: 3 dependencies
        const initialDeps: any[] = [
          {
            key: resolverModule.generateDependencyKey(testRepoId, "src/index.ts", "./utils", "import"),
            repoId: testRepoId,
            sourceFile: "src/index.ts",
            targetFile: "src/utils.ts",
            importSource: "./utils",
            dependencyType: "import",
            kind: "internal",
            resolutionStatus: "RESOLVED_INTERNAL",
          },
          {
            key: resolverModule.generateDependencyKey(testRepoId, "src/index.ts", "react", "import"),
            repoId: testRepoId,
            sourceFile: "src/index.ts",
            targetFile: null,
            importSource: "react",
            dependencyType: "import",
            kind: "external",
            resolutionStatus: "RESOLVED_EXTERNAL",
            version: "^18.0.0",
          },
          {
            key: resolverModule.generateDependencyKey(testRepoId, "package.json", "express", "manifest"),
            repoId: testRepoId,
            sourceFile: "package.json",
            targetFile: null,
            importSource: "express",
            dependencyType: "manifest",
            kind: "external",
            resolutionStatus: "RESOLVED_EXTERNAL",
            version: "^4.18.0",
          },
        ];

        const insertedCount = await resolverModule.syncRepositoryDependenciesBatch(db, testRepoId, initialDeps);
        assert.strictEqual(insertedCount, 3);

        const inDb1 = await db.dependencyRecord.findMany({ where: { repoId: testRepoId } });
        assert.strictEqual(inDb1.length, 3);

        // Second Batch: remove "react", update "./utils", add "./logger"
        const secondDeps: any[] = [
          {
            key: resolverModule.generateDependencyKey(testRepoId, "src/index.ts", "./utils", "import"),
            repoId: testRepoId,
            sourceFile: "src/index.ts",
            targetFile: "src/utils/index.ts", // updated target
            importSource: "./utils",
            dependencyType: "import",
            kind: "internal",
            resolutionStatus: "RESOLVED_INTERNAL",
          },
          {
            key: resolverModule.generateDependencyKey(testRepoId, "src/index.ts", "./logger", "import"),
            repoId: testRepoId,
            sourceFile: "src/index.ts",
            targetFile: "src/logger.ts",
            importSource: "./logger",
            dependencyType: "import",
            kind: "internal",
            resolutionStatus: "RESOLVED_INTERNAL",
          },
        ];

        const updatedCount = await resolverModule.syncRepositoryDependenciesBatch(db, testRepoId, secondDeps);
        assert.strictEqual(updatedCount, 2);

        const inDb2 = await db.dependencyRecord.findMany({ where: { repoId: testRepoId } });
        assert.strictEqual(inDb2.length, 2);

        const utilsDep = inDb2.find((d) => d.importSource === "./utils");
        assert.strictEqual(utilsDep?.targetFile, "src/utils/index.ts");

        const reactDep = inDb2.find((d) => d.importSource === "react");
        assert.strictEqual(reactDep, undefined); // obsolete pruned!
      } finally {
        await db.dependencyRecord.deleteMany({ where: { repoId: testRepoId } });
        await db.repository.deleteMany({ where: { id: testRepoId } });
      }
    });
  });
});
