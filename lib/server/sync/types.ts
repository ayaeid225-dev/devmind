import "server-only";

export type ChangedFileAction = "added" | "modified" | "deleted" | "renamed";

export interface ChangedFileItem {
  path: string;
  action: ChangedFileAction;
  oldPath?: string;
  additions?: number;
  deletions?: number;
}

export interface SyncOptions {
  branch?: string;
  pusher?: string;
  deliveryId?: string;
  isManual?: boolean;
  forceFull?: boolean;
  token?: string;
  commits?: Array<{
    sha: string;
    message: string;
    authorName?: string;
    authorDate?: string;
    added?: string[];
    removed?: string[];
    modified?: string[];
  }>;
}

export interface SyncResult {
  success: boolean;
  repoId: string;
  beforeSha: string | null;
  afterSha: string;
  isIncremental: boolean;
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  durationMs: number;
  summary: string;
  error?: string;
}

export interface WebhookPushPayload {
  ref: string;
  before?: string;
  after: string;
  repository: {
    id?: number;
    name: string;
    full_name: string;
    owner: {
      name?: string;
      email?: string;
      login: string;
    };
    default_branch?: string;
  };
  pusher?: {
    name?: string;
    email?: string;
  };
  head_commit?: {
    id: string;
    message?: string;
    author?: {
      name?: string;
      email?: string;
    };
  };
  commits?: Array<{
    id: string;
    message?: string;
    added?: string[];
    removed?: string[];
    modified?: string[];
  }>;
}
