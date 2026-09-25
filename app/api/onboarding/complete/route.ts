import { NextResponse } from "next/server";
import { getCurrentUser, setSessionCookie } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { onboardingCompleted: true },
    });

    await setSessionCookie({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      tokenVersion: updatedUser.tokenVersion,
      onboardingCompleted: true,
    });

    return NextResponse.json({
      success: true,
      onboardingCompleted: true,
    });
  } catch (error) {
    console.error("API POST /api/onboarding/complete error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error completing onboarding" },
      { status: 500 }
    );
  }
}
