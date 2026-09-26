"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Logo,
  Button,
  Input,
  Icon,
  Badge,
  Spinner,
  Skeleton,
  type IconName,
} from "@/components/ui";

// -------------------------------------------------------------
// TYPES & DATA DEFINITIONS
// -------------------------------------------------------------

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: string | null;
  githubUsername?: string | null;
  initials?: string;
  onboardingCompleted?: boolean;
}

interface GitHubRepoItem {
  id: number | string;
  name: string;
  full_name: string;
  private: boolean;
  html_url?: string;
  description: string | null;
  language: string | null;
  stargazers_count?: number;
  forks_count?: number;
  updated_at?: string;
  default_branch?: string;
  owner?: {
    login: string;
    avatar_url?: string;
  };
}

interface RepoStatusData {
  id: string;
  name: string;
  owner: string;
  ingestionStatus: "PENDING" | "PROCESSING" | "INDEXING" | "COMPLETED" | "FAILED" | string;
  ingestionProgress?: number;
  totalFiles?: number;
  processedFiles?: number;
  filesCount?: number;
  modulesCount?: number;
  depsCount?: number;
  contributorsCount?: number;
  commitsCount?: number;
  ingestionError?: string | null;
  lastSyncAt?: string | null;
  progress?: {
    status: string;
    stage: "CONNECTING" | "FETCHING_TREE" | "PARSING_FILES" | "RESOLVING_DEPENDENCIES" | "SYNCING_GIT" | "FINALIZING";
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
  };
}

interface RoleOption {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
}

const ROLES: RoleOption[] = [
  {
    id: "Developer",
    title: "Developer",
    desc: "Build features, fix bugs, and ship code directly into repositories.",
    icon: "code",
  },
  {
    id: "Tech Lead",
    title: "Tech Lead",
    desc: "Architecture, system design, technical roadmap, and code reviews.",
    icon: "puzzle",
  },
  {
    id: "Engineering Manager",
    title: "Engineering Manager",
    desc: "Team velocity, delivery health, and cross-functional engineering.",
    icon: "users",
  },
  {
    id: "Founder",
    title: "Founder / CTO",
    desc: "Product direction, technical vision, and end-to-end velocity.",
    icon: "zap",
  },
  {
    id: "Student",
    title: "Student / Learner",
    desc: "Study architecture, navigate complex codebases, and grow skills.",
    icon: "learning",
  },
  {
    id: "Other",
    title: "Other Specialist",
    desc: "DevOps, Security, Quality Engineering, or research.",
    icon: "terminal",
  },
];

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3572A5",
  Rust: "#DEA584",
  Go: "#00ADD8",
  Java: "#B07219",
  "C++": "#F34B7D",
  C: "#555555",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  HTML: "#E34F26",
  CSS: "#563D7C",
};

// -------------------------------------------------------------
// REUSABLE ONBOARDING SHELL
// -------------------------------------------------------------

interface OnboardingShellProps {
  currentStep: number;
  children: React.ReactNode;
}

function OnboardingShell({ currentStep, children }: OnboardingShellProps) {
  const stepLabel = currentStep === 1 ? "Welcome" : currentStep === 2 ? "Repository" : "Ready";
  const stepNumber = `0${currentStep}`;

  return (
    <div className="min-h-screen bg-[#090B0A] text-[#F2F1E8] flex flex-col selection:bg-[rgba(200,214,43,0.22)] selection:text-[#F2F1E8]">
      {/* Top Header */}
      <header className="border-b border-[#293024] bg-[#090B0A]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
          {/* Brand Logo & Wordmark */}
          <div className="flex items-center gap-2.5">
            <Logo height={20} alt="DevMind" />
            <span className="font-semibold text-sm tracking-tight text-[#F2F1E8]">DevMind</span>
          </div>

          {/* Minimal Step Indicator */}
          <div className="flex items-center gap-2 font-mono text-xs text-[#A7AA9B]">
            <span>
              Step <strong className="text-[#C8D62B] font-semibold">{stepNumber}</strong> / 03
            </span>
            <span className="text-[#6F756A]">·</span>
            <span className="text-[#6F756A] hidden sm:inline">{stepLabel}</span>
          </div>
        </div>

        {/* Minimal Progress Bar Under Header */}
        <div className="h-[1px] w-full bg-[#141813] relative">
          <div
            className="h-[1px] bg-[#C8D62B] transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          />
        </div>
      </header>

      {/* Centered Main Workflow Body */}
      <main className="flex-1 flex flex-col justify-center px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-2xl flex-1 flex flex-col justify-between">
          {children}
        </div>
      </main>
    </div>
  );
}

// -------------------------------------------------------------
// MAIN ONBOARDING COMPONENT
// -------------------------------------------------------------

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL query parameters
  const stepParam = searchParams.get("step") || "welcome";
  const repoIdParam = searchParams.get("repoId") || "";
  const repoNameParam = searchParams.get("repoName") || "";

  // User session state
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Step 1: Role calibration state
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Step 2: Repository selection state
  const [repos, setRepos] = useState<GitHubRepoItem[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepoItem | null>(null);
  const [connectingRepo, setConnectingRepo] = useState(false);

  // Step 3: Indexing and Ready state
  const analyzingRepoId = repoIdParam || "";
  const analyzingRepoName = repoNameParam || "";
  const [repoStatus, setRepoStatus] = useState<RepoStatusData | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const [squashedCount, setSquashedCount] = useState(0);
  const [bugPosition, setBugPosition] = useState({ x: 50, y: 50 });
  const [bugHitAnim, setBugHitAnim] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Derive active step number
  const currentStep = stepParam === "repository" ? 2 : stepParam === "analyzing" ? 3 : 1;

  // 1. Fetch current authenticated user session
  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login?next=/onboarding");
            return;
          }
          throw new Error("Failed to load user session");
        }
        const data = await res.json();
        if (isMounted && data.success && data.user) {
          setUser(data.user);
          if (data.user.role && !selectedRole) {
            setSelectedRole(data.user.role);
          }
          if (data.user.onboardingCompleted) {
            router.push("/app/overview");
          }
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      } finally {
        if (isMounted) setLoadingUser(false);
      }
    }
    loadUser();
    return () => {
      isMounted = false;
    };
  }, [router, selectedRole]);

  // 2. Fetch GitHub Repositories for Step 2
  const refreshRepositories = useCallback(async () => {
    setLoadingRepos(true);
    setRepoError(null);
    try {
      const res = await fetch("/api/github/repositories");
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorMsg =
          typeof data.error === "object"
            ? data.error?.message
            : data.error || "Unable to fetch your GitHub repositories.";
        setRepoError(errorMsg);
        return;
      }
      setRepos(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error("Error fetching repositories:", err);
      setRepoError("Network failure connecting to GitHub API. Please check your connection.");
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    if (stepParam !== "repository") return;
    let isMounted = true;

    async function fetchRepos() {
      try {
        const res = await fetch("/api/github/repositories");
        const data = await res.json();
        if (!isMounted) return;
        if (!data.success) {
          const errorMsg =
            typeof data.error === "object"
              ? data.error?.message
              : data.error || "Unable to fetch your GitHub repositories.";
          setRepoError(errorMsg);
        } else {
          setRepos(Array.isArray(data.data) ? data.data : []);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching repositories:", err);
        setRepoError("Network failure connecting to GitHub API. Please check your connection.");
      } finally {
        if (isMounted) setLoadingRepos(false);
      }
    }

    fetchRepos();

    return () => {
      isMounted = false;
    };
  }, [stepParam]);

  // 3. Handle Step 1 Submit (Save Role)
  const handleRoleSubmit = async () => {
    if (!selectedRole) return;
    setSavingRole(true);
    setRoleError(null);
    try {
      const res = await fetch("/api/onboarding/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRoleError(data.error || "Failed to update role preference. Please try again.");
        return;
      }
      router.push("/onboarding?step=repository");
    } catch (err) {
      console.error("Failed to save role:", err);
      setRoleError("Network error occurred while saving your role preference.");
    } finally {
      setSavingRole(false);
    }
  };

  // 4. Handle Step 2 Connect Repository
  const handleConnectRepo = async () => {
    if (!selectedRepo) return;
    setConnectingRepo(true);
    setRepoError(null);
    try {
      const ownerLogin = selectedRepo.owner?.login || selectedRepo.full_name.split("/")[0];
      const repoName = selectedRepo.name || selectedRepo.full_name.split("/")[1];

      const res = await fetch("/api/repositories/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: ownerLogin,
          repo: repoName,
          branch: selectedRepo.default_branch || "main",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.isAlreadyRunning) {
          const rId = `${ownerLogin}/${repoName}`;
          router.push(
            `/onboarding?step=analyzing&repoId=${encodeURIComponent(rId)}&repoName=${encodeURIComponent(
              repoName
            )}`
          );
          return;
        }

        const errMsg =
          typeof data.error === "object"
            ? data.error?.message
            : data.error || "Failed to start repository ingestion.";
        setRepoError(errMsg);
        return;
      }

      const activeRepoId = data.data?.id || `${ownerLogin}/${repoName}`;
      router.push(
        `/onboarding?step=analyzing&repoId=${encodeURIComponent(activeRepoId)}&repoName=${encodeURIComponent(
          repoName
        )}`
      );
    } catch (err) {
      console.error("Failed to ingest repo:", err);
      setRepoError("Network error occurred while starting repository indexing.");
    } finally {
      setConnectingRepo(false);
    }
  };

  // 5. Complete Onboarding in Step 3
  const markOnboardingComplete = useCallback(async () => {
    if (completingOnboarding) return;
    setCompletingOnboarding(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
    } finally {
      setCompletingOnboarding(false);
    }
  }, [completingOnboarding]);

  // 6. Polling repository indexing status in Step 3
  useEffect(() => {
    if (stepParam !== "analyzing" || !analyzingRepoId) return;

    let isPolling = true;
    let pollInterval: NodeJS.Timeout | null = null;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/repositories/${encodeURIComponent(analyzingRepoId)}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (isPolling && data.success && data.data) {
          const repo = data.data as RepoStatusData;
          setRepoStatus(repo);

          if (repo.ingestionStatus === "COMPLETED") {
            setIsCompleted(true);
            markOnboardingComplete();
            if (pollInterval) clearInterval(pollInterval);
          } else if (repo.ingestionStatus === "FAILED") {
            if (pollInterval) clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error("Error polling repository status:", err);
      }
    }

    checkStatus();
    pollInterval = setInterval(checkStatus, 600);

    return () => {
      isPolling = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [stepParam, analyzingRepoId, markOnboardingComplete]);

  // Handle Retry Ingestion
  const handleRetryIngestion = useCallback(async () => {
    if (!analyzingRepoId || isRetrying) return;
    setIsRetrying(true);
    setRepoError(null);
    try {
      const parts = analyzingRepoId.split("/");
      const owner = parts.length > 1 ? parts[0] : (selectedRepo?.owner?.login || user?.githubUsername || "unknown");
      const repo = parts.length > 1 ? parts[1] : analyzingRepoId;

      const res = await fetch("/api/repositories/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          branch: selectedRepo?.default_branch || "main",
          force: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsCompleted(false);
        setRepoStatus({
          id: analyzingRepoId,
          name: repo,
          owner,
          ingestionStatus: "INDEXING",
          progress: {
            status: "INDEXING",
            stage: "CONNECTING",
            percent: 5,
            processedFiles: 0,
            totalFiles: 0,
            message: "Retrying repository analysis...",
          },
        });
      }
    } catch (err) {
      console.error("Failed to retry ingestion:", err);
    } finally {
      setIsRetrying(false);
    }
  }, [analyzingRepoId, isRetrying, selectedRepo, user]);

  // Filter repositories for Step 2
  const filteredRepos = useMemo(() => {
    let result = repos;

    if (visibilityFilter === "public") {
      result = result.filter((r) => !r.private);
    } else if (visibilityFilter === "private") {
      result = result.filter((r) => r.private);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.full_name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
      );
    }

    return result;
  }, [repos, searchQuery, visibilityFilter]);

  const isReposLoading = loadingRepos || (stepParam === "repository" && repos.length === 0 && !repoError);

  const selectedRoleTitle = useMemo(() => {
    return ROLES.find((r) => r.id === selectedRole)?.title || selectedRole || user?.role || "Developer";
  }, [selectedRole, user?.role]);

  // Truthful telemetry state resolution
  const filesState = useMemo(() => {
    if (!repoStatus) return { label: "Pending", isDone: false, isLoading: false };
    const count = repoStatus.filesCount ?? repoStatus.totalFiles ?? 0;
    if (count > 0) {
      return { label: `${count.toLocaleString()} files discovered`, isDone: true, isLoading: false };
    }
    if (repoStatus.ingestionStatus === "PROCESSING") {
      return { label: "Scanning...", isDone: false, isLoading: true };
    }
    if (repoStatus.ingestionStatus === "COMPLETED") {
      return { label: "None detected", isDone: true, isLoading: false };
    }
    return { label: "Pending", isDone: false, isLoading: false };
  }, [repoStatus]);

  const modulesState = useMemo(() => {
    if (!repoStatus) return { label: "Pending", isDone: false, isLoading: false };
    const count = repoStatus.modulesCount ?? 0;
    if (count > 0) {
      return { label: `${count.toLocaleString()} modules isolated`, isDone: true, isLoading: false };
    }
    if (repoStatus.ingestionStatus === "PROCESSING" && filesState.isDone) {
      return { label: "Analyzing...", isDone: false, isLoading: true };
    }
    if (repoStatus.ingestionStatus === "COMPLETED") {
      return { label: "—", isDone: true, isLoading: false };
    }
    return { label: "Pending", isDone: false, isLoading: false };
  }, [repoStatus, filesState.isDone]);

  const depsState = useMemo(() => {
    if (!repoStatus) return { label: "Pending", isDone: false, isLoading: false };
    const count = repoStatus.depsCount ?? 0;
    if (count > 0) {
      return { label: `${count.toLocaleString()} dependencies linked`, isDone: true, isLoading: false };
    }
    if (repoStatus.ingestionStatus === "PROCESSING" && modulesState.isDone) {
      return { label: "Mapping...", isDone: false, isLoading: true };
    }
    if (repoStatus.ingestionStatus === "COMPLETED") {
      return { label: "—", isDone: true, isLoading: false };
    }
    return { label: "Pending", isDone: false, isLoading: false };
  }, [repoStatus, modulesState.isDone]);

  // Loading skeleton before user profile is resolved
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#090B0A] text-[#F2F1E8] flex flex-col">
        <header className="border-b border-[#293024] bg-[#090B0A]">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <Logo height={20} alt="DevMind" />
              <span className="font-semibold text-sm tracking-tight text-[#F2F1E8]">DevMind</span>
            </div>
            <Skeleton className="h-4 w-20 rounded" />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3">
            <Spinner size={20} />
            <span className="font-mono text-xs text-[#A7AA9B]">Calibrating DevMind workspace...</span>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER WORKFLOW
  // -------------------------------------------------------------
  return (
    <OnboardingShell currentStep={currentStep}>
      {/* =========================================================
          STEP 1: WELCOME & ROLE SELECTION
      ========================================================= */}
      {currentStep === 1 && (
        <div className="flex-1 flex flex-col justify-between space-y-8">
          <div className="space-y-6">
            {/* Compact GitHub Identity Block */}
            <div className="flex items-center justify-between rounded-lg border border-[#293024] bg-[#0E110F] px-3.5 py-2.5">
              <div className="flex items-center gap-3">
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name || "Avatar"}
                    className="h-8 w-8 rounded-full border border-[#293024] object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#141813] border border-[#293024] font-mono text-xs font-semibold text-[#C8D62B]">
                    {user?.initials || "EM"}
                  </div>
                )}
                <div>
                  <div className="font-medium text-sm text-[#F2F1E8] leading-snug">
                    {user?.name || "Developer"}
                  </div>
                  <div className="font-mono text-xs text-[#A7AA9B]">
                    {user?.githubUsername ? `@${user.githubUsername}` : user?.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#A7AA9B]">
                <Icon name="github" className="h-3 w-3 text-[#6F756A]" />
                <span className="hidden sm:inline">Authenticated via GitHub</span>
                <span className="sm:hidden">GitHub</span>
              </div>
            </div>

            {/* Main Heading & Calibration Intent */}
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-[#F2F1E8]">
                Welcome to DevMind
              </h1>
              <p className="text-sm text-[#A7AA9B]">
                Let’s calibrate your workspace to your engineering workflow.
              </p>
            </div>

            {/* Role Header */}
            <div className="space-y-3 pt-2">
              <div className="font-mono text-xs uppercase tracking-wider text-[#A7AA9B] font-medium">
                Your role
              </div>

              {/* Error Banner */}
              {roleError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-md border border-[#D85C55]/30 bg-[#D85C55]/10 px-3 py-2 text-xs text-[#D85C55]"
                >
                  <Icon name="alert" className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{roleError}</span>
                </div>
              )}

              {/* Responsive 2-Column Role Grid */}
              <div
                role="radiogroup"
                aria-label="Engineering Roles"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              >
                {ROLES.map((role) => {
                  const isSelected = selectedRole === role.id;
                  return (
                    <div
                      key={role.id}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedRole(role.id);
                        setRoleError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          setSelectedRole(role.id);
                          setRoleError(null);
                        }
                      }}
                      className={`group relative flex cursor-pointer items-start justify-between rounded-lg border p-3.5 transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C8D62B] ${
                        isSelected
                          ? "border-[#C8D62B] bg-[rgba(200,214,43,0.04)]"
                          : "border-[#293024] bg-[#0E110F] hover:border-[#384332] hover:bg-[#141813]"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 pr-2">
                        {/* Subtle Role Icon */}
                        <div
                          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isSelected
                              ? "border-[rgba(200,214,43,0.4)] bg-[rgba(200,214,43,0.12)] text-[#C8D62B]"
                              : "border-[#293024] bg-[#141813] text-[#A7AA9B] group-hover:text-[#F2F1E8]"
                          }`}
                        >
                          <Icon name={role.icon} className="h-3.5 w-3.5" />
                        </div>

                        {/* Title & Concise Description */}
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-xs font-semibold text-[#F2F1E8] leading-snug">
                            {role.title}
                          </div>
                          <p className="text-[11.5px] text-[#6F756A] leading-relaxed line-clamp-2">
                            {role.desc}
                          </p>
                        </div>
                      </div>

                      {/* Disciplined Selection Indicator */}
                      <div
                        className={`mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border transition-all ${
                          isSelected
                            ? "border-[#C8D62B] bg-[#C8D62B] text-[#090B0A]"
                            : "border-[#384332] bg-transparent group-hover:border-[#6F756A]"
                        }`}
                      >
                        {isSelected && <Icon name="check" className="h-2 w-2 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 1 Actions */}
          <div className="flex items-center justify-end pt-6 border-t border-[#293024]">
            <Button
              variant="primary"
              size="md"
              disabled={!selectedRole || savingRole}
              onClick={handleRoleSubmit}
              className="min-w-[130px]"
            >
              {savingRole ? (
                <span className="flex items-center gap-2">
                  <Spinner size={13} /> Saving...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-medium">
                  Continue <Icon name="arrowRight" className="h-3.5 w-3.5" />
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* =========================================================
          STEP 2: REPOSITORY SELECTION
      ========================================================= */}
      {currentStep === 2 && (
        <div className="flex-1 flex flex-col justify-between space-y-8">
          <div className="space-y-6">
            {/* Heading & Subtitle */}
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-[#F2F1E8]">
                Choose what DevMind should understand
              </h1>
              <p className="text-sm text-[#A7AA9B]">
                Select a repository to index its architecture, dependencies, and code intelligence.
              </p>
            </div>

            {/* Error Banner */}
            {repoError && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-md border border-[#D85C55]/30 bg-[#D85C55]/10 px-3.5 py-2.5 text-xs text-[#D85C55]"
              >
                <div className="flex items-center gap-2">
                  <Icon name="alert" className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{repoError}</span>
                </div>
                <button
                  type="button"
                  onClick={refreshRepositories}
                  className="font-mono text-xs underline hover:text-[#F2F1E8] flex-shrink-0 cursor-pointer"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search repositories..."
                  icon="search"
                  className="w-full bg-[#0E110F] border-[#293024] focus:border-[#C8D62B] text-xs h-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F756A] hover:text-[#F2F1E8] cursor-pointer"
                    aria-label="Clear search"
                  >
                    <Icon name="close" className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                {(["all", "public", "private"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setVisibilityFilter(filter)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors cursor-pointer ${
                      visibilityFilter === filter
                        ? "border-[#C8D62B] bg-[rgba(200,214,43,0.08)] text-[#C8D62B] font-medium"
                        : "border-[#293024] bg-[#0E110F] text-[#6F756A] hover:text-[#A7AA9B] hover:border-[#384332]"
                    }`}
                  >
                    {filter === "all" ? "All" : filter === "public" ? "Public" : "Private"}
                  </button>
                ))}
              </div>
            </div>

            {/* Repository List Container */}
            <div
              role="listbox"
              aria-label="GitHub repositories"
              className="max-h-[380px] overflow-y-auto space-y-1.5 rounded-lg border border-[#293024] bg-[#0E110F] p-2"
            >
              {isReposLoading ? (
                <div className="space-y-2 p-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-lg border border-[#293024] bg-[#141813] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                      <Skeleton className="h-3 w-3/4" />
                      <div className="flex items-center gap-4 pt-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#141813] text-[#6F756A]">
                    <Icon name="search" className="h-4 w-4" />
                  </div>
                  <p className="font-medium text-xs text-[#F2F1E8]">No repositories found</p>
                  <p className="text-xs text-[#6F756A] max-w-sm mx-auto">
                    {searchQuery
                      ? `No repositories match "${searchQuery}". Try a different keyword or clear the filter.`
                      : "No repositories were returned from your GitHub account."}
                  </p>
                </div>
              ) : (
                filteredRepos.map((repo) => {
                  const isSelected = selectedRepo?.id === repo.id;
                  const langColor = repo.language ? LANGUAGE_COLORS[repo.language] || "#A7AA9B" : null;

                  return (
                    <div
                      key={repo.id}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => setSelectedRepo(repo)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          setSelectedRepo(repo);
                        }
                      }}
                      className={`group cursor-pointer rounded-lg border p-3 transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C8D62B] ${
                        isSelected
                          ? "border-[#C8D62B] bg-[rgba(200,214,43,0.04)]"
                          : "border-[#20261F] bg-[#141813] hover:border-[#384332] hover:bg-[#181D17]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[#6F756A] group-hover:text-[#A7AA9B]">
                            <Icon name="github" className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-mono text-xs font-semibold text-[#F2F1E8] group-hover:text-[#C8D62B] transition-colors truncate">
                            {repo.name}
                          </span>
                          <span className="font-mono text-[11px] text-[#6F756A] truncate">
                            ({repo.owner?.login || repo.full_name.split("/")[0]})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {repo.private ? (
                            <Badge variant="amber" small>
                              <span className="flex items-center gap-1">
                                <Icon name="lock" className="h-2 w-2" /> Private
                              </span>
                            </Badge>
                          ) : (
                            <Badge variant="cyan" small>
                              Public
                            </Badge>
                          )}

                          {/* Radio Check Marker */}
                          <div
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-all ${
                              isSelected
                                ? "border-[#C8D62B] bg-[#C8D62B] text-[#090B0A]"
                                : "border-[#384332] bg-transparent group-hover:border-[#6F756A]"
                            }`}
                          >
                            {isSelected && <Icon name="check" className="h-2 w-2 stroke-[3]" />}
                          </div>
                        </div>
                      </div>

                      {repo.description && (
                        <p className="mt-1 text-xs text-[#A7AA9B] line-clamp-1 leading-relaxed">
                          {repo.description}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-4 text-[11px] font-mono text-[#6F756A]">
                        {repo.language && (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: langColor || "#A7AA9B" }}
                            />
                            <span className="text-[#A7AA9B]">{repo.language}</span>
                          </div>
                        )}

                        {typeof repo.stargazers_count === "number" && (
                          <div className="flex items-center gap-1">
                            <span>★</span>
                            <span>{repo.stargazers_count.toLocaleString()}</span>
                          </div>
                        )}

                        {repo.default_branch && (
                          <div className="flex items-center gap-1 text-[#6F756A]">
                            <Icon name="branch" className="h-3 w-3" />
                            <span>{repo.default_branch}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Step 2 Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-[#293024]">
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push("/onboarding?step=welcome")}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Icon name="arrowLeft" className="h-3.5 w-3.5" /> Back
              </span>
            </Button>

            <Button
              variant="primary"
              size="md"
              disabled={!selectedRepo || connectingRepo}
              onClick={handleConnectRepo}
              className="min-w-[140px]"
            >
              {connectingRepo ? (
                <span className="flex items-center gap-2">
                  <Spinner size={13} /> Ingesting...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-medium">
                  Continue <Icon name="arrowRight" className="h-3.5 w-3.5" />
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* =========================================================
          STEP 3: READY / REAL INGESTION TELEMETRY
      ========================================================= */}
      {currentStep === 3 && (() => {
        const progressData = repoStatus?.progress;
        const currentPercent = isCompleted ? 100 : (progressData?.percent ?? (repoStatus?.ingestionStatus === "COMPLETED" ? 100 : 0));
        const stageKey = progressData?.stage || (isCompleted ? "FINALIZING" : "CONNECTING");
        
        const STAGE_ORDER: Record<string, number> = {
          CONNECTING: 1,
          FETCHING_TREE: 2,
          PARSING_FILES: 3,
          RESOLVING_DEPENDENCIES: 4,
          SYNCING_GIT: 5,
          FINALIZING: 6,
        };
        const currentStageNum = isCompleted ? 7 : (STAGE_ORDER[stageKey] || 1);

        const STAGES = [
          { key: "CONNECTING", order: 1, label: "Connect repository & verify access" },
          { key: "FETCHING_TREE", order: 2, label: "Scan file tree & boundary detection" },
          { key: "PARSING_FILES", order: 3, label: "Parse AST symbols & resolve imports" },
          { key: "RESOLVING_DEPENDENCIES", order: 4, label: "Link module edges & package manifests" },
          { key: "SYNCING_GIT", order: 5, label: "Extract contributors & commit history" },
          { key: "FINALIZING", order: 6, label: "Finalize engineering architecture" },
        ];

        return (
          <div className="flex-1 flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              {/* Heading & Subtitle */}
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-[#F2F1E8]">
                  {isCompleted
                    ? "Your workspace is ready"
                    : repoStatus?.ingestionStatus === "FAILED"
                    ? "Workspace setup paused"
                    : "Analyzing repository..."}
                </h1>
                <p className="text-sm text-[#A7AA9B]">
                  {isCompleted
                    ? "DevMind has synthesized the repository architecture and engineering context."
                    : repoStatus?.ingestionStatus === "FAILED"
                    ? "Repository indexing encountered an unexpected problem. You can retry or proceed."
                    : progressData?.message || "Building your engineering context: modules, dependencies, and code graphs."}
                </p>
              </div>

              {/* Calibrated Workspace Summary Card */}
              <div className="rounded-lg border border-[#293024] bg-[#0E110F] p-4 space-y-3">
                <div className="font-mono text-xs uppercase tracking-wider text-[#A7AA9B] font-medium border-b border-[#293024] pb-2">
                  Workspace Configuration
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* GitHub Account */}
                  <div className="space-y-1">
                    <div className="font-mono text-[11px] text-[#6F756A]">Identity</div>
                    <div className="flex items-center gap-2">
                      {user?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatarUrl}
                          alt="Avatar"
                          className="h-4 w-4 rounded-full border border-[#293024] object-cover"
                        />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-[#141813] flex items-center justify-center font-mono text-[9px] font-bold text-[#C8D62B]">
                          {user?.initials || "EM"}
                        </div>
                      )}
                      <span className="font-medium text-xs text-[#F2F1E8] truncate">
                        {user?.name || "Developer"}{" "}
                        <span className="font-mono text-[11px] text-[#6F756A]">
                          ({user?.githubUsername ? `@${user.githubUsername}` : ""})
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Calibrated Role */}
                  <div className="space-y-1">
                    <div className="font-mono text-[11px] text-[#6F756A]">Role</div>
                    <div className="text-xs font-medium text-[#F2F1E8]">
                      {selectedRoleTitle}
                    </div>
                  </div>

                  {/* Target Repository */}
                  <div className="space-y-1">
                    <div className="font-mono text-[11px] text-[#6F756A]">Repository</div>
                    <div className="font-mono text-xs font-medium text-[#C8D62B] truncate">
                      {analyzingRepoName || analyzingRepoId || "Connected Repository"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Truthful Real Progress Telemetry Card */}
              <div className="rounded-lg border border-[#293024] bg-[#141813] p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#293024] pb-2.5">
                  <div className="font-mono text-xs uppercase tracking-wider text-[#A7AA9B] font-medium flex items-center gap-2">
                    <span>Indexing Telemetry</span>
                    {!isCompleted && repoStatus?.ingestionStatus !== "FAILED" && (
                      <span className="inline-block w-2 h-2 rounded-full bg-[#C8D62B] animate-ping" />
                    )}
                  </div>
                  <div>
                    {isCompleted ? (
                      <Badge variant="lime" small>
                        <span className="flex items-center gap-1 font-mono">
                          <Icon name="check" className="h-2.5 w-2.5" /> Context Ready
                        </span>
                      </Badge>
                    ) : repoStatus?.ingestionStatus === "FAILED" ? (
                      <Badge variant="error" small>
                        <span className="flex items-center gap-1 font-mono">
                          <Icon name="alert" className="h-2.5 w-2.5" /> Indexing Paused
                        </span>
                      </Badge>
                    ) : (
                      <Badge variant="blue" small>
                        <span className="flex items-center gap-1.5 font-mono">
                          <Spinner size={10} /> Ingesting ({currentPercent}%)
                        </span>
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Progress Bar & DevMind Moving Arrow (Phases 11 & 12) */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between font-mono text-xs text-[#A7AA9B]">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[#C8D62B] font-bold">
                        {isCompleted ? "✓ Completed" : `→ Stage ${Math.min(6, currentStageNum)}/6:`}
                      </span>
                      <span className="text-[#F2F1E8]">
                        {progressData?.message || (isCompleted ? "All repository context indexed" : "Analyzing repository architecture...")}
                      </span>
                    </span>
                    <span className="font-bold text-[#C8D62B]">{currentPercent}%</span>
                  </div>

                  {/* Progress Track with Moving Arrow */}
                  <div className="relative pt-2 pb-5">
                    {/* Track Background */}
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#0E110F] border border-[#293024]">
                      <div
                        className="h-full bg-gradient-to-r from-[#8BC34A] to-[#C8D62B] transition-all duration-300 ease-out"
                        style={{ width: `${currentPercent}%` }}
                      />
                    </div>

                    {/* Moving Arrow (Phase 12) following actual percentage */}
                    <div
                      className="absolute top-4.5 transform -translate-x-1/2 transition-all duration-300 ease-out pointer-events-none"
                      style={{ left: `${Math.max(2, Math.min(98, currentPercent))}%` }}
                      aria-hidden="true"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-[12px] leading-none text-[#C8D62B]">▲</span>
                        <span className="font-mono text-[9px] font-bold text-[#C8D62B] bg-[#0E110F] border border-[#293024] px-1 py-0.5 rounded shadow whitespace-nowrap">
                          {currentPercent}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Real File Progress Counter & Active File Readout */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 font-mono text-xs">
                    <div className="text-[#A7AA9B] flex items-center gap-2">
                      <span className="text-[#6F756A]">Progress:</span>
                      <span className="text-[#F2F1E8] font-medium">
                        {progressData?.totalFiles
                          ? `${progressData.processedFiles.toLocaleString()} / ${progressData.totalFiles.toLocaleString()} files`
                          : repoStatus?.filesCount
                          ? `${repoStatus.filesCount.toLocaleString()} files`
                          : "Discovering file tree..."}
                      </span>
                      {progressData?.estimatedRemainingMs != null && progressData.estimatedRemainingMs > 0 && !isCompleted && (
                        <span className="text-[#6F756A] text-[11px]">
                          (~{Math.ceil(progressData.estimatedRemainingMs / 1000)}s remaining)
                        </span>
                      )}
                    </div>

                    {progressData?.elapsedMs != null && (
                      <div className="text-[#6F756A] text-[11px]">
                        Elapsed: {(progressData.elapsedMs / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>

                  {/* Active Processing File Path */}
                  {progressData?.currentFile && !isCompleted && (
                    <div className="mt-2 flex items-center gap-2 font-mono text-[11px] bg-[#0E110F] border border-[#293024] px-3 py-1.5 rounded text-[#A7AA9B] truncate">
                      <span className="text-[#C8D62B] font-bold shrink-0">➜</span>
                      <span className="text-[#6F756A] shrink-0">Currently processing:</span>
                      <span className="text-[#F2F1E8] truncate font-medium">{progressData.currentFile}</span>
                    </div>
                  )}
                </div>

                {/* Granular Stages Checklist (Phase 11) */}
                <div className="space-y-2 pt-3 border-t border-[#293024] font-mono text-xs">
                  {STAGES.map((st) => {
                    const isDone = isCompleted || currentStageNum > st.order;
                    const isActive = !isCompleted && currentStageNum === st.order;
                    return (
                      <div key={st.key} className="flex items-center justify-between py-0.5">
                        <div className="flex items-center gap-2.5">
                          {isDone ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#8BC34A]/20 text-[#8BC34A] text-[10px] font-bold">
                              ✓
                            </span>
                          ) : isActive ? (
                            <span className="flex h-4 w-4 items-center justify-center">
                              <Spinner size={11} />
                            </span>
                          ) : (
                            <span className="h-4 w-4 rounded-full border border-[#293024] flex items-center justify-center text-[9px] text-[#6F756A]">
                              {st.order}
                            </span>
                          )}
                          <span className={isDone ? "text-[#F2F1E8]" : isActive ? "text-[#C8D62B] font-medium" : "text-[#6F756A]"}>
                            {st.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#6F756A]">
                          {isDone ? "Completed" : isActive ? "Active..." : "Pending"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Phase 13: Optional Small Waiting Interaction - Catch the Bug */}
              {!isCompleted && repoStatus?.ingestionStatus !== "FAILED" && (
                <div className="rounded-lg border border-[#293024] bg-[#0E110F] p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between text-[#A7AA9B] font-mono text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span>Waiting for repository analysis? Squash the bug:</span>
                    </span>
                    <span className="text-[#C8D62B] font-bold">
                      {squashedCount > 0 ? `${squashedCount} squashed!` : "0 squashed"}
                    </span>
                  </div>
                  <div
                    className="relative h-16 w-full rounded border border-[#293024] bg-[#141813] overflow-hidden select-none cursor-pointer"
                    onClick={() => {
                      setSquashedCount((c) => c + 1);
                      setBugHitAnim(true);
                      setTimeout(() => setBugHitAnim(false), 600);
                      setBugPosition({
                        x: Math.floor(Math.random() * 80) + 10,
                        y: Math.floor(Math.random() * 60) + 15,
                      });
                    }}
                  >
                    <div
                      className="absolute transition-all duration-300 ease-out transform -translate-x-1/2 -translate-y-1/2 text-xl hover:scale-125 active:scale-90"
                      style={{ left: `${bugPosition.x}%`, top: `${bugPosition.y}%` }}
                      title="Click to squash!"
                    >
                      🐞
                    </div>
                    {bugHitAnim && (
                      <div
                        className="absolute font-mono text-[11px] font-bold text-[#C8D62B] animate-ping"
                        style={{ left: `${bugPosition.x}%`, top: `${Math.max(10, bugPosition.y - 20)}%` }}
                      >
                        +1 Squashed!
                      </div>
                    )}
                    <div className="absolute bottom-1 right-2 font-mono text-[9px] text-[#6F756A] pointer-events-none">
                      Click the bug to pass the time
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 14: Completion UI with Real Statistics */}
              {isCompleted && (
                <div className="rounded-lg border border-[#8BC34A]/30 bg-[#8BC34A]/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#8BC34A]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8BC34A]/20">✓</span>
                    <span>Repository successfully analyzed</span>
                  </div>
                  <p className="text-xs text-[#A7AA9B] leading-relaxed">
                    DevMind has synthesized the repository architecture, extracted module boundaries, and indexed dependencies.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
                    <div className="bg-[#0E110F] border border-[#293024] p-2.5 rounded">
                      <div className="text-[10px] text-[#6F756A]">Files</div>
                      <div className="text-sm font-bold text-[#F2F1E8]">
                        {(repoStatus?.filesCount ?? progressData?.totalFiles ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#0E110F] border border-[#293024] p-2.5 rounded">
                      <div className="text-[10px] text-[#6F756A]">Modules</div>
                      <div className="text-sm font-bold text-[#C8D62B]">
                        {(repoStatus?.modulesCount ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#0E110F] border border-[#293024] p-2.5 rounded">
                      <div className="text-[10px] text-[#6F756A]">Dependencies</div>
                      <div className="text-sm font-bold text-[#4A90E2]">
                        {(repoStatus?.depsCount ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#0E110F] border border-[#293024] p-2.5 rounded">
                      <div className="text-[10px] text-[#6F756A]">Indexing Time</div>
                      <div className="text-sm font-bold text-[#F2F1E8]">
                        {progressData?.elapsedMs ? `${(progressData.elapsedMs / 1000).toFixed(1)}s` : "Complete"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 15: Error recovery card if failed */}
              {repoStatus?.ingestionStatus === "FAILED" && (
                <div
                  role="alert"
                  className="rounded-lg border border-[#D85C55]/30 bg-[#D85C55]/10 p-4 text-xs text-[#D85C55] space-y-3"
                >
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Icon name="alert" className="h-4 w-4" />
                    <span>Repository ingestion failed</span>
                  </div>
                  <div className="space-y-1">
                    <div className="font-mono text-[11px] text-[#A7AA9B]">
                      Failed at stage: <span className="text-[#F2F1E8] font-semibold">{progressData?.stage || "Processing"}</span>
                    </div>
                    <p className="text-[#A7AA9B] leading-relaxed">
                      {repoStatus.ingestionError || progressData?.error || "An unexpected issue occurred while parsing this repository."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isRetrying}
                      onClick={handleRetryIngestion}
                    >
                      {isRetrying ? (
                        <span className="flex items-center gap-1.5">
                          <Spinner size={11} /> Retrying...
                        </span>
                      ) : (
                        <span>Retry analysis</span>
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push("/onboarding?step=repository")}
                    >
                      Choose another repository
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3 Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-[#293024]">
              <span className="font-mono text-xs text-[#6F756A]">
                {isCompleted
                  ? "Workspace ready"
                  : repoStatus?.ingestionStatus === "FAILED"
                  ? "Setup paused"
                  : "Indexing runs reliably in the background"}
              </span>

              <Button
                variant="primary"
                size="md"
                disabled={completingOnboarding || (!isCompleted && repoStatus?.ingestionStatus !== "FAILED")}
                onClick={async () => {
                  await markOnboardingComplete();
                  const targetUrl = analyzingRepoId
                    ? `/app/overview?repoId=${encodeURIComponent(analyzingRepoId)}`
                    : "/app/overview";
                  router.push(targetUrl);
                }}
                className="min-w-[160px]"
              >
                {completingOnboarding ? (
                  <span className="flex items-center gap-2">
                    <Spinner size={13} /> Finalizing...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-medium">
                    Open workspace <Icon name="arrowRight" className="h-3.5 w-3.5" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        );
      })()}
    </OnboardingShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#090B0A]">
          <Spinner size={20} />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
