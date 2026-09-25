import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

const VALID_ROLES = [
  "Developer",
  "Tech Lead",
  "Engineering Manager",
  "Founder",
  "Student",
  "Other",
] as const;

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const role = body?.role;

    if (!role || typeof role !== "string" || !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid role selection. Must be one of: " + VALID_ROLES.join(", "),
        },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { role },
    });

    return NextResponse.json({
      success: true,
      role,
    });
  } catch (error) {
    console.error("API POST /api/onboarding/role error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error saving role" },
      { status: 500 }
    );
  }
}
