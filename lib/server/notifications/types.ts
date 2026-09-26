export type NotificationType =
  | "INGESTION_COMPLETED"
  | "INGESTION_FAILED"
  | "INGESTION_PARTIAL"
  | "SYNC_COMPLETED"
  | "SYNC_FAILED"
  | "REPO_CONNECTED"
  | "GITHUB_SYNC_ISSUE"
  | "ACTIVITY";

export interface CreateNotificationInput {
  userId: string;
  orgId?: string | null;
  projectId?: string | null;
  repoId?: string | null;
  type: NotificationType | string;
  title: string;
  message: string;
  entityId?: string | null;
  link?: string | null;
  dedupeKey?: string | null;
}

export interface NotifyRepoMembersInput {
  orgId?: string | null;
  projectId?: string | null;
  type: NotificationType | string;
  title: string;
  message: string;
  entityId?: string | null;
  link?: string | null;
  dedupeKey?: string | null;
  targetUserId?: string | null;
}

export interface NotificationQueryOptions {
  repoId?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}
