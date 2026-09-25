import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Module from "node:module";
import { execFileSync } from "node:child_process";

// Mock server-only for node:test runner outside Next.js compiler
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, [id, ...args]);
};

import {
  isGitRepository,
  extractGitHistory,
  getLatestCommitSha,
  getDefaultBranch,
  normalizeGitPath,
  resolveNumstatPath,
  mapGitChangeType,
} from "../lib/server/git/extractor";

let db: typeof import("../lib/server/db").db;
let ingestGitHistory: typeof import("../lib/server/git/service").ingestGitHistory;
let getCommitHistory: typeof import("../lib/server/git/service").getCommitHistory;
let getCommit: typeof import("../lib/server/git/service").getCommit;
let getFileHistory: typeof import("../lib/server/git/service").getFileHistory;
let getCommitChanges: typeof import("../lib/server/git/service").getCommitChanges;

function createTempGitRepo(): { repoPath: string; cleanup: () => void } {
  const tmpBase = os.tmpdir();
  const repoPath = fs.mkdtempSync(path.join(tmpBase, "devmind-git-test-"));

  const git = (args: string[]) => {
    return execFileSync("git", args, {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
    });
  };

  git(["init"]);
  git(["config", "user.name", "DevMind Tester"]);
  git(["config", "user.email", "tester@devmind.ai"]);
  git(["config", "commit.gpgsign", "false"]);

  const cleanup = () => {
    try {
      fs.rmSync(repoPath, { recursive: true, force: true });
    } catch {}
  };

  return { repoPath, cleanup };
}

describe("Git History Ingestion Suite", () => {
  before(async () => {
    const dbModule = await import("../lib/server/db");
    db = dbModule.db;
    const gitServiceModule = await import("../lib/server/git/service");
    ingestGitHistory = gitServiceModule.ingestGitHistory;
    getCommitHistory = gitServiceModule.getCommitHistory;
    getCommit = gitServiceModule.getCommit;
    getFileHistory = gitServiceModule.getFileHistory;
    getCommitChanges = gitServiceModule.getCommitChanges;
  });

  describe("1. Extractor & Path Utilities", () => {
    test("normalizeGitPath handles backslashes, leading/trailing slashes, and quotes", () => {
      assert.equal(normalizeGitPath("src\\utils\\file.ts"), "src/utils/file.ts");
      assert.equal(normalizeGitPath("./src/index.ts"), "src/index.ts");
      assert.equal(normalizeGitPath("/app/routes/"), "app/routes");
      assert.equal(normalizeGitPath('"quoted/file name.ts"'), "quoted/file name.ts");
      assert.equal(normalizeGitPath("path//with///slashes.ts"), "path/with/slashes.ts");
      assert.equal(normalizeGitPath(""), "");
    });

    test("resolveNumstatPath extracts destination paths from rename expressions", () => {
      assert.equal(resolveNumstatPath("src/{old => new}.ts"), "src/new.ts");
      assert.equal(resolveNumstatPath("foo/bar.ts => baz/bar.ts"), "baz/bar.ts");
      assert.equal(resolveNumstatPath("src/{ => lib}/index.ts"), "src/lib/index.ts");
      assert.equal(resolveNumstatPath("src/{lib => }/index.ts"), "src/index.ts");
      assert.equal(resolveNumstatPath("simple/path.ts"), "simple/path.ts");
      assert.equal(resolveNumstatPath('"quoted/path.ts"'), "quoted/path.ts");
    });

    test("mapGitChangeType accurately categorizes status letters", () => {
      assert.equal(mapGitChangeType("A"), "ADDED");
      assert.equal(mapGitChangeType("M"), "MODIFIED");
      assert.equal(mapGitChangeType("D"), "DELETED");
      assert.equal(mapGitChangeType("R100"), "RENAMED");
      assert.equal(mapGitChangeType("R085"), "RENAMED");
      assert.equal(mapGitChangeType("C100"), "COPIED");
      assert.equal(mapGitChangeType("T"), "TYPE_CHANGED");
      assert.equal(mapGitChangeType("X"), "UNKNOWN");
    });

    test("isGitRepository distinguishes git repositories from plain directories", async () => {
      const { repoPath, cleanup } = createTempGitRepo();
      try {
        const isRepo = await isGitRepository(repoPath);
        assert.equal(isRepo, true);

        const plainDir = fs.mkdtempSync(path.join(os.tmpdir(), "devmind-plain-dir-"));
        try {
          const isNotRepo = await isGitRepository(plainDir);
          assert.equal(isNotRepo, false);
        } finally {
          fs.rmSync(plainDir, { recursive: true, force: true });
        }
      } finally {
        cleanup();
      }
    });
  });

  describe("2. Real Git Repository Extraction", () => {
    let repoPath: string;
    let cleanup: () => void;

    before(() => {
      const env = createTempGitRepo();
      repoPath = env.repoPath;
      cleanup = env.cleanup;

      const git = (args: string[]) => {
        return execFileSync("git", args, {
          cwd: repoPath,
          encoding: "utf-8",
          stdio: "pipe",
        });
      };

      // Commit 1: Initial files
      fs.writeFileSync(path.join(repoPath, "README.md"), "# Test Project\nLine 1\nLine 2\n");
      fs.mkdirSync(path.join(repoPath, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(repoPath, "src", "index.ts"),
        "export const greeting = 'Hello, DevMind!';\n"
      );
      git(["add", "."]);
      git(["commit", "-m", "Initial commit: Add README and index.ts"]);

      // Commit 2: Modification + Binary file
      fs.appendFileSync(path.join(repoPath, "README.md"), "Line 3 added\n");
      fs.writeFileSync(
        path.join(repoPath, "src", "logo.bin"),
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0xff])
      );
      git(["add", "."]);
      git(["commit", "-m", "feat: update readme and add binary asset"]);

      // Commit 3: Rename + Deletion
      git(["mv", "src/index.ts", "src/main.ts"]);
      git(["rm", "src/logo.bin"]);
      git(["commit", "-m", "refactor: rename index to main, remove logo.bin"]);

      // Commit 4: Unicode commit message
      fs.writeFileSync(
        path.join(repoPath, "i18n.txt"),
        "Multi-language support: العربية 🚀 日本語\n"
      );
      git(["add", "."]);
      git(["commit", "-m", "chore: add unicode file 🌍 - دعم اللغة العربية"]);
    });

    after(() => {
      cleanup();
    });

    test("Extracts real commit metadata without mocks", async () => {
      const commits = await extractGitHistory(repoPath);
      assert.equal(commits.length, 4);

      // Verify newest commit (Commit 4)
      const c4 = commits[0];
      assert.match(c4.message, /chore: add unicode file 🌍 - دعم اللغة العربية/);
      assert.equal(c4.authorName, "DevMind Tester");
      assert.equal(c4.authorEmail, "tester@devmind.ai");
      assert.equal(c4.sha.length, 40);
      assert.equal(c4.shortSha.length >= 7, true);
      assert.equal(c4.parentShas.length, 1);
      assert.equal(c4.fileChanges.length, 1);
      assert.equal(c4.fileChanges[0].newPath, "i18n.txt");
      assert.equal(c4.fileChanges[0].changeType, "ADDED");
      assert.equal(c4.fileChanges[0].additions, 1);
    });

    test("Accurately detects RENAMED, DELETED, and MODIFIED file changes", async () => {
      const commits = await extractGitHistory(repoPath);

      // Commit 3 (Rename and Delete)
      const c3 = commits[1];
      assert.match(c3.message, /refactor: rename index to main, remove logo.bin/);
      assert.equal(c3.fileChanges.length, 2);

      const renameChange = c3.fileChanges.find((f) => f.changeType === "RENAMED");
      assert.ok(renameChange, "Should contain a RENAMED change");
      assert.equal(renameChange.oldPath, "src/index.ts");
      assert.equal(renameChange.newPath, "src/main.ts");
      assert.equal(typeof renameChange.similarity, "number");
      assert.equal(renameChange.similarity! >= 50, true);

      const deleteChange = c3.fileChanges.find((f) => f.changeType === "DELETED");
      assert.ok(deleteChange, "Should contain a DELETED change");
      assert.equal(deleteChange.newPath, "src/logo.bin");
    });

    test("Accurately detects binary files from Git diff", async () => {
      const commits = await extractGitHistory(repoPath);

      // Commit 2 (Added binary asset)
      const c2 = commits[2];
      const binaryChange = c2.fileChanges.find((f) => f.newPath === "src/logo.bin");
      assert.ok(binaryChange, "Should find src/logo.bin");
      assert.equal(binaryChange.isBinary, true);
      assert.equal(binaryChange.changeType, "ADDED");

      const modifiedReadme = c2.fileChanges.find((f) => f.newPath === "README.md");
      assert.ok(modifiedReadme, "Should find README.md");
      assert.equal(modifiedReadme.isBinary, false);
      assert.equal(modifiedReadme.changeType, "MODIFIED");
      assert.equal(modifiedReadme.additions, 1);
      assert.equal(modifiedReadme.deletions, 0);
    });

    test("Supports incremental sync using sinceSha", async () => {
      const allCommits = await extractGitHistory(repoPath);
      const commit2Sha = allCommits[2].sha; // Commit 2

      // Incremental sync since commit 2 should only return commits 3 and 4
      const incremental = await extractGitHistory(repoPath, {
        incremental: true,
        sinceSha: commit2Sha,
      });

      assert.equal(incremental.length, 2);
      assert.equal(incremental[0].sha, allCommits[0].sha);
      assert.equal(incremental[1].sha, allCommits[1].sha);
    });

    test("Supports maxCommits limit parameter", async () => {
      const limited = await extractGitHistory(repoPath, { maxCommits: 2 });
      assert.equal(limited.length, 2);
    });
  });

  describe("3. Database Persistence & Service Layer", () => {
    let repoPath: string;
    let cleanup: () => void;
    const testOrgId = "org-git-test";
    const testProjectId = "proj-git-test";
    const testRepoId = "repo-git-test-sample";

    before(async () => {
      const env = createTempGitRepo();
      repoPath = env.repoPath;
      cleanup = env.cleanup;

      const git = (args: string[]) => {
        return execFileSync("git", args, {
          cwd: repoPath,
          encoding: "utf-8",
          stdio: "pipe",
        });
      };

      fs.writeFileSync(path.join(repoPath, "app.ts"), "console.log('App running');\n");
      git(["add", "."]);
      git(["commit", "-m", "init: app.ts"]);

      fs.appendFileSync(path.join(repoPath, "app.ts"), "console.log('Update');\n");
      git(["add", "."]);
      git(["commit", "-m", "update: app.ts with second line"]);

      // Seed database records
      await db.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: {
          id: testOrgId,
          name: "Git Test Org",
          slug: "git-test-org",
        },
      });

      await db.project.upsert({
        where: { id: testProjectId },
        update: {},
        create: {
          id: testProjectId,
          orgId: testOrgId,
          name: "Git Test Project",
          slug: "git-test-project",
        },
      });

      await db.repository.upsert({
        where: { id: testRepoId },
        update: {
          localPath: repoPath,
          gitSyncStatus: "NOT_SYNCED",
        },
        create: {
          id: testRepoId,
          projectId: testProjectId,
          name: testRepoId,
          owner: "test-owner",
          localPath: repoPath,
          gitSyncStatus: "NOT_SYNCED",
        },
      });
    });

    after(async () => {
      cleanup();
      try {
        await db.commitFileChangeRecord.deleteMany({ where: { repoId: testRepoId } });
        await db.commitRecord.deleteMany({ where: { repoId: testRepoId } });
        await db.repository.deleteMany({ where: { id: testRepoId } });
        await db.project.deleteMany({ where: { id: testProjectId } });
        await db.organization.deleteMany({ where: { id: testOrgId } });
      } catch {}
    });

    test("ingestGitHistory persists real commits and file changes into database", async () => {
      const result = await ingestGitHistory(testRepoId, repoPath);

      assert.equal(result.success, true);
      assert.equal(result.commitsSynced, 2);
      assert.equal(result.fileChangesSynced >= 2, true);
      assert.ok(result.latestCommitSha);

      // Verify repository updated in DB
      const repoRecord = await db.repository.findUnique({
        where: { id: testRepoId },
      });
      assert.equal(repoRecord?.gitSyncStatus, "COMPLETED");
      assert.equal(repoRecord?.commitsCount, 2);
      assert.equal(repoRecord?.latestCommitSha, result.latestCommitSha);
      assert.ok(repoRecord?.lastGitSyncAt);

      // Verify commit records in DB
      const dbCommits = await db.commitRecord.findMany({
        where: { repoId: testRepoId },
        include: { fileChanges: true },
        orderBy: { committedAt: "desc" },
      });
      assert.equal(dbCommits.length, 2);
      const updateCommit = dbCommits.find((c) => c.message.includes("update: app.ts"));
      assert.ok(updateCommit, "Should find commit with message update: app.ts");
      assert.equal(updateCommit.fileChanges.length, 1);
      assert.equal(updateCommit.fileChanges[0].newPath, "app.ts");
      assert.equal(updateCommit.fileChanges[0].changeType, "MODIFIED");

      const initCommit = dbCommits.find((c) => c.message.includes("init: app.ts"));
      assert.ok(initCommit, "Should find commit with message init: app.ts");
      assert.equal(initCommit.fileChanges.length, 1);
      assert.equal(initCommit.fileChanges[0].newPath, "app.ts");
      assert.equal(initCommit.fileChanges[0].changeType, "ADDED");
    });

    test("ingestGitHistory is idempotent and does not create duplicate records", async () => {
      // Re-run sync on the same repository
      const reSyncResult = await ingestGitHistory(testRepoId, repoPath);

      assert.equal(reSyncResult.success, true);
      assert.equal(reSyncResult.commitsSynced, 2);

      const commitCount = await db.commitRecord.count({
        where: { repoId: testRepoId },
      });
      assert.equal(commitCount, 2, "Commit count should remain exactly 2 after re-sync");

      const fileChangesCount = await db.commitFileChangeRecord.count({
        where: { repoId: testRepoId },
      });
      assert.equal(fileChangesCount, 2, "File changes count should remain exactly 2");
    });

    test("Query service functions: getCommitHistory, getCommit, getFileHistory, getCommitChanges", async () => {
      // 1. getCommitHistory
      const history = await getCommitHistory(testRepoId, { limit: 10 });
      assert.equal(history.length, 2);
      assert.ok(history[0].fileChanges.length > 0);

      // 2. getCommit by full SHA and short SHA
      const latestSha = history[0].sha;
      const commitBySha = await getCommit(testRepoId, latestSha);
      assert.ok(commitBySha);
      assert.equal(commitBySha.sha, latestSha);

      const commitByShortSha = await getCommit(testRepoId, history[0].shortSha);
      assert.ok(commitByShortSha);
      assert.equal(commitByShortSha.sha, latestSha);

      // 3. getFileHistory
      const fileHistory = await getFileHistory(testRepoId, "app.ts");
      assert.equal(fileHistory.length, 2);
      assert.ok(fileHistory[0].commit);

      // 4. getCommitChanges
      const changes = await getCommitChanges(testRepoId, latestSha);
      assert.equal(changes.length, 1);
      assert.equal(changes[0].newPath, "app.ts");
    });

    test("Gracefully handles non-git directories and reports failure without throwing", async () => {
      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "devmind-fake-repo-"));
      try {
        const result = await ingestGitHistory(testRepoId, nonGitDir);
        assert.equal(result.success, false);
        assert.ok(result.error);
        assert.match(result.error, /not a valid Git repository/i);

        const repo = await db.repository.findUnique({
          where: { id: testRepoId },
        });
        assert.equal(repo?.gitSyncStatus, "FAILED");
        assert.ok(repo?.gitSyncError);
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
      }
    });
  });

  describe("4. Real Repository Validation (palmerhq/monorepo-starter)", () => {
    const monorepoPath = "C:/Users/DELL/Desktop/monorepo-starter";
    const monorepoRepoId = "repo-monorepo-starter-val";

    before(async () => {
      await db.organization.upsert({
        where: { id: "org-monorepo-test" },
        update: {},
        create: {
          id: "org-monorepo-test",
          name: "Monorepo Test Org",
          slug: "monorepo-test-org",
        },
      });

      await db.project.upsert({
        where: { id: "proj-monorepo-test" },
        update: {},
        create: {
          id: "proj-monorepo-test",
          orgId: "org-monorepo-test",
          name: "Monorepo Test Project",
          slug: "monorepo-test-proj",
        },
      });

      // Seed monorepo test record
      await db.repository.upsert({
        where: { id: monorepoRepoId },
        update: {
          projectId: "proj-monorepo-test",
          localPath: monorepoPath,
          gitSyncStatus: "NOT_SYNCED",
        },
        create: {
          id: monorepoRepoId,
          projectId: "proj-monorepo-test",
          name: "monorepo-starter",
          owner: "palmerhq",
          localPath: monorepoPath,
          gitSyncStatus: "NOT_SYNCED",
        },
      });
    });

    after(async () => {
      try {
        await db.commitFileChangeRecord.deleteMany({ where: { repoId: monorepoRepoId } });
        await db.commitRecord.deleteMany({ where: { repoId: monorepoRepoId } });
        await db.repository.deleteMany({ where: { id: monorepoRepoId } });
        await db.project.deleteMany({ where: { id: "proj-monorepo-test" } });
        await db.organization.deleteMany({ where: { id: "org-monorepo-test" } });
      } catch {}
    });

    test("Ingests all 24 real commits from palmerhq/monorepo-starter into SQLite", async () => {
      const result = await ingestGitHistory(monorepoRepoId, monorepoPath);

      assert.equal(result.success, true);
      assert.equal(result.commitsSynced, 24, "Should sync all 24 commits from monorepo-starter");
      assert.ok(result.fileChangesSynced > 100, "Should have synced over 100 file changes across commits");
      assert.equal(result.latestCommitSha?.startsWith("92ef9fe"), true);

      // Verify in DB
      const dbCount = await db.commitRecord.count({
        where: { repoId: monorepoRepoId },
      });
      assert.equal(dbCount, 24);

      // Verify merge commit 92ef9fe has 2 parents
      const mergeCommit = await db.commitRecord.findUnique({
        where: {
          repoId_sha: {
            repoId: monorepoRepoId,
            sha: "92ef9fe5c5866e48539999c53980e3dce95bbc49",
          },
        },
      });
      assert.ok(mergeCommit);
      const parents = JSON.parse(mergeCommit.parentShasJson);
      assert.equal(parents.length, 2);
      assert.equal(parents[0].startsWith("7800ea4"), true);
      assert.equal(parents[1].startsWith("77eaa4e"), true);

      // Verify binary file change detection for ian-white.png
      const binaryFileChange = await db.commitFileChangeRecord.findFirst({
        where: {
          repoId: monorepoRepoId,
          newPath: "mono-jvm/mono-api/src/test/resources/media/ian-white.png",
          commitSha: "77eaa4efc872b4399b48dda9e5d334ffc5020b9f",
        },
      });
      assert.ok(binaryFileChange);
      assert.equal(binaryFileChange.isBinary, true);
      assert.equal(binaryFileChange.changeType, "MODIFIED");

      // Verify file history for README.md across multiple commits
      const readmeHistory = await getFileHistory(monorepoRepoId, "README.md");
      assert.ok(readmeHistory.length >= 3, "README.md was updated across multiple commits");
    });
  });

  describe("5. Incremental Synchronization & Cascade Deletion", () => {
    let repoPath: string;
    let cleanup: () => void;
    const testRepoId = "repo-inc-test";
    const testProjectId = "proj-inc-test";
    const testOrgId = "org-inc-test";

    before(async () => {
      const env = createTempGitRepo();
      repoPath = env.repoPath;
      cleanup = env.cleanup;

      const git = (args: string[]) => {
        return execFileSync("git", args, {
          cwd: repoPath,
          encoding: "utf-8",
          stdio: "pipe",
        });
      };

      // Initial 2 commits
      fs.writeFileSync(path.join(repoPath, "file1.ts"), "const a = 1;\n");
      git(["add", "."]);
      git(["commit", "-m", "commit 1: file1"]);

      fs.writeFileSync(path.join(repoPath, "file2.ts"), "const b = 2;\n");
      git(["add", "."]);
      git(["commit", "-m", "commit 2: file2"]);

      await db.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: "Inc Org", slug: "inc-org" },
      });

      await db.project.upsert({
        where: { id: testProjectId },
        update: {},
        create: { id: testProjectId, orgId: testOrgId, name: "Inc Proj", slug: "inc-proj" },
      });

      await db.repository.upsert({
        where: { id: testRepoId },
        update: { localPath: repoPath, gitSyncStatus: "NOT_SYNCED" },
        create: {
          id: testRepoId,
          projectId: testProjectId,
          name: "inc-repo",
          owner: "inc-owner",
          localPath: repoPath,
          gitSyncStatus: "NOT_SYNCED",
        },
      });
    });

    after(async () => {
      cleanup();
      try {
        await db.commitFileChangeRecord.deleteMany({ where: { repoId: testRepoId } });
        await db.commitRecord.deleteMany({ where: { repoId: testRepoId } });
        await db.repository.deleteMany({ where: { id: testRepoId } });
        await db.project.deleteMany({ where: { id: testProjectId } });
        await db.organization.deleteMany({ where: { id: testOrgId } });
      } catch {}
    });

    test("Incremental sync only ingests new commits made after previous sync", async () => {
      const git = (args: string[]) => {
        return execFileSync("git", args, {
          cwd: repoPath,
          encoding: "utf-8",
          stdio: "pipe",
        });
      };

      // Step 1: Initial sync (2 commits)
      const initialSync = await ingestGitHistory(testRepoId, repoPath);
      assert.equal(initialSync.success, true);
      assert.equal(initialSync.commitsSynced, 2);

      // Step 2: Make 3rd commit in repo
      fs.writeFileSync(path.join(repoPath, "file3.ts"), "const c = 3;\n");
      git(["add", "."]);
      git(["commit", "-m", "commit 3: file3 added"]);

      // Step 3: Run incremental sync
      const incSync = await ingestGitHistory(testRepoId, repoPath, { incremental: true });
      assert.equal(incSync.success, true);
      assert.equal(incSync.commitsSynced, 1, "Incremental sync should only sync the 1 new commit");

      // Verify total in DB is now 3
      const totalCount = await db.commitRecord.count({ where: { repoId: testRepoId } });
      assert.equal(totalCount, 3, "Total commits in DB should now be 3");

      const latestCommit = await db.commitRecord.findFirst({
        where: { repoId: testRepoId },
        orderBy: { committedAt: "desc" },
      });
      assert.match(latestCommit?.message || "", /commit 3: file3 added/);
    });

    test("Cascade deletion cleans up all commits and file changes when repository is deleted", async () => {
      // Confirm records exist before deletion
      const commitsBefore = await db.commitRecord.count({ where: { repoId: testRepoId } });
      assert.equal(commitsBefore, 3);
      const changesBefore = await db.commitFileChangeRecord.count({ where: { repoId: testRepoId } });
      assert.ok(changesBefore >= 3);

      // Delete the repository
      await db.repository.delete({ where: { id: testRepoId } });

      // Verify cascade deletion
      const commitsAfter = await db.commitRecord.count({ where: { repoId: testRepoId } });
      assert.equal(commitsAfter, 0, "All commits should be cascade deleted");

      const changesAfter = await db.commitFileChangeRecord.count({ where: { repoId: testRepoId } });
      assert.equal(changesAfter, 0, "All commit file changes should be cascade deleted");
    });
  });
});

