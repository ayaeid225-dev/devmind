import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

// Mock server-only for node:test runner outside Next.js compiler
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, [id, ...args]);
};

let db: typeof import("../lib/server/db").db;
let syncRepositoryStats: typeof import("../lib/server/repositories/stats").syncRepositoryStats;
let verifyRepositoryStatsConsistency: typeof import("../lib/server/repositories/stats").verifyRepositoryStatsConsistency;
let ingestGitHistory: typeof import("../lib/server/git/service").ingestGitHistory;
let ingestContributors: typeof import("../lib/server/contributors/service").ingestContributors;

describe("Structured Database Layer Test Suite (Milestone 1)", () => {
  before(async () => {
    const dbModule = await import("../lib/server/db");
    db = dbModule.db;
    const statsModule = await import("../lib/server/repositories/stats");
    syncRepositoryStats = statsModule.syncRepositoryStats;
    verifyRepositoryStatsConsistency = statsModule.verifyRepositoryStatsConsistency;
    const gitModule = await import("../lib/server/git/service");
    ingestGitHistory = gitModule.ingestGitHistory;
    const contribModule = await import("../lib/server/contributors/service");
    ingestContributors = contribModule.ingestContributors;
  });

  const testOrgId = "test-struct-db-org";
  const testProjectId = "test-struct-db-proj";
  const testRepoId = "test-struct-db-repo";

  async function cleanupAll(repoId: string, projectId: string, orgId: string) {
    try {
      // Direct child deletions if needed
      await db.commitFileChangeRecord.deleteMany({ where: { repoId } });
      await db.commitRecord.deleteMany({ where: { repoId } });
      await db.contributorRecord.deleteMany({ where: { repoId } });
      await db.dependencyRecord.deleteMany({ where: { repoId } });
      await db.documentChunk.deleteMany({ where: { repoId } });
      await db.fileRecord.deleteMany({ where: { repoId } });
      await db.module.deleteMany({ where: { repoId } });
      await db.branch.deleteMany({ where: { repoId } });
      await db.developerRecord.deleteMany({ where: { repoId } });
      await db.activityRecord.deleteMany({ where: { repoId } });
      await db.repository.deleteMany({ where: { id: repoId } });
      await db.project.deleteMany({ where: { id: projectId } });
      await db.organization.deleteMany({ where: { id: orgId } });
    } catch {}
  }

  describe("1. Relational Modeling & Schema Integrity", () => {
    before(async () => {
      await cleanupAll(testRepoId, testProjectId, testOrgId);

      await db.organization.create({
        data: { id: testOrgId, name: "Test Org", slug: "test-struct-org" },
      });
      await db.project.create({
        data: { id: testProjectId, orgId: testOrgId, name: "Test Proj", slug: "test-struct-proj" },
      });
      await db.repository.create({
        data: {
          id: testRepoId,
          projectId: testProjectId,
          name: "test-repo",
          owner: "test-owner",
          defaultBranch: "main",
        },
      });
    });

    after(async () => {
      await cleanupAll(testRepoId, testProjectId, testOrgId);
    });

    test("Persists full relational hierarchy (Repository -> Module -> File -> Chunks -> Dependencies -> Commits -> Changes -> Contributors)", async () => {
      // 1. Create Module
      const module = await db.module.create({
        data: {
          repoId: testRepoId,
          name: "core",
          type: "core",
          desc: "Core business logic",
        },
      });

      // 2. Create FileRecord
      const fileRecord = await db.fileRecord.create({
        data: {
          repoId: testRepoId,
          moduleId: module.id,
          path: "src/core/auth.ts",
          size: "4.2 KB",
          type: "code",
          language: "TypeScript",
          parsingStatus: "PARSED",
          lineCount: 120,
          symbolsJson: JSON.stringify({
            classes: [{ name: "AuthService", line: 10 }],
            functions: [{ name: "validateToken", line: 45 }],
          }),
          updatedText: "Just now",
        },
      });

      // 3. Create DocumentChunk linked to FileRecord and Repository
      const chunk = await db.documentChunk.create({
        data: {
          repoId: testRepoId,
          fileId: fileRecord.id,
          path: "src/core/auth.ts",
          language: "TypeScript",
          content: "export class AuthService { ... }",
          startLine: 1,
          endLine: 60,
          chunkIndex: 0,
          contentHash: "hash-auth-chunk-0",
        },
      });

      // 4. Create DependencyRecords (internal file import and external package)
      const depInternal = await db.dependencyRecord.create({
        data: {
          key: `dep-${testRepoId}-auth-to-crypto`,
          repoId: testRepoId,
          kind: "internal",
          sourceFile: "src/core/auth.ts",
          targetFile: "src/core/crypto.ts",
          importSource: "./crypto",
          dependencyType: "import",
          language: "typescript",
          resolutionStatus: "RESOLVED_INTERNAL",
        },
      });

      const depExternal = await db.dependencyRecord.create({
        data: {
          key: `dep-${testRepoId}-manifest-jsonwebtoken`,
          repoId: testRepoId,
          kind: "external",
          sourceFile: "package.json",
          importSource: "jsonwebtoken",
          dependencyType: "manifest",
          name: "jsonwebtoken",
          version: "^9.0.0",
          purpose: "Production dependency",
        },
      });

      // 5. Create ContributorRecord
      const contributor = await db.contributorRecord.create({
        data: {
          repoId: testRepoId,
          identityKey: "email:alice@example.com",
          name: "Alice Engineer",
          email: "alice@example.com",
          authoredCommitsCount: 1,
          totalCommitsCount: 1,
          additions: 120,
          deletions: 0,
          filesTouchedCount: 1,
          filesTouchedJson: JSON.stringify(["src/core/auth.ts"]),
          firstContributionAt: new Date("2026-01-01T10:00:00Z"),
          lastContributionAt: new Date("2026-01-01T10:00:00Z"),
          isAuthor: true,
        },
      });

      // 6. Create CommitRecord linked to Contributor
      const commit = await db.commitRecord.create({
        data: {
          repoId: testRepoId,
          sha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
          shortSha: "a1b2c3d",
          message: "feat: implement auth service",
          authorName: "Alice Engineer",
          authorEmail: "alice@example.com",
          authorContributorId: contributor.id,
          authoredAt: new Date("2026-01-01T10:00:00Z"),
          committedAt: new Date("2026-01-01T10:00:00Z"),
          parentShasJson: JSON.stringify([]),
        },
      });

      // 7. Create CommitFileChangeRecord linked to CommitRecord
      const change = await db.commitFileChangeRecord.create({
        data: {
          repoId: testRepoId,
          commitId: commit.id,
          commitSha: commit.sha,
          newPath: "src/core/auth.ts",
          changeType: "ADDED",
          additions: 120,
          deletions: 0,
        },
      });

      // 8. Verify deep relational retrieval
      const repoWithRelations = await db.repository.findUnique({
        where: { id: testRepoId },
        include: {
          modules: { include: { files: true } },
          fileRecords: { include: { documentChunks: true, module: true } },
          dependencyRecords: true,
          commits: {
            include: {
              fileChanges: true,
              authorContributor: true,
            },
          },
          contributors: {
            include: {
              authoredCommits: true,
            },
          },
        },
      });

      assert.ok(repoWithRelations);
      assert.equal(repoWithRelations.modules.length, 1);
      assert.equal(repoWithRelations.fileRecords.length, 1);
      assert.equal(repoWithRelations.fileRecords[0].documentChunks.length, 1);
      assert.equal(repoWithRelations.dependencyRecords.length, 2);
      assert.equal(repoWithRelations.commits.length, 1);
      assert.equal(repoWithRelations.commits[0].fileChanges.length, 1);
      assert.equal(repoWithRelations.commits[0].authorContributor?.id, contributor.id);
      assert.equal(repoWithRelations.contributors.length, 1);
      assert.equal(repoWithRelations.contributors[0].authoredCommits[0].id, commit.id);
    });
  });

  describe("2. Foreign Keys & Cascading Deletions", () => {
    const cascadeRepoId = "test-cascade-repo";

    before(async () => {
      await cleanupAll(cascadeRepoId, testProjectId, testOrgId);

      await db.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: "Test Org", slug: "test-struct-org" },
      });
      await db.project.upsert({
        where: { id: testProjectId },
        update: {},
        create: { id: testProjectId, orgId: testOrgId, name: "Test Proj", slug: "test-struct-proj" },
      });
      await db.repository.create({
        data: {
          id: cascadeRepoId,
          projectId: testProjectId,
          name: "cascade-repo",
          owner: "test-owner",
        },
      });

      const file = await db.fileRecord.create({
        data: {
          repoId: cascadeRepoId,
          path: "lib/api.ts",
          size: "2 KB",
          type: "code",
          language: "TypeScript",
          updatedText: "Just now",
        },
      });

      await db.documentChunk.create({
        data: {
          repoId: cascadeRepoId,
          fileId: file.id,
          path: "lib/api.ts",
          language: "TypeScript",
          content: "export const api = {};",
          startLine: 1,
          endLine: 20,
          chunkIndex: 0,
          contentHash: "hash-chunk-cascade",
        },
      });

      await db.dependencyRecord.create({
        data: {
          key: `dep-${cascadeRepoId}-lib-api`,
          repoId: cascadeRepoId,
          kind: "internal",
          sourceFile: "lib/api.ts",
          targetFile: "lib/client.ts",
          importSource: "./client",
        },
      });

      const contrib = await db.contributorRecord.create({
        data: {
          repoId: cascadeRepoId,
          identityKey: "email:bob@example.com",
          name: "Bob Dev",
          email: "bob@example.com",
          firstContributionAt: new Date(),
          lastContributionAt: new Date(),
        },
      });

      const commit = await db.commitRecord.create({
        data: {
          repoId: cascadeRepoId,
          sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          shortSha: "bbbbbbb",
          message: "initial commit",
          authorName: "Bob Dev",
          authorEmail: "bob@example.com",
          authorContributorId: contrib.id,
          authoredAt: new Date(),
          committedAt: new Date(),
        },
      });

      await db.commitFileChangeRecord.create({
        data: {
          repoId: cascadeRepoId,
          commitId: commit.id,
          commitSha: commit.sha,
          newPath: "lib/api.ts",
          changeType: "ADDED",
          additions: 20,
          deletions: 0,
        },
      });
    });

    test("Deleting a commit cascade-deletes its CommitFileChanges and sets authorContributorId to null without deleting contributor", async () => {
      const commit = await db.commitRecord.findFirst({
        where: { repoId: cascadeRepoId },
      });
      assert.ok(commit);

      await db.commitRecord.delete({ where: { id: commit.id } });

      const changesAfter = await db.commitFileChangeRecord.findMany({
        where: { commitId: commit.id },
      });
      assert.equal(changesAfter.length, 0, "Commit file changes must be cascade-deleted");

      const contributorAfter = await db.contributorRecord.findFirst({
        where: { repoId: cascadeRepoId },
      });
      assert.ok(contributorAfter, "Contributor must remain intact when commit is deleted");
    });

    test("Deleting a repository cascade-deletes all associated child models cleanly", async () => {
      // Re-create a commit for the repository cascade test
      const contrib = await db.contributorRecord.findFirst({ where: { repoId: cascadeRepoId } });
      assert.ok(contrib);
      const commit = await db.commitRecord.create({
        data: {
          repoId: cascadeRepoId,
          sha: "cccccccccccccccccccccccccccccccccccccccc",
          shortSha: "ccccccc",
          message: "recreated commit",
          authorName: "Bob Dev",
          authorEmail: "bob@example.com",
          authorContributorId: contrib.id,
          authoredAt: new Date(),
          committedAt: new Date(),
        },
      });
      await db.commitFileChangeRecord.create({
        data: {
          repoId: cascadeRepoId,
          commitId: commit.id,
          commitSha: commit.sha,
          newPath: "lib/api.ts",
          changeType: "MODIFIED",
          additions: 5,
          deletions: 1,
        },
      });

      // Now delete the Repository
      await db.repository.delete({ where: { id: cascadeRepoId } });

      // Verify all child tables have 0 rows for cascadeRepoId
      const [files, chunks, deps, commits, changes, contributors] = await Promise.all([
        db.fileRecord.count({ where: { repoId: cascadeRepoId } }),
        db.documentChunk.count({ where: { repoId: cascadeRepoId } }),
        db.dependencyRecord.count({ where: { repoId: cascadeRepoId } }),
        db.commitRecord.count({ where: { repoId: cascadeRepoId } }),
        db.commitFileChangeRecord.count({ where: { repoId: cascadeRepoId } }),
        db.contributorRecord.count({ where: { repoId: cascadeRepoId } }),
      ]);

      assert.equal(files, 0, "FileRecords must be cascade deleted");
      assert.equal(chunks, 0, "DocumentChunks must be cascade deleted");
      assert.equal(deps, 0, "DependencyRecords must be cascade deleted");
      assert.equal(commits, 0, "CommitRecords must be cascade deleted");
      assert.equal(changes, 0, "CommitFileChangeRecords must be cascade deleted");
      assert.equal(contributors, 0, "ContributorRecords must be cascade deleted");
    });
  });

  describe("3. Unique Constraints & Idempotency", () => {
    const idempRepoId = "test-idemp-repo";

    before(async () => {
      await cleanupAll(idempRepoId, testProjectId, testOrgId);

      await db.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: "Test Org", slug: "test-struct-org" },
      });
      await db.project.upsert({
        where: { id: testProjectId },
        update: {},
        create: { id: testProjectId, orgId: testOrgId, name: "Test Proj", slug: "test-struct-proj" },
      });
      await db.repository.create({
        data: {
          id: idempRepoId,
          projectId: testProjectId,
          name: "idemp-repo",
          owner: "test-owner",
        },
      });
    });

    after(async () => {
      await cleanupAll(idempRepoId, testProjectId, testOrgId);
    });

    test("Enforces unique constraint on FileRecord [repoId, path]", async () => {
      await db.fileRecord.create({
        data: {
          repoId: idempRepoId,
          path: "src/index.ts",
          size: "1 KB",
          type: "code",
          language: "TypeScript",
          updatedText: "Initial",
        },
      });

      // Duplicate create must reject
      await assert.rejects(
        db.fileRecord.create({
          data: {
            repoId: idempRepoId,
            path: "src/index.ts",
            size: "2 KB",
            type: "code",
            language: "TypeScript",
            updatedText: "Duplicate",
          },
        }),
        /Unique constraint failed/i
      );

      // Upsert must succeed and update existing record
      const upserted = await db.fileRecord.upsert({
        where: {
          repoId_path: {
            repoId: idempRepoId,
            path: "src/index.ts",
          },
        },
        update: { lineCount: 50 },
        create: {
          repoId: idempRepoId,
          path: "src/index.ts",
          size: "2 KB",
          type: "code",
          language: "TypeScript",
          updatedText: "Upserted",
        },
      });
      assert.equal(upserted.lineCount, 50);

      const count = await db.fileRecord.count({ where: { repoId: idempRepoId } });
      assert.equal(count, 1, "Upsert should not create duplicates");
    });

    test("Enforces unique constraint on CommitRecord [repoId, sha]", async () => {
      const sha = "1111222233334444555566667777888899990000";
      await db.commitRecord.create({
        data: {
          repoId: idempRepoId,
          sha,
          shortSha: sha.slice(0, 7),
          message: "Commit 1",
          authorName: "Dev",
          authorEmail: "dev@example.com",
          authoredAt: new Date(),
          committedAt: new Date(),
        },
      });

      await assert.rejects(
        db.commitRecord.create({
          data: {
            repoId: idempRepoId,
            sha,
            shortSha: sha.slice(0, 7),
            message: "Duplicate Commit",
            authorName: "Dev",
            authorEmail: "dev@example.com",
            authoredAt: new Date(),
            committedAt: new Date(),
          },
        }),
        /Unique constraint failed/i
      );

      const count = await db.commitRecord.count({ where: { repoId: idempRepoId, sha } });
      assert.equal(count, 1);
    });

    test("Enforces unique constraint on ContributorRecord [repoId, identityKey]", async () => {
      const identityKey = "email:alice@example.com";
      await db.contributorRecord.create({
        data: {
          repoId: idempRepoId,
          identityKey,
          name: "Alice",
          email: "alice@example.com",
          firstContributionAt: new Date(),
          lastContributionAt: new Date(),
        },
      });

      await assert.rejects(
        db.contributorRecord.create({
          data: {
            repoId: idempRepoId,
            identityKey,
            name: "Alice Duplicate",
            email: "alice@example.com",
            firstContributionAt: new Date(),
            lastContributionAt: new Date(),
          },
        }),
        /Unique constraint failed/i
      );

      const count = await db.contributorRecord.count({
        where: { repoId: idempRepoId, identityKey },
      });
      assert.equal(count, 1);
    });

    test("Enforces unique constraint on DependencyRecord key", async () => {
      const key = `dep-${idempRepoId}-unique-key`;
      await db.dependencyRecord.create({
        data: {
          key,
          repoId: idempRepoId,
          kind: "internal",
          sourceFile: "a.ts",
          targetFile: "b.ts",
        },
      });

      await assert.rejects(
        db.dependencyRecord.create({
          data: {
            key,
            repoId: idempRepoId,
            kind: "internal",
            sourceFile: "a.ts",
            targetFile: "c.ts",
          },
        }),
        /Unique constraint failed/i
      );
    });
  });

  describe("4. Query Indexes & Filter Performance", () => {
    const queryRepoId = "test-query-perf-repo";

    before(async () => {
      await cleanupAll(queryRepoId, testProjectId, testOrgId);

      await db.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: "Test Org", slug: "test-struct-org" },
      });
      await db.project.upsert({
        where: { id: testProjectId },
        update: {},
        create: { id: testProjectId, orgId: testOrgId, name: "Test Proj", slug: "test-struct-proj" },
      });
      await db.repository.create({
        data: {
          id: queryRepoId,
          projectId: testProjectId,
          name: "query-repo",
          owner: "test-owner",
        },
      });

      // Seed multiple files
      await db.fileRecord.createMany({
        data: [
          { repoId: queryRepoId, path: "src/a.ts", size: "1KB", type: "code", language: "TypeScript", parsingStatus: "PARSED", updatedText: "now" },
          { repoId: queryRepoId, path: "src/b.py", size: "2KB", type: "code", language: "Python", parsingStatus: "PARSED", updatedText: "now" },
          { repoId: queryRepoId, path: "docs/readme.md", size: "3KB", type: "doc", language: "Markdown", parsingStatus: "UNSUPPORTED", updatedText: "now" },
        ],
      });

      // Seed dependencies
      await db.dependencyRecord.createMany({
        data: [
          { key: `dep-${queryRepoId}-1`, repoId: queryRepoId, kind: "internal", sourceFile: "src/a.ts", targetFile: "src/util.ts", dependencyType: "import" },
          { key: `dep-${queryRepoId}-2`, repoId: queryRepoId, kind: "external", sourceFile: "package.json", name: "lodash", dependencyType: "manifest" },
        ],
      });

      // Seed commits
      await db.commitRecord.createMany({
        data: [
          {
            repoId: queryRepoId,
            sha: "1111111111111111111111111111111111111111",
            shortSha: "1111111",
            message: "Commit 1",
            authorName: "Alice",
            authorEmail: "alice@company.com",
            authoredAt: new Date("2026-01-01T00:00:00Z"),
            committedAt: new Date("2026-01-01T00:00:00Z"),
          },
          {
            repoId: queryRepoId,
            sha: "2222222222222222222222222222222222222222",
            shortSha: "2222222",
            message: "Commit 2",
            authorName: "Bob",
            authorEmail: "bob@company.com",
            authoredAt: new Date("2026-01-02T00:00:00Z"),
            committedAt: new Date("2026-01-02T00:00:00Z"),
          },
        ],
      });

      // Seed contributors
      await db.contributorRecord.createMany({
        data: [
          {
            repoId: queryRepoId,
            identityKey: "email:alice@company.com",
            name: "Alice",
            email: "alice@company.com",
            totalCommitsCount: 10,
            firstContributionAt: new Date("2026-01-01T00:00:00Z"),
            lastContributionAt: new Date("2026-01-10T00:00:00Z"),
          },
          {
            repoId: queryRepoId,
            identityKey: "email:bob@company.com",
            name: "Bob",
            email: "bob@company.com",
            totalCommitsCount: 5,
            firstContributionAt: new Date("2026-01-02T00:00:00Z"),
            lastContributionAt: new Date("2026-01-05T00:00:00Z"),
          },
        ],
      });
    });

    after(async () => {
      await cleanupAll(queryRepoId, testProjectId, testOrgId);
    });

    test("Indexed queries on FileRecord: [repoId, language] and [repoId, parsingStatus]", async () => {
      const tsFiles = await db.fileRecord.findMany({
        where: { repoId: queryRepoId, language: "TypeScript" },
      });
      assert.equal(tsFiles.length, 1);
      assert.equal(tsFiles[0].path, "src/a.ts");

      const parsedFiles = await db.fileRecord.findMany({
        where: { repoId: queryRepoId, parsingStatus: "PARSED" },
      });
      assert.equal(parsedFiles.length, 2);
    });

    test("Indexed queries on DependencyRecord: [repoId, targetFile] and [repoId, dependencyType]", async () => {
      const targetQuery = await db.dependencyRecord.findMany({
        where: { repoId: queryRepoId, targetFile: "src/util.ts" },
      });
      assert.equal(targetQuery.length, 1);

      const manifestDeps = await db.dependencyRecord.findMany({
        where: { repoId: queryRepoId, dependencyType: "manifest" },
      });
      assert.equal(manifestDeps.length, 1);
    });

    test("Indexed queries on CommitRecord: [repoId, authorEmail] and [repoId, committedAt]", async () => {
      const aliceCommits = await db.commitRecord.findMany({
        where: { repoId: queryRepoId, authorEmail: "alice@company.com" },
      });
      assert.equal(aliceCommits.length, 1);

      const orderedCommits = await db.commitRecord.findMany({
        where: { repoId: queryRepoId },
        orderBy: { committedAt: "desc" },
      });
      assert.equal(orderedCommits[0].shortSha, "2222222");
    });

    test("Indexed queries on ContributorRecord: [repoId, totalCommitsCount] and [repoId, name]", async () => {
      const topContributors = await db.contributorRecord.findMany({
        where: { repoId: queryRepoId },
        orderBy: { totalCommitsCount: "desc" },
      });
      assert.equal(topContributors.length, 2);
      assert.equal(topContributors[0].name, "Alice");
      assert.equal(topContributors[0].totalCommitsCount, 10);
    });
  });

  describe("5. Aggregate Consistency & Synchronization Service", () => {
    const statsRepoId = "test-stats-repo";

    before(async () => {
      await cleanupAll(statsRepoId, testProjectId, testOrgId);

      await db.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: "Test Org", slug: "test-struct-org" },
      });
      await db.project.upsert({
        where: { id: testProjectId },
        update: {},
        create: { id: testProjectId, orgId: testOrgId, name: "Test Proj", slug: "test-struct-proj" },
      });
      await db.repository.create({
        data: {
          id: statsRepoId,
          projectId: testProjectId,
          name: "stats-repo",
          owner: "test-owner",
          // Intentionally initialize with zeros
          filesCount: 0,
          modulesCount: 0,
          depsCount: 0,
          commitsCount: 0,
          contributorsCount: 0,
          latestCommitSha: null,
        },
      });
    });

    after(async () => {
      await cleanupAll(statsRepoId, testProjectId, testOrgId);
    });

    test("syncRepositoryStats computes accurate aggregate counts and latestCommitSha from relational rows", async () => {
      // 1. Insert 2 Modules
      await db.module.createMany({
        data: [
          { repoId: statsRepoId, name: "mod1", type: "core", desc: "Module 1" },
          { repoId: statsRepoId, name: "mod2", type: "api", desc: "Module 2" },
        ],
      });

      // 2. Insert 3 Files
      await db.fileRecord.createMany({
        data: [
          { repoId: statsRepoId, path: "file1.ts", size: "1KB", type: "code", language: "TS", updatedText: "now" },
          { repoId: statsRepoId, path: "file2.ts", size: "1KB", type: "code", language: "TS", updatedText: "now" },
          { repoId: statsRepoId, path: "file3.ts", size: "1KB", type: "code", language: "TS", updatedText: "now" },
        ],
      });

      // 3. Insert 4 Dependencies
      await db.dependencyRecord.createMany({
        data: [
          { key: `dep-${statsRepoId}-1`, repoId: statsRepoId, kind: "internal" },
          { key: `dep-${statsRepoId}-2`, repoId: statsRepoId, kind: "internal" },
          { key: `dep-${statsRepoId}-3`, repoId: statsRepoId, kind: "external" },
          { key: `dep-${statsRepoId}-4`, repoId: statsRepoId, kind: "external" },
        ],
      });

      // 4. Insert 2 Commits with distinct timestamps
      const shaOlder = "1000000000000000000000000000000000000000";
      const shaNewer = "2000000000000000000000000000000000000000";

      await db.commitRecord.create({
        data: {
          repoId: statsRepoId,
          sha: shaOlder,
          shortSha: "1000000",
          message: "First commit",
          authorName: "Alice",
          authorEmail: "alice@test.com",
          authoredAt: new Date("2026-01-01T12:00:00Z"),
          committedAt: new Date("2026-01-01T12:00:00Z"),
        },
      });

      await db.commitRecord.create({
        data: {
          repoId: statsRepoId,
          sha: shaNewer,
          shortSha: "2000000",
          message: "Second commit",
          authorName: "Bob",
          authorEmail: "bob@test.com",
          authoredAt: new Date("2026-01-02T15:00:00Z"),
          committedAt: new Date("2026-01-02T15:00:00Z"),
        },
      });

      // 5. Insert 2 Contributors
      await db.contributorRecord.createMany({
        data: [
          {
            repoId: statsRepoId,
            identityKey: "email:alice@test.com",
            name: "Alice",
            email: "alice@test.com",
            totalCommitsCount: 1,
            firstContributionAt: new Date("2026-01-01T12:00:00Z"),
            lastContributionAt: new Date("2026-01-01T12:00:00Z"),
          },
          {
            repoId: statsRepoId,
            identityKey: "email:bob@test.com",
            name: "Bob",
            email: "bob@test.com",
            totalCommitsCount: 1,
            firstContributionAt: new Date("2026-01-02T15:00:00Z"),
            lastContributionAt: new Date("2026-01-02T15:00:00Z"),
          },
        ],
      });

      // Initially, verify that the repository row has discrepancies (since counts are still 0)
      const reportBefore = await verifyRepositoryStatsConsistency(statsRepoId);
      assert.equal(reportBefore.isConsistent, false);
      assert.ok(reportBefore.discrepancies.filesCount);
      assert.ok(reportBefore.discrepancies.commitsCount);
      assert.ok(reportBefore.discrepancies.latestCommitSha);

      // Execute syncRepositoryStats
      const syncResult = await syncRepositoryStats(statsRepoId);

      assert.equal(syncResult.filesCount, 3);
      assert.equal(syncResult.modulesCount, 2);
      assert.equal(syncResult.depsCount, 4);
      assert.equal(syncResult.commitsCount, 2);
      assert.equal(syncResult.contributorsCount, 2);
      assert.equal(syncResult.latestCommitSha, shaNewer);

      // Verify that verifyRepositoryStatsConsistency now passes with 100% consistency
      const reportAfter = await verifyRepositoryStatsConsistency(statsRepoId);
      assert.equal(reportAfter.isConsistent, true);
      assert.equal(Object.keys(reportAfter.discrepancies).length, 0);

      // Verify stored repository row in database
      const repoRow = await db.repository.findUnique({ where: { id: statsRepoId } });
      assert.ok(repoRow);
      assert.equal(repoRow.filesCount, 3);
      assert.equal(repoRow.modulesCount, 2);
      assert.equal(repoRow.depsCount, 4);
      assert.equal(repoRow.commitsCount, 2);
      assert.equal(repoRow.contributorsCount, 2);
      assert.equal(repoRow.latestCommitSha, shaNewer);
    });

    test("Dynamic child modification and resynchronization maintains consistency", async () => {
      // Add 2 more files and 1 more dependency
      await db.fileRecord.createMany({
        data: [
          { repoId: statsRepoId, path: "file4.ts", size: "1KB", type: "code", language: "TS", updatedText: "now" },
          { repoId: statsRepoId, path: "file5.ts", size: "1KB", type: "code", language: "TS", updatedText: "now" },
        ],
      });

      await db.dependencyRecord.create({
        data: {
          key: `dep-${statsRepoId}-5`,
          repoId: statsRepoId,
          kind: "external",
          name: "zod",
        },
      });

      // Resynchronize
      const synced = await syncRepositoryStats(statsRepoId);
      assert.equal(synced.filesCount, 5);
      assert.equal(synced.depsCount, 5);

      const check = await verifyRepositoryStatsConsistency(statsRepoId);
      assert.equal(check.isConsistent, true);
    });
  });

  describe("6. Real Repository Validation (palmerhq/monorepo-starter)", () => {
    const realRepoDir = "C:\\Users\\DELL\\Desktop\\monorepo-starter";
    const realTestRepoId = "repo-real-struct-db-test";

    before(async () => {
      await cleanupAll(realTestRepoId, testProjectId, testOrgId);

      await db.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: "Test Org", slug: "test-struct-org" },
      });
      await db.project.upsert({
        where: { id: testProjectId },
        update: {},
        create: { id: testProjectId, orgId: testOrgId, name: "Test Proj", slug: "test-struct-proj" },
      });
      await db.repository.create({
        data: {
          id: realTestRepoId,
          projectId: testProjectId,
          name: "monorepo-starter",
          owner: "palmerhq",
          defaultBranch: "master",
          localPath: realRepoDir,
        },
      });
    });

    after(async () => {
      await cleanupAll(realTestRepoId, testProjectId, testOrgId);
    });

    test("Ingests real repository Git history & contributors into normalized tables and verifies 100% database consistency", async () => {
      // 1. Ingest real git history
      const gitResult = await ingestGitHistory(realTestRepoId, realRepoDir, {
        branch: "master",
      });
      assert.equal(gitResult.success, true);
      assert.ok(gitResult.commitsSynced > 0, "Real commits must be synced");

      // 2. Ingest contributors from real git history
      const contribResult = await ingestContributors(realTestRepoId);
      assert.equal(contribResult.success, true);
      assert.ok(contribResult.contributorsSynced > 0, "Real contributors must be synced");

      // 3. Verify foreign key links from CommitRecord to ContributorRecord
      const linkedCommits = await db.commitRecord.findMany({
        where: {
          repoId: realTestRepoId,
          authorContributorId: { not: null },
        },
        include: {
          authorContributor: true,
          fileChanges: true,
        },
      });
      assert.ok(linkedCommits.length > 0, "Real commits must link to normalized ContributorRecord");
      assert.ok(linkedCommits[0].authorContributor, "Author contributor must be populated");
      assert.ok(linkedCommits[0].fileChanges.length > 0, "File changes must exist on real commits");

      // 4. Verify unique constraint: Re-ingesting real git history and contributors does not duplicate
      const gitReingest = await ingestGitHistory(realTestRepoId, realRepoDir, {
        branch: "master",
      });
      assert.equal(gitReingest.commitsSynced, gitResult.commitsSynced, "Re-ingestion must not duplicate commits");

      const contribReingest = await ingestContributors(realTestRepoId);
      assert.equal(contribReingest.contributorsSynced, contribResult.contributorsSynced, "Re-ingestion must not duplicate contributors");

      // 5. Synchronize and verify statistics
      const stats = await syncRepositoryStats(realTestRepoId);
      assert.equal(stats.commitsCount, gitResult.commitsSynced);
      assert.equal(stats.contributorsCount, contribResult.contributorsSynced);
      assert.ok(stats.latestCommitSha);

      const consistencyCheck = await verifyRepositoryStatsConsistency(realTestRepoId);
      assert.equal(
        consistencyCheck.isConsistent,
        true,
        `Real repository database state must be 100% consistent: ${JSON.stringify(consistencyCheck.discrepancies)}`
      );
    });
  });
});
