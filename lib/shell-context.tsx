"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { DEFAULT_USER, REPO, type Repo } from "@/data/fixtures";

const STORAGE_KEY = "devmind_active_repo_id";

export interface User {
  initials: string;
  name: string;
  email: string;
}

export interface ApiRepoItem {
  id: string;
  name: string;
  owner: string;
  defaultBranch: string;
  filesCount: number;
  modulesCount: number;
  depsCount: number;
  contributorsCount?: number;
  lastIndexedAt?: string;
  ingestionStatus?: string;
}

interface ShellContextType {
  activeRepoId: string | null;
  activeRepo: Repo;
  availableRepos: ApiRepoItem[];
  branch: string;
  user: User | null;
  analysisDone: boolean;
  paletteOpen: boolean;
  setActiveRepoId: (repoId: string) => void;
  setRepo: (repo: Repo) => void;
  setBranch: (branch: string) => void;
  setUser: (user: User | null) => void;
  setAnalysisDone: (done: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  refreshRepositories: () => Promise<ApiRepoItem[]>;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [activeRepoId, setActiveRepoIdState] = useState<string | null>(null);
  const [availableRepos, setAvailableRepos] = useState<ApiRepoItem[]>([]);
  const [repo, setRepoState] = useState<Repo>(REPO);
  const [branch, setBranchState] = useState<string>("main");
  const [user, setUser] = useState<User | null>(DEFAULT_USER);
  const [analysisDone, setAnalysisDone] = useState<boolean>(true);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);

  // Fetch real repositories from DB
  const refreshRepositories = useCallback(async (): Promise<ApiRepoItem[]> => {
    try {
      const res = await fetch("/api/repositories");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableRepos(data.data);
        return data.data as ApiRepoItem[];
      }
    } catch (err) {
      console.error("Failed to fetch available repositories:", err);
    }
    return [];
  }, []);

  // Update active repo by ID and persist
  const setActiveRepoId = useCallback((repoId: string) => {
    if (!repoId) return;
    setActiveRepoIdState(repoId);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, repoId);
      } catch {
        // ignore quota errors
      }

      // Update URL search parameter if on workspace routes
      if (window.location.pathname.startsWith("/app/")) {
        const url = new URL(window.location.href);
        if (url.searchParams.get("repoId") !== repoId) {
          url.searchParams.set("repoId", repoId);
          window.history.replaceState(null, "", url.toString());
        }
      }
    }

    // Match with available repos or build dynamic Repo object
    setAvailableRepos((prevRepos) => {
      const found = prevRepos.find((r) => r.id === repoId || r.name === repoId);
      if (found) {
        setRepoState({
          name: found.name,
          owner: found.owner,
          branch: found.defaultBranch || "main",
          lang: "TypeScript",
          updated: found.lastIndexedAt ? new Date(found.lastIndexedAt).toLocaleDateString() : "Just now",
          contributors: found.contributorsCount || 4,
          files: found.filesCount || 0,
          modules: found.modulesCount || 0,
          deps: found.depsCount || 0,
          private: true,
          desc: `Repository ${found.owner}/${found.name}`,
        });
        setBranchState(found.defaultBranch || "main");
      } else {
        setRepoState({
          name: repoId,
          owner: "github",
          branch: "main",
          lang: "TypeScript",
          updated: "Just now",
          contributors: 4,
          files: 0,
          modules: 0,
          deps: 0,
          private: true,
          desc: `Repository ${repoId}`,
        });
      }
      return prevRepos;
    });
  }, []);

  const setRepo = useCallback((newRepo: Repo) => {
    setRepoState(newRepo);
    if (newRepo.name) {
      setActiveRepoId(newRepo.name);
    }
    if (newRepo.branch) {
      setBranchState(newRepo.branch);
    }
  }, [setActiveRepoId]);

  const setBranch = useCallback((newBranch: string) => {
    setBranchState(newBranch);
    setRepoState((prev) => ({ ...prev, branch: newBranch }));
  }, []);

  const openPalette = () => setPaletteOpen(true);
  const closePalette = () => setPaletteOpen(false);
  const togglePalette = () => setPaletteOpen((prev) => !prev);

  // Restore state safely on client mount (SSR Safe)
  useEffect(() => {
    let ignore = false;
    async function initRepoState() {
      const dbRepos = await refreshRepositories();
      if (ignore) return;

      let targetRepoId: string | null = null;

      // 1. Check URL ?repoId=
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        targetRepoId = params.get("repoId");
      }

      // 2. Check localStorage
      if (!targetRepoId && typeof window !== "undefined") {
        try {
          targetRepoId = localStorage.getItem(STORAGE_KEY);
        } catch {
          targetRepoId = null;
        }
      }

      // 3. Fallback to first database repo
      if (!targetRepoId && dbRepos && dbRepos.length > 0) {
        targetRepoId = dbRepos[0].id || dbRepos[0].name;
      }

      if (targetRepoId) {
        setActiveRepoId(targetRepoId);
      }
    }

    initRepoState();

    return () => {
      ignore = true;
    };
  }, [refreshRepositories, setActiveRepoId]);

  // Global Ctrl/Cmd + K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ShellContext.Provider
      value={{
        activeRepoId,
        activeRepo: repo,
        availableRepos,
        branch,
        user,
        analysisDone,
        paletteOpen,
        setActiveRepoId,
        setRepo,
        setBranch,
        setUser,
        setAnalysisDone,
        openPalette,
        closePalette,
        togglePalette,
        refreshRepositories,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error("useShell must be used within a ShellProvider");
  }
  return context;
}
