import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "./db";
import { getCurrentUser, setSessionCookie } from "./auth";
import type { GitHubTreeItem } from "./ingestion/tree";

const CSRF_COOKIE_NAME = "github_oauth_state";

export interface GitHubProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

export interface GitHubEmailItem {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: string | null;
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  updated_at: string;
  size: number;
}

function getGitHubRedirectUri(): string {
  return (
    process.env.GITHUB_REDIRECT_URI ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/github/callback`
      : "http://localhost:3000/api/github/callback")
  ).trim();
}

export function getGitHubTokenEncryptionKey(): Buffer {
  const rawKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY?.trim();

  if (!rawKey) {
    // Fallback key if not provided in environment for dev safety
    return crypto.createHash("sha256").update("devmind_default_github_token_encryption_key_32bytes").digest();
  }

  let keyBuffer: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    keyBuffer = Buffer.from(rawKey, "hex");
  } else if (/^[A-Za-z0-9+/=]{44}$/.test(rawKey)) {
    keyBuffer = Buffer.from(rawKey, "base64");
  } else {
    keyBuffer = crypto.createHash("sha256").update(rawKey).digest();
  }

  return keyBuffer;
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) return "";
  try {
    const key = getGitHubTokenEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `v1:${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error("[SECURITY LOG] Token encryption failed:", error instanceof Error ? error.message : "Encryption error");
    throw error;
  }
}

export function decryptToken(ciphertext: string): { decrypted: string; isLegacy: boolean } | null {
  if (!ciphertext) return null;

  if (ciphertext.startsWith("v1:")) {
    try {
      const parts = ciphertext.split(":");
      if (parts.length !== 4) {
        console.error("[SECURITY LOG] Malformed encrypted token: Invalid format length");
        return null;
      }

      const [, ivHex, authTagHex, encryptedHex] = parts;
      if (ivHex.length !== 24 || authTagHex.length !== 32 || !encryptedHex) {
        console.error("[SECURITY LOG] Malformed encrypted token: Invalid IV or AuthTag length");
        return null;
      }

      const key = getGitHubTokenEncryptionKey();
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return { decrypted, isLegacy: false };
    } catch (error) {
      console.error("[SECURITY LOG] Token decryption failed:", error instanceof Error ? error.message : "Error");
      return null;
    }
  }

  return { decrypted: ciphertext, isLegacy: true };
}

export async function getUserAccessToken(userId: string): Promise<string | null> {
  const account = await db.gitHubAccount.findUnique({
    where: { userId },
    select: { accessToken: true },
  });

  if (!account || !account.accessToken) return null;

  const result = decryptToken(account.accessToken);
  if (!result || !result.decrypted) return null;

  if (result.isLegacy) {
    try {
      const encryptedAccessToken = encryptToken(result.decrypted);
      await db.gitHubAccount.update({
        where: { userId },
        data: { accessToken: encryptedAccessToken },
      });
    } catch (err) {
      console.error("Failed to perform lazy token migration:", err);
    }
  }

  return result.decrypted;
}

export async function fetchGitHubUserEmails(accessToken: string): Promise<GitHubEmailItem[]> {
  try {
    const res = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "DevMind-App",
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function generateGitHubAuthUrl(options?: {
  intent?: "signin" | "connect";
  returnTo?: string;
}): Promise<string> {
  const intent = options?.intent ?? "connect";
  if (intent === "connect") {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Unauthenticated: User must be signed in to connect GitHub");
    }
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const redirectUri = getGitHubRedirectUri();

  if (!clientId || !clientSecret || clientId === "mock_github_client_id" || clientSecret === "mock_github_client_secret") {
    throw new Error("GitHub OAuth is not configured. Please set real GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your .env file.");
  }

  const nonce = crypto.randomBytes(32).toString("hex");
  const statePayload = JSON.stringify({
    nonce,
    intent,
    returnTo: options?.returnTo || (intent === "signin" ? "/app/overview" : "/connect"),
  });

  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, statePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });

  const scope = intent === "signin" ? "read:user user:email" : "read:user user:email repo";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state: nonce,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function handleGitHubCallback(
  code: string,
  state: string,
  overrideState?: string
): Promise<{
  success: boolean;
  intent?: "signin" | "connect";
  returnTo?: string;
  login?: string;
  name?: string | null;
  avatarUrl?: string | null;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    onboardingCompleted: boolean;
  };
}> {
  let rawSavedState = overrideState;
  if (!rawSavedState) {
    try {
      const cookieStore = await cookies();
      rawSavedState = cookieStore.get(CSRF_COOKIE_NAME)?.value;
      cookieStore.delete(CSRF_COOKIE_NAME);
    } catch {
      rawSavedState = undefined;
    }
  }

  if (!rawSavedState) {
    return { success: false, error: "Invalid CSRF state token. Connection request expired or was modified." };
  }

  let expectedNonce = rawSavedState;
  let stateIntent: "signin" | "connect" = "connect";
  let returnTo = "/app/overview";

  try {
    const parsed = JSON.parse(rawSavedState);
    if (parsed && typeof parsed === "object" && typeof parsed.nonce === "string") {
      expectedNonce = parsed.nonce;
      if (parsed.intent === "signin" || parsed.intent === "connect") {
        stateIntent = parsed.intent;
      }
      if (typeof parsed.returnTo === "string" && parsed.returnTo.startsWith("/")) {
        returnTo = parsed.returnTo;
      }
    }
  } catch {
    expectedNonce = rawSavedState;
  }

  if (!state || !expectedNonce || state.length !== expectedNonce.length) {
    return { success: false, intent: stateIntent, error: "Invalid CSRF state token. Connection request expired or was modified." };
  }

  const isMatch = crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedNonce));
  if (!isMatch) {
    return { success: false, intent: stateIntent, error: "Invalid CSRF state token. Connection request expired or was modified." };
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const redirectUri = getGitHubRedirectUri();

  if (!clientId || !clientSecret || clientId === "mock_github_client_id" || clientSecret === "mock_github_client_secret") {
    return { success: false, intent: stateIntent, error: "GitHub OAuth app credentials are not configured in .env." };
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return {
        success: false,
        intent: stateIntent,
        error: `GitHub OAuth server error (${tokenRes.status}). Failed to exchange authorization code.`,
      };
    }

    const tokenData = await tokenRes.json().catch(() => null);
    if (!tokenData || tokenData.error || typeof tokenData.access_token !== "string" || !tokenData.access_token.trim()) {
      return {
        success: false,
        intent: stateIntent,
        error: tokenData?.error_description || "Failed to exchange GitHub authorization code.",
      };
    }

    const accessToken = tokenData.access_token.trim();

    const profileRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "DevMind-App",
      },
    });

    if (!profileRes.ok) {
      return {
        success: false,
        intent: stateIntent,
        error: `GitHub API error (${profileRes.status}): Unable to fetch authenticated user profile.`,
      };
    }

    const profile: GitHubProfile = await profileRes.json().catch(() => null);
    if (!profile || typeof profile.id !== "number" || !profile.login) {
      return {
        success: false,
        intent: stateIntent,
        error: "Invalid GitHub user profile payload returned from API.",
      };
    }

    const githubUserId = String(profile.id);

    // Fetch verified emails
    const emails = await fetchGitHubUserEmails(accessToken);
    let verifiedEmail: string | null = null;
    if (emails.length > 0) {
      const primaryVerified = emails.find((e) => e.primary && e.verified);
      if (primaryVerified) {
        verifiedEmail = primaryVerified.email.toLowerCase().trim();
      } else {
        const anyVerified = emails.find((e) => e.verified);
        if (anyVerified) {
          verifiedEmail = anyVerified.email.toLowerCase().trim();
        }
      }
    } else if (profile.email) {
      verifiedEmail = profile.email.toLowerCase().trim();
    }

    // -------------------------------------------------------------
    // FLOW 1: INTENT === "signin" (Unauthenticated Sign-in / Sign-up)
    // -------------------------------------------------------------
    if (stateIntent === "signin") {
      const encryptedAccessToken = encryptToken(accessToken);

      // 1. Check if GitHub account is already registered by githubUserId
      const existingGitHubAccount = await db.gitHubAccount.findUnique({
        where: { githubUserId },
        include: { user: true },
      });

      if (existingGitHubAccount) {
        await db.gitHubAccount.update({
          where: { id: existingGitHubAccount.id },
          data: {
            login: profile.login,
            name: profile.name || profile.login,
            avatarUrl: profile.avatar_url,
            email: verifiedEmail || profile.email || existingGitHubAccount.email,
            accessToken: encryptedAccessToken,
            status: "ACTIVE",
          },
        });

        if (typeof setSessionCookie === "function") {
          await setSessionCookie({
            userId: existingGitHubAccount.user.id,
            email: existingGitHubAccount.user.email,
            name: existingGitHubAccount.user.name,
            tokenVersion: existingGitHubAccount.user.tokenVersion,
            onboardingCompleted: existingGitHubAccount.user.onboardingCompleted,
          });
        }

        return {
          success: true,
          intent: "signin",
          returnTo,
          login: profile.login,
          name: profile.name,
          avatarUrl: profile.avatar_url,
          user: {
            id: existingGitHubAccount.user.id,
            email: existingGitHubAccount.user.email,
            name: existingGitHubAccount.user.name,
            onboardingCompleted: existingGitHubAccount.user.onboardingCompleted,
          },
        };
      }

      // 2. Link by verified email if DevMind user exists
      if (verifiedEmail) {
        const existingUser = await db.user.findUnique({
          where: { email: verifiedEmail },
          include: { githubAccount: true },
        });

        if (existingUser) {
          if (existingUser.githubAccount && existingUser.githubAccount.githubUserId !== githubUserId) {
            return {
              success: false,
              intent: "signin",
              error: "A different GitHub account is already linked to this DevMind user.",
            };
          }

          await db.gitHubAccount.upsert({
            where: { userId: existingUser.id },
            update: {
              githubUserId,
              login: profile.login,
              name: profile.name || profile.login,
              avatarUrl: profile.avatar_url,
              email: verifiedEmail,
              accessToken: encryptedAccessToken,
              status: "ACTIVE",
            },
            create: {
              userId: existingUser.id,
              githubUserId,
              login: profile.login,
              name: profile.name || profile.login,
              avatarUrl: profile.avatar_url,
              email: verifiedEmail,
              accessToken: encryptedAccessToken,
              status: "ACTIVE",
            },
          });

          if (typeof setSessionCookie === "function") {
            await setSessionCookie({
              userId: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              tokenVersion: existingUser.tokenVersion,
              onboardingCompleted: existingUser.onboardingCompleted,
            });
          }

          return {
            success: true,
            intent: "signin",
            returnTo,
            login: profile.login,
            name: profile.name,
            avatarUrl: profile.avatar_url,
            user: {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              onboardingCompleted: existingUser.onboardingCompleted,
            },
          };
        }
      }

      // 3. New user provisioning (strictly requires verified email)
      if (!verifiedEmail) {
        return {
          success: false,
          intent: "signin",
          error: "Your GitHub account does not have a verified email address. Please verify your email on GitHub and try again.",
        };
      }

      const displayName = (profile.name || profile.login).trim();
      const orgName = `${displayName.split(" ")[0]}'s Workspace`;
      const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);

      const { newUser } = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: verifiedEmail!,
            name: displayName,
            avatarUrl: profile.avatar_url || null,
            role: "Developer",
            color: "#C8D62B",
            onboardingCompleted: false,
          },
        });

        const org = await tx.organization.create({
          data: {
            name: orgName,
            slug: orgSlug,
          },
        });

        await tx.orgMember.create({
          data: {
            orgId: org.id,
            userId: user.id,
            role: "OWNER",
          },
        });

        await tx.gitHubAccount.create({
          data: {
            userId: user.id,
            githubUserId,
            login: profile.login,
            name: displayName,
            avatarUrl: profile.avatar_url,
            email: verifiedEmail,
            accessToken: encryptedAccessToken,
            status: "ACTIVE",
          },
        });

        return { newUser: user };
      });

      if (typeof setSessionCookie === "function") {
        await setSessionCookie({
          userId: newUser.id,
          email: newUser.email,
          name: newUser.name,
          tokenVersion: newUser.tokenVersion,
          onboardingCompleted: false,
        });
      }

      return {
        success: true,
        intent: "signin",
        returnTo,
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatar_url,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          onboardingCompleted: false,
        },
      };
    }

    // -------------------------------------------------------------
    // FLOW 2: INTENT === "connect" (Existing Authenticated User Linking)
    // -------------------------------------------------------------
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, intent: "connect", error: "Unauthenticated user" };
    }

    const existingAccount = await db.gitHubAccount.findUnique({
      where: { githubUserId },
    });

    if (existingAccount && existingAccount.userId !== user.id) {
      return {
        success: false,
        intent: "connect",
        error: `GitHub account @${profile.login} is already linked to another DevMind account.`,
      };
    }

    const encryptedAccessToken = encryptToken(accessToken);

    await db.gitHubAccount.upsert({
      where: { userId: user.id },
      update: {
        githubUserId,
        login: profile.login,
        name: profile.name || profile.login,
        avatarUrl: profile.avatar_url,
        email: verifiedEmail || profile.email,
        accessToken: encryptedAccessToken,
        status: "ACTIVE",
      },
      create: {
        userId: user.id,
        githubUserId,
        login: profile.login,
        name: profile.name || profile.login,
        avatarUrl: profile.avatar_url,
        email: verifiedEmail || profile.email,
        accessToken: encryptedAccessToken,
        status: "ACTIVE",
      },
    });

    return {
      success: true,
      intent: "connect",
      returnTo: "/connect?status=connected",
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatar_url,
    };
  } catch (error) {
    console.error("GitHub OAuth callback error during code exchange:", error);
    return { success: false, intent: stateIntent, error: "OAuth handshake with GitHub failed." };
  }
}

export async function getGitHubStatus(): Promise<{
  connected: boolean;
  login?: string;
  name?: string | null;
  avatarUrl?: string | null;
  updatedAt?: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { connected: false };
  }

  try {
    const account = await db.gitHubAccount.findUnique({
      where: { userId: user.id },
      select: {
        login: true,
        name: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    if (!account) {
      return { connected: false };
    }

    return {
      connected: true,
      login: account.login,
      name: account.name,
      avatarUrl: account.avatarUrl,
      updatedAt: account.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error("Failed to fetch GitHub connection status:", error);
    return { connected: false };
  }
}

export async function disconnectGitHub() {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthenticated" };
  }

  try {
    await db.gitHubAccount.deleteMany({
      where: { userId: user.id },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to disconnect GitHub account:", error);
    return { success: false, error: "Failed to disconnect GitHub account" };
  }
}

export async function fetchUserGitHubRepos(): Promise<GitHubRepoItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const accessToken = await getUserAccessToken(user.id);
  if (!accessToken) return [];

  try {
    const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "DevMind-App",
      },
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch GitHub user repos:", error);
    return [];
  }
}

export async function fetchRepoBranches(owner: string, repo: string): Promise<Array<{ name: string; isDefault: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return [{ name: "main", isDefault: true }];

  const accessToken = await getUserAccessToken(user.id);
  if (!accessToken) {
    return [{ name: "main", isDefault: true }];
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "DevMind-App",
      },
    });

    if (!res.ok) return [{ name: "main", isDefault: true }];
    const branches = await res.json();
    return branches.map((b: { name: string }) => ({
      name: b.name,
      isDefault: b.name === "main" || b.name === "master",
    }));
  } catch {
    return [{ name: "main", isDefault: true }];
  }
}

export async function getRepoGitHubAccessToken(repoId: string): Promise<string | null> {
  try {
    const repo = await db.repository.findUnique({
      where: { id: repoId },
      include: {
        project: {
          include: {
            org: {
              include: {
                members: {
                  include: {
                    user: {
                      include: {
                        githubAccount: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!repo) return null;

    if (repo.project?.org?.members) {
      const accounts: Array<{ accessToken: string; login: string }> = [];
      for (const member of repo.project.org.members) {
        if (member.user?.githubAccount?.accessToken) {
          accounts.push({
            accessToken: member.user.githubAccount.accessToken,
            login: member.user.githubAccount.login,
          });
        }
      }

      const matching = accounts.find((a) => a.login.toLowerCase() === repo.owner.toLowerCase());
      const chosen = matching || accounts[0];

      if (chosen) {
        const dec = decryptToken(chosen.accessToken);
        if (dec?.decrypted) return dec.decrypted;
      }
    }

    const ownerAccount = await db.gitHubAccount.findFirst({
      where: { login: repo.owner },
    });
    if (ownerAccount?.accessToken) {
      const dec = decryptToken(ownerAccount.accessToken);
      if (dec?.decrypted) return dec.decrypted;
    }

    const anyAccount = await db.gitHubAccount.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    });
    if (anyAccount?.accessToken) {
      const dec = decryptToken(anyAccount.accessToken);
      if (dec?.decrypted) return dec.decrypted;
    }

    return null;
  } catch (err) {
    console.error(`Failed to get GitHub token for repository ${repoId}:`, err);
    return null;
  }
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch = "main",
  explicitToken?: string
): Promise<GitHubTreeItem[]> {
  let accessToken = explicitToken;
  if (!accessToken) {
    const user = await getCurrentUser();
    if (user) {
      accessToken = (await getUserAccessToken(user.id)) || undefined;
    }
  }

  const headers: Record<string, string> = {
    "User-Agent": "DevMind-App",
    Accept: "application/vnd.github.v3+json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
      headers,
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.tree || [];
  } catch (error) {
    console.error(`Failed to fetch repo tree for ${owner}/${repo}:`, error);
    return [];
  }
}

export async function fetchRawFileContent(
  owner: string,
  repo: string,
  path: string,
  branch = "main",
  explicitToken?: string
): Promise<string> {
  let accessToken = explicitToken;
  if (!accessToken) {
    const user = await getCurrentUser();
    if (user) {
      accessToken = (await getUserAccessToken(user.id)) || undefined;
    }
  }

  const headers: Record<string, string> = {
    "User-Agent": "DevMind-App",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`, {
      headers,
    });

    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

export interface GitHubCompareFileItem {
  sha: string;
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed";
  additions: number;
  deletions: number;
  changes: number;
  previous_filename?: string;
}

export interface GitHubCompareResult {
  status: string;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: Array<{
    sha: string;
    message: string;
    authorName: string;
    authorDate: string;
  }>;
  files: GitHubCompareFileItem[];
}

export async function compareRepoCommits(
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string,
  explicitToken?: string
): Promise<GitHubCompareResult | null> {
  let accessToken = explicitToken;
  if (!accessToken) {
    const user = await getCurrentUser();
    if (user) {
      accessToken = (await getUserAccessToken(user.id)) || undefined;
    }
  }

  const headers: Record<string, string> = {
    "User-Agent": "DevMind-App",
    Accept: "application/vnd.github.v3+json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(baseSha)}...${encodeURIComponent(headSha)}`,
      { headers }
    );

    if (!res.ok) {
      console.warn(`GitHub compare API returned HTTP ${res.status} for ${owner}/${repo} ${baseSha}...${headSha}`);
      return null;
    }

    const data = await res.json();
    return {
      status: data.status || "diverged",
      ahead_by: data.ahead_by ?? 0,
      behind_by: data.behind_by ?? 0,
      total_commits: data.total_commits ?? (data.commits?.length || 0),
      commits: Array.isArray(data.commits)
        ? data.commits.map((c: any) => ({
            sha: c.sha || "",
            message: c.commit?.message?.split("\n")[0] || "",
            authorName: c.commit?.author?.name || c.author?.login || "Contributor",
            authorDate: c.commit?.author?.date || new Date().toISOString(),
          }))
        : [],
      files: Array.isArray(data.files)
        ? data.files.map((f: any) => ({
            sha: f.sha || "",
            filename: f.filename || "",
            status: f.status || "modified",
            additions: f.additions || 0,
            deletions: f.deletions || 0,
            changes: f.changes || 0,
            previous_filename: f.previous_filename,
          }))
        : [],
    };
  } catch (error) {
    console.error(`Failed to compare commits for ${owner}/${repo}:`, error);
    return null;
  }
}


export interface GitHubCommitItem {
  sha: string;
  message: string;
  authorName: string;
  authorDate: string;
  authorLogin?: string;
  htmlUrl?: string;
}

export interface GitHubContributorItem {
  login: string;
  id: number;
  avatarUrl: string;
  contributions: number;
  htmlUrl?: string;
}

export async function fetchRepoCommits(
  owner: string,
  repo: string,
  branch = "main",
  limit = 20
): Promise<GitHubCommitItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const accessToken = await getUserAccessToken(user.id);
  if (!accessToken) return [];

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "DevMind-App",
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((c: any) => ({
      sha: c.sha || "",
      message: c.commit?.message?.split("\n")[0] || "Update repository",
      authorName: c.commit?.author?.name || c.author?.login || "Contributor",
      authorDate: c.commit?.author?.date || new Date().toISOString(),
      authorLogin: c.author?.login,
      htmlUrl: c.html_url,
    }));
  } catch (error) {
    console.error(`Failed to fetch repo commits for ${owner}/${repo}:`, error);
    return [];
  }
}

export async function fetchRepoContributors(
  owner: string,
  repo: string,
  limit = 20
): Promise<GitHubContributorItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const accessToken = await getUserAccessToken(user.id);
  if (!accessToken) return [];

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "DevMind-App",
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      login: item.login || `contributor-${item.id}`,
      id: item.id,
      avatarUrl: item.avatar_url || "",
      contributions: item.contributions || 1,
      htmlUrl: item.html_url,
    }));
  } catch (error) {
    console.error(`Failed to fetch repo contributors for ${owner}/${repo}:`, error);
    return [];
  }
}
