import { NextResponse } from "next/server";
import { generateGitHubAuthUrl } from "@/lib/server/github";
import { getCurrentUser } from "@/lib/server/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated: Please sign in to connect GitHub" },
        { status: 401 }
      );
    }

    const authUrl = await generateGitHubAuthUrl();
    return NextResponse.json({
      success: true,
      url: authUrl,
    });
  } catch (error) {
    console.error("API GET /api/github/connect error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate GitHub OAuth connection" },
      { status: 500 }
    );
  }
}
