import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleGitHubCallback } from "@/lib/server/github";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  const baseUrl = request.nextUrl.origin;

  // Inspect state cookie to determine intent even if an error occurred before code exchange
  let detectedIntent: "signin" | "connect" = "connect";
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("github_oauth_state")?.value;
    if (rawCookie) {
      try {
        const parsed = JSON.parse(rawCookie);
        if (parsed?.intent === "signin") {
          detectedIntent = "signin";
        }
      } catch {}
    }
  } catch {}

  if (errorParam || !code || !state) {
    try {
      const cookieStore = await cookies();
      cookieStore.delete("github_oauth_state");
    } catch {}

    const errorMsg =
      errorParam === "access_denied"
        ? "GitHub authorization was canceled."
        : (errorDesc || errorParam || "Missing GitHub authorization code or state.");

    if (detectedIntent === "signin") {
      const errorUrl = new URL("/login", baseUrl);
      errorUrl.searchParams.set("error", errorMsg);
      return NextResponse.redirect(errorUrl);
    } else {
      const errorUrl = new URL("/connect-failed", baseUrl);
      errorUrl.searchParams.set("reason", errorMsg);
      return NextResponse.redirect(errorUrl);
    }
  }

  const result = await handleGitHubCallback(code, state);

  if (!result.success) {
    const effectiveIntent = result.intent || detectedIntent;
    const errorMsg = result.error || "GitHub authentication failed.";

    if (effectiveIntent === "signin") {
      const errorUrl = new URL("/login", baseUrl);
      errorUrl.searchParams.set("error", errorMsg);
      return NextResponse.redirect(errorUrl);
    } else {
      const errorUrl = new URL("/connect-failed", baseUrl);
      errorUrl.searchParams.set("reason", errorMsg);
      return NextResponse.redirect(errorUrl);
    }
  }

  if (result.intent === "signin") {
    const isCompleted = result.user?.onboardingCompleted ?? false;
    let returnTo = isCompleted ? (result.returnTo || "/app/overview") : "/onboarding";
    if (!returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.startsWith("/\\")) {
      returnTo = isCompleted ? "/app/overview" : "/onboarding";
    }
    return NextResponse.redirect(new URL(returnTo, baseUrl));
  }

  const successUrl = new URL("/connect", baseUrl);
  successUrl.searchParams.set("status", "connected");
  return NextResponse.redirect(successUrl);
}
