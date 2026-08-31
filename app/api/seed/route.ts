import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/server/seed";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Database seeding is disabled in production" },
      { status: 403 }
    );
  }

  try {
    await seedDatabase();
    return NextResponse.json({
      success: true,
      message: "Database seeded successfully from fixtures.",
    });
  } catch (error) {
    console.error("API POST /api/seed error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to seed database" },
      { status: 500 }
    );
  }
}
