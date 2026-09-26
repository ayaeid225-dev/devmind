import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { markNotificationAsRead } from "@/lib/server/notifications";
import { db } from "@/lib/server/db";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const notification = await db.notification.findFirst({
      where: { id, userId: user.id },
      include: {
        repo: {
          select: { id: true, name: true, owner: true },
        },
      },
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({ read: true }));
    const shouldMarkRead = body.read !== false;

    if (shouldMarkRead) {
      const updated = await markNotificationAsRead(user.id, id);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: "Notification not found or access denied" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: updated,
      });
    } else {
      // Allow marking as unread if explicitly requested
      const notification = await db.notification.findFirst({
        where: { id, userId: user.id },
      });
      if (!notification) {
        return NextResponse.json(
          { success: false, error: "Notification not found or access denied" },
          { status: 404 }
        );
      }
      const updated = await db.notification.update({
        where: { id },
        data: { read: false },
      });
      return NextResponse.json({
        success: true,
        data: updated,
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to update notification";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const notification = await db.notification.findFirst({
      where: { id, userId: user.id },
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: "Notification not found or access denied" },
        { status: 404 }
      );
    }

    await db.notification.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to delete notification";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
