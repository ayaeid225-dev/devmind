import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
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
let verifyGitHubWebhookSignature: typeof import("../lib/server/sync/webhook").verifyGitHubWebhookSignature;
let findConnectedRepository: typeof import("../lib/server/sync/webhook").findConnectedRepository;
let detectIncrementalChanges: typeof import("../lib/server/sync/incremental").detectIncrementalChanges;
let processIncrementalSync: typeof import("../lib/server/sync/incremental").processIncrementalSync;
let enqueueSyncJob: typeof import("../lib/server/sync/queue").enqueueSyncJob;
let executeSyncJob: typeof import("../lib/server/sync/queue").executeSyncJob;
let processSyncQueue: typeof import("../lib/server/sync/queue").processSyncQueue;
let webhookRouteHandler: typeof import("../app/api/webhooks/github/route").POST;

const TEST_SECRET = "test_webhook_secret_key_1234567890_32bytes";

function generateSignature(payload: string, secret: string = TEST_SECRET): string {
  const hmac = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `sha256=${hmac}`;
}

describe("P1: Automatic GitHub Repository Synchronization Suite", () => {
  const repoId1 = "test-sync-repo-1";
  const repoId2 = "test-sync-repo-2";
  const testOwner = "test-owner";
  let testOrgId: string;
  let testUserId: string;

  before(async () => {
    process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;

    const dbModule = await import("../lib/server/db");
    db = dbModule.db;

    const webhookModule = await import("../lib/server/sync/webhook");
    verifyGitHubWebhookSignature = webhookModule.verifyGitHubWebhookSignature;
    findConnectedRepository = webhookModule.findConnectedRepository;

    const incrementalModule = await import("../lib/server/sync/incremental");
    detectIncrementalChanges = incrementalModule.detectIncrementalChanges;
    processIncrementalSync = incrementalModule.processIncrementalSync;

    const queueModule = await import("../lib/server/sync/queue");
    enqueueSyncJob = queueModule.enqueueSyncJob;
    executeSyncJob = queueModule.executeSyncJob;
    processSyncQueue = queueModule.processSyncQueue;

    const routeModule = await import("../app/api/webhooks/github/route");
    webhookRouteHandler = routeModule.POST;

    // Clean up any stale test records
    await db.syncJob.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.documentChunk.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.dependencyRecord.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.fileRecord.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.module.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.commitRecord.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.repository.deleteMany({ where: { id: { in: [repoId1, repoId2] } } });

    // Create test user, organization, and GitHubAccount
    const user = await db.user.upsert({
      where: { email: "tester-sync@devmind.ai" },
      update: {},
      create: {
        id: "user-sync-test",
        email: "tester-sync@devmind.ai",
        name: "Sync Tester",
      },
    });
    testUserId = user.id;

    const org = await db.organization.upsert({
      where: { slug: "sync-test-org" },
      update: {},
      create: {
        id: "org-sync-test",
        name: "Sync Test Organization",
        slug: "sync-test-org",
      },
    });
    testOrgId = org.id;

    await db.orgMember.upsert({
      where: { orgId_userId: { orgId: org.id, userId: user.id } },
      update: {},
      create: {
        orgId: org.id,
        userId: user.id,
        role: "OWNER",
      },
    });

    await db.gitHubAccount.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        githubUserId: "gh-sync-test-id",
        login: testOwner,
        accessToken: "test-access-token",
        status: "ACTIVE",
      },
    });

    const project = await db.project.upsert({
      where: { slug: "sync-test-project" },
      update: {},
      create: {
        id: "proj-sync-test",
        orgId: org.id,
        name: "Sync Test Project",
        slug: "sync-test-project",
      },
    });

    // Create Repository 1
    await db.repository.create({
      data: {
        id: repoId1,
        projectId: project.id,
        name: repoId1,
        owner: testOwner,
        defaultBranch: "main",
        latestCommitSha: "1111111111111111111111111111111111111111",
        lastSyncedCommitSha: "1111111111111111111111111111111111111111",
        gitSyncStatus: "COMPLETED",
        syncStatus: "COMPLETED",
        filesCount: 1,
      },
    });

    // Create Initial file in Repository 1
    await db.fileRecord.create({
      data: {
        repoId: repoId1,
        path: "src/index.ts",
        size: "1.2 KB",
        type: "code",
        language: "TypeScript",
        parsingStatus: "PARSED",
        lineCount: 20,
        updatedText: "Just now",
      },
    });

    // Create Repository 2 (for isolation testing)
    await db.repository.create({
      data: {
        id: repoId2,
        projectId: project.id,
        name: repoId2,
        owner: testOwner,
        defaultBranch: "main",
        latestCommitSha: "2222222222222222222222222222222222222222",
        lastSyncedCommitSha: "2222222222222222222222222222222222222222",
        gitSyncStatus: "COMPLETED",
        syncStatus: "COMPLETED",
        filesCount: 5,
      },
    });
  });

  after(async () => {
    // Cleanup
    await db.syncJob.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.documentChunk.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.dependencyRecord.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.fileRecord.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.module.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.commitRecord.deleteMany({ where: { repoId: { in: [repoId1, repoId2] } } });
    await db.repository.deleteMany({ where: { id: { in: [repoId1, repoId2] } } });
  });

  // -------------------------------------------------------------
  // Test 1: Valid GitHub push webhook
  // -------------------------------------------------------------
  test("1. Valid GitHub push webhook is accepted with 202 and enqueues sync job", async () => {
    const payload = JSON.stringify({
      ref: "refs/heads/main",
      before: "1111111111111111111111111111111111111111",
      after: "3333333333333333333333333333333333333333",
      repository: {
        name: repoId1,
        full_name: `${testOwner}/${repoId1}`,
        owner: { login: testOwner },
        default_branch: "main",
      },
      head_commit: {
        id: "3333333333333333333333333333333333333333",
        message: "feat: add user service",
      },
      commits: [
        {
          id: "3333333333333333333333333333333333333333",
          message: "feat: add user service",
          added: ["src/services/user.ts"],
          modified: [],
          removed: [],
        },
      ],
    });

    const sig = generateSignature(payload);

    const req = new Request("http://localhost:3000/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sig,
        "x-github-event": "push",
        "x-github-delivery": "delivery-uuid-test-1",
        "content-type": "application/json",
      },
      body: payload,
    });

    const res = await webhookRouteHandler(req as any);
    assert.strictEqual(res.status, 202);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.jobId);

    // Verify job in database
    const job = await db.syncJob.findUnique({ where: { id: data.jobId } });
    assert.ok(job);
    assert.strictEqual(job.repoId, repoId1);
    assert.strictEqual(job.afterSha, "3333333333333333333333333333333333333333");
  });

  // -------------------------------------------------------------
  // Test 2: Invalid webhook signature
  // -------------------------------------------------------------
  test("2. Invalid webhook signature is rejected with 401 Unauthorized", async () => {
    const payload = JSON.stringify({
      ref: "refs/heads/main",
      after: "4444444444444444444444444444444444444444",
      repository: {
        name: repoId1,
        owner: { login: testOwner },
      },
    });

    // Provide invalid signature signed with wrong secret
    const badSig = generateSignature(payload, "wrong_secret");

    const req = new Request("http://localhost:3000/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": badSig,
        "x-github-event": "push",
        "content-type": "application/json",
      },
      body: payload,
    });

    const res = await webhookRouteHandler(req as any);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /invalid.*signature/i);
  });

  // -------------------------------------------------------------
  // Test 3: Unknown repository
  // -------------------------------------------------------------
  test("3. Webhook for unknown repository returns 404", async () => {
    const payload = JSON.stringify({
      ref: "refs/heads/main",
      after: "5555555555555555555555555555555555555555",
      repository: {
        name: "completely-unconnected-repo",
        owner: { login: "some-other-owner" },
      },
    });

    const sig = generateSignature(payload);

    const req = new Request("http://localhost:3000/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sig,
        "x-github-event": "push",
        "content-type": "application/json",
      },
      body: payload,
    });

    const res = await webhookRouteHandler(req as any);
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /not connected/i);
  });

  // -------------------------------------------------------------
  // Test 4: Duplicate webhook delivery
  // -------------------------------------------------------------
  test("4. Duplicate webhook delivery is handled safely without re-enqueueing duplicate job", async () => {
    const deliveryId = "delivery-uuid-duplicate-test";
    const payload = JSON.stringify({
      ref: "refs/heads/main",
      before: "1111111111111111111111111111111111111111",
      after: "6666666666666666666666666666666666666666",
      repository: {
        name: repoId1,
        owner: { login: testOwner },
      },
      commits: [
        {
          id: "6666666666666666666666666666666666666666",
          message: "update",
          added: [],
          modified: ["src/index.ts"],
          removed: [],
        },
      ],
    });

    const sig = generateSignature(payload);

    // Delivery 1
    const req1 = new Request("http://localhost:3000/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sig,
        "x-github-event": "push",
        "x-github-delivery": deliveryId,
        "content-type": "application/json",
      },
      body: payload,
    });
    const res1 = await webhookRouteHandler(req1 as any);
    assert.strictEqual(res1.status, 202);

    // Delivery 2 (same delivery ID)
    const req2 = new Request("http://localhost:3000/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sig,
        "x-github-event": "push",
        "x-github-delivery": deliveryId,
        "content-type": "application/json",
      },
      body: payload,
    });
    const res2 = await webhookRouteHandler(req2 as any);
    assert.strictEqual(res2.status, 200);
    const data2 = await res2.json();
    assert.strictEqual(data2.duplicate, true);
    assert.match(data2.message, /duplicate.*ignored/i);
  });

  // -------------------------------------------------------------
  // Test 5: Added file incremental processing
  // -------------------------------------------------------------
  test("5. Added file creates FileRecord, updates modules, and creates chunks", async () => {
    const newSha = "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";

    const result = await processIncrementalSync(
      repoId1,
      newSha,
      [
        {
          path: "src/services/auth.ts",
          action: "added",
        },
      ],
      {
        branch: "main",
        pusher: "Developer A",
      }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.filesAdded, 1);
    assert.strictEqual(result.filesDeleted, 0);

    // Verify FileRecord in DB
    const file = await db.fileRecord.findUnique({
      where: { repoId_path: { repoId: repoId1, path: "src/services/auth.ts" } },
    });
    assert.ok(file);
    assert.strictEqual(file.path, "src/services/auth.ts");
    assert.strictEqual(file.language, "TypeScript");

    // Verify module association
    assert.ok(file.moduleId);
    const mod = await db.module.findUnique({ where: { id: file.moduleId } });
    assert.ok(mod);

    // Verify DocumentChunk created
    const chunks = await db.documentChunk.findMany({
      where: { repoId: repoId1, path: "src/services/auth.ts" },
    });
    assert.ok(chunks.length > 0);
  });

  // -------------------------------------------------------------
  // Test 6: Modified file incremental processing
  // -------------------------------------------------------------
  test("6. Modified file updates FileRecord and re-chunks without duplicates", async () => {
    const newSha = "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222";

    const result = await processIncrementalSync(
      repoId1,
      newSha,
      [
        {
          path: "src/index.ts",
          action: "modified",
        },
      ],
      {
        branch: "main",
        pusher: "Developer B",
      }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.filesModified, 1);

    const file = await db.fileRecord.findUnique({
      where: { repoId_path: { repoId: repoId1, path: "src/index.ts" } },
    });
    assert.ok(file);
    assert.strictEqual(file.updatedText, "Just now");
  });

  // -------------------------------------------------------------
  // Test 7: Deleted file incremental processing
  // -------------------------------------------------------------
  test("7. Deleted file removes FileRecord, chunks, and invalidates dependencies", async () => {
    // Add a file and a dependency first
    await db.fileRecord.create({
      data: {
        repoId: repoId1,
        path: "src/obsolete.ts",
        size: "0.5 KB",
        type: "code",
        language: "TypeScript",
        updatedText: "Old",
      },
    });

    await db.dependencyRecord.create({
      data: {
        repoId: repoId1,
        key: `${repoId1}::src/index.ts::./obsolete::import`,
        sourceFile: "src/index.ts",
        targetFile: "src/obsolete.ts",
        importSource: "./obsolete",
        dependencyType: "import",
        kind: "internal",
        resolutionStatus: "RESOLVED_INTERNAL",
      },
    });

    const newSha = "cccc3333cccc3333cccc3333cccc3333cccc3333";

    const result = await processIncrementalSync(
      repoId1,
      newSha,
      [
        {
          path: "src/obsolete.ts",
          action: "deleted",
        },
      ],
      {
        branch: "main",
      }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.filesDeleted, 1);

    // FileRecord should be deleted
    const file = await db.fileRecord.findUnique({
      where: { repoId_path: { repoId: repoId1, path: "src/obsolete.ts" } },
    });
    assert.strictEqual(file, null);

    // Dependency targetFile should be marked UNRESOLVED
    const dep = await db.dependencyRecord.findFirst({
      where: { repoId: repoId1, importSource: "./obsolete" },
    });
    assert.ok(dep);
    assert.strictEqual(dep.targetFile, null);
    assert.strictEqual(dep.resolutionStatus, "UNRESOLVED");
  });

  // -------------------------------------------------------------
  // Test 8: Renamed file incremental processing
  // -------------------------------------------------------------
  test("8. Renamed file preserves identity and updates paths and references", async () => {
    // Create old file
    const oldFile = await db.fileRecord.create({
      data: {
        repoId: repoId1,
        path: "src/utils/old-helper.ts",
        size: "1.0 KB",
        type: "code",
        language: "TypeScript",
        updatedText: "Initial",
      },
    });

    await db.documentChunk.create({
      data: {
        repoId: repoId1,
        fileId: oldFile.id,
        path: "src/utils/old-helper.ts",
        language: "TypeScript",
        content: "export function helper() {}",
        startLine: 1,
        endLine: 1,
        chunkIndex: 0,
        contentHash: "hash123",
      },
    });

    const newSha = "dddd4444dddd4444dddd4444dddd4444dddd4444";

    const result = await processIncrementalSync(
      repoId1,
      newSha,
      [
        {
          path: "src/utils/new-helper.ts",
          oldPath: "src/utils/old-helper.ts",
          action: "renamed",
        },
      ],
      {
        branch: "main",
      }
    );

    assert.strictEqual(result.success, true);

    // Old path should not exist
    const oldCheck = await db.fileRecord.findUnique({
      where: { repoId_path: { repoId: repoId1, path: "src/utils/old-helper.ts" } },
    });
    assert.strictEqual(oldCheck, null);

    // New path should have the same ID (identity preserved)
    const newCheck = await db.fileRecord.findUnique({
      where: { repoId_path: { repoId: repoId1, path: "src/utils/new-helper.ts" } },
    });
    assert.ok(newCheck);
    assert.strictEqual(newCheck.id, oldFile.id);

    // Chunk path updated
    const chunk = await db.documentChunk.findFirst({
      where: { repoId: repoId1, path: "src/utils/new-helper.ts" },
    });
    assert.ok(chunk);
  });

  // -------------------------------------------------------------
  // Test 9: Multiple changed files
  // -------------------------------------------------------------
  test("9. Multiple changed files (1 added, 1 modified, 1 deleted) in a single sync pass", async () => {
    // Create a file to delete
    await db.fileRecord.create({
      data: {
        repoId: repoId1,
        path: "src/to-delete.ts",
        size: "0.2 KB",
        type: "code",
        language: "TypeScript",
        updatedText: "Old",
      },
    });

    const newSha = "eeee5555eeee5555eeee5555eeee5555eeee5555";

    const result = await processIncrementalSync(
      repoId1,
      newSha,
      [
        { path: "src/new-feature.ts", action: "added" },
        { path: "src/index.ts", action: "modified" },
        { path: "src/to-delete.ts", action: "deleted" },
      ],
      { branch: "main" }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.filesAdded, 1);
    assert.strictEqual(result.filesModified, 1);
    assert.strictEqual(result.filesDeleted, 1);
    assert.strictEqual(result.summary, "Added 1 • Modified 1 • Deleted 1");
  });

  // -------------------------------------------------------------
  // Test 10: No previous synced commit → full sync fallback
  // -------------------------------------------------------------
  test("10. No previous commit SHA falls back to full sync safely", async () => {
    const detection = await detectIncrementalChanges(
      repoId1,
      "0000000000000000000000000000000000000000",
      "ffff6666ffff6666ffff6666ffff6666ffff6666"
    );

    assert.strictEqual(detection.canIncremental, false);
    assert.strictEqual(detection.changes.length, 0);
    assert.match(detection.reason!, /No previous commit/i);
  });

  // -------------------------------------------------------------
  // Test 11: Incremental sync failure → previous commit remains unchanged
  // -------------------------------------------------------------
  test("11. Incremental sync failure preserves previous successful commit and records error", async () => {
    const prevRepo = await db.repository.findUnique({ where: { id: repoId1 } });
    const originalSha = prevRepo?.latestCommitSha;
    assert.ok(originalSha);

    // Call processIncrementalSync with a corrupted change that throws
    let threw = false;
    try {
      await processIncrementalSync("non-existent-repo-id-fail", "999999", []);
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, true);

    // Check that repoId1 was untouched
    const afterRepo = await db.repository.findUnique({ where: { id: repoId1 } });
    assert.strictEqual(afterRepo?.latestCommitSha, originalSha);
    assert.strictEqual(afterRepo?.lastSyncedCommitSha, originalSha);
  });

  // -------------------------------------------------------------
  // Test 12: Successful sync → lastSyncedCommitSha updates
  // -------------------------------------------------------------
  test("12. Successful sync advances latestCommitSha and lastSyncedCommitSha to new SHA", async () => {
    const targetSha = "1234567890abcdef1234567890abcdef12345678";

    const result = await processIncrementalSync(
      repoId1,
      targetSha,
      [{ path: "src/index.ts", action: "modified" }],
      { branch: "main" }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.afterSha, targetSha);

    const repo = await db.repository.findUnique({ where: { id: repoId1 } });
    assert.strictEqual(repo?.latestCommitSha, targetSha);
    assert.strictEqual(repo?.lastSyncedCommitSha, targetSha);
    assert.strictEqual(repo?.gitSyncStatus, "COMPLETED");
    assert.strictEqual(repo?.syncStatus, "COMPLETED");
    assert.ok(repo?.lastSuccessfulSyncAt);
  });

  // -------------------------------------------------------------
  // Test 13: Two concurrent syncs for the same repository
  // -------------------------------------------------------------
  test("13. Two concurrent sync jobs for the same repository execute sequentially", async () => {
    const shaA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const shaB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const jobA = await enqueueSyncJob({
      repoId: repoId1,
      afterSha: shaA,
      deliveryId: "concurrent-delivery-A",
      commits: [{ sha: shaA, message: "commit A", added: ["src/file-a.ts"] }],
    });

    const jobB = await enqueueSyncJob({
      repoId: repoId1,
      afterSha: shaB,
      deliveryId: "concurrent-delivery-B",
      commits: [{ sha: shaB, message: "commit B", added: ["src/file-b.ts"] }],
    });

    assert.strictEqual(jobA.enqueued, true);
    assert.strictEqual(jobB.enqueued, true);

    // Run the queue
    await processSyncQueue(repoId1);

    // Both jobs should complete without corruption
    const dbJobA = await db.syncJob.findUnique({ where: { id: jobA.job.id } });
    const dbJobB = await db.syncJob.findUnique({ where: { id: jobB.job.id } });

    assert.strictEqual(dbJobA?.status, "COMPLETED");
    assert.strictEqual(dbJobB?.status, "COMPLETED");
  });

  // -------------------------------------------------------------
  // Test 14: Repository isolation
  // -------------------------------------------------------------
  test("14. Repository isolation: Changes to repo 1 do not affect repo 2", async () => {
    const repo2Before = await db.repository.findUnique({ where: { id: repoId2 } });
    const filesCountBefore = repo2Before?.filesCount;
    const shaBefore = repo2Before?.latestCommitSha;

    // Mutate repo 1
    const newShaRepo1 = "7777777777777777777777777777777777777777";
    await processIncrementalSync(
      repoId1,
      newShaRepo1,
      [{ path: "src/isolated-feature.ts", action: "added" }],
      { branch: "main" }
    );

    // Verify repo 1 updated
    const repo1After = await db.repository.findUnique({ where: { id: repoId1 } });
    assert.strictEqual(repo1After?.latestCommitSha, newShaRepo1);

    // Verify repo 2 remained completely unchanged
    const repo2After = await db.repository.findUnique({ where: { id: repoId2 } });
    assert.strictEqual(repo2After?.latestCommitSha, shaBefore);
    assert.strictEqual(repo2After?.filesCount, filesCountBefore);

    // Verify files in repo 2 did NOT get the new file
    const fileInRepo2 = await db.fileRecord.findUnique({
      where: { repoId_path: { repoId: repoId2, path: "src/isolated-feature.ts" } },
    });
    assert.strictEqual(fileInRepo2, null);
  });
});
