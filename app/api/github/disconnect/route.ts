import { NextResponse } from "next/server";
import { disconnectGitHub } from "@/lib/server/github";

export async function POST() {
  try {
    const result = await disconnectGitHub();
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "GitHub account disconnected successfully",
    });
  } catch (error) {
    console.error("API POST /api/github/disconnect error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
