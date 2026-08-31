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

    const docs = await db.documentRecord.findMany({
      where: { repoId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: docs });
  } catch (error) {
    console.error("GET /api/docs error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { title, category = "architecture", summary, bodyContent, repoId } = body;

    if (!repoId) {
      return NextResponse.json({ success: false, error: "Repository ID is required" }, { status: 400 });
    }

    if (!title || !summary) {
      return NextResponse.json({ success: false, error: "Title and summary are required" }, { status: 400 });
    }

    const docId = `doc-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    const newDoc = await db.documentRecord.create({
      data: {
        id: docId,
        repoId,
        category,
        title,
        summary,
        author: user.name,
        status: "verified",
        coverage: 90,
        contentJson: JSON.stringify([
          {
            h: title,
            body: bodyContent || summary,
          },
        ]),
      },
    });

    return NextResponse.json({ success: true, data: newDoc });
  } catch (error) {
    console.error("POST /api/docs error:", error);
    return NextResponse.json({ success: false, error: "Failed to create document" }, { status: 500 });
  }
}
