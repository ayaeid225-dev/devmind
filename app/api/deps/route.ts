import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get("repoId")?.trim();

    if (!repoId) {
      return NextResponse.json(
        { success: false, error: "Repository context (repoId) is required" },
        { status: 400 }
      );
    }

    const deps = await db.dependencyRecord.findMany({
      where: { repoId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: deps });
  } catch (error) {
    console.error("GET /api/deps error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch dependencies" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      kind = "external",
      name,
      version,
      purpose,
      status = "active",
      fromModule,
      toModule,
      repoId,
      sourceFile,
      targetFile,
      importSource,
      dependencyType = "import",
      language,
      resolutionStatus = "RESOLVED_INTERNAL",
    } = body;

    if (!repoId) {
      return NextResponse.json({ success: false, error: "Repository ID is required" }, { status: 400 });
    }

    const key = body.key || `${repoId}::${sourceFile || "global"}::${importSource || name || Date.now()}::${dependencyType}`;

    const newDep = await db.dependencyRecord.create({
      data: {
        key,
        repoId,
        kind,
        name: name || undefined,
        version: version || undefined,
        purpose: purpose || undefined,
        status: status || undefined,
        fromModule: fromModule || undefined,
        toModule: toModule || undefined,
        sourceFile: sourceFile || undefined,
        targetFile: targetFile || undefined,
        importSource: importSource || undefined,
        dependencyType,
        language: language || undefined,
        resolutionStatus,
      },
    });

    return NextResponse.json({ success: true, data: newDep });
  } catch (error) {
    console.error("POST /api/deps error:", error);
    return NextResponse.json({ success: false, error: "Failed to create dependency" }, { status: 500 });
  }
}
