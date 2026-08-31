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

    const dev = await db.developerRecord.findFirst({
      where: { id },
    });

    if (!dev) {
      return NextResponse.json({ success: false, error: "Developer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: dev });
  } catch (error) {
    console.error(`GET /api/devs/${id} error:`, error);
    return NextResponse.json({ success: false, error: "Failed to fetch developer" }, { status: 500 });
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

    await db.developerRecord.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Developer "${id}" deleted.` });
  } catch (error) {
    console.error(`DELETE /api/devs/${id} error:`, error);
    return NextResponse.json({ success: false, error: "Failed to delete developer" }, { status: 500 });
  }
}
