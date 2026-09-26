import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { ingestionProgressTracker } from "@/lib/server/ingestion/progress";

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
      where: {
        OR: [
          { id },
          { name: id },
          ...(id.includes("/") ? [{ name: id.split("/")[1], owner: id.split("/")[0] }] : []),
        ],
      },
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

    // Retrieve live progress telemetry if actively running or recently updated
    const liveProgress =
      ingestionProgressTracker.get(repo.id) ||
      ingestionProgressTracker.get(repo.name) ||
      ingestionProgressTracker.get(id);

    const progress = liveProgress || {
      status: repo.ingestionStatus as any,
      stage: repo.ingestionStatus === "COMPLETED" ? ("FINALIZING" as const) : ("CONNECTING" as const),
      percent: repo.ingestionStatus === "COMPLETED" ? 100 : 0,
      processedFiles: repo.filesCount,
      totalFiles: repo.filesCount,
      startedAt: repo.startedAt?.toISOString(),
      completedAt: repo.completedAt?.toISOString(),
      error: repo.ingestionError || undefined,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...repo,
        progress,
      },
    });
  } catch (error) {
    console.error(`API GET /api/repositories/${id}/status error:`, error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
