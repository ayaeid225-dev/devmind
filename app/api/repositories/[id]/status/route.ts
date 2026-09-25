import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";

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

    const repo = await db.repository.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        owner: true,
        defaultBranch: true,
        ingestionStatus: true,
        ingestionError: true,
        startedAt: true,
        completedAt: true,
        filesCount: true,
        modulesCount: true,
        depsCount: true,
        contributorsCount: true,
        lastIndexedAt: true,
        gitSyncStatus: true,
        syncStatus: true,
        latestCommitSha: true,
        lastSyncedCommitSha: true,
        lastGitSyncAt: true,
        lastSuccessfulSyncAt: true,
        lastSyncSummary: true,
        gitSyncError: true,
        syncError: true,
      },
    });

    if (!repo) {
      return NextResponse.json(
        { success: false, error: `Repository "${id}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: repo,
    });
  } catch (error) {
    console.error(`API GET /api/repositories/${id}/status error:`, error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
