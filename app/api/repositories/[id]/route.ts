import { NextRequest, NextResponse } from "next/server";
import { getRepositoryByName } from "@/lib/server/repositories";
import { getCurrentUser } from "@/lib/server/auth";
import { REPOS } from "@/data/fixtures";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const dbRepo = await getRepositoryByName(id);
    if (dbRepo) {
      return NextResponse.json({
        success: true,
        data: dbRepo,
      });
    }

    const fixtureRepo = REPOS.find((r) => r.name === id);
    if (fixtureRepo) {
      return NextResponse.json({
        success: true,
        data: fixtureRepo,
        source: "fixture",
      });
    }

    return NextResponse.json(
      { success: false, error: `Repository "${id}" not found` },
      { status: 404 }
    );
  } catch (error) {
    console.error(`API GET /api/repositories/${id} error:`, error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
