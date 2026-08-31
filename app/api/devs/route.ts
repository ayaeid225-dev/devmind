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

    const devs = await db.developerRecord.findMany({
      where: { repoId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: devs });
  } catch (error) {
    console.error("GET /api/devs error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch developers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, role, color = "#C8D62B", coverage = "80%", blurb, repoId } = body;

    if (!repoId) {
      return NextResponse.json({ success: false, error: "Repository ID is required" }, { status: 400 });
    }

    if (!name || !role) {
      return NextResponse.json({ success: false, error: "Name and role are required" }, { status: 400 });
    }

    const devId = `dev-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    const newDev = await db.developerRecord.create({
      data: {
        id: devId,
        repoId,
        name,
        role,
        color,
        coverage: typeof coverage === "number" ? coverage : 80,
        blurb: blurb || `Contributor specializing in ${role}`,
        recentContribution: `Added features for ${role}`,
      },
    });

    return NextResponse.json({ success: true, data: newDev });
  } catch (error) {
    console.error("POST /api/devs error:", error);
    return NextResponse.json({ success: false, error: "Failed to add developer" }, { status: 500 });
  }
}
