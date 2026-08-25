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

  const clientId = process.env.GITHUB_CLIENT_ID || "mock_github_client_id";
  const redirectUri = process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/api/github/callback";
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
    return { success: false, error: "Invalid CSRF state token" };
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId === "mock_github_client_id") {
    const mockGithubUser = {
      githubUserId: "12345678",
      login: "anjali",
      name: "Anjali Rao",
      avatarUrl: "https://avatars.githubusercontent.com/u/12345678",
      email: "anjali@medialab.dev",
      accessToken: "mock_github_access_token_sec_12345",
    };

    await db.gitHubAccount.upsert({
      where: { userId: user.id },
      update: {
        login: mockGithubUser.login,
        name: mockGithubUser.name,
        avatarUrl: mockGithubUser.avatarUrl,
        email: mockGithubUser.email,
        accessToken: mockGithubUser.accessToken,
      },
      create: {
        userId: user.id,
        githubUserId: mockGithubUser.githubUserId,
        login: mockGithubUser.login,
        name: mockGithubUser.name,
        avatarUrl: mockGithubUser.avatarUrl,
        email: mockGithubUser.email,
        accessToken: mockGithubUser.accessToken,
      },
    });

    return { success: true, login: mockGithubUser.login };
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
        error: tokenData.error_description || "Failed to exchange GitHub authorization code",
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
      return { success: false, error: "Failed to fetch GitHub profile" };
    }

    const profile: GitHubProfile = await profileRes.json();
    const githubUserId = String(profile.id);

    const existingAccount = await db.gitHubAccount.findUnique({
      where: { githubUserId },
    });

    if (existingAccount && existingAccount.userId !== user.id) {
      return {
        success: false,
        error: `GitHub account @${profile.login} is already linked to another DevMind account`,
      };
    }

    await db.gitHubAccount.upsert({
      where: { userId: user.id },
      update: {
        githubUserId,
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatar_url,
        email: profile.email,
        accessToken,
      },
      create: {
        userId: user.id,
        githubUserId,
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatar_url,
        email: profile.email,
        accessToken,
      },
    });

    return { success: true, login: profile.login };
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return { success: false, error: "OAuth token exchange failed" };
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
    await db.gitHubAccount.delete({
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

  // Fallback for mock token
  if (account.accessToken.startsWith("mock_")) {
    return [
      {
        id: 101,
        name: "clinic-management",
        full_name: "medialab/clinic-management",
        owner: { login: "medialab", avatar_url: "" },
        private: true,
        html_url: "https://github.com/medialab/clinic-management",
        description: "Clinic management platform",
        language: "Dart",
        default_branch: "main",
        updated_at: "2 hours ago",
        size: 14200,
      },
      {
        id: 102,
        name: "patient-portal",
        full_name: "medialab/patient-portal",
        owner: { login: "medialab", avatar_url: "" },
        private: true,
        html_url: "https://github.com/medialab/patient-portal",
        description: "Patient web portal and booking system",
        language: "TypeScript",
        default_branch: "main",
        updated_at: "Yesterday",
        size: 8400,
      },
    ];
  }

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

  if (!account || !account.accessToken || account.accessToken.startsWith("mock_")) {
    return [
      { name: "main", isDefault: true },
      { name: "feat/appointment-reschedule", isDefault: false },
      { name: "feat/telehealth-integration", isDefault: false },
    ];
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

  if (!account || !account.accessToken || account.accessToken.startsWith("mock_")) {
    // Return sample tree for clinic-management mock ingestion
    return [
      { path: "pubspec.yaml", mode: "100644", type: "blob", sha: "s1", size: 420 },
      { path: "lib/main.dart", mode: "100644", type: "blob", sha: "s2", size: 1240 },
      { path: "lib/features/auth/auth_service.dart", mode: "100644", type: "blob", sha: "s3", size: 2100 },
      { path: "lib/features/appointments/appointment_controller.dart", mode: "100644", type: "blob", sha: "s4", size: 3400 },
      { path: "lib/features/patients/patient_model.dart", mode: "100644", type: "blob", sha: "s5", size: 1800 },
    ];
  }

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

  if (!account || !account.accessToken || account.accessToken.startsWith("mock_")) {
    if (path === "pubspec.yaml") {
      return 'name: clinic_management\ndescription: Clinic system\ndependencies:\n  flutter: sdk\n  http: ^1.2.0\n  provider: ^6.1.0\n';
    }
    return `// Content for ${path} in ${owner}/${repo}\nimport 'package:flutter/material.dart';\n\nclass ${path.split("/").pop()?.replace(/\.\w+$/, "")} {\n  void init() { print("Initialized ${path}"); }\n}\n`;
  }

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
