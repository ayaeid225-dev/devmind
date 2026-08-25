import "server-only";

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url?: string;
}

export interface IngestionSafetyLimits {
  maxFilesCount: number;
  maxFileSize: number; // bytes
  maxTotalBytes: number; // bytes
}

export const DEFAULT_SAFETY_LIMITS: IngestionSafetyLimits = {
  maxFilesCount: 500,
  maxFileSize: 500 * 1024, // 500 KB
  maxTotalBytes: 25 * 1024 * 1024, // 25 MB
};

const IGNORED_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".idea",
  ".vscode",
  "vendor",
  "target",
  "bin",
  "obj",
  "tmp",
  ".cache",
]);

const IGNORED_FILE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "ico",
  "webp",
  "pdf",
  "zip",
  "tar",
  "gz",
  "7z",
  "exe",
  "dll",
  "so",
  "dylib",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "mp3",
  "mp4",
  "db",
  "sqlite",
]);

export function filterTreeItems(
  items: GitHubTreeItem[],
  limits = DEFAULT_SAFETY_LIMITS
): { validBlobs: GitHubTreeItem[]; ignoredCount: number } {
  const validBlobs: GitHubTreeItem[] = [];
  let ignoredCount = 0;
  let totalBytes = 0;

  for (const item of items) {
    if (item.type !== "blob") continue;

    const pathSegments = item.path.split("/");
    const isIgnoredDir = pathSegments.some((seg) => IGNORED_DIRECTORY_NAMES.has(seg.toLowerCase()));

    if (isIgnoredDir) {
      ignoredCount++;
      continue;
    }

    const ext = item.path.split(".").pop()?.toLowerCase() || "";
    if (IGNORED_FILE_EXTENSIONS.has(ext)) {
      ignoredCount++;
      continue;
    }

    const itemSize = item.size ?? 0;
    if (itemSize > limits.maxFileSize) {
      ignoredCount++;
      continue;
    }

    if (totalBytes + itemSize > limits.maxTotalBytes || validBlobs.length >= limits.maxFilesCount) {
      ignoredCount++;
      continue;
    }

    validBlobs.push(item);
    totalBytes += itemSize;
  }

  return { validBlobs, ignoredCount };
}
