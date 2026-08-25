import { NextRequest, NextResponse } from "next/server";
import { handleGitHubCallback } from "@/lib/server/github";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const baseUrl = request.nextUrl.origin;

  if (errorParam || !code || !state) {
    const errorUrl = new URL("/connect-failed", baseUrl);
    if (errorParam) errorUrl.searchParams.set("reason", errorParam);
    return NextResponse.redirect(errorUrl);
  }

  const result = await handleGitHubCallback(code, state);

  if (!result.success) {
    const errorUrl = new URL("/connect-failed", baseUrl);
    errorUrl.searchParams.set("reason", result.error || "oauth_failed");
    return NextResponse.redirect(errorUrl);
  }

  const successUrl = new URL("/connect", baseUrl);
  successUrl.searchParams.set("status", "connected");
  return NextResponse.redirect(successUrl);
}
