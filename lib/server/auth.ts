import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE_NAME = "devmind_session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "devmind_secret_jwt_token_key_change_in_production_32bytes"
);

export interface UserSessionPayload {
  userId: string;
  email: string;
  name: string;
  tokenVersion?: number;
  onboardingCompleted?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: UserSessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    tokenVersion: payload.tokenVersion ?? 0,
    onboardingCompleted: payload.onboardingCompleted ?? false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : 0,
      onboardingCompleted: Boolean(payload.onboardingCompleted),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: UserSessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionPayload(): Promise<UserSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSessionPayload();
  if (!session) return null;

  try {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        color: true,
        tokenVersion: true,
        onboardingCompleted: true,
        githubAccount: {
          select: {
            login: true,
            avatarUrl: true,
            name: true,
          },
        },
        memberships: {
          include: {
            org: true,
          },
        },
      },
    });

    if (!user) return null;

    const primaryOrg = user.memberships[0]?.org ?? null;
    const orgRole = user.memberships[0]?.role ?? "MEMBER";

    return {
      id: user.id,
      email: user.email,
      name: user.name || user.githubAccount?.name || user.githubAccount?.login || "Engineer",
      avatarUrl: user.avatarUrl || user.githubAccount?.avatarUrl || null,
      role: user.role,
      color: user.color,
      onboardingCompleted: user.onboardingCompleted,
      githubUsername: user.githubAccount?.login ?? null,
      initials: (() => {
        const displayName = user.name || user.githubAccount?.name || user.githubAccount?.login || "EN";
        const parts = displayName.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return "";
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      })(),
      organization: primaryOrg
        ? {
            id: primaryOrg.id,
            name: primaryOrg.name,
            slug: primaryOrg.slug,
            role: orgRole,
          }
        : null,
    };
  } catch (error) {
    console.error("Failed to fetch current authenticated user:", error);
    return null;
  }
}

export async function assertUserRepoAccess(userId: string, repoId: string) {
  return await db.repository.findFirst({
    where: {
      id: repoId,
      project: {
        org: {
          members: {
            some: { userId },
          },
        },
      },
    },
  });
}
