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
let getRepositoryKnowledge: typeof import("../lib/server/knowledge").getRepositoryKnowledge;
let getFileKnowledge: typeof import("../lib/server/knowledge").getFileKnowledge;
let getSymbolKnowledge: typeof import("../lib/server/knowledge").getSymbolKnowledge;
let getContributorKnowledge: typeof import("../lib/server/knowledge").getContributorKnowledge;
let findSymbolsByName: typeof import("../lib/server/knowledge").findSymbolsByName;
let getFileImports: typeof import("../lib/server/knowledge").getFileImports;
let getFileDependents: typeof import("../lib/server/knowledge").getFileDependents;
let getFileCommits: typeof import("../lib/server/knowledge").getFileCommits;
let getFileContributors: typeof import("../lib/server/knowledge").getFileContributors;
let getContributorFiles: typeof import("../lib/server/knowledge").getContributorFiles;
let getContributorModules: typeof import("../lib/server/knowledge").getContributorModules;
let getClassMethods: typeof import("../lib/server/knowledge").getClassMethods;
let getFileSymbols: typeof import("../lib/server/knowledge").getFileSymbols;
let traverseKnowledgeGraph: typeof import("../lib/server/knowledge").traverseKnowledgeGraph;
let ingestGitHistory: typeof import("../lib/server/git/service").ingestGitHistory;
let ingestContributors: typeof import("../lib/server/contributors/service").ingestContributors;

describe("DevMind Milestone 2.2 — Knowledge Query Layer Test Suite", () => {
  const testOrgId = "org-m2-query-test";
  const testProjectId = "proj-m2-query-test";
  const testRepoId = "repo-m2-query-test";

  async function cleanupAll(repoId: string, projectId: string, orgId: string) {
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
      await db.project.deleteMany({ where: { id: projectId } });
      await db.organization.deleteMany({ where: { id: orgId } });
    } catch {}
  }

  before(async () => {
    const dbModule = await import("../lib/server/db");
    db = dbModule.db;
    const knowledgeModule = await import("../lib/server/knowledge");
    getRepositoryKnowledge = knowledgeModule.getRepositoryKnowledge;
    getFileKnowledge = knowledgeModule.getFileKnowledge;
    getSymbolKnowledge = knowledgeModule.getSymbolKnowledge;
    getContributorKnowledge = knowledgeModule.getContributorKnowledge;
    findSymbolsByName = knowledgeModule.findSymbolsByName;
    getFileImports = knowledgeModule.getFileImports;
    getFileDependents = knowledgeModule.getFileDependents;
    getFileCommits = knowledgeModule.getFileCommits;
    getFileContributors = knowledgeModule.getFileContributors;
    getContributorFiles = knowledgeModule.getContributorFiles;
    getContributorModules = knowledgeModule.getContributorModules;
    getClassMethods = knowledgeModule.getClassMethods;
    getFileSymbols = knowledgeModule.getFileSymbols;
    traverseKnowledgeGraph = knowledgeModule.traverseKnowledgeGraph;

    const gitModule = await import("../lib/server/git/service");
    ingestGitHistory = gitModule.ingestGitHistory;
    const contribModule = await import("../lib/server/contributors/service");
    ingestContributors = contribModule.ingestContributors;

    await cleanupAll(testRepoId, testProjectId, testOrgId);

    // Seed database for M2.2 query tests
    await db.organization.create({
      data: { id: testOrgId, name: "Query Org", slug: "query-org" },
    });
    await db.project.create({
      data: { id: testProjectId, orgId: testOrgId, name: "Query Proj", slug: "query-proj" },
    });
    await db.repository.create({
      data: {
        id: testRepoId,
        projectId: testProjectId,
        name: "query-repo",
        owner: "devmind-query",
        defaultBranch: "main",
      },
    });

    // Modules
    const authModule = await db.module.create({
      data: {
        repoId: testRepoId,
        name: "auth-module",
        type: "feature",
        desc: "Auth and security module",
      },
    });

    const userModule = await db.module.create({
      data: {
        repoId: testRepoId,
        name: "user-module",
        type: "feature",
        desc: "User profile management",
      },
    });

    // File 1: src/auth/AuthService.ts (in auth-module)
    await db.fileRecord.create({
      data: {
        repoId: testRepoId,
        moduleId: authModule.id,
        path: "src/auth/AuthService.ts",
        size: "3 KB",
        type: "code",
        language: "TypeScript",
        parsingStatus: "PARSED",
        lineCount: 100,
        symbolsJson: JSON.stringify({
          path: "src/auth/AuthService.ts",
          classes: [
            {
              name: "AuthService",
              file: "src/auth/AuthService.ts",
              baseClass: "BaseAuth",
              startLine: 1,
              endLine: 80,
              methods: [
                {
                  name: "login",
                  file: "src/auth/AuthService.ts",
                  className: "AuthService",
                  startLine: 10,
                  endLine: 25,
                  parameters: ["email", "password"],
                  returnType: "Promise<string>",
                  isAsync: true,
                },
                {
                  name: "logout",
                  file: "src/auth/AuthService.ts",
                  className: "AuthService",
                  startLine: 30,
                  endLine: 40,
                  parameters: ["token"],
                  returnType: "void",
                  isAsync: false,
                },
              ],
            },
          ],
          functions: [
            {
              name: "generateToken",
              file: "src/auth/AuthService.ts",
              startLine: 85,
              endLine: 95,
              parameters: ["userId"],
              returnType: "string",
              isAsync: false,
            },
          ],
        }),
        updatedText: "now",
      },
    });

    // File 2: src/user/UserService.ts (in user-module)
    // Duplicate symbol test: has a class named "AuthService" as well
    await db.fileRecord.create({
      data: {
        repoId: testRepoId,
        moduleId: userModule.id,
        path: "src/user/UserService.ts",
        size: "2.5 KB",
        type: "code",
        language: "TypeScript",
        parsingStatus: "PARSED",
        lineCount: 75,
        symbolsJson: JSON.stringify({
          path: "src/user/UserService.ts",
          classes: [
            {
              name: "UserService",
              file: "src/user/UserService.ts",
              startLine: 1,
              endLine: 50,
              methods: [
                {
                  name: "getUser",
                  file: "src/user/UserService.ts",
                  className: "UserService",
                  startLine: 10,
                  endLine: 20,
                  parameters: ["id"],
                  returnType: "Promise<User>",
                  isAsync: true,
                },
              ],
            },
            // Duplicate class name across files for disambiguation testing
            {
              name: "AuthService",
              file: "src/user/UserService.ts",
              startLine: 52,
              endLine: 70,
              methods: [
                {
                  name: "validateLocalUser",
                  file: "src/user/UserService.ts",
                  className: "AuthService",
                  startLine: 55,
                  endLine: 65,
                  parameters: ["id"],
                  returnType: "boolean",
                  isAsync: false,
                },
              ],
            },
          ],
          functions: [
            {
              name: "generateToken",
              file: "src/user/UserService.ts",
              startLine: 71,
              endLine: 75,
              parameters: ["seed"],
              returnType: "string",
              isAsync: false,
            },
          ],
        }),
        updatedText: "now",
      },
    });

    // File 3: src/api/client.ts (no module, imports AuthService.ts)
    await db.fileRecord.create({
      data: {
        repoId: testRepoId,
        path: "src/api/client.ts",
        size: "1.2 KB",
        type: "code",
        language: "TypeScript",
        parsingStatus: "PARSED",
        lineCount: 30,
        updatedText: "now",
      },
    });

    // File 4: src/corrupt.ts with broken/empty symbolsJson
    await db.fileRecord.create({
      data: {
        repoId: testRepoId,
        path: "src/corrupt.ts",
        size: "500 B",
        type: "code",
        language: "TypeScript",
        parsingStatus: "PARSED",
        lineCount: 15,
        symbolsJson: "{ bad json",
        updatedText: "now",
      },
    });

    // Dependencies:
    // client.ts imports src/auth/AuthService.ts
    await db.dependencyRecord.create({
      data: {
        key: `dep-${testRepoId}-client-to-auth`,
        repoId: testRepoId,
        kind: "internal",
        sourceFile: "src/api/client.ts",
        targetFile: "src/auth/AuthService.ts",
        importSource: "../auth/AuthService",
        dependencyType: "import",
        language: "TypeScript",
        resolutionStatus: "RESOLVED_INTERNAL",
      },
    });

    // UserService.ts imports src/auth/AuthService.ts
    await db.dependencyRecord.create({
      data: {
        key: `dep-${testRepoId}-user-to-auth`,
        repoId: testRepoId,
        kind: "internal",
        sourceFile: "src/user/UserService.ts",
        targetFile: "src/auth/AuthService.ts",
        importSource: "../auth/AuthService",
        dependencyType: "import",
        language: "TypeScript",
        resolutionStatus: "RESOLVED_INTERNAL",
      },
    });

    // External dependency for AuthService.ts
    await db.dependencyRecord.create({
      data: {
        key: `dep-${testRepoId}-auth-to-jwt`,
        repoId: testRepoId,
        kind: "external",
        sourceFile: "src/auth/AuthService.ts",
        targetFile: null,
        name: "jsonwebtoken",
        version: "^9.0.2",
        dependencyType: "import",
        resolutionStatus: "RESOLVED_EXTERNAL",
      },
    });

    // Contributor 1: Alice (author of commit 1 & 2)
    const aliceKey = `email:alice@devmind.io`;
    const aliceContrib = await db.contributorRecord.create({
      data: {
        id: "contrib-query-alice",
        repoId: testRepoId,
        identityKey: aliceKey,
        name: "Alice Dev",
        email: "alice@devmind.io",
        authoredCommitsCount: 2,
        totalCommitsCount: 2,
        firstContributionAt: new Date("2026-01-01T10:00:00Z"),
        lastContributionAt: new Date("2026-02-01T10:00:00Z"),
        additions: 150,
        deletions: 20,
        filesTouchedCount: 2,
        filesTouchedJson: JSON.stringify(["src/auth/AuthService.ts", "src/user/UserService.ts"]),
        isAuthor: true,
      },
    });

    // Contributor 2: Bob (author of commit 3)
    const bobKey = `email:bob@devmind.io`;
    const bobContrib = await db.contributorRecord.create({
      data: {
        id: "contrib-query-bob",
        repoId: testRepoId,
        identityKey: bobKey,
        name: "Bob Builder",
        email: "bob@devmind.io",
        authoredCommitsCount: 1,
        totalCommitsCount: 1,
        firstContributionAt: new Date("2026-02-15T10:00:00Z"),
        lastContributionAt: new Date("2026-02-15T10:00:00Z"),
        additions: 40,
        deletions: 5,
        filesTouchedCount: 1,
        filesTouchedJson: JSON.stringify(["src/api/client.ts"]),
        isAuthor: true,
      },
    });

    // Commits:
    // Commit 1: Alice changed AuthService.ts
    const commit1Sha = "1111111111111111111111111111111111111111";
    const commit1 = await db.commitRecord.create({
      data: {
        id: `commit-${testRepoId}-1`,
        sha: commit1Sha,
        shortSha: commit1Sha.substring(0, 7),
        repoId: testRepoId,
        message: "feat: add AuthService login flow",
        authorName: "Alice Dev",
        authorEmail: "alice@devmind.io",
        authorContributorId: aliceContrib.id,
        authoredAt: new Date("2026-01-01T10:00:00Z"),
        committedAt: new Date("2026-01-01T10:00:00Z"),
      },
    });

    await db.commitFileChangeRecord.create({
      data: {
        repoId: testRepoId,
        commitId: commit1.id,
        commitSha: commit1Sha,
        newPath: "src/auth/AuthService.ts",
        changeType: "ADDED",
        additions: 100,
        deletions: 10,
      },
    });

    // Commit 2: Alice changed UserService.ts
    const commit2Sha = "2222222222222222222222222222222222222222";
    const commit2 = await db.commitRecord.create({
      data: {
        id: `commit-${testRepoId}-2`,
        sha: commit2Sha,
        shortSha: commit2Sha.substring(0, 7),
        repoId: testRepoId,
        message: "feat: add UserService",
        authorName: "Alice Dev",
        authorEmail: "alice@devmind.io",
        authorContributorId: aliceContrib.id,
        authoredAt: new Date("2026-02-01T10:00:00Z"),
        committedAt: new Date("2026-02-01T10:00:00Z"),
      },
    });

    await db.commitFileChangeRecord.create({
      data: {
        repoId: testRepoId,
        commitId: commit2.id,
        commitSha: commit2Sha,
        newPath: "src/user/UserService.ts",
        changeType: "ADDED",
        additions: 50,
        deletions: 10,
      },
    });

    // Commit 3: Bob changed client.ts
    const commit3Sha = "3333333333333333333333333333333333333333";
    const commit3 = await db.commitRecord.create({
      data: {
        id: `commit-${testRepoId}-3`,
        sha: commit3Sha,
        shortSha: commit3Sha.substring(0, 7),
        repoId: testRepoId,
        message: "chore: add api client",
        authorName: "Bob Builder",
        authorEmail: "bob@devmind.io",
        authorContributorId: bobContrib.id,
        authoredAt: new Date("2026-02-15T10:00:00Z"),
        committedAt: new Date("2026-02-15T10:00:00Z"),
      },
    });

    await db.commitFileChangeRecord.create({
      data: {
        repoId: testRepoId,
        commitId: commit3.id,
        commitSha: commit3Sha,
        newPath: "src/api/client.ts",
        changeType: "ADDED",
        additions: 40,
        deletions: 5,
      },
    });
  });

  after(async () => {
    await cleanupAll(testRepoId, testProjectId, testOrgId);
  });

  // 1. Repository knowledge query
  test("1. getRepositoryKnowledge returns partitioned repository collections", async () => {
    const view = await getRepositoryKnowledge(testRepoId);

    assert.equal(view.repoNode.id, `repo:${testRepoId}`);
    assert.equal(view.repoNode.name, "query-repo");
    assert.equal(view.modules.length, 2);
    assert.equal(view.files.length, 4);
    assert.ok(view.classes.length >= 2, "Must contain classes from auth and user files");
    assert.ok(view.functions.length >= 2, "Must contain standalone functions");
    assert.ok(view.methods.length >= 3, "Must contain class methods");
    assert.equal(view.contributors.length, 2);
    assert.equal(view.commits.length, 3);
    assert.ok(view.dependencies.length >= 1);
    assert.ok(view.edges.length > 0);
    assert.ok(view.stats.totalNodes > 0);
    assert.ok(view.stats.totalEdges > 0);
  });

  // 2. File knowledge query
  test("2. getFileKnowledge returns comprehensive file view", async () => {
    const fileView = await getFileKnowledge(testRepoId, "src/auth/AuthService.ts");
    assert.ok(fileView);
    assert.equal(fileView.fileNode.filePath, "src/auth/AuthService.ts");
    assert.equal(fileView.moduleNode?.name, "auth-module");
    assert.equal(fileView.classes.length, 1);
    assert.equal(fileView.classes[0].name, "AuthService");
    assert.equal(fileView.functions.length, 1);
    assert.equal(fileView.functions[0].name, "generateToken");
    assert.equal(fileView.methods.length, 2);
    // External dependency to jsonwebtoken
    assert.ok(fileView.externalDependencies.some((e) => e.dependencyNode.name === "jsonwebtoken"));
    // Dependents: client.ts and UserService.ts import AuthService.ts
    assert.equal(fileView.dependents.length, 2);
    assert.ok(fileView.dependents.some((d) => d.sourceFile === "src/api/client.ts"));
    assert.ok(fileView.dependents.some((d) => d.sourceFile === "src/user/UserService.ts"));
    // Modifying commits
    assert.equal(fileView.recentCommits.length, 1);
    assert.equal(fileView.recentCommits[0].contributorNode?.name, "Alice Dev");
  });

  // 3. Class lookup
  test("3. getSymbolKnowledge looks up Class symbol with metadata", async () => {
    const classView = await getSymbolKnowledge(testRepoId, "UserService");
    assert.ok(classView);
    assert.equal(classView.symbolNode.type, "Class");
    assert.equal(classView.symbolNode.name, "UserService");
    assert.equal(classView.fileNode!.filePath, "src/user/UserService.ts");
    assert.equal(classView.moduleNode?.name, "user-module");
    assert.equal(classView.methods.length, 1);
    assert.equal(classView.methods[0].name, "getUser");
  });

  // 4. Function lookup
  test("4. getSymbolKnowledge looks up Function symbol with parameters and returnType", async () => {
    const funcView = await getSymbolKnowledge(testRepoId, "generateToken", "src/auth/AuthService.ts");
    assert.ok(funcView);
    assert.equal(funcView.symbolNode.type, "Function");
    assert.equal(funcView.symbolNode.name, "generateToken");
    assert.equal(funcView.fileNode!.filePath, "src/auth/AuthService.ts");
    assert.deepEqual(funcView.symbolNode.metadata?.parameters, ["userId"]);
    assert.equal(funcView.symbolNode.metadata?.returnType, "string");
  });

  // 5. Method lookup
  test("5. getSymbolKnowledge looks up Method symbol with parentClass and isAsync", async () => {
    const methodView = await getSymbolKnowledge(testRepoId, "login", "src/auth/AuthService.ts");
    assert.ok(methodView);
    assert.equal(methodView.symbolNode.type, "Method");
    assert.equal(methodView.symbolNode.name, "login");
    assert.equal(methodView.parentClass?.name, "AuthService");
    assert.equal(methodView.symbolNode.metadata?.isAsync, true);
    assert.deepEqual(methodView.symbolNode.metadata?.parameters, ["email", "password"]);
  });

  // 6. Duplicate symbol disambiguation
  test("6. findSymbolsByName finds all duplicate symbols and filePath disambiguates getSymbolKnowledge", async () => {
    // Both src/auth/AuthService.ts and src/user/UserService.ts have a class named "AuthService"
    const allMatches = await findSymbolsByName(testRepoId, "AuthService");
    assert.equal(allMatches.length, 2);
    const filePaths = allMatches.map((m) => m.fileNode!.filePath).sort();
    assert.deepEqual(filePaths, ["src/auth/AuthService.ts", "src/user/UserService.ts"]);

    // Disambiguate using filePath parameter
    const authVersion = await getSymbolKnowledge(testRepoId, "AuthService", "src/auth/AuthService.ts");
    assert.ok(authVersion);
    assert.equal(authVersion.fileNode!.filePath, "src/auth/AuthService.ts");
    assert.ok(authVersion.methods.some((m) => m.name === "login"));

    const userVersion = await getSymbolKnowledge(testRepoId, "AuthService", "src/user/UserService.ts");
    assert.ok(userVersion);
    assert.equal(userVersion.fileNode!.filePath, "src/user/UserService.ts");
    assert.ok(userVersion.methods.some((m) => m.name === "validateLocalUser"));
  });

  // 7. Contributor knowledge query
  test("7. getContributorKnowledge returns contributor info and relationships", async () => {
    const contrib = await getContributorKnowledge(testRepoId, "alice@devmind.io");
    assert.ok(contrib);
    assert.equal(contrib.contributorNode.name, "Alice Dev");
    assert.equal(contrib.totalCommitsCount, 2);
    assert.equal(contrib.filesTouched.length, 2);
    assert.ok(contrib.filesTouched.includes("src/auth/AuthService.ts"));
    assert.ok(contrib.filesTouched.includes("src/user/UserService.ts"));
    assert.equal(contrib.recentCommits.length, 2);
    assert.ok(contrib.touchedModules.some((m) => m.name === "auth-module"));
    assert.ok(contrib.touchedModules.some((m) => m.name === "user-module"));
  });

  // 8. File → imported files (getFileImports)
  test("8. getFileImports returns distinct internal target files imported by the file", async () => {
    const clientImports = await getFileImports(testRepoId, "src/api/client.ts");
    assert.deepEqual(clientImports, ["src/auth/AuthService.ts"]);

    const userImports = await getFileImports(testRepoId, "src/user/UserService.ts");
    assert.deepEqual(userImports, ["src/auth/AuthService.ts"]);

    const authImports = await getFileImports(testRepoId, "src/auth/AuthService.ts");
    // jsonwebtoken is an external package (targetFile: null), so internal imports are empty
    assert.deepEqual(authImports, []);
  });

  // 9. File → dependent files (getFileDependents)
  test("9. getFileDependents returns distinct source files that import the file", async () => {
    const authDependents = await getFileDependents(testRepoId, "src/auth/AuthService.ts");
    assert.equal(authDependents.length, 2);
    assert.ok(authDependents.includes("src/api/client.ts"));
    assert.ok(authDependents.includes("src/user/UserService.ts"));

    const clientDependents = await getFileDependents(testRepoId, "src/api/client.ts");
    assert.deepEqual(clientDependents, []);
  });

  // 10. File → modifying commits (getFileCommits)
  test("10. getFileCommits returns commit nodes modifying the file", async () => {
    const commits = await getFileCommits(testRepoId, "src/auth/AuthService.ts");
    assert.equal(commits.length, 1);
    assert.equal(commits[0].type, "Commit");
    assert.equal(commits[0].label, "1111111: feat: add AuthService login flow");

    const clientCommits = await getFileCommits(testRepoId, "src/api/client.ts");
    assert.equal(clientCommits.length, 1);
    assert.equal(clientCommits[0].label, "3333333: chore: add api client");
  });

  // 11. File → contributors (getFileContributors)
  test("11. getFileContributors returns distinct contributor nodes who modified the file", async () => {
    const authContributors = await getFileContributors(testRepoId, "src/auth/AuthService.ts");
    assert.equal(authContributors.length, 1);
    assert.equal(authContributors[0].name, "Alice Dev");

    const clientContributors = await getFileContributors(testRepoId, "src/api/client.ts");
    assert.equal(clientContributors.length, 1);
    assert.equal(clientContributors[0].name, "Bob Builder");
  });

  // 12. Contributor → touched files (getContributorFiles)
  test("12. getContributorFiles returns file paths touched by contributor", async () => {
    const aliceFiles = await getContributorFiles(testRepoId, "Alice Dev");
    assert.equal(aliceFiles.length, 2);
    assert.ok(aliceFiles.includes("src/auth/AuthService.ts"));
    assert.ok(aliceFiles.includes("src/user/UserService.ts"));

    const bobFiles = await getContributorFiles(testRepoId, "bob@devmind.io");
    assert.deepEqual(bobFiles, ["src/api/client.ts"]);
  });

  // 13. Contributor → related modules (getContributorModules)
  test("13. getContributorModules returns module nodes touched by contributor", async () => {
    const aliceModules = await getContributorModules(testRepoId, "Alice Dev");
    assert.equal(aliceModules.length, 2);
    const moduleNames = aliceModules.map((m) => m.name).sort();
    assert.deepEqual(moduleNames, ["auth-module", "user-module"]);

    // Bob touched client.ts which is not assigned to a module
    const bobModules = await getContributorModules(testRepoId, "bob@devmind.io");
    assert.equal(bobModules.length, 0);
  });

  // 14. Class → methods (getClassMethods)
  test("14. getClassMethods returns method nodes of the specified class", async () => {
    const authMethods = await getClassMethods(testRepoId, "AuthService", "src/auth/AuthService.ts");
    assert.equal(authMethods.length, 2);
    const methodNames = authMethods.map((m) => m.name).sort();
    assert.deepEqual(methodNames, ["login", "logout"]);

    const userMethods = await getClassMethods(testRepoId, "UserService");
    assert.equal(userMethods.length, 1);
    assert.equal(userMethods[0].name, "getUser");
  });

  // 15. File → symbols (getFileSymbols)
  test("15. getFileSymbols returns classes, functions, and methods for a file", async () => {
    const symbols = await getFileSymbols(testRepoId, "src/auth/AuthService.ts");
    assert.equal(symbols.classes.length, 1);
    assert.equal(symbols.classes[0].name, "AuthService");
    assert.equal(symbols.functions.length, 1);
    assert.equal(symbols.functions[0].name, "generateToken");
    assert.equal(symbols.methods.length, 2);
    assert.ok(symbols.methods.some((m) => m.name === "login"));
    assert.ok(symbols.methods.some((m) => m.name === "logout"));
  });

  // 16. Missing repository handling
  test("16. Missing repository handling throws or returns predictable error/empty", async () => {
    await assert.rejects(
      async () => {
        await getRepositoryKnowledge("non-existent-repo-id");
      },
      /Repository not found/
    );

    const fileK = await getFileKnowledge("non-existent-repo-id", "any/path.ts");
    assert.equal(fileK, null);

    const symbolK = await getSymbolKnowledge("non-existent-repo-id", "AnySymbol");
    assert.equal(symbolK, null);

    const contribK = await getContributorKnowledge("non-existent-repo-id", "someone");
    assert.equal(contribK, null);
  });

  // 17. Missing file handling
  test("17. Missing file handling returns predictable null or empty arrays", async () => {
    const fileK = await getFileKnowledge(testRepoId, "does/not/exist.ts");
    assert.equal(fileK, null);

    const imports = await getFileImports(testRepoId, "does/not/exist.ts");
    assert.deepEqual(imports, []);

    const dependents = await getFileDependents(testRepoId, "does/not/exist.ts");
    assert.deepEqual(dependents, []);

    const commits = await getFileCommits(testRepoId, "does/not/exist.ts");
    assert.deepEqual(commits, []);

    const contributors = await getFileContributors(testRepoId, "does/not/exist.ts");
    assert.deepEqual(contributors, []);

    const symbols = await getFileSymbols(testRepoId, "does/not/exist.ts");
    assert.deepEqual(symbols, { classes: [], functions: [], methods: [] });
  });

  // 18. Missing symbol handling
  test("18. Missing symbol handling returns predictable null or empty arrays", async () => {
    const symbolK = await getSymbolKnowledge(testRepoId, "NonExistentSymbol");
    assert.equal(symbolK, null);

    const methods = await getClassMethods(testRepoId, "NonExistentClass");
    assert.deepEqual(methods, []);

    const symbols = await findSymbolsByName(testRepoId, "NonExistentSymbol");
    assert.deepEqual(symbols, []);
  });

  // 19. Missing contributor handling
  test("19. Missing contributor handling returns predictable null or empty arrays", async () => {
    const contribK = await getContributorKnowledge(testRepoId, "non-existent-contributor");
    assert.equal(contribK, null);

    const files = await getContributorFiles(testRepoId, "non-existent-contributor");
    assert.deepEqual(files, []);

    const modules = await getContributorModules(testRepoId, "non-existent-contributor");
    assert.deepEqual(modules, []);
  });

  // 20. Empty/invalid symbol data handling
  test("20. Gracefully handles empty, missing, or corrupted symbol data without throwing", async () => {
    // File with corrupted JSON: src/corrupt.ts
    const symbols = await getFileSymbols(testRepoId, "src/corrupt.ts");
    assert.deepEqual(symbols, { classes: [], functions: [], methods: [] });

    const fileView = await getFileKnowledge(testRepoId, "src/corrupt.ts");
    assert.ok(fileView);
    assert.deepEqual(fileView.classes, []);
    assert.deepEqual(fileView.functions, []);
    assert.deepEqual(fileView.methods, []);

    // File with no symbolsJson: src/api/client.ts
    const clientSymbols = await getFileSymbols(testRepoId, "src/api/client.ts");
    assert.deepEqual(clientSymbols, { classes: [], functions: [], methods: [] });
  });

  // Real Repository Integration Tests with palmerhq/monorepo-starter
  describe("Real Repository Integration (palmerhq/monorepo-starter)", () => {
    const realRepoDir = "C:\\Users\\DELL\\Desktop\\monorepo-starter";
    const realTestRepoId = "repo-real-query-test";

    before(async () => {
      await cleanupAll(realTestRepoId, testProjectId, testOrgId);

      await db.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: "Query Org", slug: "query-org" },
      });
      await db.project.upsert({
        where: { id: testProjectId },
        update: {},
        create: { id: testProjectId, orgId: testOrgId, name: "Query Proj", slug: "query-proj" },
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

      // Ingest real git history and contributors
      await ingestGitHistory(realTestRepoId, realRepoDir, { branch: "master" });
      await ingestContributors(realTestRepoId);

      // Add real module and file records
      const uiMod = await db.module.create({
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
          moduleId: uiMod.id,
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
      await cleanupAll(realTestRepoId, testProjectId, testOrgId);
    });

    test("Queries real repository knowledge successfully", async () => {
      const realKnowledge = await getRepositoryKnowledge(realTestRepoId);

      assert.equal(realKnowledge.repoNode.name, "monorepo-starter");
      assert.ok(realKnowledge.commits.length > 0, "Real commits must be queried");
      assert.ok(realKnowledge.contributors.length > 0, "Real contributors must be queried");
      assert.ok(realKnowledge.files.length > 0, "Real files must be queried");
      assert.ok(realKnowledge.classes.length > 0, "Real classes must be queried");
      assert.ok(realKnowledge.functions.length > 0, "Real functions must be queried");
      assert.ok(realKnowledge.stats.totalNodes > 0);
      assert.ok(realKnowledge.stats.totalEdges > 0);
    });

    test("Queries real contributor files and touched modules", async () => {
      const repoKnowledge = await getRepositoryKnowledge(realTestRepoId);
      const topContributor = repoKnowledge.contributors[0];
      assert.ok(topContributor, "Must have at least one contributor from real repo");

      const touchedFiles = await getContributorFiles(realTestRepoId, topContributor.name);
      assert.ok(Array.isArray(touchedFiles), "Must return array of files");

      const touchedModules = await getContributorModules(realTestRepoId, topContributor.name);
      assert.ok(Array.isArray(touchedModules), "Must return array of modules");
    });
  });
});
