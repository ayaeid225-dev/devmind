import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "devmind_session";

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: AUTH_SECRET environment variable is required in production.");
    }
    return new TextEncoder().encode("devmind_secret_jwt_token_key_change_in_production_32bytes");
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  let isValidSession = false;
  let onboardingCompleted = false;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
      isValidSession = true;
      onboardingCompleted = Boolean(payload.onboardingCompleted);
    } catch {
      isValidSession = false;
    }
  }

  // Protect /onboarding route
  if (pathname === "/onboarding") {
    if (!isValidSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (onboardingCompleted) {
      return NextResponse.redirect(new URL("/app/overview", request.url));
    }
    return NextResponse.next();
  }

  // Protect /app/*, /connect, and /repos routes
  if (
    pathname.startsWith("/app") ||
    pathname === "/connect" ||
    pathname === "/repos"
  ) {
    if (!isValidSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!onboardingCompleted) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  // Prevent authenticated users from returning to auth forms
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) {
    if (isValidSession) {
      const destination = onboardingCompleted ? "/app/overview" : "/onboarding";
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onboarding",
    "/app/:path*",
    "/connect",
    "/repos",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};
