import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";

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
    const { lessonId, completed } = body;

    return NextResponse.json({
      success: true,
      data: {
        lessonId,
        completed: Boolean(completed),
      },
      message: `Lesson "${lessonId}" progress updated.`,
    });
  } catch (error) {
    console.error("API POST /api/learning error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update lesson progress" },
      { status: 500 }
    );
  }
}
