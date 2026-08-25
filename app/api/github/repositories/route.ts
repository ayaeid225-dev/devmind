import { NextResponse } from "next/server";
import { fetchUserGitHubRepos } from "@/lib/server/github";
import { getCurrentUser } from "@/lib/server/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const repos = await fetchUserGitHubRepos();
    return NextResponse.json({
      success: true,
      data: repos,
    });
  } catch (error) {
    console.error("API GET /api/github/repositories error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch GitHub repositories" },
      { status: 500 }
    );
  }
}
