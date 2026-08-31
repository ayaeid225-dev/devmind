import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { getCurrentUser } from "./auth";
import type { GitHubTreeItem } from "./ingestion/tree";

const CSRF_COOKIE_NAME = "github_oauth_state";

export interface GitHubProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
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

export async function generateGitHubAuthUrl(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthenticated: User must be signed in to connect GitHub");
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const redirectUri = (process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/api/github/callback").trim();

  if (!clientId || !clientSecret || clientId === "mock_github_client_id" || clientSecret === "mock_github_client_secret") {
    throw new Error("GitHub OAuth is not configured. Please set real GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your .env file.");
  }

  const state = Math.random().toString(36).substring(2) + Date.now().toString(36);

  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email repo",
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function handleGitHubCallback(code: string, state: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthenticated user" };
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  cookieStore.delete(CSRF_COOKIE_NAME);

  if (!state || !savedState || state !== savedState) {
    return { success: false, error: "Invalid CSRF state token. Connection request expired or was modified." };
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret || clientId === "mock_github_client_id" || clientSecret === "mock_github_client_secret") {
    return { success: false, error: "GitHub OAuth app credentials are not configured in .env." };
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
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      return {
        success: false,
        error: tokenData.error_description || "Failed to exchange GitHub authorization code.",
      };
    }

    const accessToken = tokenData.access_token;

    const profileRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "DevMind-App",
      },
    });

    if (!profileRes.ok) {
      return { success: false, error: "Failed to fetch authenticated GitHub user profile." };
    }

    const profile: GitHubProfile = await profileRes.json();
    const githubUserId = String(profile.id);

    const existingAccount = await db.gitHubAccount.findUnique({
      where: { githubUserId },
    });

    if (existingAccount && existingAccount.userId !== user.id) {
      return {
        success: false,
        error: `GitHub account @${profile.login} is already linked to another DevMind account.`,
      };
    }

    await db.gitHubAccount.upsert({
      where: { userId: user.id },
      update: {
        githubUserId,
        login: profile.login,
        name: profile.name || profile.login,
        avatarUrl: profile.avatar_url,
        email: profile.email,
        accessToken,
      },
      create: {
        userId: user.id,
        githubUserId,
        login: profile.login,
        name: profile.name || profile.login,
        avatarUrl: profile.avatar_url,
        email: profile.email,
        accessToken,
      },
    });

    return {
      success: true,
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatar_url,
    };
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return { success: false, error: "OAuth handshake with GitHub failed." };
  }
}

export async function getGitHubStatus() {
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

  const account = await db.gitHubAccount.findUnique({
    where: { userId: user.id },
  });

  if (!account || !account.accessToken) return [];

  try {
    const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
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

  const account = await db.gitHubAccount.findUnique({
    where: { userId: user.id },
  });

  if (!account || !account.accessToken) {
    return [{ name: "main", isDefault: true }];
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
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

export async function fetchRepoTree(owner: string, repo: string, branch = "main"): Promise<GitHubTreeItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const account = await db.gitHubAccount.findUnique({
    where: { userId: user.id },
  });

  if (!account || !account.accessToken) return [];

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "User-Agent": "DevMind-App",
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.tree || [];
  } catch (error) {
    console.error(`Failed to fetch repo tree for ${owner}/${repo}:`, error);
    return [];
  }
}

export async function fetchRawFileContent(owner: string, repo: string, path: string, branch = "main"): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return "";

  const account = await db.gitHubAccount.findUnique({
    where: { userId: user.id },
  });

  if (!account || !account.accessToken) return "";

  try {
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "User-Agent": "DevMind-App",
      },
    });

    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}
