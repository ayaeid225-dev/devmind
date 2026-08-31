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

    const activity = await db.activityRecord.findMany({
      where: { repoId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: activity });
  } catch (error) {
    console.error("GET /api/activity error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch activity" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { repoId, text, category = "analysis", icon = "log" } = body;

    if (!repoId) {
      return NextResponse.json({ success: false, error: "Repository ID is required" }, { status: 400 });
    }

    if (!text) {
      return NextResponse.json({ success: false, error: "Activity text is required" }, { status: 400 });
    }

    const record = await db.activityRecord.create({
      data: {
        repoId,
        text,
        byUser: user.name,
        category,
        icon,
        timestampText: "Just now",
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("POST /api/activity error:", error);
    return NextResponse.json({ success: false, error: "Failed to log activity" }, { status: 500 });
  }
}
