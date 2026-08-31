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

    const modules = await db.module.findMany({
      where: { repoId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: modules });
  } catch (error) {
    console.error("GET /api/modules error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch modules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type = "core", desc, repoId } = body;

    if (!repoId) {
      return NextResponse.json({ success: false, error: "Repository ID is required" }, { status: 400 });
    }

    if (!name || !desc) {
      return NextResponse.json({ success: false, error: "Name and description are required" }, { status: 400 });
    }

    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    const newModule = await db.module.create({
      data: {
        id,
        repoId,
        name,
        type,
        desc,
        aiSummary: `New ${type} module "${name}": ${desc}`,
        filesCount: 0,
        depsCount: 0,
        dependentsCount: 0,
      },
    });

    return NextResponse.json({ success: true, data: newModule });
  } catch (error) {
    console.error("POST /api/modules error:", error);
    return NextResponse.json({ success: false, error: "Failed to create module" }, { status: 500 });
  }
}
