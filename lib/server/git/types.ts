export type GitChangeType =
  | "ADDED"
  | "MODIFIED"
  | "DELETED"
  | "RENAMED"
  | "COPIED"
  | "TYPE_CHANGED"
  | "UNKNOWN";

export interface GitFileChange {
  oldPath: string | null;
  newPath: string;
  changeType: GitChangeType;
  additions: number;
  deletions: number;
  similarity: number | null;
  isBinary: boolean;
  fileMode: string | null;
}

export interface GitCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  committerName: string;
  committerEmail: string;
  authoredAt: Date;
  committedAt: Date;
  parentShas: string[];
  fileChanges: GitFileChange[];
}

export interface GitSyncOptions {
  branch?: string;
  maxCommits?: number;
  incremental?: boolean;
  sinceSha?: string;
}

export interface GitSyncResult {
  success: boolean;
  repoId: string;
  commitsSynced: number;
  fileChangesSynced: number;
  latestCommitSha: string | null;
  durationMs: number;
  error?: string;
}

export interface CommitHistoryQueryOptions {
  branch?: string;
  limit?: number;
  offset?: number;
  authorEmail?: string;
  since?: Date;
  until?: Date;
}
