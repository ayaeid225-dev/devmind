import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { markAllNotificationsAsRead } from "@/lib/server/notifications";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const repoId = body?.repoId || undefined;

    const result = await markAllNotificationsAsRead(user.id, repoId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to mark all as read";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
