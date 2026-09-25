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
let ingestGitHistory: typeof import("../lib/server/git/service").ingestGitHistory;
let ingestContributors: typeof import("../lib/server/contributors/service").ingestContributors;

// Route Handlers
let graphRoute: typeof import("../app/api/knowledge/graph/route");
let traverseRoute: typeof import("../app/api/knowledge/graph/traverse/route");
let entityRoute: typeof import("../app/api/knowledge/entity/route");
let fileRoute: typeof import("../app/api/knowledge/file/route");
let symbolRoute: typeof import("../app/api/knowledge/symbol/route");
let contributorRoute: typeof import("../app/api/knowledge/contributor/route");
let contributorsRoute: typeof import("../app/api/contributors/route");

describe("DevMind Milestone 2.3 — Knowledge API Layer Test Suite", () => {
  const testOrgId = "org-m2-api-test";
  const testProjectId = "proj-m2-api-test";
  const testRepoId = "repo-m2-api-test";
  const authorizedUserId = "user-m2-api-authorized";
  const unauthorizedUserId = "user-m2-api-unauthorized";

  let authorizedToken: string;
  let unauthorizedToken: string;

  async function cleanupRepo(repoId: string) {
    try {
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
    } catch {}
  }

  async function cleanupAll(repoId: string, projectId: string, orgId: string) {
    try {
      await cleanupRepo(repoId);
      await db.project.deleteMany({ where: { id: projectId } });
      await db.orgMember.deleteMany({ where: { orgId } });
      await db.organization.deleteMany({ where: { id: orgId } });
      await db.user.deleteMany({ where: { id: { in: [authorizedUserId, unauthorizedUserId] } } });
    } catch {}
  }

  function setAuthenticatedUser(token: string | null) {
    cookieStore.clear();
    if (token) {
      cookieStore.set("devmind_session", { name: "devmind_session", value: token });
    }
  }

  before(async () => {
    const dbModule = await import("../lib/server/db");
    db = dbModule.db;
    authModule = await import("../lib/server/auth");

    const gitModule = await import("../lib/server/git/service");
    ingestGitHistory = gitModule.ingestGitHistory;
    const contribModule = await import("../lib/server/contributors/service");
    ingestContributors = contribModule.ingestContributors;

    // Load routes
    graphRoute = await import("../app/api/knowledge/graph/route");
    traverseRoute = await import("../app/api/knowledge/graph/traverse/route");
    entityRoute = await import("../app/api/knowledge/entity/route");
    fileRoute = await import("../app/api/knowledge/file/route");
    symbolRoute = await import("../app/api/knowledge/symbol/route");
    contributorRoute = await import("../app/api/knowledge/contributor/route");
    contributorsRoute = await import("../app/api/contributors/route");

    await cleanupAll(testRepoId, testProjectId, testOrgId);

    // 1. Create Users
    await db.user.create({
      data: {
        id: authorizedUserId,
        email: "auth-user@devmind.io",
        name: "Authorized Engineer",
        onboardingCompleted: true,
      },
    });

    await db.user.create({
      data: {
        id: unauthorizedUserId,
        email: "unauth-user@devmind.io",
        name: "Unauthorized Engineer",
        onboardingCompleted: true,
      },
    });

    authorizedToken = await authModule.createSessionToken({
      userId: authorizedUserId,
      email: "auth-user@devmind.io",
      name: "Authorized Engineer",
      onboardingCompleted: true,
    });

    unauthorizedToken = await authModule.createSessionToken({
      userId: unauthorizedUserId,
      email: "unauth-user@devmind.io",
      name: "Unauthorized Engineer",
      onboardingCompleted: true,
    });

    // 2. Organization & Membership (only authorizedUser is member)
    await db.organization.create({
      data: {
        id: testOrgId,
        name: "API Test Org",
        slug: "api-test-org",
      },
    });

    await db.orgMember.create({
      data: {
        orgId: testOrgId,
        userId: authorizedUserId,
        role: "MEMBER",
      },
    });

    // 3. Project & Repository
    await db.project.create({
      data: {
        id: testProjectId,
        orgId: testOrgId,
        name: "API Test Project",
        slug: "api-test-project",
      },
    });

    await db.repository.create({
      data: {
        id: testRepoId,
        projectId: testProjectId,
        name: "api-test-repo",
        owner: "devmind-api",
        defaultBranch: "main",
      },
    });

    // 4. Module
    const coreModule = await db.module.create({
      data: {
        repoId: testRepoId,
        name: "core",
        type: "core",
        desc: "Core domain logic",
      },
    });

    // 5. Files with symbols
    // File A: src/core/AuthService.ts
    await db.fileRecord.create({
      data: {
        repoId: testRepoId,
        moduleId: coreModule.id,
        path: "src/core/AuthService.ts",
        size: "2.5 KB",
        type: "code",
        language: "TypeScript",
        parsingStatus: "PARSED",
        lineCount: 80,
        symbolsJson: JSON.stringify({
          path: "src/core/AuthService.ts",
          classes: [
            {
              name: "AuthService",
              file: "src/core/AuthService.ts",
              baseClass: "BaseService",
              startLine: 1,
              endLine: 50,
              methods: [
                {
                  name: "authenticate",
                  file: "src/core/AuthService.ts",
                  className: "AuthService",
                  startLine: 10,
                  endLine: 25,
                  parameters: ["token"],
                  returnType: "Promise<boolean>",
                  isAsync: true,
                },
              ],
            },
          ],
          functions: [
            {
              name: "hashToken",
              file: "src/core/AuthService.ts",
              startLine: 55,
              endLine: 65,
              parameters: ["raw"],
              returnType: "string",
              isAsync: false,
            },
          ],
        }),
        updatedText: "now",
      },
    });

    // File B: src/utils/helpers.ts (has duplicate symbol "hashToken" for disambiguation testing)
    await db.fileRecord.create({
      data: {
        repoId: testRepoId,
        path: "src/utils/helpers.ts",
        size: "1 KB",
        type: "code",
        language: "TypeScript",
        parsingStatus: "PARSED",
        lineCount: 30,
        symbolsJson: JSON.stringify({
          path: "src/utils/helpers.ts",
          classes: [],
          functions: [
            {
              name: "hashToken",
              file: "src/utils/helpers.ts",
              startLine: 5,
              endLine: 15,
              parameters: ["str", "salt"],
              returnType: "string",
              isAsync: false,
            },
          ],
        }),
        updatedText: "now",
      },
    });

    // File C: src/index.ts (imports AuthService.ts)
    await db.fileRecord.create({
      data: {
        repoId: testRepoId,
        path: "src/index.ts",
        size: "500 B",
        type: "code",
        language: "TypeScript",
        parsingStatus: "PARSED",
        lineCount: 15,
        updatedText: "now",
      },
    });

    // 6. Dependencies
    await db.dependencyRecord.create({
      data: {
        key: `dep-${testRepoId}-index-to-auth`,
        repoId: testRepoId,
        kind: "internal",
        sourceFile: "src/index.ts",
        targetFile: "src/core/AuthService.ts",
        importSource: "./core/AuthService",
        dependencyType: "import",
        language: "TypeScript",
        resolutionStatus: "RESOLVED_INTERNAL",
      },
    });

    // External dependency
    await db.dependencyRecord.create({
      data: {
        key: `dep-${testRepoId}-auth-jwt`,
        repoId: testRepoId,
        kind: "external",
        sourceFile: "src/core/AuthService.ts",
        targetFile: null,
        name: "jsonwebtoken",
        version: "^9.0.2",
        dependencyType: "import",
        resolutionStatus: "RESOLVED_EXTERNAL",
      },
    });

    // 7. Contributors
    const alice = await db.contributorRecord.create({
      data: {
        id: "contrib-api-alice",
        repoId: testRepoId,
        identityKey: "email:alice@api.test",
        name: "Alice Api",
        email: "alice@api.test",
        authoredCommitsCount: 1,
        totalCommitsCount: 1,
        additions: 120,
        deletions: 15,
        filesTouchedCount: 2,
        filesTouchedJson: JSON.stringify(["src/core/AuthService.ts", "src/index.ts"]),
        firstContributionAt: new Date("2026-01-10T10:00:00Z"),
        lastContributionAt: new Date("2026-01-10T10:00:00Z"),
        isAuthor: true,
      },
    });

    // 8. Commits
    const commitSha = "aaaaaa1111111111111111111111111111111111";
    const commit = await db.commitRecord.create({
      data: {
        id: `commit-${testRepoId}-1`,
        sha: commitSha,
        shortSha: commitSha.substring(0, 7),
        repoId: testRepoId,
        message: "feat: initialize auth service",
        authorName: "Alice Api",
        authorEmail: "alice@api.test",
        authorContributorId: alice.id,
        authoredAt: new Date("2026-01-10T10:00:00Z"),
        committedAt: new Date("2026-01-10T10:00:00Z"),
      },
    });

    await db.commitFileChangeRecord.create({
      data: {
        repoId: testRepoId,
        commitId: commit.id,
        commitSha: commitSha,
        newPath: "src/core/AuthService.ts",
        changeType: "ADDED",
        additions: 120,
        deletions: 15,
      },
    });
  });

  after(async () => {
    await cleanupRepo("repo-real-api-test");
    await cleanupAll(testRepoId, testProjectId, testOrgId);
  });

  beforeEach(() => {
    // Default each test to authorized session
    setAuthenticatedUser(authorizedToken);
  });

  // 1. Repository Graph Endpoint
  test("1. GET /api/knowledge/graph returns full partitioned repository knowledge", async () => {
    const req = new NextRequest(`http://localhost:3000/api/knowledge/graph?repoId=${testRepoId}`);
    const res = await graphRoute.GET(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.repoNode.id, `repo:${testRepoId}`);
    assert.equal(json.data.files.length, 3);
    assert.equal(json.data.modules.length, 1);
    assert.ok(json.data.classes.length >= 1);
    assert.ok(json.data.functions.length >= 2);
    assert.equal(json.data.contributors.length, 1);
    assert.equal(json.data.commits.length, 1);
    assert.ok(json.data.stats.totalNodes > 0);
  });

  // 2. Repository Graph Filtering
  test("2. GET /api/knowledge/graph filters by entityTypes and relationTypes", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/knowledge/graph?repoId=${testRepoId}&entityTypes=File,Module&relationTypes=CONTAINS`
    );
    const res = await graphRoute.GET(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    // Classes, Functions, Commits, Contributors should be empty in filtered view
    assert.equal(json.data.classes.length, 0);
    assert.equal(json.data.commits.length, 0);
    assert.equal(json.data.contributors.length, 0);
    assert.ok(json.data.files.length > 0);
    assert.ok(json.data.modules.length > 0);
  });

  // 3. Entity Endpoint
  test("3. GET /api/knowledge/entity resolves File, Class, Contributor, and Module entities", async () => {
    // a) File entity
    const fileReq = new NextRequest(
      `http://localhost:3000/api/knowledge/entity?repoId=${testRepoId}&type=File&id=src/core/AuthService.ts`
    );
    const fileRes = await entityRoute.GET(fileReq);
    assert.equal(fileRes.status, 200);
    const fileJson = await fileRes.json();
    assert.equal(fileJson.success, true);
    assert.equal(fileJson.data.fileNode.filePath, "src/core/AuthService.ts");

    // b) Class entity
    const classReq = new NextRequest(
      `http://localhost:3000/api/knowledge/entity?repoId=${testRepoId}&type=Class&id=AuthService`
    );
    const classRes = await entityRoute.GET(classReq);
    assert.equal(classRes.status, 200);
    const classJson = await classRes.json();
    assert.equal(classJson.success, true);
    assert.equal(classJson.data.symbolNode.name, "AuthService");
    assert.equal(classJson.data.symbolNode.type, "Class");

    // c) Contributor entity
    const contribReq = new NextRequest(
      `http://localhost:3000/api/knowledge/entity?repoId=${testRepoId}&type=Contributor&id=Alice%20Api`
    );
    const contribRes = await entityRoute.GET(contribReq);
    assert.equal(contribRes.status, 200);
    const contribJson = await contribRes.json();
    assert.equal(contribJson.success, true);
    assert.equal(contribJson.data.contributorNode.name, "Alice Api");

    // d) Module entity
    const modReq = new NextRequest(
      `http://localhost:3000/api/knowledge/entity?repoId=${testRepoId}&type=Module&id=core`
    );
    const modRes = await entityRoute.GET(modReq);
    assert.equal(modRes.status, 200);
    const modJson = await modRes.json();
    assert.equal(modJson.success, true);
    assert.equal(modJson.data.moduleNode.name, "core");
    assert.ok(modJson.data.files.length >= 1);
  });

  // 4. File Knowledge Endpoint
  test("4. GET /api/knowledge/file returns complete file view with symbols and dependencies", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/knowledge/file?repoId=${testRepoId}&path=src/core/AuthService.ts`
    );
    const res = await fileRoute.GET(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.fileNode.filePath, "src/core/AuthService.ts");
    assert.equal(json.data.moduleNode?.name, "core");
    assert.equal(json.data.classes.length, 1);
    assert.equal(json.data.classes[0].name, "AuthService");
    assert.equal(json.data.methods.length, 1);
    assert.equal(json.data.methods[0].name, "authenticate");
    assert.equal(json.data.functions.length, 1);
    assert.equal(json.data.functions[0].name, "hashToken");
    assert.ok(json.data.dependents.some((d: any) => d.sourceFile === "src/index.ts"));
    assert.ok(json.data.externalDependencies.some((e: any) => e.dependencyNode.name === "jsonwebtoken"));
    assert.equal(json.data.recentCommits.length, 1);
    assert.equal(json.data.recentCommits[0].contributorNode.name, "Alice Api");
  });

  // 5. Symbol Endpoint
  test("5. GET /api/knowledge/symbol looks up single unambiguous symbol", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/knowledge/symbol?repoId=${testRepoId}&name=AuthService`
    );
    const res = await symbolRoute.GET(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.symbolNode.name, "AuthService");
    assert.equal(json.data.symbolNode.type, "Class");
    assert.equal(json.data.methods.length, 1);
    assert.equal(json.data.methods[0].name, "authenticate");
  });

  // 6. Duplicate Symbol Disambiguation
  test("6. GET /api/knowledge/symbol detects ambiguity and supports filePath disambiguation", async () => {
    // "hashToken" exists in both src/core/AuthService.ts and src/utils/helpers.ts
    const ambiguousReq = new NextRequest(
      `http://localhost:3000/api/knowledge/symbol?repoId=${testRepoId}&name=hashToken`
    );
    const ambiguousRes = await symbolRoute.GET(ambiguousReq);
    // Returns 409 Conflict with ambiguous: true and matches list
    assert.equal(ambiguousRes.status, 409);
    const ambiguousJson = await ambiguousRes.json();
    assert.equal(ambiguousJson.success, false);
    assert.equal(ambiguousJson.ambiguous, true);
    assert.equal(ambiguousJson.matches.length, 2);

    // Disambiguate using filePath parameter
    const disambiguatedReq = new NextRequest(
      `http://localhost:3000/api/knowledge/symbol?repoId=${testRepoId}&name=hashToken&filePath=src/core/AuthService.ts`
    );
    const disambiguatedRes = await symbolRoute.GET(disambiguatedReq);
    assert.equal(disambiguatedRes.status, 200);
    const disambiguatedJson = await disambiguatedRes.json();
    assert.equal(disambiguatedJson.success, true);
    assert.equal(disambiguatedJson.data.symbolNode.name, "hashToken");
    assert.equal(disambiguatedJson.data.fileNode.filePath, "src/core/AuthService.ts");
    assert.deepEqual(disambiguatedJson.data.symbolNode.metadata?.parameters, ["raw"]);

    // all=true lists all matches without error
    const allReq = new NextRequest(
      `http://localhost:3000/api/knowledge/symbol?repoId=${testRepoId}&name=hashToken&all=true`
    );
    const allRes = await symbolRoute.GET(allReq);
    assert.equal(allRes.status, 200);
    const allJson = await allRes.json();
    assert.equal(allJson.success, true);
    assert.equal(allJson.data.length, 2);
  });

  // 7. Contributor Endpoint
  test("7. GET /api/knowledge/contributor returns contributor profile and statistics", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/knowledge/contributor?repoId=${testRepoId}&id=alice@api.test`
    );
    const res = await contributorRoute.GET(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.contributorNode.name, "Alice Api");
    assert.equal(json.data.totalCommitsCount, 1);
    assert.equal(json.data.filesTouched.length, 2);
    assert.ok(json.data.touchedModules.some((m: any) => m.name === "core"));
  });

  // 8. Contributors Collection Endpoint
  test("8. GET /api/contributors returns collection of repository contributors", async () => {
    const req = new NextRequest(`http://localhost:3000/api/contributors?repoId=${testRepoId}`);
    const res = await contributorsRoute.GET(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.equal(json.data.length, 1);
    assert.equal(json.data[0].name, "Alice Api");
    assert.equal(json.data[0].email, "alice@api.test");
  });

  // 9. Graph Traversal Endpoint
  test("9. GET /api/knowledge/graph/traverse navigates graph starting from node", async () => {
    const startNodeId = `file:${testRepoId}:src/index.ts`;
    const req = new NextRequest(
      `http://localhost:3000/api/knowledge/graph/traverse?repoId=${testRepoId}&startNodeId=${encodeURIComponent(
        startNodeId
      )}&maxDepth=2`
    );
    const res = await traverseRoute.GET(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.nodes.some((n: any) => n.id === startNodeId));
    // Reaches AuthService.ts via IMPORTS
    assert.ok(json.data.nodes.some((n: any) => n.id === `file:${testRepoId}:src/core/AuthService.ts`));
    // Reaches AuthService class via CONTAINS
    assert.ok(json.data.nodes.some((n: any) => n.name === "AuthService"));
  });

  // 10. Missing Required Parameters
  test("10. Validates required parameters with 400 Bad Request", async () => {
    // Missing repoId on /api/knowledge/graph
    const res1 = await graphRoute.GET(new NextRequest("http://localhost:3000/api/knowledge/graph"));
    assert.equal(res1.status, 400);

    // Missing path on /api/knowledge/file
    const res2 = await fileRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/file?repoId=${testRepoId}`)
    );
    assert.equal(res2.status, 400);

    // Missing name on /api/knowledge/symbol
    const res3 = await symbolRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/symbol?repoId=${testRepoId}`)
    );
    assert.equal(res3.status, 400);

    // Missing id on /api/knowledge/contributor
    const res4 = await contributorRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/contributor?repoId=${testRepoId}`)
    );
    assert.equal(res4.status, 400);

    // Missing type/id on /api/knowledge/entity
    const res5 = await entityRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/entity?repoId=${testRepoId}`)
    );
    assert.equal(res5.status, 400);

    // Missing startNodeId on /api/knowledge/graph/traverse
    const res6 = await traverseRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/graph/traverse?repoId=${testRepoId}`)
    );
    assert.equal(res6.status, 400);
  });

  // 11. Invalid Parameters
  test("11. Validates invalid parameters with 400 Bad Request", async () => {
    // Invalid entityType on /api/knowledge/graph
    const res1 = await graphRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/graph?repoId=${testRepoId}&entityTypes=InvalidType`)
    );
    assert.equal(res1.status, 400);

    // Invalid relationType on /api/knowledge/graph
    const res2 = await graphRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/graph?repoId=${testRepoId}&relationTypes=InvalidRel`)
    );
    assert.equal(res2.status, 400);

    // Invalid type on /api/knowledge/entity
    const res3 = await entityRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/entity?repoId=${testRepoId}&type=Bogus&id=123`)
    );
    assert.equal(res3.status, 400);

    // Invalid maxDepth on /api/knowledge/graph/traverse
    const res4 = await traverseRoute.GET(
      new NextRequest(
        `http://localhost:3000/api/knowledge/graph/traverse?repoId=${testRepoId}&startNodeId=x&maxDepth=99`
      )
    );
    assert.equal(res4.status, 400);
  });

  // 12. Not-Found Behavior
  test("12. Returns 404 Not Found for non-existent entities, files, symbols, and contributors", async () => {
    // File not found
    const res1 = await fileRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/file?repoId=${testRepoId}&path=missing.ts`)
    );
    assert.equal(res1.status, 404);

    // Symbol not found
    const res2 = await symbolRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/symbol?repoId=${testRepoId}&name=MissingSymbol`)
    );
    assert.equal(res2.status, 404);

    // Contributor not found
    const res3 = await contributorRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/contributor?repoId=${testRepoId}&id=ghost`)
    );
    assert.equal(res3.status, 404);

    // Entity not found
    const res4 = await entityRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/entity?repoId=${testRepoId}&type=File&id=nonexistent.ts`)
    );
    assert.equal(res4.status, 404);

    // Repository not found
    const res5 = await graphRoute.GET(
      new NextRequest("http://localhost:3000/api/knowledge/graph?repoId=missing-repo-id")
    );
    assert.equal(res5.status, 404);
  });

  // 13. Unauthorized Repository Access
  test("13. Enforces 401 Unauthenticated and 403 Forbidden on repository access", async () => {
    // 401 Unauthenticated when no session cookie exists
    setAuthenticatedUser(null);
    const unauthRes = await graphRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/graph?repoId=${testRepoId}`)
    );
    assert.equal(unauthRes.status, 401);

    // 403 Forbidden when logged in as user without repository access
    setAuthenticatedUser(unauthorizedToken);
    const forbiddenRes = await graphRoute.GET(
      new NextRequest(`http://localhost:3000/api/knowledge/graph?repoId=${testRepoId}`)
    );
    assert.equal(forbiddenRes.status, 403);
  });

  // 14. Real Repository Integration with palmerhq/monorepo-starter
  describe("Real Repository Integration (palmerhq/monorepo-starter)", () => {
    const realRepoDir = "C:\\Users\\DELL\\Desktop\\monorepo-starter";
    const realTestRepoId = "repo-real-api-test";

    before(async () => {
      await cleanupRepo(realTestRepoId);

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

      // Ingest real git history and contributors
      await ingestGitHistory(realTestRepoId, realRepoDir, { branch: "master" });
      await ingestContributors(realTestRepoId);

      // Add a real package file with symbols
      const pkgModule = await db.module.create({
        data: {
          repoId: realTestRepoId,
          name: "ui",
          type: "package",
          desc: "Shared UI component package",
        },
      });

      await db.fileRecord.create({
        data: {
          repoId: realTestRepoId,
          moduleId: pkgModule.id,
          path: "packages/ui/src/Button.tsx",
          size: "1.5 KB",
          type: "code",
          language: "TypeScript",
          parsingStatus: "PARSED",
          lineCount: 45,
          symbolsJson: JSON.stringify({
            path: "packages/ui/src/Button.tsx",
            classes: [
              {
                name: "ButtonProps",
                file: "packages/ui/src/Button.tsx",
                startLine: 5,
                endLine: 15,
                methods: [],
              },
            ],
            functions: [
              {
                name: "Button",
                file: "packages/ui/src/Button.tsx",
                startLine: 18,
                endLine: 40,
                parameters: ["props"],
                returnType: "JSX.Element",
              },
            ],
          }),
          updatedText: "now",
        },
      });
    });

    after(async () => {
      await cleanupRepo(realTestRepoId);
    });

    beforeEach(() => {
      setAuthenticatedUser(authorizedToken);
    });

    test("14a. GET /api/knowledge/graph returns real git commits and contributors", async () => {
      const req = new NextRequest(`http://localhost:3000/api/knowledge/graph?repoId=${realTestRepoId}`);
      const res = await graphRoute.GET(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.repoNode.name, "monorepo-starter");
      assert.ok(json.data.commits.length > 0, "Must have real commits");
      assert.ok(json.data.contributors.length > 0, "Must have real contributors");
      assert.ok(json.data.classes.length > 0, "Must have ButtonProps class");
      assert.ok(json.data.functions.length > 0, "Must have Button function");
    });

    test("14b. GET /api/contributors returns real ingested contributors", async () => {
      const req = new NextRequest(`http://localhost:3000/api/contributors?repoId=${realTestRepoId}`);
      const res = await contributorsRoute.GET(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.length > 0);
      assert.ok(json.data[0].totalCommitsCount > 0);
      assert.ok(json.data[0].name.length > 0);
    });

    test("14c. GET /api/knowledge/file returns real package file knowledge", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/knowledge/file?repoId=${realTestRepoId}&path=packages/ui/src/Button.tsx`
      );
      const res = await fileRoute.GET(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.fileNode.filePath, "packages/ui/src/Button.tsx");
      assert.equal(json.data.classes[0].name, "ButtonProps");
      assert.equal(json.data.functions[0].name, "Button");
    });
  });
});
