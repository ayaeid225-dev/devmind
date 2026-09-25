import { NextRequest, NextResponse } from "next/server";
import { generateGitHubAuthUrl } from "@/lib/server/github";
import { getCurrentUser } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const intentParam = searchParams.get("intent");
    const intent: "signin" | "connect" = intentParam === "signin" ? "signin" : "connect";

    const rawReturnTo = searchParams.get("returnTo") || searchParams.get("next");
    const returnTo =
      rawReturnTo &&
      rawReturnTo.startsWith("/") &&
      !rawReturnTo.startsWith("//") &&
      !rawReturnTo.startsWith("/\\")
        ? rawReturnTo
        : (intent === "signin" ? "/app/overview" : "/connect");

    if (intent === "connect") {
      const user = await getCurrentUser();
      if (!user) {
        const isHtmlRequest = request.headers.get("accept")?.includes("text/html");
        if (isHtmlRequest) {
          const loginUrl = new URL("/login", request.nextUrl.origin);
          loginUrl.searchParams.set("next", "/connect");
          return NextResponse.redirect(loginUrl);
        }
        return NextResponse.json(
          { success: false, error: "Unauthenticated: Please sign in to connect GitHub" },
          { status: 401 }
        );
      }
    }

    const authUrl = await generateGitHubAuthUrl({ intent, returnTo });

    // Check if client expects direct 302 redirect or JSON response
    const shouldRedirect =
      request.nextUrl.searchParams.get("redirect") === "true" ||
      (request.headers.get("accept")?.includes("text/html") &&
        !request.headers.get("accept")?.includes("application/json"));

    if (shouldRedirect) {
      return NextResponse.redirect(authUrl);
    }

    return NextResponse.json({
      success: true,
      url: authUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate GitHub OAuth connection";
    console.error("API GET /api/github/connect error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
