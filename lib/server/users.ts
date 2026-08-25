import "server-only";
import { db } from "./db";

export async function findUserByEmail(email: string) {
  try {
    return await db.user.findUnique({
      where: { email },
    });
  } catch (error) {
    console.error("Failed to fetch user by email:", error);
    return null;
  }
}

export async function createUser(data: {
  email: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  color?: string;
}) {
  try {
    return await db.user.create({
      data,
    });
  } catch (error) {
    console.error("Failed to create user:", error);
    throw error;
  }
}

export async function findOrganizationBySlug(slug: string) {
  try {
    return await db.organization.findUnique({
      where: { slug },
      include: {
        projects: true,
      },
    });
  } catch (error) {
    console.error("Failed to fetch organization:", error);
    return null;
  }
}
