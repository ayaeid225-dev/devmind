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
let askAssistant: typeof import("../lib/server/ai/assistant").askAssistant;
let searchEvidence: typeof import("../lib/server/rag/search").searchEvidence;
let searchRepository: typeof import("../lib/server/rag/search").searchRepository;
let getLLMProvider: typeof import("../lib/server/ai/provider").getLLMProvider;
let chunkFileContent: typeof import("../lib/server/rag/chunker").chunkFileContent;
let getEmbeddingProvider: typeof import("../lib/server/rag/provider").getEmbeddingProvider;

describe("DevMind — Repository-Grounded AI Assistant Suite (18 Scenarios)", () => {
  const repoIdA = "test-ai-repo-a";
  const repoIdB = "test-ai-repo-b";
  const repoIdUnindexed = "test-ai-repo-unindexed";

  let testOrgId: string;
  let testUserId: string;
  let unauthorizedUserId: string;
  let authFileId: string;
  let userFileId: string;
  let dynamicFileId: string;
  let originalGeminiKey: string | undefined;

  before(async () => {
    originalGeminiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "mock_key";

    const dbModule = await import("../lib/server/db");
    db = dbModule.db;

    const assistantModule = await import("../lib/server/ai/assistant");
    askAssistant = assistantModule.askAssistant;

    const ragSearchModule = await import("../lib/server/rag/search");
    searchEvidence = ragSearchModule.searchEvidence;
    searchRepository = ragSearchModule.searchRepository;

    const providerModule = await import("../lib/server/ai/provider");
    getLLMProvider = providerModule.getLLMProvider;

    const chunkerModule = await import("../lib/server/rag/chunker");
    chunkFileContent = chunkerModule.chunkFileContent;

    const embProviderModule = await import("../lib/server/rag/provider");
    getEmbeddingProvider = embProviderModule.getEmbeddingProvider;

    // Clean up any stale data
    await db.documentChunk.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.commitFileChangeRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.commitRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.dependencyRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.fileRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.module.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.documentRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.repository.deleteMany({ where: { id: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });

    // Create Org and Users
    const org = await db.organization.create({
      data: {
        name: "AI Grounding Test Org",
        slug: `ai-grounding-org-${Date.now()}`,
      },
    });
    testOrgId = org.id;

    const user = await db.user.create({
      data: {
        email: `ai-tester-${Date.now()}@devmind.test`,
        name: "AI Test User",
      },
    });
    testUserId = user.id;

    const unauthorizedUser = await db.user.create({
      data: {
        email: `unauthorized-${Date.now()}@devmind.test`,
        name: "Unauthorized User",
      },
    });
    unauthorizedUserId = unauthorizedUser.id;

    await db.orgMember.create({
      data: {
        orgId: testOrgId,
        userId: testUserId,
        role: "OWNER",
      },
    });

    const project = await db.project.create({
      data: {
        name: "AI Grounding Project",
        slug: `ai-project-${Date.now()}`,
        orgId: testOrgId,
      },
    });

    // Create Repositories
    await db.repository.create({
      data: {
        id: repoIdA,
        projectId: project.id,
        name: "backend-service-a",
        owner: "test-org",
        defaultBranch: "main",
      },
    });

    await db.repository.create({
      data: {
        id: repoIdB,
        projectId: project.id,
        name: "isolated-service-b",
        owner: "test-org",
        defaultBranch: "main",
      },
    });

    await db.repository.create({
      data: {
        id: repoIdUnindexed,
        projectId: project.id,
        name: "unindexed-empty-repo",
        owner: "test-org",
        defaultBranch: "main",
      },
    });

    // Create Modules in Repo A
    const authModule = await db.module.create({
      data: {
        id: `mod-auth-${repoIdA}`,
        repoId: repoIdA,
        name: "AuthModule",
        type: "Security",
        desc: "JWT Session and OAuth Authentication Gateway",
        filesCount: 2,
        depsCount: 3,
        dependentsCount: 5,
      },
    });

    const billingModule = await db.module.create({
      data: {
        id: `mod-billing-${repoIdA}`,
        repoId: repoIdA,
        name: "BillingModule",
        type: "Core",
        desc: "Subscription payments and invoicing",
        filesCount: 1,
        depsCount: 2,
        dependentsCount: 1,
      },
    });

    // Create Files in Repo A
    const authFile = await db.fileRecord.create({
      data: {
        repoId: repoIdA,
        moduleId: authModule.id,
        path: "src/auth/jwt.service.ts",
        size: "3.2 KB",
        type: "code",
        language: "TypeScript",
        lineCount: 45,
        symbolsJson: JSON.stringify([
          { name: "JwtService", kind: "class", line: 5 },
          { name: "verifyToken", kind: "method", line: 12 },
          { name: "signSessionToken", kind: "method", line: 24 },
        ]),
        updatedText: "export class JwtService { ... }",
      },
    });
    authFileId = authFile.id;

    const userControllerFile = await db.fileRecord.create({
      data: {
        repoId: repoIdA,
        moduleId: authModule.id,
        path: "src/controllers/user.controller.ts",
        size: "2.1 KB",
        type: "code",
        language: "TypeScript",
        lineCount: 30,
        symbolsJson: JSON.stringify([
          { name: "UserController", kind: "class", line: 4 },
          { name: "getProfile", kind: "method", line: 10 },
        ]),
        updatedText: "export class UserController { ... }",
      },
    });
    userFileId = userControllerFile.id;

    // Create Sensitive File in Repo A (should be excluded)
    const envFile = await db.fileRecord.create({
      data: {
        repoId: repoIdA,
        path: ".env.production",
        size: "400 B",
        type: "config",
        language: "Shell",
        updatedText: "DATABASE_PASSWORD=super_secret_db_password_12345",
      },
    });

    // Populate Real Chunks with Embeddings
    const embProvider = getEmbeddingProvider();

    const authContent = `
export class JwtService {
  private readonly secretKey = process.env.JWT_SECRET || 'dev-secret';

  async verifyToken(token: string): Promise<UserSessionPayload> {
    // Validates HMAC-SHA256 signature and returns user claims
    return jwt.verify(token, this.secretKey);
  }

  async signSessionToken(userId: string, role: string): Promise<string> {
    return jwt.sign({ sub: userId, role }, this.secretKey, { expiresIn: '7d' });
  }
}
`;
    const authChunks = chunkFileContent({
      repoId: repoIdA,
      fileId: authFile.id,
      path: authFile.path,
      content: authContent,
    });
    for (const c of authChunks) {
      const vec = await embProvider.embedText(c.content);
      await db.documentChunk.create({
        data: {
          repoId: repoIdA,
          fileId: authFile.id,
          moduleId: authModule.id,
          path: c.path,
          language: c.language,
          content: c.content,
          startLine: c.startLine,
          endLine: c.endLine,
          chunkIndex: c.chunkIndex,
          contentHash: c.contentHash,
          embeddingJson: JSON.stringify(vec),
        },
      });
    }

    const userContent = `
import { JwtService } from '../auth/jwt.service';

export class UserController {
  constructor(private jwtService: JwtService) {}

  async getProfile(req: Request, res: Response) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = await this.jwtService.verifyToken(token);
    return res.json({ user: session.sub });
  }
}
`;
    const userChunks = chunkFileContent({
      repoId: repoIdA,
      fileId: userControllerFile.id,
      path: userControllerFile.path,
      content: userContent,
    });
    for (const c of userChunks) {
      const vec = await embProvider.embedText(c.content);
      await db.documentChunk.create({
        data: {
          repoId: repoIdA,
          fileId: userControllerFile.id,
          moduleId: authModule.id,
          path: c.path,
          language: c.language,
          content: c.content,
          startLine: c.startLine,
          endLine: c.endLine,
          chunkIndex: c.chunkIndex,
          contentHash: c.contentHash,
          embeddingJson: JSON.stringify(vec),
        },
      });
    }

    // Sensitive chunk (.env.production)
    await db.documentChunk.create({
      data: {
        repoId: repoIdA,
        fileId: envFile.id,
        path: ".env.production",
        language: "Shell",
        content: "DATABASE_PASSWORD=super_secret_db_password_12345\nAPI_SECRET=sk-proj-supersecret9988",
        startLine: 1,
        endLine: 2,
        chunkIndex: 0,
        contentHash: "hash-secret-env",
        embeddingJson: JSON.stringify(await embProvider.embedText("DATABASE_PASSWORD super_secret_db_password_12345")),
      },
    });

    // Create Dependency Records in Repo A
    // user.controller.ts IMPORTS jwt.service.ts
    await db.dependencyRecord.create({
      data: {
        key: `dep-${repoIdA}-1`,
        repoId: repoIdA,
        kind: "internal",
        sourceFile: "src/controllers/user.controller.ts",
        targetFile: "src/auth/jwt.service.ts",
        importSource: "../auth/jwt.service",
        fromModule: "AuthModule",
        toModule: "AuthModule",
        dependencyType: "import",
        resolutionStatus: "RESOLVED_INTERNAL",
      },
    });

    // Create Real Git Commits and File Changes in Repo A
    const commit1 = await db.commitRecord.create({
      data: {
        repoId: repoIdA,
        sha: "a1b2c3d4e5f67890123456789abcdef012345678",
        shortSha: "a1b2c3d",
        message: "feat(auth): implement JWT token verification and session signing",
        authorName: "Sarah Connor",
        authorEmail: "sarah@cyberdyne.test",
        authoredAt: new Date("2026-09-20T10:00:00Z"),
        committedAt: new Date("2026-09-20T10:05:00Z"),
      },
    });

    await db.commitFileChangeRecord.create({
      data: {
        repoId: repoIdA,
        commitId: commit1.id,
        commitSha: commit1.sha,
        newPath: "src/auth/jwt.service.ts",
        changeType: "ADDED",
        additions: 45,
        deletions: 0,
      },
    });

    // Create Data in Repo B (for isolation test)
    const repoBFile = await db.fileRecord.create({
      data: {
        repoId: repoIdB,
        path: "src/secrets/repo_b_isolated.ts",
        size: "1 KB",
        type: "code",
        language: "TypeScript",
        updatedText: "export const REPO_B_EXCLUSIVE_DATA = 'SECRET_B';",
      },
    });
    await db.documentChunk.create({
      data: {
        repoId: repoIdB,
        fileId: repoBFile.id,
        path: repoBFile.path,
        language: repoBFile.language,
        content: "export const REPO_B_EXCLUSIVE_DATA = 'SECRET_B';",
        startLine: 1,
        endLine: 1,
        chunkIndex: 0,
        contentHash: "repo-b-hash",
        embeddingJson: JSON.stringify(await embProvider.embedText("REPO_B_EXCLUSIVE_DATA SECRET_B")),
      },
    });
  });

  after(async () => {
    // Cleanup
    await db.documentChunk.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.commitFileChangeRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.commitRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.dependencyRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.fileRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.module.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.documentRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.repository.deleteMany({ where: { id: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.project.deleteMany({ where: { orgId: testOrgId } });
    await db.orgMember.deleteMany({ where: { orgId: testOrgId } });
    await db.organization.deleteMany({ where: { id: testOrgId } });
    await db.user.deleteMany({ where: { id: { in: [testUserId, unauthorizedUserId] } } });
    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });

  // Scenario 1: Repository-specific question uses real repository evidence
  test("1. Repository-specific question uses real repository evidence", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "How does JWT token verification work in this repository?",
      userId: testUserId,
    });

    assert.equal(res.evidenceState, "VERIFIED");
    assert.equal(res.insufficientEvidence, false);
    assert.ok(res.confidence > 0.5, "Expected high confidence score");
    assert.ok(res.citations.length > 0, "Expected at least 1 citation");
    assert.equal(res.citations[0].path, "src/auth/jwt.service.ts");
    assert.ok(res.answer.includes("jwt.service.ts") || res.answer.includes("JwtService"));
    assert.ok(res.relatedFiles.includes("src/auth/jwt.service.ts"));
  });

  // Scenario 2: Generic question can still be answered
  test("2. Generic question can still be answered", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "What is dependency injection?",
      userId: testUserId,
    });

    assert.equal(res.intent, "GENERAL");
    assert.equal(res.evidenceState, "PARTIAL");
    assert.equal(res.insufficientEvidence, false);
    assert.ok(res.answer.includes("design pattern") || res.answer.includes("Dependency injection"));
  });

  // Scenario 3: File-location question returns real files
  test("3. File-location question returns real files", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "Where is authentication implemented?",
      userId: testUserId,
    });

    assert.equal(res.intent, "LOCATION");
    assert.equal(res.evidenceState, "VERIFIED");
    assert.ok(res.citations.some((c) => c.path === "src/auth/jwt.service.ts"));
    assert.ok(res.answer.includes("src/auth/jwt.service.ts"));
  });

  // Scenario 4: Dependency question uses actual relationships
  test("4. Dependency question uses actual relationships", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "What depends on jwt.service.ts?",
      userId: testUserId,
    });

    assert.ok(res.intent === "DEPENDENCY" || res.intent === "IMPACT");
    assert.equal(res.evidenceState, "VERIFIED");
    assert.ok(
      res.impactAnalysis?.directlyAffected.includes("src/controllers/user.controller.ts"),
      "user.controller.ts must be detected as directly depending on jwt.service.ts"
    );
    assert.ok(
      res.answer.includes("user.controller.ts"),
      "Answer must explicitly mention the dependent file"
    );
  });

  // Scenario 5: Impact question identifies actual dependents
  test("5. Impact question identifies actual dependents", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "What happens if I delete src/auth/jwt.service.ts?",
      userId: testUserId,
    });

    assert.equal(res.intent, "IMPACT");
    assert.equal(res.evidenceState, "VERIFIED");
    assert.ok(res.impactAnalysis, "Expected impactAnalysis object");
    assert.ok(res.impactAnalysis.directlyAffected.includes("src/controllers/user.controller.ts"));
    assert.ok(res.answer.includes("Directly affected"));
    assert.ok(res.answer.includes("user.controller.ts"));
  });

  // Scenario 6: Missing evidence produces NOT_FOUND or PARTIAL
  test("6. Missing evidence produces NOT_FOUND or PARTIAL without hallucinations", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "Where is the Ethereum cryptocurrency blockchain smart contract miner?",
      userId: testUserId,
    });

    assert.equal(res.evidenceState, "NOT_FOUND");
    assert.equal(res.insufficientEvidence, true);
    assert.equal(res.confidence, 0);
    assert.equal(res.confidenceLevel, "LOW");
    assert.equal(res.citations.length, 0);
    assert.ok(
      res.answer.includes("I couldn't verify this from the indexed repository data"),
      "Expected exact zero-hallucination notice"
    );
  });

  // Scenario 7: Deleted files are not returned as valid evidence
  test("7. Deleted files are not returned as valid evidence", async () => {
    // Create a temporary file
    const tempFile = await db.fileRecord.create({
      data: {
        repoId: repoIdA,
        path: "src/legacy/obsolete_helper.ts",
        size: "1 KB",
        type: "code",
        language: "TypeScript",
        updatedText: "export function obsoleteLegacyAlgorithm() {}",
      },
    });

    const chunk = await db.documentChunk.create({
      data: {
        repoId: repoIdA,
        fileId: tempFile.id,
        path: tempFile.path,
        language: "TypeScript",
        content: "export function obsoleteLegacyAlgorithm() { return 42; }",
        startLine: 1,
        endLine: 1,
        chunkIndex: 0,
        contentHash: "temp-obsolete-hash",
        embeddingJson: JSON.stringify(await getEmbeddingProvider().embedText("obsoleteLegacyAlgorithm")),
      },
    });

    // Verify it is searchable before deletion
    const beforeRes = await askAssistant({
      repoId: repoIdA,
      question: "Where is obsoleteLegacyAlgorithm defined?",
      userId: testUserId,
    });
    assert.ok(beforeRes.citations.some((c) => c.path === "src/legacy/obsolete_helper.ts"));

    // Simulate P1 sync deletion: delete chunk and file record
    await db.documentChunk.delete({ where: { id: chunk.id } });
    await db.fileRecord.delete({ where: { id: tempFile.id } });

    // Verify after deletion: file MUST NOT appear as valid evidence
    const afterRes = await askAssistant({
      repoId: repoIdA,
      question: "Where is obsoleteLegacyAlgorithm defined?",
      userId: testUserId,
    });
    assert.ok(
      !afterRes.citations.some((c) => c.path === "src/legacy/obsolete_helper.ts"),
      "Deleted file must not be returned in citations"
    );
    assert.equal(afterRes.evidenceState, "NOT_FOUND");
  });

  // Scenario 8: Newly indexed files can be retrieved
  test("8. Newly indexed files can be retrieved immediately", async () => {
    const newFile = await db.fileRecord.create({
      data: {
        repoId: repoIdA,
        path: "src/telemetry/metrics_collector.ts",
        size: "2 KB",
        type: "code",
        language: "TypeScript",
        updatedText: "export class PrometheusMetricsCollector {}",
      },
    });
    dynamicFileId = newFile.id;

    await db.documentChunk.create({
      data: {
        repoId: repoIdA,
        fileId: newFile.id,
        path: newFile.path,
        language: "TypeScript",
        content: "export class PrometheusMetricsCollector { recordLatency(ms: number) { /* latency */ } }",
        startLine: 1,
        endLine: 2,
        chunkIndex: 0,
        contentHash: "metrics-hash-1",
        embeddingJson: JSON.stringify(await getEmbeddingProvider().embedText("PrometheusMetricsCollector recordLatency")),
      },
    });

    const res = await askAssistant({
      repoId: repoIdA,
      question: "Where is PrometheusMetricsCollector defined?",
      userId: testUserId,
    });

    assert.equal(res.evidenceState, "VERIFIED");
    assert.ok(res.citations.some((c) => c.path === "src/telemetry/metrics_collector.ts"));
  });

  // Scenario 9: Repository isolation works (no cross-repo leaks)
  test("9. Repository isolation works (no cross-repo leaks)", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "What is REPO_B_EXCLUSIVE_DATA SECRET_B?",
      userId: testUserId,
    });

    assert.equal(res.evidenceState, "NOT_FOUND");
    assert.ok(!res.citations.some((c) => c.path.includes("repo_b")));
    assert.ok(!res.answer.includes("SECRET_B"));
  });

  // Scenario 10: Unauthorized repository access is rejected
  test("10. Unauthorized repository access is rejected with 403 error", async () => {
    await assert.rejects(
      async () => {
        await askAssistant({
          repoId: repoIdA,
          question: "Where is authentication?",
          userId: unauthorizedUserId,
        });
      },
      /Unauthorized/i,
      "Expected askAssistant to reject non-member user"
    );
  });

  // Scenario 11: Sensitive files are excluded
  test("11. Sensitive files (.env, secrets) are completely excluded from AI context", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "What is the super_secret_db_password_12345 DATABASE_PASSWORD in .env.production?",
      userId: testUserId,
    });

    assert.equal(res.evidenceState, "NOT_FOUND");
    assert.ok(!res.citations.some((c) => c.path.includes(".env")));
    assert.ok(!res.answer.includes("super_secret_db_password_12345"));
  });

  // Scenario 12: No mock/fake project data is used
  test("12. No mock/fake project data is used", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "How does JWT authentication work?",
      userId: testUserId,
    });

    // Must not contain mock placeholders from prototype
    assert.ok(!res.answer.includes("Dr. Smith"));
    assert.ok(!res.answer.includes("AppointmentController"));
    assert.ok(!res.answer.includes("PatientRecord"));
    assert.ok(res.citations.every((c) => c.path.startsWith("src/")));
  });

  // Scenario 13: Evidence references are valid (real files and line numbers)
  test("13. Evidence references are valid (real files, chunk/file IDs, and line numbers)", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "Where is verifyToken implemented?",
      userId: testUserId,
    });

    assert.ok(res.citations.length > 0);
    for (const citation of res.citations) {
      assert.ok(citation.path.length > 0);
      assert.ok(citation.startLine >= 1);
      assert.ok(citation.endLine >= citation.startLine);
      assert.ok(citation.id.length > 0);

      // Verify that this file actually exists in the database
      const dbFile = await db.fileRecord.findFirst({
        where: { repoId: repoIdA, path: citation.path },
      });
      assert.ok(dbFile, `Citation file ${citation.path} must exist in database`);
    }
  });

  // Scenario 14: Existing semantic search tests continue passing
  test("14. Existing semantic search (searchRepository) continues working", async () => {
    const searchRes = await searchRepository({
      repoId: repoIdA,
      query: "JwtService verifyToken",
      userId: testUserId,
    });

    assert.equal(searchRes.indexed, true);
    assert.ok(searchRes.results.length > 0);
    assert.ok(
      searchRes.results.some((r) => r.path === "src/auth/jwt.service.ts"),
      "Expected src/auth/jwt.service.ts in search results"
    );
  });

  // Scenario 15: Existing AI Assistant functionality (searchEvidence + generateAnswer) continues working
  test("15. Existing AI Assistant functionality continues working with original signatures", async () => {
    const evidence = await searchEvidence({
      repoId: repoIdA,
      query: "verifyToken JwtService",
      limit: 3,
      userId: testUserId,
    });

    assert.ok(evidence.length > 0);
    const provider = getLLMProvider();

    // Calling generateAnswer with original { question, evidence } signature
    const aiAnswer = await provider.generateAnswer({
      question: "verifyToken JwtService",
      evidence,
    });

    assert.ok(aiAnswer.answer.length > 0);
    assert.ok(typeof aiAnswer.confidence === "number");
    assert.ok(Array.isArray(aiAnswer.citations));
  });

  // Scenario 16: Git-history questions do not fabricate commits
  test("16. Git-history questions do not fabricate commits and ground in real data", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "Who changed src/auth/jwt.service.ts recently and what was the commit?",
      userId: testUserId,
    });

    assert.equal(res.intent, "GIT_HISTORY");
    assert.equal(res.evidenceState, "VERIFIED");
    assert.ok(res.gitHistory && res.gitHistory.length > 0, "Expected gitHistory records");
    assert.equal(res.gitHistory[0].author, "Sarah Connor");
    assert.equal(res.gitHistory[0].shortSha, "a1b2c3d");
    assert.ok(res.answer.includes("Sarah Connor"));
    assert.ok(res.answer.includes("a1b2c3d"));
  });

  // Scenario 17: Unindexed repository handles clean empty state
  test("17. Unindexed repository returns unindexed notice with NOT_FOUND state", async () => {
    const res = await askAssistant({
      repoId: repoIdUnindexed,
      question: "Where is authentication?",
      userId: testUserId,
    });

    assert.equal(res.evidenceState, "NOT_FOUND");
    assert.equal(res.insufficientEvidence, true);
    assert.ok(res.answer.includes("has not been indexed yet"));
  });

  // Scenario 18: Architecture question describes real modules
  test("18. Architecture question describes real indexed modules", async () => {
    const res = await askAssistant({
      repoId: repoIdA,
      question: "Explain the project architecture and modules",
      userId: testUserId,
    });

    assert.equal(res.intent, "ARCHITECTURE");
    assert.equal(res.evidenceState, "VERIFIED");
    assert.ok(res.answer.includes("AuthModule"));
    assert.ok(res.answer.includes("BillingModule"));
  });
});
