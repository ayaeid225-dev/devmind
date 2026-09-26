import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import {
  getUserNotifications,
  createNotification,
  markAllNotificationsAsRead,
} from "@/lib/server/notifications";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const repoId = searchParams.get("repoId") || undefined;
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = searchParams.get("limit")
      ? Math.min(100, Math.max(1, parseInt(searchParams.get("limit")!, 10)))
      : 30;
    const offset = searchParams.get("offset")
      ? Math.max(0, parseInt(searchParams.get("offset")!, 10))
      : 0;

    const result = await getUserNotifications(user.id, {
      repoId,
      unreadOnly,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to fetch notifications";
    console.error("API GET /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Check if this is a bulk mark-all-read request
    if (body.action === "mark-all-read") {
      const result = await markAllNotificationsAsRead(user.id, body.repoId);
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    const { type, title, message, repoId, orgId, projectId, entityId, link, dedupeKey } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { success: false, error: "type, title, and message are required" },
        { status: 400 }
      );
    }

    const notification = await createNotification({
      userId: user.id,
      repoId: repoId || null,
      orgId: orgId || null,
      projectId: projectId || null,
      type,
      title,
      message,
      entityId: entityId || null,
      link: link || null,
      dedupeKey: dedupeKey || null,
    });

    return NextResponse.json(
      {
        success: true,
        data: notification,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to create notification";
    console.error("API POST /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const errorMsg = error instanceof Error ? error.message : "Failed to update notifications";
    console.error("API PATCH /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
