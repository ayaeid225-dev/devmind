
export type IngestionStage =
  | "CONNECTING"
  | "FETCHING_TREE"
  | "PARSING_FILES"
  | "RESOLVING_DEPENDENCIES"
  | "SYNCING_GIT"
  | "FINALIZING";

export type IngestionStatus = "PENDING" | "INDEXING" | "COMPLETED" | "FAILED";

export interface IngestionProgress {
  status: IngestionStatus;
  stage: IngestionStage;
  percent: number;
  processedFiles: number;
  totalFiles: number;
  currentFile?: string;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  elapsedMs?: number;
  estimatedRemainingMs?: number;
}

export const STAGE_BASE_WEIGHTS: Record<IngestionStage, { base: number; max: number; label: string }> = {
  CONNECTING: { base: 2, max: 5, label: "Connecting repository & verifying credentials" },
  FETCHING_TREE: { base: 5, max: 15, label: "Discovering repository tree & filtering safety bounds" },
  PARSING_FILES: { base: 15, max: 75, label: "Parsing AST symbols & resolving file imports" },
  RESOLVING_DEPENDENCIES: { base: 75, max: 85, label: "Linking internal module edges & manifest dependencies" },
  SYNCING_GIT: { base: 85, max: 95, label: "Extracting contributors & commit history" },
  FINALIZING: { base: 95, max: 99, label: "Calculating metrics & finalizing repository" },
};

/**
 * Calculates a truthful, monotonic overall percentage.
 * Ensures percent never goes backwards and stays clamped between 0 and 100.
 */
export function calculateProgressPercent(
  stage: IngestionStage,
  processedFiles: number,
  totalFiles: number,
  previousPercent = 0
): number {
  const config = STAGE_BASE_WEIGHTS[stage];
  if (!config) return Math.min(100, Math.max(0, previousPercent));

  let calculated = config.base;

  if (stage === "PARSING_FILES" && totalFiles > 0) {
    const fraction = Math.min(1, Math.max(0, processedFiles / totalFiles));
    const range = config.max - config.base;
    calculated = config.base + Math.round(fraction * range);
  } else if (stage === "FINALIZING") {
    calculated = 98;
  }

  // Never allow progress to go backwards; clamp between 0 and 100
  const monotonic = Math.max(previousPercent, calculated);
  return Math.min(100, Math.max(0, monotonic));
}

class IngestionProgressTracker {
  private progressMap = new Map<string, IngestionProgress>();
  private fileStartTimes = new Map<string, number>();

  /**
   * Initializes or resets progress tracking for a repository.
   */
  start(repoId: string, initialMessage = "Initializing repository indexing..."): IngestionProgress {
    const startedAt = new Date().toISOString();
    const initial: IngestionProgress = {
      status: "INDEXING",
      stage: "CONNECTING",
      percent: STAGE_BASE_WEIGHTS.CONNECTING.base,
      processedFiles: 0,
      totalFiles: 0,
      message: initialMessage,
      startedAt,
    };

    this.progressMap.set(repoId, initial);
    this.fileStartTimes.set(repoId, Date.now());
    return initial;
  }

  /**
   * Updates the progress for an active repository ingestion.
   */
  update(
    repoId: string,
    updates: {
      stage?: IngestionStage;
      processedFiles?: number;
      totalFiles?: number;
      currentFile?: string;
      message?: string;
    }
  ): IngestionProgress {
    const current = this.progressMap.get(repoId) || {
      status: "INDEXING",
      stage: updates.stage || "CONNECTING",
      percent: 0,
      processedFiles: 0,
      totalFiles: 0,
      startedAt: new Date().toISOString(),
    };

    const stage = updates.stage ?? current.stage;
    const processedFiles = updates.processedFiles ?? current.processedFiles;
    const totalFiles = updates.totalFiles ?? current.totalFiles;
    const currentFile = updates.currentFile ?? current.currentFile;

    const percent = calculateProgressPercent(stage, processedFiles, totalFiles, current.percent);

    // Calculate elapsed and estimated remaining time
    const startTime = this.fileStartTimes.get(repoId) || Date.now();
    const elapsedMs = Math.max(0, Date.now() - startTime);

    let estimatedRemainingMs: number | undefined;
    if (stage === "PARSING_FILES" && processedFiles > 5 && totalFiles > processedFiles) {
      const msPerFile = elapsedMs / processedFiles;
      const remainingFiles = totalFiles - processedFiles;
      estimatedRemainingMs = Math.round(msPerFile * remainingFiles);
    }

    const updated: IngestionProgress = {
      ...current,
      status: "INDEXING",
      stage,
      percent,
      processedFiles,
      totalFiles,
      currentFile,
      message: updates.message ?? current.message ?? STAGE_BASE_WEIGHTS[stage].label,
      elapsedMs,
      estimatedRemainingMs,
    };

    this.progressMap.set(repoId, updated);
    return updated;
  }

  /**
   * Marks ingestion as successfully COMPLETED with 100% progress.
   */
  complete(repoId: string, totalFilesCount?: number): IngestionProgress {
    const current = this.progressMap.get(repoId);
    const completedAt = new Date().toISOString();
    const startTime = this.fileStartTimes.get(repoId) || Date.now();
    const elapsedMs = Math.max(0, Date.now() - startTime);

    const files = totalFilesCount ?? current?.totalFiles ?? current?.processedFiles ?? 0;

    const completed: IngestionProgress = {
      status: "COMPLETED",
      stage: "FINALIZING",
      percent: 100,
      processedFiles: files,
      totalFiles: files,
      currentFile: undefined,
      message: "Repository successfully indexed",
      startedAt: current?.startedAt || completedAt,
      completedAt,
      elapsedMs,
    };

    this.progressMap.set(repoId, completed);
    return completed;
  }

  /**
   * Marks ingestion as FAILED.
   */
  fail(repoId: string, errorMessage: string, stage?: IngestionStage): IngestionProgress {
    const current = this.progressMap.get(repoId);
    const completedAt = new Date().toISOString();
    const startTime = this.fileStartTimes.get(repoId) || Date.now();
    const elapsedMs = Math.max(0, Date.now() - startTime);

    const failed: IngestionProgress = {
      status: "FAILED",
      stage: stage || current?.stage || "CONNECTING",
      percent: current?.percent || 0,
      processedFiles: current?.processedFiles || 0,
      totalFiles: current?.totalFiles || 0,
      currentFile: current?.currentFile,
      message: `Ingestion failed: ${errorMessage}`,
      error: errorMessage,
      startedAt: current?.startedAt || completedAt,
      completedAt,
      elapsedMs,
    };

    this.progressMap.set(repoId, failed);
    return failed;
  }

  /**
   * Retrieves the current progress for a repository.
   */
  get(repoId: string): IngestionProgress | null {
    return this.progressMap.get(repoId) || null;
  }

  /**
   * Checks if an ingestion job is currently running for a repository.
   */
  isRunning(repoId: string): boolean {
    const p = this.progressMap.get(repoId);
    return p?.status === "INDEXING";
  }

  /**
   * Cleans up finished progress for a repository.
   */
  cleanup(repoId: string): void {
    this.progressMap.delete(repoId);
    this.fileStartTimes.delete(repoId);
  }
}

// Global Singleton Progress Tracker
export const ingestionProgressTracker = new IngestionProgressTracker();
