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

    const doc = await db.documentRecord.findFirst({
      where: { id },
    });

    if (!doc) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error(`GET /api/docs/${id} error:`, error);
    return NextResponse.json({ success: false, error: "Failed to fetch document" }, { status: 500 });
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

    await db.documentRecord.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Document "${id}" deleted.` });
  } catch (error) {
    console.error(`DELETE /api/docs/${id} error:`, error);
    return NextResponse.json({ success: false, error: "Failed to delete document" }, { status: 500 });
  }
}
