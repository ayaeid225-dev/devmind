import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { hashPassword, setSessionCookie } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, teamName } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const orgName = teamName?.trim() || `${name.split(" ")[0]}'s Workspace`;
    const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role: "Lead Architect",
        color: "#C8D62B",
      },
    });

    const org = await db.organization.create({
      data: {
        name: orgName,
        slug: orgSlug,
      },
    });

    await db.orgMember.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: "OWNER",
      },
    });

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
        },
      },
    });
  } catch (error) {
    console.error("API POST /api/auth/signup error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error during registration" },
      { status: 500 }
    );
  }
}
