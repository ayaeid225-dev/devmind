"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Icon,
  Badge,
  Button,
  Card,
  ProgressBar,
  Skeleton,
  EmptyState,
  useToast,
  type BadgeVariant,
} from "@/components/ui";
import { useShell } from "@/lib/shell-context";
import {
  generateOnboardingPath,
  CATEGORY_LABELS,
  CATEGORY_BADGES,
  type OnboardingPath,
  type OnboardingStep,
  type OnboardingCategory,
} from "@/lib/onboarding-helper";
import type { RepositoryKnowledgeView } from "@/lib/server/knowledge/types";

// ============================================================================
// LOCAL STORAGE PROGRESS TRACKING (REPO-SCOPED)
// ============================================================================

function getStoredProgress(repoId: string): string[] {
  if (typeof window === "undefined" || !repoId) return [];
  try {
    const raw = localStorage.getItem(`devmind_onboarding_${repoId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredProgress(repoId: string, completedStepIds: string[]): void {
  if (typeof window === "undefined" || !repoId) return;
  try {
    localStorage.setItem(`devmind_onboarding_${repoId}`, JSON.stringify(completedStepIds));
  } catch {
    // Ignore localStorage write quota errors
  }
}

// ============================================================================
// MAIN ONBOARDING CONTENT COMPONENT
// ============================================================================

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { activeRepoId, activeRepo } = useShell();

  // Dynamic repository resolution: URL searchParam -> Shell activeRepoId -> Shell activeRepo name
  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo?.name || "";

  const [graphData, setGraphData] = useState<RepositoryKnowledgeView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);

  // Load knowledge graph data whenever the active repository changes
  useEffect(() => {
    let ignore = false;

    async function fetchKnowledgeGraph() {
      if (!currentRepoId) {
        setLoading(false);
        setGraphData(null);
        return;
      }

      setLoading(true);
      setError(null);
      setActiveStepIndex(0);

      // Load repository-isolated progress
      const saved = getStoredProgress(currentRepoId);
      setCompletedStepIds(saved);

      try {
        const res = await fetch(`/api/knowledge/graph?repoId=${encodeURIComponent(currentRepoId)}`);
        const json = await res.json();

        if (ignore) return;

        if (json.success && json.data) {
          setGraphData(json.data);
        } else {
          setError(json.error || "Failed to load project knowledge for onboarding");
          setGraphData(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load knowledge model");
          setGraphData(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchKnowledgeGraph();

    return () => {
      ignore = true;
    };
  }, [currentRepoId]);

  // Generate dynamic onboarding path from knowledge graph
  const onboardingPath: OnboardingPath | null = useMemo(() => {
    if (!graphData) return null;
    return generateOnboardingPath(graphData, { repoIdOverride: currentRepoId });
  }, [graphData, currentRepoId]);

  const steps = onboardingPath?.steps || [];
  const totalSteps = steps.length;
  const activeStep: OnboardingStep | null = steps[activeStepIndex] || steps[0] || null;

  // Completion calculation
  const completedCount = useMemo(() => {
    const validIds = new Set(steps.map((s) => s.id));
    return completedStepIds.filter((id) => validIds.has(id)).length;
  }, [completedStepIds, steps]);

  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isAllComplete = totalSteps > 0 && completedCount === totalSteps;

  // Find next uncompleted step
  const nextUncompletedIndex = useMemo(() => {
    const set = new Set(completedStepIds);
    const idx = steps.findIndex((s) => !set.has(s.id));
    return idx >= 0 ? idx : 0;
  }, [steps, completedStepIds]);

  // Toggle step completion
  const handleToggleComplete = (stepId: string) => {
    const exists = completedStepIds.includes(stepId);
    const next = exists
      ? completedStepIds.filter((id) => id !== stepId)
      : [...completedStepIds, stepId];

    setCompletedStepIds(next);
    saveStoredProgress(currentRepoId, next);

    if (!exists) {
      toast("Milestone marked as understood!", "success");
      // Auto-advance if not at the end
      if (activeStepIndex < totalSteps - 1) {
        setActiveStepIndex((prev) => prev + 1);
      }
    }
  };

  const handleResetProgress = () => {
    setCompletedStepIds([]);
    saveStoredProgress(currentRepoId, []);
    setActiveStepIndex(0);
    toast("Onboarding progress reset", "info");
  };

  // --------------------------------------------------------------------------
  // RENDER: Loading State
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="fade-up">
        <div className="page-head mb24">
          <Skeleton style={{ height: 32, width: 340, marginBottom: 8 }} />
          <Skeleton style={{ height: 18, width: 560 }} />
        </div>
        <Card className="mb24" pad>
          <Skeleton style={{ height: 60, width: "100%" }} />
        </Card>
        <div className="row gap24" style={{ alignItems: "flex-start" }}>
          <div style={{ width: 360, flexShrink: 0 }}>
            <Skeleton style={{ height: 420, width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <Skeleton style={{ height: 500, width: "100%" }} />
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: No Repository Selected
  // --------------------------------------------------------------------------
  if (!currentRepoId) {
    return (
      <div className="fade-up">
        <EmptyState
          title="No Repository Connected"
          sub="Connect or select a repository from the workspace dropdown to generate a real, architecture-aware developer onboarding curriculum."
          icon="git"
        >
          <div className="mt16">
            <Button variant="primary" size="sm" onClick={() => router.push("/repos")}>
              Select Repository
            </Button>
          </div>
        </EmptyState>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: Empty or Incomplete Repository
  // --------------------------------------------------------------------------
  if (error || !onboardingPath || onboardingPath.isEmpty) {
    return (
      <div className="fade-up">
        <div className="page-head mb24">
          <h1 className="page-title">Developer Onboarding: {currentRepoId}</h1>
          <p className="page-sub">
            A guided, architecture-aware onboarding curriculum generated dynamically from the repository knowledge model.
          </p>
        </div>
        <EmptyState
          title="Knowledge Graph Incomplete"
          sub={
            error ||
            onboardingPath?.emptyReason ||
            "No modules or files have been indexed for this repository yet. Run repository ingestion or verify the repository structure."
          }
          icon="brain"
        >
          <div className="mt16">
            <Button variant="primary" size="sm" onClick={() => router.push("/repos")}>
              View Repositories
            </Button>
          </div>
        </EmptyState>
      </div>
    );
  }

  const { summary } = onboardingPath;

  // --------------------------------------------------------------------------
  // RENDER: Active Onboarding Experience
  // --------------------------------------------------------------------------
  return (
    <div className="fade-up">
      {/* 1. Header & Architecture Badges */}
      <div className="page-head">
        <div className="row between align-center wrap gap12">
          <div>
            <div className="row gap8 align-center mb8">
              <Badge variant="cyan" small dot>
                {summary.architectureType}
              </Badge>
              <Badge variant="gray" small>
                {summary.totalSteps} Milestones • ~{summary.estimatedMinutes} mins
              </Badge>
              {onboardingPath.startingPoint && (
                <Badge variant="lime" small>
                  Starts at: {onboardingPath.startingPoint.title}
                </Badge>
              )}
            </div>
            <h1 className="page-title">Developer Onboarding: {onboardingPath.repoName}</h1>
            <p className="page-sub">
              Senior engineer walkthrough through the codebase architecture, entry points, core domain logic, and dependencies.
            </p>
          </div>

          <div className="row gap8 align-center">
            <Link
              href={`/app/map?repoId=${encodeURIComponent(currentRepoId)}`}
              className="btn btn-outline btn-sm"
              style={{ textDecoration: "none" }}
            >
              <Icon name="map" className="ic-sm" /> Architecture Map
            </Link>
            {completedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleResetProgress} title="Reset your completion checkmarks">
                <Icon name="refresh" className="ic-sm" /> Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Onboarding Progress Bar */}
      <div className="card card-pad mb24">
        <div className="row between align-center wrap gap12">
          <div>
            <div className="row gap8 align-center">
              <b style={{ fontSize: 15 }}>
                {completedCount} of {totalSteps} milestones understood ({progressPct}%)
              </b>
              {isAllComplete && (
                <Badge variant="success" small dot>
                  Curriculum Complete
                </Badge>
              )}
            </div>
            <div className="t3 small mt6">
              {isAllComplete ? (
                "You have explored the primary architecture, entry points, and domain boundaries of this project."
              ) : (
                <>
                  Up next:{" "}
                  <b className="t2">
                    Step {steps[nextUncompletedIndex]?.stepNumber}: {steps[nextUncompletedIndex]?.title}
                  </b>
                  {" — "}
                  <span className="t3">{steps[nextUncompletedIndex]?.categoryLabel}</span>
                </>
              )}
            </div>
          </div>

          {!isAllComplete && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveStepIndex(nextUncompletedIndex)}
            >
              Jump to Next Milestone <Icon name="arrowRight" className="ic-sm" />
            </Button>
          )}
        </div>

        <div className="mt16">
          <ProgressBar value={progressPct} />
        </div>
      </div>

      {/* 3. Main Onboarding Split View: Curriculum Stepper & Active Detail Panel */}
      <div className="row gap24" style={{ alignItems: "flex-start" }}>
        {/* Left Column: Ordered Onboarding Steps Curriculum */}
        <div style={{ width: 340, flexShrink: 0 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border-soft)",
                background: "var(--surface)",
              }}
              className="row between align-center"
            >
              <b style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em" }} className="t3">
                Curriculum Steps ({totalSteps})
              </b>
              <span className="tiny t3 font-mono">Ordered by Dependency</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((step, idx) => {
                const isActive = idx === activeStepIndex;
                const isDone = completedStepIds.includes(step.id);
                const badgeVar = CATEGORY_BADGES[step.category] || "gray";

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepIndex(idx)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 16px",
                      background: isActive
                        ? "rgba(139, 195, 74, 0.08)"
                        : isDone
                        ? "rgba(255, 255, 255, 0.01)"
                        : "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border-soft)",
                      borderLeft: isActive ? "3px solid var(--brand)" : "3px solid transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      width: "100%",
                    }}
                  >
                    {/* Step number badge / check */}
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        fontFamily: "var(--mono)",
                        fontWeight: 600,
                        flexShrink: 0,
                        background: isDone
                          ? "rgba(139, 195, 74, 0.16)"
                          : isActive
                          ? "var(--brand)"
                          : "var(--surface)",
                        color: isDone
                          ? "var(--success)"
                          : isActive
                          ? "#000"
                          : "var(--text-3)",
                        border: isDone
                          ? "1px solid rgba(139, 195, 74, 0.4)"
                          : "1px solid var(--border)",
                      }}
                    >
                      {isDone ? <Icon name="check" className="ic-xs" /> : `0${step.stepNumber}`}
                    </span>

                    {/* Step info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row between align-center gap4 mb4">
                        <span
                          style={{
                            fontWeight: isActive ? 600 : 500,
                            fontSize: 13.5,
                            color: isActive ? "var(--text-1)" : "var(--text-2)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {step.title}
                        </span>
                        <Badge variant={badgeVar} small>
                          {step.category}
                        </Badge>
                      </div>

                      <div className="tiny t3 line-clamp-1 mb4">
                        {step.isStartingPoint ? (
                          <span style={{ color: "var(--brand)", fontWeight: 500 }}>
                            ★ Entry point • {step.stats.filesCount} files
                          </span>
                        ) : (
                          `${step.stats.filesCount} files • ${step.stats.dependenciesCount} deps`
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Deep-Dive Active Step Detail Panel */}
        {activeStep && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="card" style={{ overflow: "hidden" }}>
              {/* Active Step Header */}
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid var(--border-soft)",
                  background: "var(--surface)",
                }}
              >
                <div className="row between align-center wrap gap12">
                  <div>
                    <div className="row gap8 align-center mb8">
                      <span
                        className="font-mono t3"
                        style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}
                      >
                        Step {activeStep.stepNumber} of {totalSteps}
                      </span>
                      <Badge variant={CATEGORY_BADGES[activeStep.category]} small>
                        {activeStep.categoryLabel}
                      </Badge>
                      {activeStep.isStartingPoint && (
                        <Badge variant="lime" small dot>
                          Recommended Starting Point
                        </Badge>
                      )}
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
                      {activeStep.title}
                    </h2>
                  </div>

                  <div className="row gap8 align-center">
                    <Button
                      variant={completedStepIds.includes(activeStep.id) ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => handleToggleComplete(activeStep.id)}
                    >
                      <Icon
                        name={completedStepIds.includes(activeStep.id) ? "checkCircle" : "check"}
                        className="ic-sm"
                      />
                      {completedStepIds.includes(activeStep.id)
                        ? "Understood ✓"
                        : "Mark as Understood"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step Body */}
              <div style={{ padding: "24px" }} className="flex flex-col gap24">
                {/* 1. Architectural Role & Why It Matters */}
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }} className="t3 mb12">
                    Architectural Role
                  </h3>
                  <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-1)", margin: "0 0 16px 0" }}>
                    {activeStep.roleExplanation}
                  </p>

                  <div
                    style={{
                      background: "rgba(139, 195, 74, 0.06)",
                      border: "1px solid rgba(139, 195, 74, 0.25)",
                      borderRadius: 8,
                      padding: "14px 18px",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={{ color: "var(--brand)", marginTop: 2, flexShrink: 0 }}>
                      <Icon name="brain" className="ic-sm" />
                    </span>
                    <div>
                      <b style={{ fontSize: 13.5, color: "var(--text-1)", display: "block", marginBottom: 4 }}>
                        Why this matters in understanding {onboardingPath.repoName}
                      </b>
                      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>
                        {activeStep.whyItMatters}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Architecture Context: Dependencies & Dependents */}
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }} className="t3 mb12">
                    System Architecture Context
                  </h3>

                  <div className="grid grid-2 gap16">
                    {/* Dependencies (Outgoing) */}
                    <div
                      style={{
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border-soft)",
                        borderRadius: 8,
                        padding: 14,
                      }}
                    >
                      <div className="row between align-center mb8">
                        <span style={{ fontSize: 12, fontWeight: 600 }} className="t3">
                          Depends On ({activeStep.dependencies.length})
                        </span>
                        <span className="tiny t3">Outgoing connections</span>
                      </div>
                      {activeStep.dependencies.length > 0 ? (
                        <div className="flex flex-col gap6">
                          {activeStep.dependencies.slice(0, 6).map((dep) => (
                            <div
                              key={dep.id}
                              className="row between align-center gap8"
                              style={{
                                padding: "6px 10px",
                                background: "var(--surface)",
                                borderRadius: 6,
                                border: "1px solid var(--border-soft)",
                                fontSize: 12,
                              }}
                            >
                              <div className="row gap6 align-center min-w-0">
                                <Icon
                                  name={dep.type === "Dependency" ? "deps" : "modules"}
                                  className="ic-xs t3"
                                />
                                <span className="font-mono text-ellipsis" style={{ color: "var(--text-1)" }}>
                                  {dep.name}
                                </span>
                              </div>
                              <span className="tiny t3 font-mono">{dep.relationLabel}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="tiny t3 p8">No internal or external dependencies. Decoupled module.</div>
                      )}
                    </div>

                    {/* Dependents (Incoming) */}
                    <div
                      style={{
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border-soft)",
                        borderRadius: 8,
                        padding: 14,
                      }}
                    >
                      <div className="row between align-center mb8">
                        <span style={{ fontSize: 12, fontWeight: 600 }} className="t3">
                          Required By / Dependents ({activeStep.dependents.length})
                        </span>
                        <span className="tiny t3">Inbound callers</span>
                      </div>
                      {activeStep.dependents.length > 0 ? (
                        <div className="flex flex-col gap6">
                          {activeStep.dependents.slice(0, 6).map((dep) => (
                            <div
                              key={dep.id}
                              className="row between align-center gap8"
                              style={{
                                padding: "6px 10px",
                                background: "var(--surface)",
                                borderRadius: 6,
                                border: "1px solid var(--border-soft)",
                                fontSize: 12,
                              }}
                            >
                              <div className="row gap6 align-center min-w-0">
                                <Icon name="modules" className="ic-xs t3" />
                                <span className="font-mono text-ellipsis" style={{ color: "var(--text-1)" }}>
                                  {dep.name}
                                </span>
                              </div>
                              <span className="tiny t3 font-mono">Consumer</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="tiny t3 p8">No internal modules depend on this. Top-level consumer.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Code Navigation: Key Files & Symbols */}
                <div>
                  <div className="row between align-center mb12">
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        margin: 0,
                      }}
                      className="t3"
                    >
                      Key Code Locations ({activeStep.files.length} Files)
                    </h3>
                    <Link
                      href={`/app/files?repoId=${encodeURIComponent(currentRepoId)}`}
                      className="tiny font-mono t2"
                      style={{ textDecoration: "none" }}
                    >
                      Browse all files →
                    </Link>
                  </div>

                  <div className="flex flex-col gap8">
                    {activeStep.files.map((file) => (
                      <div
                        key={file.id}
                        className="row between align-center gap12"
                        style={{
                          padding: "10px 14px",
                          background: "var(--surface)",
                          borderRadius: 8,
                          border: "1px solid var(--border-soft)",
                        }}
                      >
                        <div className="row gap8 align-center min-w-0">
                          <Icon name="file" className="ic-sm t3 flex-shrink-0" />
                          <div className="min-w-0">
                            <span
                              style={{
                                fontWeight: 500,
                                fontSize: 13,
                                color: "var(--text-1)",
                                display: "block",
                              }}
                              className="text-ellipsis"
                            >
                              {file.filePath || file.name}
                            </span>
                            {file.subLabel && (
                              <span className="tiny t3 font-mono block text-ellipsis">
                                {file.subLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="row gap6 align-center flex-shrink-0">
                          <Link
                            href={`/app/map?repoId=${encodeURIComponent(currentRepoId)}&node=${encodeURIComponent(file.id)}`}
                            className="btn btn-ghost btn-xs"
                            title="Inspect in Project Map"
                            style={{ textDecoration: "none" }}
                          >
                            <Icon name="map" className="ic-xs" /> Map
                          </Link>
                          <Link
                            href={`/app/files?repoId=${encodeURIComponent(currentRepoId)}&search=${encodeURIComponent(file.name)}`}
                            className="btn btn-ghost btn-xs"
                            title="Open in Files"
                            style={{ textDecoration: "none" }}
                          >
                            <Icon name="file" className="ic-xs" /> Code
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Contained AST Classes & Functions (if present) */}
                {(activeStep.classes.length > 0 || activeStep.functions.length > 0) && (
                  <div>
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        margin: "0 0 12px 0",
                      }}
                      className="t3"
                    >
                      Key Classes & Domain Functions
                    </h3>
                    <div className="row gap8 wrap">
                      {activeStep.classes.map((cls) => (
                        <Link
                          key={cls.id}
                          href={cls.href}
                          style={{
                            textDecoration: "none",
                            padding: "5px 10px",
                            borderRadius: 6,
                            background: "rgba(120, 150, 216, 0.1)",
                            border: "1px solid rgba(120, 150, 216, 0.3)",
                            fontSize: 12,
                            fontFamily: "var(--mono)",
                            color: "var(--text-1)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ color: "#7896D8", fontWeight: 600 }}>class</span>
                          <span>{cls.name}</span>
                        </Link>
                      ))}
                      {activeStep.functions.map((fn) => (
                        <Link
                          key={fn.id}
                          href={fn.href}
                          style={{
                            textDecoration: "none",
                            padding: "5px 10px",
                            borderRadius: 6,
                            background: "rgba(214, 167, 44, 0.1)",
                            border: "1px solid rgba(214, 167, 44, 0.3)",
                            fontSize: 12,
                            fontFamily: "var(--mono)",
                            color: "var(--text-1)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ color: "#D6A72C", fontWeight: 600 }}>fn</span>
                          <span>{fn.name}()</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step Navigation Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid var(--border-soft)",
                  background: "var(--surface)",
                }}
                className="row between align-center wrap gap12"
              >
                <div>
                  {activeStepIndex > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveStepIndex((prev) => prev - 1)}
                    >
                      <Icon name="arrowLeft" className="ic-sm" /> Previous: Step {steps[activeStepIndex - 1]?.stepNumber}
                    </Button>
                  ) : (
                    <span className="tiny t3">First Milestone</span>
                  )}
                </div>

                <div className="row gap8 align-center">
                  <Link
                    href={activeStep.mapHref}
                    className="btn btn-outline btn-sm"
                    style={{ textDecoration: "none" }}
                  >
                    <Icon name="map" className="ic-sm" /> View in Project Map
                  </Link>
                  {activeStep.entityType === "Module" && (
                    <Link
                      href={activeStep.primaryHref}
                      className="btn btn-outline btn-sm"
                      style={{ textDecoration: "none" }}
                    >
                      <Icon name="modules" className="ic-sm" /> Module Details
                    </Link>
                  )}
                  {activeStepIndex < totalSteps - 1 && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveStepIndex((prev) => prev + 1)}
                    >
                      Next: Step {steps[activeStepIndex + 1]?.stepNumber}{" "}
                      <Icon name="arrowRight" className="ic-sm" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LearningPage() {
  return (
    <Suspense
      fallback={
        <div className="fade-up">
          <Skeleton style={{ height: 32, width: 300, marginBottom: 12 }} />
          <Skeleton style={{ height: 18, width: 480, marginBottom: 24 }} />
          <Skeleton style={{ height: 380, width: "100%" }} />
        </div>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}
