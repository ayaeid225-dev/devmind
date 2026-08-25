"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { DEFAULT_USER, REPO, type Repo } from "@/data/fixtures";

export interface User {
  initials: string;
  name: string;
  email: string;
}

interface ShellContextType {
  repo: Repo;
  branch: string;
  user: User | null;
  analysisDone: boolean;
  paletteOpen: boolean;
  setRepo: (repo: Repo) => void;
  setBranch: (branch: string) => void;
  setUser: (user: User | null) => void;
  setAnalysisDone: (done: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [repo, setRepoState] = useState<Repo>(REPO);
  const [branch, setBranchState] = useState<string>(REPO.branch || "main");
  const [user, setUser] = useState<User | null>(DEFAULT_USER);
  const [analysisDone, setAnalysisDone] = useState<boolean>(true);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);

  const setRepo = (newRepo: Repo) => {
    setRepoState(newRepo);
    if (newRepo.branch) {
      setBranchState(newRepo.branch);
    }
  };

  const setBranch = (newBranch: string) => {
    setBranchState(newBranch);
    setRepoState((prev) => ({ ...prev, branch: newBranch }));
  };

  const openPalette = () => setPaletteOpen(true);
  const closePalette = () => setPaletteOpen(false);
  const togglePalette = () => setPaletteOpen((prev) => !prev);

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
        repo,
        branch,
        user,
        analysisDone,
        paletteOpen,
        setRepo,
        setBranch,
        setUser,
        setAnalysisDone,
        openPalette,
        closePalette,
        togglePalette,
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
