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

import { extractSymbolsFromFile } from "../lib/server/knowledge/extractor";

let db: typeof import("../lib/server/db").db;
let buildRepositoryKnowledgeGraph: typeof import("../lib/server/knowledge/service").buildRepositoryKnowledgeGraph;
let getFileKnowledge: typeof import("../lib/server/knowledge/service").getFileKnowledge;
let getSymbolKnowledge: typeof import("../lib/server/knowledge/service").getSymbolKnowledge;
let getContributorKnowledge: typeof import("../lib/server/knowledge/service").getContributorKnowledge;
let traverseKnowledgeGraph: typeof import("../lib/server/knowledge/service").traverseKnowledgeGraph;
let ingestGitHistory: typeof import("../lib/server/git/service").ingestGitHistory;
let ingestContributors: typeof import("../lib/server/contributors/service").ingestContributors;

describe("DevMind Milestone 2.1 — Knowledge Graph Service Test Suite", () => {
  before(async () => {
    const dbModule = await import("../lib/server/db");
    db = dbModule.db;
    const knowledgeService = await import("../lib/server/knowledge/service");
    buildRepositoryKnowledgeGraph = knowledgeService.buildRepositoryKnowledgeGraph;
    getFileKnowledge = knowledgeService.getFileKnowledge;
    getSymbolKnowledge = knowledgeService.getSymbolKnowledge;
    getContributorKnowledge = knowledgeService.getContributorKnowledge;
    traverseKnowledgeGraph = knowledgeService.traverseKnowledgeGraph;
    const gitModule = await import("../lib/server/git/service");
    ingestGitHistory = gitModule.ingestGitHistory;
    const contribModule = await import("../lib/server/contributors/service");
    ingestContributors = contribModule.ingestContributors;
  });

  const testOrgId = "org-m2-knowledge-test";
  const testProjectId = "proj-m2-knowledge-test";
  const testRepoId = "repo-m2-knowledge-test";

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

  describe("1. Code Symbol Extraction Layer", () => {
    test("Extracts Class and Method nodes with CONTAINS hierarchy", () => {
      const mockSymbols = JSON.stringify({
        path: "src/auth/service.ts",
        classes: [
          {
            name: "AuthService",
            file: "src/auth/service.ts",
            baseClass: "BaseService",
            interfaces: ["IAuth"],
            startLine: 10,
            endLine: 80,
            methods: [
              {
                name: "login",
                file: "src/auth/service.ts",
                className: "AuthService",
                startLine: 20,
                endLine: 35,
                parameters: ["email", "password"],
                returnType: "Promise<string>",
                isAsync: true,
              },
              {
                name: "logout",
                file: "src/auth/service.ts",
                className: "AuthService",
                startLine: 40,
                endLine: 45,
                parameters: ["userId"],
                returnType: "void",
                isAsync: false,
              },
            ],
          },
        ],
        functions: [],
      });

      const extracted = extractSymbolsFromFile(
        "test-repo",
        "src/auth/service.ts",
        mockSymbols,
        "TypeScript"
      );

      assert.equal(extracted.classes.length, 1);
      assert.equal(extracted.methods.length, 2);
      assert.equal(extracted.functions.length, 0);

      const cls = extracted.classes[0];
      assert.equal(cls.id, "class:test-repo:src/auth/service.ts:AuthService");
      assert.equal(cls.name, "AuthService");
      assert.equal(cls.type, "Class");
      assert.equal(cls.metadata?.baseClass, "BaseService");

      const methodLogin = extracted.methods.find((m) => m.name === "login");
      assert.ok(methodLogin);
      assert.equal(methodLogin.id, "method:test-repo:src/auth/service.ts:AuthService:login");
      assert.equal(methodLogin.type, "Method");
      assert.equal(methodLogin.metadata?.isAsync, true);

      // Check edges: File --CONTAINS--> Class, Class --CONTAINS--> Method
      const fileToClass = extracted.edges.find(
        (e) => e.source === "file:test-repo:src/auth/service.ts" && e.target === cls.id
      );
      assert.ok(fileToClass);
      assert.equal(fileToClass.type, "CONTAINS");

      const classToMethod = extracted.edges.find(
        (e) => e.source === cls.id && e.target === methodLogin.id
      );
      assert.ok(classToMethod);
      assert.equal(classToMethod.type, "CONTAINS");
    });

    test("Extracts standalone top-level Function nodes", () => {
      const mockSymbols = JSON.stringify({
        path: "src/utils/format.ts",
        classes: [],
        functions: [
          {
            name: "formatDate",
            file: "src/utils/format.ts",
            startLine: 5,
            endLine: 12,
            parameters: ["date", "pattern"],
            returnType: "string",
            isAsync: false,
          },
          {
            name: "parseCurrency",
            file: "src/utils/format.ts",
            startLine: 15,
            endLine: 25,
            parameters: ["raw"],
            returnType: "number",
            isAsync: false,
          },
        ],
      });

      const extracted = extractSymbolsFromFile(
        "test-repo",
        "src/utils/format.ts",
        mockSymbols,
        "TypeScript"
      );

      assert.equal(extracted.functions.length, 2);
      assert.equal(extracted.classes.length, 0);

      const fn = extracted.functions[0];
      assert.equal(fn.id, "func:test-repo:src/utils/format.ts:formatDate");
      assert.equal(fn.type, "Function");

      const edge = extracted.edges.find(
        (e) => e.source === "file:test-repo:src/utils/format.ts" && e.target === fn.id
      );
      assert.ok(edge);
      assert.equal(edge.type, "CONTAINS");
    });

    test("Gracefully handles null, undefined, or invalid symbolsJson", () => {
      assert.deepEqual(extractSymbolsFromFile("repo", "file.ts", null), {
        nodes: [],
        edges: [],
        classes: [],
        functions: [],
        methods: [],
      });
      assert.deepEqual(extractSymbolsFromFile("repo", "file.ts", "{ broken json"), {
        nodes: [],
        edges: [],
        classes: [],
        functions: [],
        methods: [],
      });
    });
  });

  describe("2. Knowledge Graph Construction & Relational Edge Linking", () => {
    before(async () => {
      await cleanupAll(testRepoId, testProjectId, testOrgId);

      await db.organization.create({
        data: { id: testOrgId, name: "Knowledge Org", slug: "knowledge-org" },
      });
      await db.project.create({
        data: { id: testProjectId, orgId: testOrgId, name: "Knowledge Proj", slug: "knowledge-proj" },
      });
      await db.repository.create({
        data: {
          id: testRepoId,
          projectId: testProjectId,
          name: "knowledge-repo",
          owner: "test-owner",
          defaultBranch: "main",
        },
      });

      // 1. Create Module
      const mod = await db.module.create({
        data: {
          repoId: testRepoId,
          name: "auth",
          type: "core",
          desc: "Authentication and token management",
        },
      });

      // 2. Create File 1: auth.ts (with symbols)
      await db.fileRecord.create({
        data: {
          repoId: testRepoId,
          moduleId: mod.id,
          path: "src/auth.ts",
          size: "3.5 KB",
          type: "code",
          language: "TypeScript",
          parsingStatus: "PARSED",
          lineCount: 85,
          symbolsJson: JSON.stringify({
            path: "src/auth.ts",
            classes: [
              {
                name: "Authenticator",
                file: "src/auth.ts",
                startLine: 1,
                endLine: 50,
                methods: [
                  {
                    name: "verifyToken",
                    file: "src/auth.ts",
                    className: "Authenticator",
                    startLine: 15,
                    endLine: 30,
                    parameters: ["token"],
                    returnType: "boolean",
                  },
                ],
              },
            ],
            functions: [
              {
                name: "hashSecret",
                file: "src/auth.ts",
                startLine: 55,
                endLine: 70,
                parameters: ["secret"],
                returnType: "string",
              },
            ],
          }),
          updatedText: "now",
        },
      });

      // 3. Create File 2: client.ts
      await db.fileRecord.create({
        data: {
          repoId: testRepoId,
          path: "src/client.ts",
          size: "2 KB",
          type: "code",
          language: "TypeScript",
          parsingStatus: "PARSED",
          lineCount: 40,
          updatedText: "now",
        },
      });

      // 4. Create Dependencies:
      // a) Internal: client.ts imports auth.ts
      await db.dependencyRecord.create({
        data: {
          key: `dep-${testRepoId}-client-to-auth`,
          repoId: testRepoId,
          kind: "internal",
          sourceFile: "src/client.ts",
          targetFile: "src/auth.ts",
          importSource: "./auth",
          dependencyType: "import",
          language: "typescript",
          resolutionStatus: "RESOLVED_INTERNAL",
        },
      });

      // b) External: auth.ts depends on jsonwebtoken
      await db.dependencyRecord.create({
        data: {
          key: `dep-${testRepoId}-manifest-jwt`,
          repoId: testRepoId,
          kind: "external",
          sourceFile: "package.json",
          name: "jsonwebtoken",
          version: "^9.0.2",
          dependencyType: "manifest",
          purpose: "JWT token signing",
        },
      });

      // 5. Create Contributor
      const contrib = await db.contributorRecord.create({
        data: {
          repoId: testRepoId,
          identityKey: "email:dev@example.com",
          name: "Dev Lead",
          email: "dev@example.com",
          authoredCommitsCount: 1,
          totalCommitsCount: 1,
          additions: 100,
          deletions: 10,
          filesTouchedCount: 2,
          filesTouchedJson: JSON.stringify(["src/auth.ts", "src/client.ts"]),
          firstContributionAt: new Date("2026-01-01T10:00:00Z"),
          lastContributionAt: new Date("2026-01-01T10:00:00Z"),
          isAuthor: true,
        },
      });

      // 6. Create Commit & FileChange
      const commit = await db.commitRecord.create({
        data: {
          repoId: testRepoId,
          sha: "fedcba9876543210fedcba9876543210fedcba98",
          shortSha: "fedcba9",
          message: "feat: add authenticator and client",
          authorName: "Dev Lead",
          authorEmail: "dev@example.com",
          authorContributorId: contrib.id,
          authoredAt: new Date("2026-01-01T10:00:00Z"),
          committedAt: new Date("2026-01-01T10:00:00Z"),
        },
      });

      await db.commitFileChangeRecord.create({
        data: {
          repoId: testRepoId,
          commitId: commit.id,
          commitSha: commit.sha,
          newPath: "src/auth.ts",
          changeType: "ADDED",
          additions: 85,
          deletions: 0,
        },
      });
    });

    test("Builds complete Knowledge Graph with all 9 entity types and relational edges", async () => {
      const graph = await buildRepositoryKnowledgeGraph(testRepoId);

      assert.equal(graph.repoId, testRepoId);
      assert.ok(graph.nodes.length >= 8, `Expected at least 8 nodes, got ${graph.nodes.length}`);
      assert.ok(graph.edges.length >= 8, `Expected at least 8 edges, got ${graph.edges.length}`);

      // Verify Entity Types present
      const nodeTypes = new Set(graph.nodes.map((n) => n.type));
      assert.ok(nodeTypes.has("Repository"), "Missing Repository node");
      assert.ok(nodeTypes.has("Module"), "Missing Module node");
      assert.ok(nodeTypes.has("File"), "Missing File node");
      assert.ok(nodeTypes.has("Class"), "Missing Class node");
      assert.ok(nodeTypes.has("Method"), "Missing Method node");
      assert.ok(nodeTypes.has("Function"), "Missing Function node");
      assert.ok(nodeTypes.has("Commit"), "Missing Commit node");
      assert.ok(nodeTypes.has("Contributor"), "Missing Contributor node");
      assert.ok(nodeTypes.has("Dependency"), "Missing Dependency node");

      // Verify Edge Types present
      const edgeTypes = new Set(graph.edges.map((e) => e.type));
      assert.ok(edgeTypes.has("CONTAINS"), "Missing CONTAINS edge");
      assert.ok(edgeTypes.has("IMPORTS"), "Missing IMPORTS edge");
      assert.ok(edgeTypes.has("CHANGES"), "Missing CHANGES edge");
      assert.ok(edgeTypes.has("AUTHORED_BY"), "Missing AUTHORED_BY edge");

      // Specific Edge Validations
      const importsEdge = graph.edges.find((e) => e.type === "IMPORTS");
      assert.ok(importsEdge);
      assert.equal(importsEdge.source, `file:${testRepoId}:src/client.ts`);
      assert.equal(importsEdge.target, `file:${testRepoId}:src/auth.ts`);

      const changesEdge = graph.edges.find((e) => e.type === "CHANGES");
      assert.ok(changesEdge);
      assert.equal(changesEdge.source, `commit:${testRepoId}:fedcba9876543210fedcba9876543210fedcba98`);
      assert.equal(changesEdge.target, `file:${testRepoId}:src/auth.ts`);

      const authoredEdge = graph.edges.find((e) => e.type === "AUTHORED_BY");
      assert.ok(authoredEdge);
      assert.equal(authoredEdge.source, `commit:${testRepoId}:fedcba9876543210fedcba9876543210fedcba98`);
      assert.equal(authoredEdge.target, `contributor:${testRepoId}:email:dev@example.com`);

      // Verify stats
      assert.equal(graph.stats.totalNodes, graph.nodes.length);
      assert.equal(graph.stats.totalEdges, graph.edges.length);
      assert.equal(graph.stats.nodesByType.Class, 1);
      assert.equal(graph.stats.nodesByType.Method, 1);
      assert.equal(graph.stats.nodesByType.Function, 1);
    });

    test("Filters Knowledge Graph by entityTypes and relationTypes", async () => {
      const filtered = await buildRepositoryKnowledgeGraph(testRepoId, {
        entityTypes: ["File", "Class", "Method"],
        relationTypes: ["CONTAINS"],
      });

      for (const n of filtered.nodes) {
        assert.ok(["File", "Class", "Method"].includes(n.type));
      }

      for (const e of filtered.edges) {
        assert.equal(e.type, "CONTAINS");
      }

      assert.equal(filtered.stats.nodesByType.Commit, 0);
      assert.equal(filtered.stats.nodesByType.Contributor, 0);
    });
  });

  describe("3. Specialized Knowledge Query Views", () => {
    test("getFileKnowledge returns comprehensive file-level knowledge view", async () => {
      const fileKnowledge = await getFileKnowledge(testRepoId, "src/auth.ts");

      assert.ok(fileKnowledge);
      assert.equal(fileKnowledge.fileNode.name, "auth.ts");
      assert.equal(fileKnowledge.moduleNode?.name, "auth");
      assert.equal(fileKnowledge.classes.length, 1);
      assert.equal(fileKnowledge.classes[0].name, "Authenticator");
      assert.equal(fileKnowledge.methods.length, 1);
      assert.equal(fileKnowledge.methods[0].name, "verifyToken");
      assert.equal(fileKnowledge.functions.length, 1);
      assert.equal(fileKnowledge.functions[0].name, "hashSecret");

      // Verify dependents: client.ts imports auth.ts
      assert.equal(fileKnowledge.dependents.length, 1);
      assert.equal(fileKnowledge.dependents[0].sourceFile, "src/client.ts");

      // Verify recent commits
      assert.equal(fileKnowledge.recentCommits.length, 1);
      assert.equal(fileKnowledge.recentCommits[0].commitNode.name, "fedcba9");
      assert.equal(fileKnowledge.recentCommits[0].contributorNode?.name, "Dev Lead");
    });

    test("getFileKnowledge returns null for non-existent file", async () => {
      const result = await getFileKnowledge(testRepoId, "src/non-existent.ts");
      assert.equal(result, null);
    });

    test("getSymbolKnowledge finds Class and returns its methods and file node", async () => {
      const symbolKnowledge = await getSymbolKnowledge(testRepoId, "Authenticator");

      assert.ok(symbolKnowledge);
      assert.equal(symbolKnowledge.symbolNode.type, "Class");
      assert.equal(symbolKnowledge.symbolNode.name, "Authenticator");
      assert.equal(symbolKnowledge.fileNode?.filePath, "src/auth.ts");
      assert.equal(symbolKnowledge.methods.length, 1);
      assert.equal(symbolKnowledge.methods[0].name, "verifyToken");
    });

    test("getSymbolKnowledge finds Function and returns its metadata", async () => {
      const funcKnowledge = await getSymbolKnowledge(testRepoId, "hashSecret");

      assert.ok(funcKnowledge);
      assert.equal(funcKnowledge.symbolNode.type, "Function");
      assert.equal(funcKnowledge.symbolNode.name, "hashSecret");
      assert.equal(funcKnowledge.fileNode?.filePath, "src/auth.ts");
    });

    test("getContributorKnowledge returns contributor profile, touched modules, and authored commits", async () => {
      const contribKnowledge = await getContributorKnowledge(
        testRepoId,
        "email:dev@example.com"
      );

      assert.ok(contribKnowledge);
      assert.equal(contribKnowledge.contributorNode.name, "Dev Lead");
      assert.equal(contribKnowledge.totalCommitsCount, 1);
      assert.equal(contribKnowledge.filesTouched.length, 2);
      assert.equal(contribKnowledge.recentCommits.length, 1);
      assert.equal(contribKnowledge.recentCommits[0].name, "fedcba9");
      assert.ok(contribKnowledge.touchedModules.some((m) => m.name === "auth"));
    });
  });

  describe("4. Breadth-First Relationship Traversal", () => {
    test("traverseKnowledgeGraph navigates multi-hop connections starting from a file", async () => {
      const startFileId = `file:${testRepoId}:src/client.ts`;
      const subgraph = await traverseKnowledgeGraph(testRepoId, startFileId, 2);

      assert.ok(subgraph.nodes.some((n) => n.id === startFileId));
      // Hop 1: client.ts imports auth.ts
      assert.ok(subgraph.nodes.some((n) => n.id === `file:${testRepoId}:src/auth.ts`));
      // Hop 2: auth.ts contains Authenticator class
      assert.ok(subgraph.nodes.some((n) => n.name === "Authenticator"));

      const edgeTypes = new Set(subgraph.edges.map((e) => e.type));
      assert.ok(edgeTypes.has("IMPORTS"));
      assert.ok(edgeTypes.has("CONTAINS"));
    });

    test("traverseKnowledgeGraph navigates from a commit to modified files and author", async () => {
      const commitId = `commit:${testRepoId}:fedcba9876543210fedcba9876543210fedcba98`;
      const subgraph = await traverseKnowledgeGraph(testRepoId, commitId, 1);

      assert.ok(subgraph.nodes.some((n) => n.id === commitId));
      // Connected to author contributor
      assert.ok(subgraph.nodes.some((n) => n.type === "Contributor"));
      // Connected to changed file
      assert.ok(subgraph.nodes.some((n) => n.id === `file:${testRepoId}:src/auth.ts`));
    });

    after(async () => {
      await cleanupAll(testRepoId, testProjectId, testOrgId);
    });
  });

  describe("5. Real Repository Validation (palmerhq/monorepo-starter)", () => {
    const realRepoDir = "C:\\Users\\DELL\\Desktop\\monorepo-starter";
    const realTestRepoId = "repo-real-knowledge-test";

    before(async () => {
      await cleanupAll(realTestRepoId, testProjectId, testOrgId);

      await db.organization.upsert({
        where: { id: testOrgId },
        update: {},
        create: { id: testOrgId, name: "Knowledge Org", slug: "knowledge-org" },
      });
      await db.project.upsert({
        where: { id: testProjectId },
        update: {},
        create: { id: testProjectId, orgId: testOrgId, name: "Knowledge Proj", slug: "knowledge-proj" },
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

      // Add a couple of realistic files with symbols
      await db.fileRecord.create({
        data: {
          repoId: realTestRepoId,
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

    test("Builds real knowledge graph with real git commits, contributors, and symbol nodes", async () => {
      const realGraph = await buildRepositoryKnowledgeGraph(realTestRepoId);

      assert.equal(realGraph.repoId, realTestRepoId);
      assert.ok(realGraph.stats.nodesByType.Commit > 0, "Real commits must be in graph");
      assert.ok(realGraph.stats.nodesByType.Contributor > 0, "Real contributors must be in graph");
      assert.ok(realGraph.stats.nodesByType.File > 0, "Files must be in graph");
      assert.ok(realGraph.stats.nodesByType.Function > 0, "Functions must be extracted");
      assert.ok(realGraph.stats.edgesByType.CHANGES > 0, "Real CHANGES edges must exist");
      assert.ok(realGraph.stats.edgesByType.AUTHORED_BY > 0, "Real AUTHORED_BY edges must exist");

      // Verify contributor knowledge with real Git stats
      const firstContrib = realGraph.nodes.find((n) => n.type === "Contributor");
      assert.ok(firstContrib);
      const contribKnowledge = await getContributorKnowledge(realTestRepoId, firstContrib.name);
      assert.ok(contribKnowledge);
      assert.ok(contribKnowledge.totalCommitsCount > 0);
    });
  });
});
