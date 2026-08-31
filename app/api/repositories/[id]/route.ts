import { NextRequest, NextResponse } from "next/server";
import { getRepositoryByName } from "@/lib/server/repositories";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

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

    // Try by name first (since most code passes name as the ID)
    const dbRepo = await getRepositoryByName(id);
    if (dbRepo) {
      return NextResponse.json({
        success: true,
        data: dbRepo,
      });
    }

    // Try by actual DB id
    const dbRepoById = await db.repository.findFirst({ where: { id } });
    if (dbRepoById) {
      return NextResponse.json({
        success: true,
        data: dbRepoById,
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
