import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

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

    await db.dependencyRecord.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Dependency "${id}" deleted.` });
  } catch (error) {
    console.error(`DELETE /api/deps/${id} error:`, error);
    return NextResponse.json({ success: false, error: "Failed to delete dependency" }, { status: 500 });
  }
}
