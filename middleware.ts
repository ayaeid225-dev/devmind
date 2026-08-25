import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "devmind_session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "devmind_secret_jwt_token_key_change_in_production_32bytes"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  let isValidSession = false;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isValidSession = true;
    } catch {
      isValidSession = false;
    }
  }

  // Protect /app/* routes
  if (pathname.startsWith("/app")) {
    if (!isValidSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Prevent authenticated users from returning to /login or /signup
  if (pathname === "/login" || pathname === "/signup") {
    if (isValidSession) {
      return NextResponse.redirect(new URL("/app/overview", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup"],
};
