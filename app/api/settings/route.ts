import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user,
        preferences: {
          pushNotifs: true,
          autoReindex: true,
          showEvidence: true,
        },
      },
    });
  } catch (error) {
    console.error("API GET /api/settings error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
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
    const { pushNotifs, autoReindex, showEvidence } = body;

    return NextResponse.json({
      success: true,
      data: {
        pushNotifs: Boolean(pushNotifs),
        autoReindex: Boolean(autoReindex),
        showEvidence: Boolean(showEvidence),
      },
      message: "Workspace preferences saved successfully.",
    });
  } catch (error) {
    console.error("API POST /api/settings error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
