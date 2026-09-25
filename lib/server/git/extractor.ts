import { execFile } from "child_process";
import { promisify } from "util";
import type {
  GitChangeType,
  GitCommitInfo,
  GitFileChange,
  GitSyncOptions,
} from "./types";

const execFileAsync = promisify(execFile);

export function normalizeGitPath(rawPath: string): string {
  if (!rawPath) return "";
  let p = rawPath.trim();
  if (p.startsWith('"') && p.endsWith('"')) {
    p = p.slice(1, -1);
  }
  p = p.replace(/\\/g, "/");
  p = p.replace(/\/+/g, "/");
  p = p.replace(/^\.\//, "");
  p = p.replace(/^\/+/, "");
  p = p.replace(/\/+$/, "");
  return p;
}

export function resolveNumstatPath(numstatPath: string): string {
  if (!numstatPath) return "";
  let resolved = numstatPath.trim();
  if (resolved.startsWith('"') && resolved.endsWith('"')) {
    resolved = resolved.slice(1, -1);
  }
  // Replace {prefix => suffix} or {old => } or { => new}
  resolved = resolved.replace(
    /\{(?:(.*?)\s*=>\s*(.*?))\}/g,
    (_match, _before, after) => (after ? after.trim() : "")
  );
  // Replace simple "old => new"
  if (resolved.includes(" => ")) {
    const parts = resolved.split(" => ");
    resolved = parts[1] || parts[0];
  }
  return normalizeGitPath(resolved);
}

export function mapGitChangeType(statusChar: string): GitChangeType {
  const code = (statusChar || "").trim().toUpperCase();
  if (code.startsWith("A")) return "ADDED";
  if (code.startsWith("M")) return "MODIFIED";
  if (code.startsWith("D")) return "DELETED";
  if (code.startsWith("R")) return "RENAMED";
  if (code.startsWith("C")) return "COPIED";
  if (code.startsWith("T")) return "TYPE_CHANGED";
  return "UNKNOWN";
}

export async function isGitRepository(repoPath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--is-inside-work-tree"],
      {
        cwd: repoPath,
        encoding: "utf-8",
        timeout: 10000,
      }
    );
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function getLatestCommitSha(
  repoPath: string,
  ref: string = "HEAD"
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", ref], {
      cwd: repoPath,
      encoding: "utf-8",
      timeout: 10000,
    });
    const sha = stdout.trim();
    return sha.length === 40 ? sha : null;
  } catch {
    return null;
  }
}

export async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      {
        cwd: repoPath,
        encoding: "utf-8",
        timeout: 10000,
      }
    );
    const branch = stdout.trim();
    if (branch && branch !== "HEAD") {
      return branch;
    }
  } catch {}

  return "main";
}

export async function verifyCommitExists(
  repoPath: string,
  sha: string
): Promise<boolean> {
  try {
    await execFileAsync("git", ["cat-file", "-e", `${sha}^{commit}`], {
      cwd: repoPath,
      encoding: "utf-8",
      timeout: 10000,
    });
    return true;
  } catch {
    return false;
  }
}

export async function extractGitHistory(
  repoPath: string,
  options?: GitSyncOptions
): Promise<GitCommitInfo[]> {
  const isRepo = await isGitRepository(repoPath);
  if (!isRepo) {
    throw new Error(`Directory is not a valid Git repository: ${repoPath}`);
  }

  const args: string[] = [
    "-c",
    "core.quotepath=false",
    "log",
    "-m",
    "--raw",
    "--numstat",
    "-M",
    "--format=COMMIT%x1f%H%x1f%h%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%at%x1f%ct%x1f%P%x1f%B%x1e",
  ];

  if (options?.maxCommits && options.maxCommits > 0) {
    // Provide a small buffer to account for possible merge commit duplicates
    args.push("-n", String(options.maxCommits * 2));
  }

  let targetRef = options?.branch || "HEAD";
  if (targetRef !== "HEAD") {
    const refExists = await verifyCommitExists(repoPath, targetRef);
    if (!refExists) {
      targetRef = "HEAD";
    }
  }

  let range = targetRef;
  if (options?.incremental && options?.sinceSha) {
    const exists = await verifyCommitExists(repoPath, options.sinceSha);
    if (exists) {
      range = `${options.sinceSha}..${targetRef}`;
    }
  }

  args.push(range);

  let stdout = "";
  try {
    const res = await execFileAsync("git", args, {
      cwd: repoPath,
      maxBuffer: 100 * 1024 * 1024,
      encoding: "utf-8",
    });
    stdout = res.stdout;
  } catch (err: unknown) {
    // If range was e.g. sinceSha..HEAD and produced an empty list or git returned 0/empty
    if (typeof err === "object" && err !== null && "stdout" in err) {
      stdout = String((err as { stdout: unknown }).stdout || "");
    } else {
      throw err;
    }
  }

  if (!stdout || !stdout.trim()) {
    return [];
  }

  const commitBlocks = stdout.split("COMMIT\x1f").filter(Boolean);
  const commits: GitCommitInfo[] = [];
  const seenShas = new Set<string>();

  for (const block of commitBlocks) {
    const recordSepIdx = block.indexOf("\x1e");
    if (recordSepIdx === -1) continue;

    const header = block.slice(0, recordSepIdx);
    const diffBody = block.slice(recordSepIdx + 1);

    const fields = header.split("\x1f");
    if (fields.length < 10) continue;

    const [sha, shortSha, an, ae, cn, ce, at, ct, parentsStr, ...msgParts] = fields;
    if (seenShas.has(sha)) {
      continue;
    }
    seenShas.add(sha);

    if (options?.maxCommits && commits.length >= options.maxCommits) {
      break;
    }
    const message = msgParts.join("\x1f").trim();

    const authoredAt = new Date(parseInt(at, 10) * 1000);
    const committedAt = new Date(parseInt(ct, 10) * 1000);
    const parentShas = parentsStr ? parentsStr.trim().split(/\s+/).filter(Boolean) : [];

    // Parse raw diff lines and numstat lines
    const rawLines: string[] = [];
    const numstatLines: string[] = [];

    const lines = diffBody.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith(":")) {
        rawLines.push(trimmed);
      } else if (trimmed.includes("\t")) {
        numstatLines.push(trimmed);
      }
    }

    // Process numstat into lookup map
    const numstatMap = new Map<
      string,
      { additions: number; deletions: number; isBinary: boolean }
    >();
    const numstatList: Array<{
      resolvedPath: string;
      additions: number;
      deletions: number;
      isBinary: boolean;
    }> = [];

    for (const nLine of numstatLines) {
      const parts = nLine.split("\t");
      if (parts.length < 3) continue;
      const addStr = parts[0].trim();
      const delStr = parts[1].trim();
      const rawPath = parts.slice(2).join("\t");
      const resolved = resolveNumstatPath(rawPath);

      const isBinary = addStr === "-" && delStr === "-";
      const additions = isBinary ? 0 : parseInt(addStr, 10) || 0;
      const deletions = isBinary ? 0 : parseInt(delStr, 10) || 0;

      const stat = { additions, deletions, isBinary };
      numstatMap.set(resolved, stat);
      numstatList.push({ resolvedPath: resolved, ...stat });
    }

    // Process raw lines into GitFileChange objects
    const fileChanges: GitFileChange[] = [];

    for (let rIdx = 0; rIdx < rawLines.length; rIdx++) {
      const rLine = rawLines[rIdx];
      const tabParts = rLine.split("\t");
      if (tabParts.length < 2) continue;

      const metaPart = tabParts[0].trim();
      const metaTokens = metaPart.split(/\s+/);
      const srcMode = metaTokens[0]?.replace(/^:/, "") || null;
      const dstMode = metaTokens[1] || null;
      const statusCode = metaTokens[4] || "";

      const changeType = mapGitChangeType(statusCode);

      let similarity: number | null = null;
      if (statusCode.startsWith("R") || statusCode.startsWith("C")) {
        const s = parseInt(statusCode.slice(1), 10);
        if (!isNaN(s)) {
          similarity = s;
        }
      }

      const fileMode = dstMode && dstMode !== "000000" ? dstMode : srcMode;

      let oldPath: string | null = null;
      let newPath: string = "";

      if (changeType === "RENAMED" || changeType === "COPIED") {
        oldPath = normalizeGitPath(tabParts[1]);
        newPath = normalizeGitPath(tabParts[2]);
      } else if (changeType === "DELETED") {
        oldPath = normalizeGitPath(tabParts[1]);
        newPath = oldPath;
      } else {
        oldPath = null;
        newPath = normalizeGitPath(tabParts[1]);
      }

      if (!newPath) continue;

      // Match numstat stats
      let stat = numstatMap.get(newPath);
      if (!stat && oldPath) {
        stat = numstatMap.get(oldPath);
      }
      if (!stat && numstatList[rIdx]) {
        stat = numstatList[rIdx];
      }

      fileChanges.push({
        oldPath,
        newPath,
        changeType,
        additions: stat?.additions ?? 0,
        deletions: stat?.deletions ?? 0,
        similarity,
        isBinary: stat?.isBinary ?? false,
        fileMode,
      });
    }

    commits.push({
      sha,
      shortSha,
      message,
      authorName: an,
      authorEmail: ae,
      committerName: cn || an,
      committerEmail: ce || ae,
      authoredAt,
      committedAt,
      parentShas,
      fileChanges,
    });
  }

  return commits;
}
