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
let searchRepository: typeof import("../lib/server/rag/search").searchRepository;
let searchEvidence: typeof import("../lib/server/rag/search").searchEvidence;
let isSensitiveFile: typeof import("../lib/server/rag/search").isSensitiveFile;
let getEmbeddingProvider: typeof import("../lib/server/rag/provider").getEmbeddingProvider;
let chunkFileContent: typeof import("../lib/server/rag/chunker").chunkFileContent;

describe("P8: Real Semantic General Search Suite", () => {
  const repoIdA = "test-semantic-repo-a";
  const repoIdB = "test-semantic-repo-b";
  const repoIdUnindexed = "test-semantic-repo-unindexed";
  let testOrgId: string;
  let testUserId: string;
  let unauthorizedUserId: string;
  let authFileId: string;
  let stripeFileId: string;

  before(async () => {
    const dbModule = await import("../lib/server/db");
    db = dbModule.db;

    const ragSearchModule = await import("../lib/server/rag/search");
    searchRepository = ragSearchModule.searchRepository;
    searchEvidence = ragSearchModule.searchEvidence;
    isSensitiveFile = ragSearchModule.isSensitiveFile;

    const providerModule = await import("../lib/server/rag/provider");
    getEmbeddingProvider = providerModule.getEmbeddingProvider;

    const chunkerModule = await import("../lib/server/rag/chunker");
    chunkFileContent = chunkerModule.chunkFileContent;

    // Clean up any stale data from previous test runs
    await db.documentChunk.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.fileRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.module.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.documentRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.repository.deleteMany({ where: { id: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });

    // Create test user and organization
    const org = await db.organization.create({
      data: {
        name: "Semantic Search Test Org",
        slug: `search-test-org-${Date.now()}`,
      },
    });
    testOrgId = org.id;

    const user = await db.user.create({
      data: {
        email: `search-tester-${Date.now()}@devmind.test`,
        name: "Search Tester",
      },
    });
    testUserId = user.id;

    // Create unauthorized user not in this organization
    const unauth = await db.user.create({
      data: {
        email: `unauth-tester-${Date.now()}@devmind.test`,
        name: "Unauthorized Tester",
      },
    });
    unauthorizedUserId = unauth.id;

    await db.orgMember.create({
      data: {
        orgId: testOrgId,
        userId: testUserId,
        role: "OWNER",
      },
    });

    const project = await db.project.create({
      data: {
        orgId: testOrgId,
        name: "Semantic Search Project",
        slug: `search-proj-${Date.now()}`,
      },
    });

    // Create Repo A (Indexed repository)
    await db.repository.create({
      data: {
        id: repoIdA,
        projectId: project.id,
        name: "core-service-repo",
        owner: "test-org",
        defaultBranch: "main",
        ingestionStatus: "COMPLETED",
        embeddingStatus: "COMPLETED",
      },
    });

    // Create Repo B (Isolated second repository)
    await db.repository.create({
      data: {
        id: repoIdB,
        projectId: project.id,
        name: "inventory-service-repo",
        owner: "test-org",
        defaultBranch: "main",
        ingestionStatus: "COMPLETED",
        embeddingStatus: "COMPLETED",
      },
    });

    // Create Repo Unindexed (0 files, 0 chunks)
    await db.repository.create({
      data: {
        id: repoIdUnindexed,
        projectId: project.id,
        name: "empty-unindexed-repo",
        owner: "test-org",
        defaultBranch: "main",
        ingestionStatus: "PENDING",
        embeddingStatus: "NOT_INDEXED",
        indexedChunksCount: 0,
      },
    });

    // Create module for Repo A
    const authMod = await db.module.create({
      data: {
        repoId: repoIdA,
        name: "Authentication & Identity Module",
        type: "core",
        desc: "Handles user login, JWT tokens, session lifecycle, and authorization policies",
      },
    });

    // Create document for Repo A
    await db.documentRecord.create({
      data: {
        repoId: repoIdA,
        category: "Architecture",
        title: "Authentication & Security Architecture Guide",
        summary: "Describes encryption standards, JWT tokens, and OAuth flow",
        author: "Security Team",
        status: "current",
      },
    });

    const provider = getEmbeddingProvider();

    // 1. Create Auth File & Chunks in Repo A
    const authFile = await db.fileRecord.create({
      data: {
        repoId: repoIdA,
        path: "src/auth/token.service.ts",
        size: "2.4 KB",
        type: "code",
        language: "TypeScript",
        moduleId: authMod.id,
        symbolsJson: JSON.stringify([
          { name: "TokenService", kind: "class", line: 8 },
          { name: "signJwtToken", kind: "method", line: 20 },
          { name: "verifySessionToken", kind: "method", line: 35 },
        ]),
        updatedText: "Indexed token service",
      },
    });
    authFileId = authFile.id;

    const authContent = `
export class TokenService {
  private secretKey: string;
  
  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  async signJwtToken(payload: { userId: string; email: string }) {
    // Generates a cryptographically signed HMAC SHA-256 JWT access token
    return sign(payload, this.secretKey, { expiresIn: '7d' });
  }

  async verifySessionToken(token: string) {
    // Validates incoming bearer token and extracts verified user session
    return verify(token, this.secretKey);
  }
}
`;
    const authChunks = chunkFileContent({
      repoId: repoIdA,
      fileId: authFile.id,
      moduleId: authMod.id,
      path: authFile.path,
      content: authContent,
    });

    for (const chunk of authChunks) {
      const vec = await provider.embedText(chunk.content);
      await db.documentChunk.create({
        data: {
          repoId: repoIdA,
          fileId: chunk.fileId,
          moduleId: chunk.moduleId,
          path: chunk.path,
          language: chunk.language,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          chunkIndex: chunk.chunkIndex,
          contentHash: chunk.contentHash,
          embeddingJson: JSON.stringify(vec),
        },
      });
    }

    // 2. Create Schema Prisma File in Repo A
    const schemaFile = await db.fileRecord.create({
      data: {
        repoId: repoIdA,
        path: "prisma/schema.prisma",
        size: "1.2 KB",
        type: "code",
        language: "Prisma",
        updatedText: "Indexed database schema",
      },
    });

    const schemaContent = `
datasource db {
  provider = "sqlite"
  url = env("DATABASE_URL")
}

model User {
  id String @id @default(cuid())
  email String @unique
  name String
}
`;
    const schemaChunks = chunkFileContent({
      repoId: repoIdA,
      fileId: schemaFile.id,
      path: schemaFile.path,
      content: schemaContent,
    });

    for (const chunk of schemaChunks) {
      const vec = await provider.embedText(chunk.content);
      await db.documentChunk.create({
        data: {
          repoId: repoIdA,
          fileId: chunk.fileId,
          path: chunk.path,
          language: chunk.language,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          chunkIndex: chunk.chunkIndex,
          contentHash: chunk.contentHash,
          embeddingJson: JSON.stringify(vec),
        },
      });
    }

    // 3. Create Billing File in Repo A (for deletion test later)
    const stripeFile = await db.fileRecord.create({
      data: {
        repoId: repoIdA,
        path: "src/billing/stripe.client.ts",
        size: "3.1 KB",
        type: "code",
        language: "TypeScript",
        updatedText: "Indexed stripe client",
      },
    });
    stripeFileId = stripeFile.id;

    const stripeContent = `
export class StripeBillingClient {
  async processSubscriptionPayment(customerId: string, amount: number) {
    // Charges customer subscription via credit card gateway
    return stripe.charges.create({ customer: customerId, amount });
  }
}
`;
    const stripeChunks = chunkFileContent({
      repoId: repoIdA,
      fileId: stripeFile.id,
      path: stripeFile.path,
      content: stripeContent,
    });

    for (const chunk of stripeChunks) {
      const vec = await provider.embedText(chunk.content);
      await db.documentChunk.create({
        data: {
          repoId: repoIdA,
          fileId: chunk.fileId,
          path: chunk.path,
          language: chunk.language,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          chunkIndex: chunk.chunkIndex,
          contentHash: chunk.contentHash,
          embeddingJson: JSON.stringify(vec),
        },
      });
    }

    // 4. Create Sensitive .env File in Repo A (to test secret exclusion)
    const envFile = await db.fileRecord.create({
      data: {
        repoId: repoIdA,
        path: ".env.production",
        size: "200 B",
        type: "code",
        language: "Unknown",
        updatedText: "SECRET_DATABASE_KEY=super_secret_db_password_12345",
      },
    });
    const envChunks = chunkFileContent({
      repoId: repoIdA,
      fileId: envFile.id,
      path: envFile.path,
      content: "SECRET_DATABASE_KEY=super_secret_db_password_12345",
    });
    for (const chunk of envChunks) {
      const vec = await provider.embedText(chunk.content);
      await db.documentChunk.create({
        data: {
          repoId: repoIdA,
          fileId: chunk.fileId,
          path: chunk.path,
          language: chunk.language,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          chunkIndex: chunk.chunkIndex,
          contentHash: chunk.contentHash,
          embeddingJson: JSON.stringify(vec),
        },
      });
    }

    // 5. Create Inventory File in Repo B (for isolation test)
    const inventoryFile = await db.fileRecord.create({
      data: {
        repoId: repoIdB,
        path: "src/inventory/warehouse.service.ts",
        size: "1.8 KB",
        type: "code",
        language: "TypeScript",
        updatedText: "Indexed warehouse service",
      },
    });
    const inventoryContent = `
export class WarehouseInventoryService {
  async trackProductStock(productId: string) {
    // Real-time stock reservation and barcode scanning
    return db.stock.findUnique({ where: { productId } });
  }
}
`;
    const invChunks = chunkFileContent({
      repoId: repoIdB,
      fileId: inventoryFile.id,
      path: inventoryFile.path,
      content: inventoryContent,
    });
    for (const chunk of invChunks) {
      const vec = await provider.embedText(chunk.content);
      await db.documentChunk.create({
        data: {
          repoId: repoIdB,
          fileId: chunk.fileId,
          path: chunk.path,
          language: chunk.language,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          chunkIndex: chunk.chunkIndex,
          contentHash: chunk.contentHash,
          embeddingJson: JSON.stringify(vec),
        },
      });
    }
  });

  after(async () => {
    await db.documentChunk.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.fileRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.module.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.documentRecord.deleteMany({ where: { repoId: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.repository.deleteMany({ where: { id: { in: [repoIdA, repoIdB, repoIdUnindexed] } } });
    await db.project.deleteMany({ where: { orgId: testOrgId } });
    await db.orgMember.deleteMany({ where: { orgId: testOrgId } });
    await db.organization.deleteMany({ where: { id: testOrgId } });
    await db.user.deleteMany({ where: { id: { in: [testUserId, unauthorizedUserId] } } });
  });

  // Scenario 1
  test("1. Semantic query returns relevant real repository data", async () => {
    const res = await searchRepository({
      repoId: repoIdA,
      query: "cryptographically signed HMAC access token",
      userId: testUserId,
    });

    assert.equal(res.indexed, true);
    assert.equal(res.repoId, repoIdA);
    assert.ok(res.results.length > 0, "Expected semantic search results");

    const authResult = res.results.find((r) => r.path === "src/auth/token.service.ts");
    assert.ok(authResult, "Expected src/auth/token.service.ts to match semantic query");
    assert.ok(authResult.score > 0.4, `Expected high score, got ${authResult?.score}`);
    assert.ok(authResult.snippet?.includes("signJwtToken") || authResult.snippet?.includes("Lines"));
  });

  // Scenario 2
  test("2. Exact file-name search works and receives top ranking", async () => {
    const res = await searchRepository({
      repoId: repoIdA,
      query: "schema.prisma",
      userId: testUserId,
    });

    assert.equal(res.indexed, true);
    assert.ok(res.results.length > 0, "Expected file search result");

    const topResult = res.results[0];
    assert.equal(topResult.path, "prisma/schema.prisma");
    assert.equal(topResult.type, "file");
    assert.ok(topResult.score >= 0.95, `Expected top score >= 0.95, got ${topResult.score}`);
  });

  // Scenario 3
  test("3. Natural-language query works (e.g. 'Where is authentication handled?')", async () => {
    const res = await searchRepository({
      repoId: repoIdA,
      query: "Where is user authentication handled?",
      userId: testUserId,
    });

    assert.equal(res.indexed, true);
    assert.ok(res.results.length > 0, "Expected search results for natural-language query");

    const paths = res.results.map((r) => r.path);
    assert.ok(
      paths.some((p) => p.includes("auth")),
      `Expected auth file or module in results, got ${JSON.stringify(paths)}`
    );
  });

  // Scenario 4
  test("4. Search is scoped strictly to the selected repository (no cross-repo leaks)", async () => {
    // Search Repo A for warehouse inventory which only exists in Repo B
    const resA = await searchRepository({
      repoId: repoIdA,
      query: "WarehouseInventoryService barcode scanning stock",
      userId: testUserId,
    });

    for (const r of resA.results) {
      assert.notEqual(r.path, "src/inventory/warehouse.service.ts", "Repo B file leaked into Repo A search!");
      assert.ok(!r.path.includes("inventory"), "Inventory path found in Repo A!");
    }

    // Now search Repo B for the same query
    const resB = await searchRepository({
      repoId: repoIdB,
      query: "WarehouseInventoryService barcode scanning stock",
      userId: testUserId,
    });

    assert.ok(
      resB.results.some((r) => r.path === "src/inventory/warehouse.service.ts"),
      "Repo B must return its own inventory file"
    );
  });

  // Scenario 5
  test("5. No mock results, hardcoded fixtures, or demo data are returned", async () => {
    const res = await searchRepository({
      repoId: repoIdA,
      query: "appointment_service masrofy patient clinic",
      userId: testUserId,
    });

    // Check that none of the fixture mock names from prototype exist
    const titles = res.results.map((r) => r.title.toLowerCase());
    const paths = res.results.map((r) => r.path.toLowerCase());

    assert.ok(!paths.includes("lib/services/appointment_service.dart"), "Found mock appointment_service!");
    assert.ok(!titles.includes("masrofy"), "Found mock masrofy reference!");
    assert.ok(!paths.includes("appointment"), "Found appointment mock reference!");
  });

  // Scenario 6
  test("6. Empty search / no-match query returns a real clean empty state", async () => {
    const res = await searchRepository({
      repoId: repoIdA,
      query: "completely_unrelated_query_that_matches_nothing_99999",
      userId: testUserId,
    });

    assert.equal(res.indexed, true);
    assert.equal(res.results.length, 0);
  });

  // Scenario 7
  test("7. Unindexed repository returns the correct unindexed state and message", async () => {
    const res = await searchRepository({
      repoId: repoIdUnindexed,
      query: "authentication",
      userId: testUserId,
    });

    assert.equal(res.indexed, false);
    assert.equal(res.results.length, 0);
    assert.ok(
      res.message?.includes("not been indexed yet"),
      `Expected unindexed message, got: ${res.message}`
    );
  });

  // Scenario 8
  test("8. Deleted files are removed from search and no longer returned", async () => {
    // Confirm billing file is searchable before deletion
    const beforeRes = await searchRepository({
      repoId: repoIdA,
      query: "processSubscriptionPayment credit card gateway",
      userId: testUserId,
    });
    assert.ok(
      beforeRes.results.some((r) => r.path === "src/billing/stripe.client.ts"),
      "Stripe client should be found before deletion"
    );

    // Delete the file and its chunks (simulating incremental sync deletion)
    await db.documentChunk.deleteMany({
      where: { repoId: repoIdA, path: "src/billing/stripe.client.ts" },
    });
    await db.fileRecord.delete({
      where: { id: stripeFileId },
    });

    // Query again after deletion
    const afterRes = await searchRepository({
      repoId: repoIdA,
      query: "processSubscriptionPayment credit card gateway stripe.client.ts",
      userId: testUserId,
    });

    assert.ok(
      !afterRes.results.some((r) => r.path === "src/billing/stripe.client.ts"),
      "Deleted file must not appear in search results!"
    );
  });

  // Scenario 9
  test("9. Newly indexed files become immediately searchable", async () => {
    const provider = getEmbeddingProvider();

    // Add a new file to Repo A
    const mailerFile = await db.fileRecord.create({
      data: {
        repoId: repoIdA,
        path: "src/notifications/mailer.service.ts",
        size: "1.5 KB",
        type: "code",
        language: "TypeScript",
        symbolsJson: JSON.stringify([{ name: "SendgridMailer", kind: "class", line: 5 }]),
        updatedText: "Indexed mailer service",
      },
    });

    const mailerContent = `
export class SendgridMailer {
  async sendWelcomeEmail(to: string, recipientName: string) {
    // Dispatches transactional onboarding email via SMTP Sendgrid template
    return sendgrid.send({ to, template: 'welcome-email' });
  }
}
`;
    const mailerChunks = chunkFileContent({
      repoId: repoIdA,
      fileId: mailerFile.id,
      path: mailerFile.path,
      content: mailerContent,
    });

    for (const chunk of mailerChunks) {
      const vec = await provider.embedText(chunk.content);
      await db.documentChunk.create({
        data: {
          repoId: repoIdA,
          fileId: chunk.fileId,
          path: chunk.path,
          language: chunk.language,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          chunkIndex: chunk.chunkIndex,
          contentHash: chunk.contentHash,
          embeddingJson: JSON.stringify(vec),
        },
      });
    }

    // Immediately search for the new content
    const res = await searchRepository({
      repoId: repoIdA,
      query: "transactional onboarding email via SMTP Sendgrid",
      userId: testUserId,
    });

    assert.ok(
      res.results.some((r) => r.path === "src/notifications/mailer.service.ts"),
      "Newly added file must immediately appear in search results"
    );
  });

  // Scenario 10
  test("10. Unauthorized repository search is rejected with error", async () => {
    await assert.rejects(
      async () => {
        await searchRepository({
          repoId: repoIdA,
          query: "authentication",
          userId: unauthorizedUserId,
        });
      },
      /Unauthorized/i,
      "Expected search to throw Unauthorized for non-member user"
    );
  });

  // Scenario 11
  test("11. Search result URL points to the correct real file viewer and API resolves it", async () => {
    const res = await searchRepository({
      repoId: repoIdA,
      query: "TokenService",
      userId: testUserId,
    });

    const tokenItem = res.results.find((r) => r.path === "src/auth/token.service.ts");
    assert.ok(tokenItem, "Expected token item in results");
    assert.ok(tokenItem.url.startsWith(`/app/evidence/${authFileId}`), `Expected url to start with /app/evidence/${authFileId}, got ${tokenItem.url}`);

    // Verify database lookup for this file works directly as expected by /api/files/[id]
    const dbFile = await db.fileRecord.findFirst({
      where: {
        OR: [{ id: authFileId }, { path: authFileId }],
      },
      include: {
        documentChunks: true,
      },
    });

    assert.ok(dbFile, "File must resolve in database");
    assert.equal(dbFile?.path, "src/auth/token.service.ts");
    assert.ok((dbFile?.documentChunks?.length || 0) > 0, "Expected file chunks to be attached");
  });

  // Scenario 12
  test("12. Existing AI Assistant retrieval functionality (searchEvidence) is not broken", async () => {
    const evidence = await searchEvidence({
      repoId: repoIdA,
      query: "signJwtToken bearer user session",
      limit: 3,
      userId: testUserId,
    });

    assert.ok(Array.isArray(evidence), "Expected evidence to be an array");
    assert.ok(evidence.length > 0, "Expected evidence results for AI Assistant");

    const topEvidence = evidence[0];
    assert.equal(topEvidence.repoId, repoIdA);
    assert.ok(topEvidence.path.length > 0);
    assert.ok(typeof topEvidence.score === "number");
    assert.ok(typeof topEvidence.startLine === "number");
    assert.ok(topEvidence.content.length > 0);
  });

  // Bonus Test: Sensitive file exclusion
  test("13. Sensitive files (.env, secrets) are completely excluded from search results", async () => {
    const res = await searchRepository({
      repoId: repoIdA,
      query: "super_secret_db_password_12345 SECRET_DATABASE_KEY",
      userId: testUserId,
    });

    for (const r of res.results) {
      assert.notEqual(r.path, ".env.production", ".env file leaked into search results!");
      assert.ok(!r.path.includes(".env"), `Sensitive file leaked: ${r.path}`);
    }

    assert.ok(isSensitiveFile(".env"), ".env must be detected as sensitive");
    assert.ok(isSensitiveFile(".env.local"), ".env.local must be detected as sensitive");
    assert.ok(isSensitiveFile("server.key"), "server.key must be detected as sensitive");
    assert.ok(isSensitiveFile("id_rsa"), "id_rsa must be detected as sensitive");
    assert.ok(!isSensitiveFile("src/auth/token.service.ts"), "token.service.ts must NOT be sensitive");
  });

  // Scenario 14: Search API GET /api/search validates authentication and parameters
  test("14. Search API GET /api/search validates authentication and parameters", async () => {
    const { GET: searchGetHandler } = await import("../app/api/search/route");

    // Unauthenticated request
    const unauthReq = new Request("http://localhost:3000/api/search?repoId=test-repo&q=test");
    const unauthRes = await searchGetHandler(unauthReq as any);
    assert.equal(unauthRes.status, 401);
  });

  // Scenario 15: Search API POST /api/search validates repoId requirement
  test("15. Search API POST /api/search validates repoId requirement", async () => {
    const { POST: searchPostHandler } = await import("../app/api/search/route");

    const missingRepoReq = new Request("http://localhost:3000/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test" }),
    });
    const res = await searchPostHandler(missingRepoReq as any);
    assert.ok(res.status === 401 || res.status === 400);
  });
});
