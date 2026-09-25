import assert from "node:assert";
import { describe, test } from "node:test";
import Module from "node:module";

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

describe("Restored Authentication & Session Flow Tests", () => {
  let authModule: typeof import("../lib/server/auth");
  let githubModule: typeof import("../lib/server/github");

  test("loads auth and github modules successfully with server mocks", async () => {
    authModule = await import("../lib/server/auth");
    githubModule = await import("../lib/server/github");
    assert.ok(authModule);
    assert.ok(githubModule);
  });

  describe("1. Password Hashing & Comparison", () => {
    test("hashes password and verifies successfully", async () => {
      const password = "mySecurePassword123";
      const hash = await authModule.hashPassword(password);
      assert.notStrictEqual(hash, password);

      const isValid = await authModule.comparePassword(password, hash);
      assert.strictEqual(isValid, true);

      const isInvalid = await authModule.comparePassword("wrongPassword", hash);
      assert.strictEqual(isInvalid, false);
    });
  });

  describe("2. JWT Session Token & Onboarding State", () => {
    test("creates and verifies session token with onboardingCompleted flag", async () => {
      const payloadNewUser = {
        userId: "test-user-id-new",
        email: "newuser@example.com",
        name: "New Engineer",
        tokenVersion: 1,
        onboardingCompleted: false,
      };

      const tokenNew = await authModule.createSessionToken(payloadNewUser);
      assert.ok(typeof tokenNew === "string" && tokenNew.length > 20);

      const verifiedNew = await authModule.verifySessionToken(tokenNew);
      assert.ok(verifiedNew);
      assert.strictEqual(verifiedNew?.userId, "test-user-id-new");
      assert.strictEqual(verifiedNew?.email, "newuser@example.com");
      assert.strictEqual(verifiedNew?.onboardingCompleted, false);

      const payloadCompletedUser = {
        userId: "test-user-id-existing",
        email: "existing@example.com",
        name: "Existing Engineer",
        tokenVersion: 2,
        onboardingCompleted: true,
      };

      const tokenCompleted = await authModule.createSessionToken(payloadCompletedUser);
      const verifiedCompleted = await authModule.verifySessionToken(tokenCompleted);
      assert.ok(verifiedCompleted);
      assert.strictEqual(verifiedCompleted?.userId, "test-user-id-existing");
      assert.strictEqual(verifiedCompleted?.onboardingCompleted, true);
    });

    test("returns null for malformed or invalid session token", async () => {
      const invalid = await authModule.verifySessionToken("not-a-valid-jwt-token");
      assert.strictEqual(invalid, null);
    });
  });

  describe("3. GitHub Token Encryption & Decryption", () => {
    test("encrypts and decrypts GitHub personal access tokens using AES-256-GCM", () => {
      const rawToken = "gho_1234567890abcdefghijklmnopqrstuvwxyz";
      const encrypted = githubModule.encryptToken(rawToken);

      assert.ok(encrypted.startsWith("v1:"));
      assert.notStrictEqual(encrypted, rawToken);

      const decrypted = githubModule.decryptToken(encrypted);
      assert.ok(decrypted);
      assert.strictEqual(decrypted?.decrypted, rawToken);
      assert.strictEqual(decrypted?.isLegacy, false);
    });
  });

  describe("4. GitHub OAuth URL Generation", () => {
    test("generates unauthenticated signin URL with correct scope and state", async () => {
      const authUrl = await githubModule.generateGitHubAuthUrl({
        intent: "signin",
        returnTo: "/app/overview",
      });

      assert.ok(authUrl.startsWith("https://github.com/login/oauth/authorize?"));
      const url = new URL(authUrl);
      assert.strictEqual(url.searchParams.get("client_id"), process.env.GITHUB_CLIENT_ID?.trim());
      assert.strictEqual(url.searchParams.get("scope"), "read:user user:email");
      assert.ok(url.searchParams.get("state"));

      // Verify that state cookie was stored
      const storedState = cookieStore.get("github_oauth_state");
      assert.ok(storedState);
      const parsedState = JSON.parse(storedState.value);
      assert.strictEqual(parsedState.intent, "signin");
      assert.strictEqual(parsedState.returnTo, "/app/overview");
    });
  });
});
