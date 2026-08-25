import { NextResponse } from "next/server";
import { getGitHubStatus } from "@/lib/server/github";

export async function GET() {
  try {
    const status = await getGitHubStatus();
    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("API GET /api/github/status error:", error);
    return NextResponse.json(
      { success: false, connected: false, error: "Failed to fetch GitHub status" },
      { status: 500 }
    );
  }
}
