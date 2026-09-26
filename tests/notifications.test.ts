/* eslint-disable @typescript-eslint/no-explicit-any */
import test, { describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { NextRequest } from "next/server";

// Mock server-only and next/headers for node:test runner outside Next.js compiler
const originalRequire = (Module.prototype as any).require;
const cookieStore = new Map<string, any>();

(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === "server-only") {
    return {};
  }
  if (id === "next/headers") {
    return {
      cookies: async () => ({
        get: (name: string) => cookieStore.get(name),
        set: (name: string, value: any, opts: any) => {
          cookieStore.set(name, { name, value, ...opts });
        },
        delete: (name: string) => {
          cookieStore.delete(name);
        },
      }),
    };
  }
  return originalRequire.apply(this, [id, ...args]);
};

let db: typeof import("../lib/server/db").db;
let authModule: typeof import("../lib/server/auth");
let notifModule: typeof import("../lib/server/notifications");

// Route Handlers
let notificationsRoute: typeof import("../app/api/notifications/route");
let notificationIdRoute: typeof import("../app/api/notifications/[id]/route");
let readAllRoute: typeof import("../app/api/notifications/read-all/route");

describe("DevMind Notifications System End-to-End Test Suite", () => {
  const testOrgAId = "org-notif-test-a";
  const testOrgBId = "org-notif-test-b";
  const testProjectAId = "proj-notif-test-a";
  const testProjectBId = "proj-notif-test-b";
  const testRepoAId = "repo-notif-test-a";
  const testRepoBId = "repo-notif-test-b";

  const userAId = "user-notif-alice";
  const userBId = "user-notif-bob";

  let tokenAlice: string;
  let tokenBob: string;

  function setAuthenticatedUser(token: string | null) {
    if (token) {
      cookieStore.set("devmind_session", { name: "devmind_session", value: token });
    } else {
      cookieStore.delete("devmind_session");
    }
  }

  async function cleanup() {
    try {
      await db.notification.deleteMany({
        where: {
          OR: [
            { userId: userAId },
            { userId: userBId },
            { repoId: testRepoAId },
            { repoId: testRepoBId },
          ],
        },
      });
      await db.syncJob.deleteMany({
        where: { OR: [{ repoId: testRepoAId }, { repoId: testRepoBId }] },
      });
      await db.repository.deleteMany({
        where: { OR: [{ id: testRepoAId }, { id: testRepoBId }] },
      });
      await db.project.deleteMany({
        where: { OR: [{ id: testProjectAId }, { id: testProjectBId }] },
      });
      await db.orgMember.deleteMany({
        where: { OR: [{ userId: userAId }, { userId: userBId }] },
      });
      await db.organization.deleteMany({
        where: { OR: [{ id: testOrgAId }, { id: testOrgBId }] },
      });
      await db.user.deleteMany({
        where: { OR: [{ id: userAId }, { id: userBId }] },
      });
    } catch {}
  }

  before(async () => {
    const dbMod = await import("../lib/server/db");
    db = dbMod.db;
    authModule = await import("../lib/server/auth");
    notifModule = await import("../lib/server/notifications");

    notificationsRoute = await import("../app/api/notifications/route");
    notificationIdRoute = await import("../app/api/notifications/[id]/route");
    readAllRoute = await import("../app/api/notifications/read-all/route");

    await cleanup();

    // 1. Create Users
    await db.user.create({
      data: {
        id: userAId,
        email: "alice@company-a.com",
        name: "Alice Engineer",
        onboardingCompleted: true,
      },
    });

    await db.user.create({
      data: {
        id: userBId,
        email: "bob@company-b.com",
        name: "Bob Architect",
        onboardingCompleted: true,
      },
    });

    tokenAlice = await authModule.createSessionToken({
      userId: userAId,
      email: "alice@company-a.com",
      name: "Alice Engineer",
      onboardingCompleted: true,
    });

    tokenBob = await authModule.createSessionToken({
      userId: userBId,
      email: "bob@company-b.com",
      name: "Bob Architect",
      onboardingCompleted: true,
    });

    // 2. Organizations & Memberships (Alice in Org A, Bob in Org B)
    await db.organization.create({
      data: { id: testOrgAId, name: "Company A", slug: "company-a" },
    });
    await db.orgMember.create({
      data: { orgId: testOrgAId, userId: userAId, role: "OWNER" },
    });

    await db.organization.create({
      data: { id: testOrgBId, name: "Company B", slug: "company-b" },
    });
    await db.orgMember.create({
      data: { orgId: testOrgBId, userId: userBId, role: "OWNER" },
    });

    // 3. Projects
    await db.project.create({
      data: {
        id: testProjectAId,
        orgId: testOrgAId,
        name: "Project A",
        slug: "project-a",
      },
    });
    await db.project.create({
      data: {
        id: testProjectBId,
        orgId: testOrgBId,
        name: "Project B",
        slug: "project-b",
      },
    });

    // 4. Repositories
    await db.repository.create({
      data: {
        id: testRepoAId,
        projectId: testProjectAId,
        name: "repo-alpha",
        owner: "company-a",
        defaultBranch: "main",
      },
    });

    await db.repository.create({
      data: {
        id: testRepoBId,
        projectId: testProjectBId,
        name: "repo-beta",
        owner: "company-b",
        defaultBranch: "main",
      },
    });
  });

  after(async () => {
    await cleanup();
  });

  beforeEach(() => {
    setAuthenticatedUser(tokenAlice);
  });

  describe("1. Database Model & Schema Integrity", () => {
    test("Persists notification with all required fields and relations", async () => {
      const notif = await notifModule.createNotification({
        userId: userAId,
        repoId: testRepoAId,
        orgId: testOrgAId,
        projectId: testProjectAId,
        type: "INGESTION_COMPLETED",
        title: "Ingestion finished",
        message: "Repository indexed with 10 files",
        entityId: testRepoAId,
        link: `/app/overview?repoId=${testRepoAId}`,
        dedupeKey: `test:ingest:${Date.now()}`,
      });

      assert.ok(notif.id);
      assert.equal(notif.userId, userAId);
      assert.equal(notif.repoId, testRepoAId);
      assert.equal(notif.type, "INGESTION_COMPLETED");
      assert.equal(notif.read, false);
      assert.ok(notif.createdAt instanceof Date);
    });

    test("Cascading deletion: deleting repository deletes associated notifications", async () => {
      const tempRepoId = "temp-repo-to-delete";
      await db.repository.create({
        data: {
          id: tempRepoId,
          projectId: testProjectAId,
          name: "temp-repo",
          owner: "company-a",
        },
      });

      await notifModule.createNotification({
        userId: userAId,
        repoId: tempRepoId,
        type: "REPO_CONNECTED",
        title: "Temporary repo connected",
        message: "Testing cascading deletion",
      });

      const beforeCount = await db.notification.count({ where: { repoId: tempRepoId } });
      assert.equal(beforeCount, 1);

      await db.repository.delete({ where: { id: tempRepoId } });

      const afterCount = await db.notification.count({ where: { repoId: tempRepoId } });
      assert.equal(afterCount, 0);
    });
  });

  describe("2. Notification Ownership & Tenant Isolation", () => {
    before(async () => {
      // Clear notifications before isolation tests
      await db.notification.deleteMany({
        where: { OR: [{ userId: userAId }, { userId: userBId }] },
      });

      // Create notification for Alice
      await notifModule.createNotification({
        userId: userAId,
        repoId: testRepoAId,
        type: "SYNC_COMPLETED",
        title: "Alice Notification",
        message: "Update for Alice",
      });

      // Create notification for Bob
      await notifModule.createNotification({
        userId: userBId,
        repoId: testRepoBId,
        type: "SYNC_COMPLETED",
        title: "Bob Notification",
        message: "Update for Bob",
      });
    });

    test("Alice only retrieves her own notifications, never Bob's", async () => {
      const aliceNotifs = await notifModule.getUserNotifications(userAId);
      assert.equal(aliceNotifs.total, 1);
      assert.equal(aliceNotifs.notifications[0].title, "Alice Notification");
      assert.equal(aliceNotifs.notifications[0].userId, userAId);

      const bobNotifs = await notifModule.getUserNotifications(userBId);
      assert.equal(bobNotifs.total, 1);
      assert.equal(bobNotifs.notifications[0].title, "Bob Notification");
      assert.equal(bobNotifs.notifications[0].userId, userBId);
    });

    test("Alice cannot query notifications for a repository she has no access to", async () => {
      // Alice attempts to query notifications for Bob's repo
      const crossRepoResult = await notifModule.getUserNotifications(userAId, {
        repoId: testRepoBId,
      });
      assert.equal(crossRepoResult.total, 0);
      assert.equal(crossRepoResult.notifications.length, 0);
    });

    test("Bob cannot mark Alice's notification as read", async () => {
      const aliceNotif = await db.notification.findFirst({ where: { userId: userAId } });
      assert.ok(aliceNotif);

      // Bob tries to mark Alice's notification as read
      const updatedByBob = await notifModule.markNotificationAsRead(userBId, aliceNotif.id);
      assert.strictEqual(updatedByBob, null);

      // Verify notification remains unread
      const verify = await db.notification.findUnique({ where: { id: aliceNotif.id } });
      assert.equal(verify?.read, false);
    });
  });

  describe("3. Idempotency & Deduplication", () => {
    test("Multiple calls with same dedupeKey do not create duplicate notifications", async () => {
      const dedupeKey = `sync-job:idemp-1234:COMPLETED`;

      const notif1 = await notifModule.createNotification({
        userId: userAId,
        repoId: testRepoAId,
        type: "SYNC_COMPLETED",
        title: "Deterministic sync",
        message: "First run",
        dedupeKey,
      });

      const notif2 = await notifModule.createNotification({
        userId: userAId,
        repoId: testRepoAId,
        type: "SYNC_COMPLETED",
        title: "Deterministic sync (retry)",
        message: "Second run",
        dedupeKey,
      });

      assert.equal(notif1.id, notif2.id);

      const count = await db.notification.count({ where: { dedupeKey } });
      assert.equal(count, 1);
    });

    test("notifyRepoMembers creates idempotent notifications per recipient", async () => {
      const dedupeKey = `job-broadcast-999:COMPLETED`;

      const results1 = await notifModule.notifyRepoMembers(testRepoAId, {
        type: "SYNC_COMPLETED",
        title: "Broadcast notification",
        message: "First attempt",
        dedupeKey,
      });

      const results2 = await notifModule.notifyRepoMembers(testRepoAId, {
        type: "SYNC_COMPLETED",
        title: "Broadcast notification retry",
        message: "Second attempt",
        dedupeKey,
      });

      assert.equal(results1.length, 1);
      assert.equal(results2.length, 1);
      assert.equal(results1[0].id, results2[0].id);
    });
  });

  describe("4. Real Event Notifications Flow", () => {
    test("Repository synchronization job failure creates real SYNC_FAILED notification", async () => {
      const failedJobId = "job-fail-test-1";
      await db.syncJob.create({
        data: {
          id: failedJobId,
          repoId: testRepoAId,
          event: "push",
          status: "FAILED",
          afterSha: "failsha123",
          error: "Git comparison timeout",
        },
      });

      // Simulate queue worker creating failure notification
      await notifModule.notifyRepoMembers(testRepoAId, {
        type: "SYNC_FAILED",
        title: "Repository synchronization failed",
        message: "Synchronization failed for company-a/repo-alpha: Git comparison timeout",
        entityId: failedJobId,
        link: `/app/overview?repoId=${testRepoAId}`,
        dedupeKey: `sync-job:${failedJobId}:FAILED`,
      });

      const failureNotif = await db.notification.findFirst({
        where: { entityId: failedJobId, type: "SYNC_FAILED" },
      });

      assert.ok(failureNotif);
      assert.equal(failureNotif.userId, userAId);
      assert.equal(failureNotif.read, false);
      assert.match(failureNotif.message, /Git comparison timeout/);
    });

    test("Repository ingestion creates real INGESTION_COMPLETED notification", async () => {
      await notifModule.notifyRepoMembers(testRepoAId, {
        type: "INGESTION_COMPLETED",
        title: "Repository ingestion completed",
        message: "Repository company-a/repo-alpha indexed successfully (45 files, 4 modules).",
        entityId: testRepoAId,
        link: `/app/overview?repoId=${testRepoAId}`,
        dedupeKey: `ingestion-completed:${testRepoAId}:sha-real-test`,
      });

      const notif = await db.notification.findFirst({
        where: { repoId: testRepoAId, type: "INGESTION_COMPLETED" },
      });

      assert.ok(notif);
      assert.equal(notif.userId, userAId);
      assert.equal(notif.read, false);
      assert.ok(notif.link?.includes("repoId="));
    });
  });

  describe("5. Notifications API Layer Endpoints", () => {
    test("GET /api/notifications returns 401 when unauthenticated", async () => {
      setAuthenticatedUser(null);
      const req = new NextRequest("http://localhost:3000/api/notifications");
      const res = await notificationsRoute.GET(req);
      assert.equal(res.status, 401);
    });

    test("GET /api/notifications returns Alice's real notifications and accurate unread count", async () => {
      setAuthenticatedUser(tokenAlice);
      const req = new NextRequest("http://localhost:3000/api/notifications");
      const res = await notificationsRoute.GET(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.notifications));
      assert.ok(json.data.total > 0);
      assert.equal(json.data.unreadCount > 0, true);

      // Verify no Bob notifications are returned
      for (const n of json.data.notifications) {
        assert.equal(n.userId, userAId);
      }
    });

    test("PATCH /api/notifications/[id] marks notification as read", async () => {
      setAuthenticatedUser(tokenAlice);

      const target = await db.notification.findFirst({
        where: { userId: userAId, read: false },
      });
      assert.ok(target, "Requires an unread notification for Alice");

      const req = new NextRequest(`http://localhost:3000/api/notifications/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ read: true }),
      });
      const res = await notificationIdRoute.PATCH(req, {
        params: Promise.resolve({ id: target.id }),
      });
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.read, true);

      // Confirm in DB
      const updated = await db.notification.findUnique({ where: { id: target.id } });
      assert.equal(updated?.read, true);
    });

    test("POST /api/notifications/read-all marks all notifications for user as read", async () => {
      setAuthenticatedUser(tokenAlice);

      // Ensure at least one unread notification exists
      await notifModule.createNotification({
        userId: userAId,
        repoId: testRepoAId,
        type: "ACTIVITY",
        title: "New Activity",
        message: "Someone pushed code",
      });

      const unreadBefore = await notifModule.getUnreadCount(userAId);
      assert.ok(unreadBefore > 0);

      const req = new NextRequest("http://localhost:3000/api/notifications/read-all", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await readAllRoute.POST(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.count > 0);

      const unreadAfter = await notifModule.getUnreadCount(userAId);
      assert.equal(unreadAfter, 0);
    });

    test("POST /api/notifications creates real notification for authenticated user", async () => {
      setAuthenticatedUser(tokenAlice);

      const payload = {
        type: "REPO_CONNECTED",
        title: "Connected from API",
        message: "Successfully connected",
        repoId: testRepoAId,
      };

      const req = new NextRequest("http://localhost:3000/api/notifications", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const res = await notificationsRoute.POST(req);
      assert.equal(res.status, 201);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.userId, userAId);
      assert.equal(json.data.title, "Connected from API");
    });

    test("Bob cannot mark Alice's notification as read via PATCH /api/notifications/[id]", async () => {
      setAuthenticatedUser(tokenBob);

      const targetAlice = await db.notification.findFirst({
        where: { userId: userAId },
      });
      assert.ok(targetAlice);

      const req = new NextRequest(`http://localhost:3000/api/notifications/${targetAlice.id}`, {
        method: "PATCH",
        body: JSON.stringify({ read: true }),
      });
      const res = await notificationIdRoute.PATCH(req, {
        params: Promise.resolve({ id: targetAlice.id }),
      });
      assert.equal(res.status, 404);
    });
  });
});
