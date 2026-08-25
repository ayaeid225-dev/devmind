import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";

export async function GET() {
  try {
    const reposCount = await db.repository.count();
    return NextResponse.json({
      status: "ok",
      database: "connected",
      repositoriesCount: reposCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check database connection error:", error);
    return NextResponse.json(
      {
        status: "degraded",
        database: "disconnected",
        message: "Database connection unavailable, using fixture fallback.",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
