import { NextResponse } from "next/server";
import { repositoryDataSource } from "@/lib/server/data-source";
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

    const repositories = await repositoryDataSource.getRepositories();
    return NextResponse.json({
      success: true,
      data: repositories,
    });
  } catch (error) {
    console.error("API GET /api/repositories error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
