import "server-only";
import { db } from "../db";
import type {
  CreateNotificationInput,
  NotifyRepoMembersInput,
  NotificationQueryOptions,
} from "./types";

/**
 * Creates a single notification for a specific user with deduplication/idempotency.
 */
export async function createNotification(input: CreateNotificationInput) {
  const {
    userId,
    repoId,
    type,
    title,
    message,
    entityId,
    link,
    dedupeKey,
  } = input;

  let orgId = input.orgId;
  let projectId = input.projectId;

  // If repoId is provided but orgId or projectId is missing, resolve them from repository
  if (repoId && (!orgId || !projectId)) {
    const repo = await db.repository.findFirst({
      where: { OR: [{ id: repoId }, { name: repoId }] },
      select: { id: true, projectId: true, project: { select: { orgId: true } } },
    });
    if (repo) {
      projectId = projectId || repo.projectId;
      orgId = orgId || repo.project.orgId;
    }
  }

  // Idempotency check via dedupeKey
  if (dedupeKey) {
    const existing = await db.notification.findUnique({
      where: { dedupeKey },
    });
    if (existing) {
      return existing;
    }
  }

  try {
    return await db.notification.create({
      data: {
        userId,
        orgId: orgId || null,
        projectId: projectId || null,
        repoId: repoId || null,
        type,
        title,
        message,
        read: false,
        entityId: entityId || null,
        link: link || null,
        dedupeKey: dedupeKey || null,
      },
    });
  } catch (err: unknown) {
    // If concurrent insert created same dedupeKey (P2002: unique constraint failed)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002" &&
      dedupeKey
    ) {
      const existing = await db.notification.findUnique({
        where: { dedupeKey },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

/**
 * Creates notifications for all users who have access to the repository (organization members),
 * or for a specific target user.
 */
export async function notifyRepoMembers(
  repoId: string,
  input: NotifyRepoMembersInput
) {
  const {
    type,
    title,
    message,
    entityId,
    link,
    dedupeKey,
    targetUserId,
  } = input;

  // Resolve repository with its project, org, and org members
  const repo = await db.repository.findFirst({
    where: { OR: [{ id: repoId }, { name: repoId }] },
    include: {
      project: {
        include: {
          org: {
            include: {
              members: {
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });

  const resolvedRepoId = repo?.id || repoId;
  const orgId = input.orgId || repo?.project?.orgId || null;
  const projectId = input.projectId || repo?.projectId || null;

  // If a specific target user was requested:
  if (targetUserId) {
    const userDedupeKey = dedupeKey ? `${targetUserId}:${dedupeKey}` : null;
    const notification = await createNotification({
      userId: targetUserId,
      repoId: resolvedRepoId,
      orgId,
      projectId,
      type,
      title,
      message,
      entityId,
      link,
      dedupeKey: userDedupeKey,
    });
    return [notification];
  }

  // Find all recipient user IDs
  const recipientUserIds: string[] = [];
  if (repo?.project?.org?.members && repo.project.org.members.length > 0) {
    for (const member of repo.project.org.members) {
      recipientUserIds.push(member.userId);
    }
  }

  // If no members found on the repo org, find all active users as fallback (e.g. initial onboarding)
  if (recipientUserIds.length === 0) {
    const users = await db.user.findMany({ select: { id: true }, take: 10 });
    for (const u of users) {
      recipientUserIds.push(u.id);
    }
  }

  const results = [];
  for (const uid of recipientUserIds) {
    const userDedupeKey = dedupeKey ? `${uid}:${dedupeKey}` : null;
    try {
      const notif = await createNotification({
        userId: uid,
        repoId: resolvedRepoId,
        orgId,
        projectId,
        type,
        title,
        message,
        entityId,
        link,
        dedupeKey: userDedupeKey,
      });
      results.push(notif);
    } catch (err) {
      console.error(`Failed to notify user ${uid}:`, err);
    }
  }

  return results;
}

/**
 * Retrieves notifications for an authenticated user with optional filtering by repository,
 * read status, and pagination.
 */
export async function getUserNotifications(
  userId: string,
  options?: NotificationQueryOptions
) {
  const where: { userId: string; repoId?: string; read?: boolean } = { userId };

  if (options?.repoId) {
    // Resolve repoId (can be ID or name)
    const repo = await db.repository.findFirst({
      where: { OR: [{ id: options.repoId }, { name: options.repoId }] },
      select: { id: true },
    });

    if (repo) {
      // Assert user access to repository's organization
      const hasAccess = await db.repository.findFirst({
        where: {
          id: repo.id,
          project: {
            org: {
              members: {
                some: { userId },
              },
            },
          },
        },
      });

      // If user doesn't have access to this repo, return empty result to protect isolation
      if (!hasAccess) {
        return {
          notifications: [],
          unreadCount: 0,
          total: 0,
        };
      }

      where.repoId = repo.id;
    } else {
      where.repoId = options.repoId;
    }
  }

  if (options?.unreadOnly) {
    where.read = false;
  }

  const take = options?.limit ?? 30;
  const skip = options?.offset ?? 0;

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        repo: {
          select: {
            id: true,
            name: true,
            owner: true,
          },
        },
      },
    }),
    db.notification.count({ where }),
    db.notification.count({
      where: {
        userId,
        ...(where.repoId ? { repoId: where.repoId } : {}),
        read: false,
      },
    }),
  ]);

  return {
    notifications,
    unreadCount,
    total,
  };
}

/**
 * Marks a specific notification as read, guaranteeing ownership verification.
 */
export async function markNotificationAsRead(userId: string, notificationId: string) {
  const notification = await db.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    return null;
  }

  return await db.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

/**
 * Marks all notifications for a user as read (optionally filtered by repository).
 */
export async function markAllNotificationsAsRead(userId: string, repoId?: string) {
  const where: { userId: string; read: boolean; repoId?: string } = { userId, read: false };

  if (repoId) {
    const repo = await db.repository.findFirst({
      where: { OR: [{ id: repoId }, { name: repoId }] },
      select: { id: true },
    });
    if (repo) {
      where.repoId = repo.id;
    }
  }

  const result = await db.notification.updateMany({
    where,
    data: { read: true },
  });

  return { count: result.count };
}

/**
 * Returns unread notification count for a user.
 */
export async function getUnreadCount(userId: string, repoId?: string): Promise<number> {
  const where: { userId: string; read: boolean; repoId?: string } = { userId, read: false };
  if (repoId) {
    const repo = await db.repository.findFirst({
      where: { OR: [{ id: repoId }, { name: repoId }] },
      select: { id: true },
    });
    if (repo) {
      where.repoId = repo.id;
    }
  }
  return await db.notification.count({ where });
}
