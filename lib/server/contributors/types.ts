export interface ContributorIdentity {
  identityKey: string;
  normalizedName: string;
  normalizedEmail: string | null;
}

export interface AggregatedContributorStats {
  identityKey: string;
  name: string;
  email: string | null;
  authoredCommitsCount: number;
  committedCommitsCount: number;
  totalCommitsCount: number;
  additions: number;
  deletions: number;
  filesTouched: Set<string>;
  firstContributionAt: Date;
  lastContributionAt: Date;
  isAuthor: boolean;
  isCommitter: boolean;
  authoredCommitIds: string[];
  committedCommitIds: string[];
}

export interface ContributorSyncOptions {
  skipCommitLinking?: boolean;
}

export interface ContributorSyncResult {
  success: boolean;
  repoId: string;
  contributorsSynced: number;
  durationMs: number;
  error?: string;
}

export type ContributorSortBy = "commits" | "additions" | "recent" | "name";
export type ContributorRoleFilter = "all" | "author" | "committer";

export interface ContributorQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: ContributorSortBy;
  role?: ContributorRoleFilter;
  includeCommits?: boolean;
}
