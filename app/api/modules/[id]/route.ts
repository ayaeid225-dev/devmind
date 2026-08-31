import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get("repoId")?.trim();

    const module = await db.module.findFirst({
      where: repoId ? { id, repoId } : { id },
    });

    if (!module) {
      return NextResponse.json({ success: false, error: "Module not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: module });
  } catch (error) {
    console.error(`GET /api/modules/${id} error:`, error);
    return NextResponse.json({ success: false, error: "Failed to fetch module" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    await db.module.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Module "${id}" deleted.` });
  } catch (error) {
    console.error(`DELETE /api/modules/${id} error:`, error);
    return NextResponse.json({ success: false, error: "Failed to delete module" }, { status: 500 });
  }
}
