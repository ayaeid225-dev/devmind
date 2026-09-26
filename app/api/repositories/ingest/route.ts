import { NextRequest, NextResponse } from "next/server";
import { ingestRepository } from "@/lib/server/ingestion";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { ingestionProgressTracker } from "@/lib/server/ingestion/progress";

// In-memory lock map ensuring a repository never runs multiple concurrent ingestion workers
const activeIngestionLocks = new Map<string, Promise<any>>();

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { owner, repo, branch, force = false } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, error: "Owner and repo are required parameters" },
        { status: 400 }
      );
    }

    const repoId = repo;

    // 1. Check if ingestion is already running for this repository
    if (activeIngestionLocks.has(repoId) || ingestionProgressTracker.isRunning(repoId)) {
      return NextResponse.json({
        success: true,
        status: "INDEXING",
        isAlreadyRunning: true,
        repositoryId: repoId,
        jobId: repoId,
        data: {
          id: repoId,
          name: repo,
          owner,
          ingestionStatus: "INDEXING",
        },
      });
    }

    // 2. Resolve or create project in organization
    const org = user.organization;
    let projectId = "proj-clinic-management";

    if (org) {
      const dbProject = await db.project.findFirst({
        where: { orgId: org.id },
      });
      if (dbProject) {
        projectId = dbProject.id;
      } else {
        const newProj = await db.project.create({
          data: {
            orgId: org.id,
            name: `${repo} Project`,
            slug: `${repo.toLowerCase()}-proj`,
          },
        });
        projectId = newProj.id;
      }
    }

    // 3. Ensure Repository record exists immediately in database
    const repository = await db.repository.upsert({
      where: { id: repoId },
      update: {
        ingestionStatus: "INDEXING",
        ingestionError: null,
        startedAt: new Date(),
        owner,
        name: repo,
        defaultBranch: branch || "main",
      },
      create: {
        id: repoId,
        projectId,
        name: repo,
        owner,
        defaultBranch: branch || "main",
        ingestionStatus: "INDEXING",
        startedAt: new Date(),
      },
    });

    // 4. Create durable SyncJob record in database
    const syncJob = await db.syncJob.create({
      data: {
        repoId: repository.id,
        event: "ingest",
        status: "PROCESSING",
        afterSha: branch || "main",
        startedAt: new Date(),
      },
    });

    // 5. Initialize live progress tracking
    ingestionProgressTracker.start(repoId, `Connecting to repository ${owner}/${repo}...`);

    // 6. Launch background worker with durable lock
    const workerPromise = (async () => {
      try {
        await ingestRepository({
          owner,
          repo,
          branch,
          user,
          force,
        });

        await db.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      } catch (ingestErr: any) {
        const errorMsg = ingestErr instanceof Error ? ingestErr.message : "Ingestion failed";
        console.error(`Background ingestion worker error for ${owner}/${repo}:`, ingestErr);

        await db.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: "FAILED",
            error: errorMsg,
            completedAt: new Date(),
          },
        });
      } finally {
        activeIngestionLocks.delete(repoId);
      }
    })();

    activeIngestionLocks.set(repoId, workerPromise);

    // 7. Return immediately (202 Accepted) without blocking the client
    return NextResponse.json(
      {
        success: true,
        status: "INDEXING",
        isAlreadyRunning: false,
        repositoryId: repoId,
        jobId: syncJob.id,
        data: {
          id: repoId,
          name: repo,
          owner,
          ingestionStatus: "INDEXING",
        },
      },
      { status: 202 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Repository ingestion initialization failed";
    console.error("API POST /api/repositories/ingest error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
