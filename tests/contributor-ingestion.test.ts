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

import {
  normalizeEmail,
  normalizeName,
  getContributorIdentityKey,
  selectBetterName,
} from "../lib/server/contributors/identity";

let db: typeof import("../lib/server/db").db;
let ingestContributors: typeof import("../lib/server/contributors/service").ingestContributors;
let getContributors: typeof import("../lib/server/contributors/service").getContributors;
let getContributor: typeof import("../lib/server/contributors/service").getContributor;
let getContributorCommits: typeof import("../lib/server/contributors/service").getContributorCommits;
let ingestGitHistory: typeof import("../lib/server/git/service").ingestGitHistory;

describe("Contributor Ingestion Test Suite", () => {
  before(async () => {
    const dbModule = await import("../lib/server/db");
    db = dbModule.db;
    const contribModule = await import("../lib/server/contributors/service");
    ingestContributors = contribModule.ingestContributors;
    getContributors = contribModule.getContributors;
    getContributor = contribModule.getContributor;
    getContributorCommits = contribModule.getContributorCommits;
    const gitModule = await import("../lib/server/git/service");
    ingestGitHistory = gitModule.ingestGitHistory;
  });

  describe("1. Identity Normalization & Key Derivation", () => {
    test("normalizeEmail standardizes casing, trims whitespace, and validates format", () => {
      assert.equal(normalizeEmail("  Alice@Example.COM  "), "alice@example.com");
      assert.equal(normalizeEmail("invalid-email"), null);
      assert.equal(normalizeEmail(""), null);
      assert.equal(normalizeEmail(null), null);
      assert.equal(normalizeEmail(undefined), null);
    });

    test("normalizeName collapses inner spaces, trims whitespace, and provides fallback", () => {
      assert.equal(normalizeName("  Bob   Smith  "), "Bob Smith");
      assert.equal(normalizeName(""), "Unknown Contributor");
      assert.equal(normalizeName(null), "Unknown Contributor");
      assert.equal(normalizeName(undefined), "Unknown Contributor");
    });

    test("Generates email-based identity key for valid emails", () => {
      const res = getContributorIdentityKey("Alice Wonder", "Alice@Wonderland.org");
      assert.equal(res.identityKey, "email:alice@wonderland.org");
      assert.equal(res.normalizedName, "Alice Wonder");
      assert.equal(res.normalizedEmail, "alice@wonderland.org");
    });

    test("Generates name-based identity key when email is missing or empty", () => {
      const res1 = getContributorIdentityKey("Dev Charlie", "");
      assert.equal(res1.identityKey, "name:dev charlie");
      assert.equal(res1.normalizedName, "Dev Charlie");
      assert.equal(res1.normalizedEmail, null);

      const res2 = getContributorIdentityKey("Dev Charlie", null);
      assert.equal(res2.identityKey, "name:dev charlie");
    });

    test("Handles missing/empty author and committer fields gracefully", () => {
      const res = getContributorIdentityKey(null, null);
      assert.equal(res.identityKey, "unknown:anonymous");
      assert.equal(res.normalizedName, "Unknown Contributor");
      assert.equal(res.normalizedEmail, null);

      const resEmpty = getContributorIdentityKey("   ", "   ");
      assert.equal(resEmpty.identityKey, "unknown:anonymous");
      assert.equal(resEmpty.normalizedName, "Unknown Contributor");
      assert.equal(resEmpty.normalizedEmail, null);
    });

    test("Preserves distinct identities for different emails even with identical names", () => {
      const dev1 = getContributorIdentityKey("John Smith", "john.work@corp.com");
      const dev2 = getContributorIdentityKey("John Smith", "john.personal@gmail.com");

      assert.notEqual(dev1.identityKey, dev2.identityKey);
      assert.equal(dev1.identityKey, "email:john.work@corp.com");
      assert.equal(dev2.identityKey, "email:john.personal@gmail.com");
    });

    test("Qualifies generic bot/noreply emails with name to avoid false merging", () => {
      const bot1 = getContributorIdentityKey("Dependabot", "noreply@github.com");
      const bot2 = getContributorIdentityKey("GitHub WebFlow", "noreply@github.com");

      assert.notEqual(bot1.identityKey, bot2.identityKey);
      assert.equal(bot1.identityKey, "email:noreply@github.com:dependabot");
      assert.equal(bot2.identityKey, "email:noreply@github.com:github webflow");
    });

    test("selectBetterName picks more complete or properly cased names", () => {
      assert.equal(selectBetterName("jared", "Jared Palmer"), "Jared Palmer");
      assert.equal(selectBetterName("Unknown Contributor", "Alice"), "Alice");
      assert.equal(selectBetterName("Bob", "Unknown Contributor"), "Bob");
      assert.equal(selectBetterName("Jared Palmer", "jared"), "Jared Palmer");
    });
  });

  describe("2. Database Contributor Derivation & Statistics Calculation", () => {
    const testOrgId = "org-contrib-test";
    const testProjectId = "proj-contrib-test";
    const testRepoId = "repo-contrib-test";

    before(async () => {
      await db.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: "Contrib Org", slug: "contrib-org" },
      });

      await db.project.upsert({
        where: { id: testProjectId },
        update: {},
        create: { id: testProjectId, orgId: testOrgId, name: "Contrib Proj", slug: "contrib-proj" },
      });

      await db.repository.upsert({
        where: { id: testRepoId },
        update: { contributorsCount: 0 },
        create: {
          id: testRepoId,
          projectId: testProjectId,
          name: "contrib-repo",
          owner: "contrib-owner",
          contributorsCount: 0,
        },
      });

      // Clear existing records
      await db.commitFileChangeRecord.deleteMany({ where: { repoId: testRepoId } });
      await db.commitRecord.deleteMany({ where: { repoId: testRepoId } });
      await db.contributorRecord.deleteMany({ where: { repoId: testRepoId } });

      // Create Commit 1: Author Alice, Committer Alice
      const commit1 = await db.commitRecord.create({
        data: {
          repoId: testRepoId,
          sha: "1111111111111111111111111111111111111111",
          shortSha: "1111111",
          message: "feat: add user service",
          authorName: "Alice Smith",
          authorEmail: "alice@example.com",
          committerName: "Alice Smith",
          committerEmail: "alice@example.com",
          authoredAt: new Date("2026-01-01T10:00:00Z"),
          committedAt: new Date("2026-01-01T10:00:00Z"),
          fileChanges: {
            create: [
              {
                repoId: testRepoId,
                commitSha: "1111111111111111111111111111111111111111",
                newPath: "src/user.ts",
                changeType: "ADDED",
                additions: 50,
                deletions: 0,
              },
              {
                repoId: testRepoId,
                commitSha: "1111111111111111111111111111111111111111",
                newPath: "README.md",
                changeType: "MODIFIED",
                additions: 10,
                deletions: 2,
              },
            ],
          },
        },
      });

      // Create Commit 2: Author Alice, Committer Bob (maintainer merge)
      const commit2 = await db.commitRecord.create({
        data: {
          repoId: testRepoId,
          sha: "2222222222222222222222222222222222222222",
          shortSha: "2222222",
          message: "fix: update user validation",
          authorName: "Alice Smith",
          authorEmail: "alice@example.com",
          committerName: "Bob Maintainer",
          committerEmail: "bob@maintainer.io",
          authoredAt: new Date("2026-01-05T12:00:00Z"),
          committedAt: new Date("2026-01-06T14:00:00Z"),
          fileChanges: {
            create: [
              {
                repoId: testRepoId,
                commitSha: "2222222222222222222222222222222222222222",
                newPath: "src/user.ts",
                changeType: "MODIFIED",
                additions: 15,
                deletions: 5,
              },
            ],
          },
        },
      });

      // Create Commit 3: Author Charlie, Committer Charlie
      const commit3 = await db.commitRecord.create({
        data: {
          repoId: testRepoId,
          sha: "3333333333333333333333333333333333333333",
          shortSha: "3333333",
          message: "docs: update api docs",
          authorName: "Charlie Brown",
          authorEmail: "charlie@peanuts.com",
          committerName: "Charlie Brown",
          committerEmail: "charlie@peanuts.com",
          authoredAt: new Date("2026-01-10T09:00:00Z"),
          committedAt: new Date("2026-01-10T09:00:00Z"),
          fileChanges: {
            create: [
              {
                repoId: testRepoId,
                commitSha: "3333333333333333333333333333333333333333",
                newPath: "docs/api.md",
                changeType: "ADDED",
                additions: 100,
                deletions: 0,
              },
            ],
          },
        },
      });
    });

    after(async () => {
      try {
        await db.commitFileChangeRecord.deleteMany({ where: { repoId: testRepoId } });
        await db.commitRecord.deleteMany({ where: { repoId: testRepoId } });
        await db.contributorRecord.deleteMany({ where: { repoId: testRepoId } });
        await db.repository.deleteMany({ where: { id: testRepoId } });
        await db.project.deleteMany({ where: { id: testProjectId } });
        await db.organization.deleteMany({ where: { id: testOrgId } });
      } catch {}
    });

    test("Derives contributors with correct author and committer statistics", async () => {
      const result = await ingestContributors(testRepoId);

      assert.equal(result.success, true);
      assert.equal(result.contributorsSynced, 3); // Alice, Bob, Charlie

      // Verify Alice stats
      const alice = await db.contributorRecord.findUnique({
        where: {
          repoId_identityKey: {
            repoId: testRepoId,
            identityKey: "email:alice@example.com",
          },
        },
      });
      assert.ok(alice);
      assert.equal(alice.name, "Alice Smith");
      assert.equal(alice.email, "alice@example.com");
      assert.equal(alice.isAuthor, true);
      assert.equal(alice.isCommitter, true);
      assert.equal(alice.authoredCommitsCount, 2);
      assert.equal(alice.committedCommitsCount, 1);
      assert.equal(alice.totalCommitsCount, 2);
      assert.equal(alice.additions, 75); // 50 + 10 + 15
      assert.equal(alice.deletions, 7); // 2 + 5
      assert.equal(alice.filesTouchedCount, 2); // src/user.ts and README.md
      assert.equal(alice.firstContributionAt.toISOString(), "2026-01-01T10:00:00.000Z");
      assert.equal(alice.lastContributionAt.toISOString(), "2026-01-05T12:00:00.000Z");

      // Verify Bob stats (Committer only)
      const bob = await db.contributorRecord.findUnique({
        where: {
          repoId_identityKey: {
            repoId: testRepoId,
            identityKey: "email:bob@maintainer.io",
          },
        },
      });
      assert.ok(bob);
      assert.equal(bob.name, "Bob Maintainer");
      assert.equal(bob.isAuthor, false);
      assert.equal(bob.isCommitter, true);
      assert.equal(bob.authoredCommitsCount, 0);
      assert.equal(bob.committedCommitsCount, 1);
      assert.equal(bob.totalCommitsCount, 1);

      // Verify Charlie stats
      const charlie = await db.contributorRecord.findUnique({
        where: {
          repoId_identityKey: {
            repoId: testRepoId,
            identityKey: "email:charlie@peanuts.com",
          },
        },
      });
      assert.ok(charlie);
      assert.equal(charlie.name, "Charlie Brown");
      assert.equal(charlie.authoredCommitsCount, 1);
      assert.equal(charlie.additions, 100);
      assert.equal(charlie.filesTouchedCount, 1);

      // Verify Repository contributorsCount is updated
      const repo = await db.repository.findUnique({ where: { id: testRepoId } });
      assert.equal(repo?.contributorsCount, 3);
    });

    test("Links commits to their authorContributor and committerContributor records", async () => {
      const commit2 = await db.commitRecord.findUnique({
        where: {
          repoId_sha: {
            repoId: testRepoId,
            sha: "2222222222222222222222222222222222222222",
          },
        },
        include: {
          authorContributor: true,
          committerContributor: true,
        },
      });

      assert.ok(commit2);
      assert.equal(commit2.authorContributor?.email, "alice@example.com");
      assert.equal(commit2.committerContributor?.email, "bob@maintainer.io");
    });

    test("Idempotency: Re-running ingestion updates statistics without creating duplicates", async () => {
      const reSync = await ingestContributors(testRepoId);
      assert.equal(reSync.success, true);
      assert.equal(reSync.contributorsSynced, 3);

      const totalCount = await db.contributorRecord.count({
        where: { repoId: testRepoId },
      });
      assert.equal(totalCount, 3, "Should maintain exactly 3 contributors after re-running");
    });

    test("Query helpers: getContributors, getContributor, getContributorCommits", async () => {
      // 1. getContributors sorted by commits
      const byCommits = await getContributors(testRepoId, { sortBy: "commits" });
      assert.equal(byCommits.length, 3);
      assert.equal(byCommits[0].name, "Alice Smith"); // 2 commits

      // 2. getContributors sorted by additions
      const byAdditions = await getContributors(testRepoId, { sortBy: "additions" });
      assert.equal(byAdditions[0].name, "Charlie Brown"); // 100 additions

      // 3. getContributors filtered by author role
      const authorsOnly = await getContributors(testRepoId, { role: "author" });
      assert.equal(authorsOnly.length, 2); // Alice and Charlie

      // 4. getContributors filtered by committer role
      const committersOnly = await getContributors(testRepoId, { role: "committer" });
      assert.equal(committersOnly.length, 3); // Alice, Bob, Charlie

      // 5. getContributor by identityKey
      const aliceRecord = await getContributor(testRepoId, "email:alice@example.com");
      assert.ok(aliceRecord);
      assert.equal(aliceRecord.authoredCommits.length, 2);

      // 6. getContributorCommits
      const aliceCommits = await getContributorCommits(testRepoId, aliceRecord.id);
      assert.equal(aliceCommits.length, 2);
    });
  });

  describe("3. Edge Cases: Empty Repositories & Missing Metadata", () => {
    const emptyRepoId = "repo-empty-test";
    const emptyProjectId = "proj-empty-test";
    const emptyOrgId = "org-empty-test";

    before(async () => {
      await db.organization.upsert({
        where: { id: emptyOrgId },
        update: {},
        create: { id: emptyOrgId, name: "Empty Org", slug: "empty-org" },
      });

      await db.project.upsert({
        where: { id: emptyProjectId },
        update: {},
        create: { id: emptyProjectId, orgId: emptyOrgId, name: "Empty Proj", slug: "empty-proj" },
      });

      await db.repository.upsert({
        where: { id: emptyRepoId },
        update: { contributorsCount: 5 },
        create: {
          id: emptyRepoId,
          projectId: emptyProjectId,
          name: "empty-repo",
          owner: "empty-owner",
          contributorsCount: 5,
        },
      });
    });

    after(async () => {
      try {
        await db.commitFileChangeRecord.deleteMany({ where: { repoId: emptyRepoId } });
        await db.commitRecord.deleteMany({ where: { repoId: emptyRepoId } });
        await db.contributorRecord.deleteMany({ where: { repoId: emptyRepoId } });
        await db.repository.deleteMany({ where: { id: emptyRepoId } });
        await db.project.deleteMany({ where: { id: emptyProjectId } });
        await db.organization.deleteMany({ where: { id: emptyOrgId } });
      } catch {}
    });

    test("Gracefully handles repositories with zero commits and resets contributorsCount to 0", async () => {
      const result = await ingestContributors(emptyRepoId);
      assert.equal(result.success, true);
      assert.equal(result.contributorsSynced, 0);

      const repo = await db.repository.findUnique({ where: { id: emptyRepoId } });
      assert.equal(repo?.contributorsCount, 0);

      const count = await db.contributorRecord.count({ where: { repoId: emptyRepoId } });
      assert.equal(count, 0);
    });

    test("Gracefully handles commits with empty/missing author and committer fields", async () => {
      const anonCommit = await db.commitRecord.create({
        data: {
          repoId: emptyRepoId,
          sha: "4444444444444444444444444444444444444444",
          shortSha: "4444444",
          message: "anonymous commit",
          authorName: "",
          authorEmail: "",
          committerName: null,
          committerEmail: null,
          authoredAt: new Date("2026-02-01T00:00:00Z"),
          committedAt: new Date("2026-02-01T00:00:00Z"),
        },
      });

      const result = await ingestContributors(emptyRepoId);
      assert.equal(result.success, true);
      assert.equal(result.contributorsSynced, 1);

      const contrib = await db.contributorRecord.findFirst({
        where: { repoId: emptyRepoId },
      });
      assert.ok(contrib);
      assert.equal(contrib.identityKey, "unknown:anonymous");
      assert.equal(contrib.name, "Unknown Contributor");
      assert.equal(contrib.email, null);
      assert.equal(contrib.authoredCommitsCount, 1);
    });
  });

  describe("4. Real Repository Validation (palmerhq/monorepo-starter)", () => {
    const monorepoPath = "C:/Users/DELL/Desktop/monorepo-starter";
    const monorepoRepoId = "repo-monorepo-starter-contrib-val";
    const monorepoProjId = "proj-monorepo-contrib-val";
    const monorepoOrgId = "org-monorepo-contrib-val";

    before(async () => {
      await db.organization.upsert({
        where: { id: monorepoOrgId },
        update: {},
        create: { id: monorepoOrgId, name: "Monorepo Org", slug: "monorepo-org" },
      });

      await db.project.upsert({
        where: { id: monorepoProjId },
        update: {},
        create: { id: monorepoProjId, orgId: monorepoOrgId, name: "Monorepo Proj", slug: "monorepo-proj" },
      });

      await db.repository.upsert({
        where: { id: monorepoRepoId },
        update: { localPath: monorepoPath, gitSyncStatus: "NOT_SYNCED" },
        create: {
          id: monorepoRepoId,
          projectId: monorepoProjId,
          name: "monorepo-starter",
          owner: "palmerhq",
          localPath: monorepoPath,
          gitSyncStatus: "NOT_SYNCED",
        },
      });

      // Ingest real Git history first
      await ingestGitHistory(monorepoRepoId, monorepoPath);
    });

    after(async () => {
      try {
        await db.commitFileChangeRecord.deleteMany({ where: { repoId: monorepoRepoId } });
        await db.commitRecord.deleteMany({ where: { repoId: monorepoRepoId } });
        await db.contributorRecord.deleteMany({ where: { repoId: monorepoRepoId } });
        await db.repository.deleteMany({ where: { id: monorepoRepoId } });
        await db.project.deleteMany({ where: { id: monorepoProjId } });
        await db.organization.deleteMany({ where: { id: monorepoOrgId } });
      } catch {}
    });

    test("Derives real contributors from monorepo-starter Git history", async () => {
      const result = await ingestContributors(monorepoRepoId);

      assert.equal(result.success, true);
      assert.ok(result.contributorsSynced >= 2, "Should have multiple contributors in monorepo-starter");

      const contributors = await getContributors(monorepoRepoId, { sortBy: "commits" });

      // Lead contributor is Jared Palmer
      const lead = contributors[0];
      assert.match(lead.name, /Jared Palmer/i);
      assert.ok(lead.totalCommitsCount >= 10, "Lead contributor should have at least 10 commits");
      assert.ok(lead.additions > 1000, "Lead contributor should have over 1000 additions");
      assert.ok(lead.filesTouchedCount > 10, "Lead contributor should have touched over 10 files");

      // Verify ImgBot contributor
      const imgbot = contributors.find((c) => c.email === "imgbothelp@gmail.com");
      assert.ok(imgbot, "Should find ImgBot contributor");
      assert.match(imgbot.name, /ImgBot/i);
      assert.equal(imgbot.isAuthor, true);

      // Verify repository metadata updated
      const repo = await db.repository.findUnique({ where: { id: monorepoRepoId } });
      assert.equal(repo?.contributorsCount, contributors.length);
    });
  });
});
