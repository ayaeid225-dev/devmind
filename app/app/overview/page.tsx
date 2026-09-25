"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Icon,
  Badge,
  MetricCard,
  Button,
  Input,
  type BadgeVariant,
} from "@/components/ui";
import { buildDynamicMapData } from "@/lib/map-helper";
import { ASK_SUGGESTIONS } from "@/data/fixtures";
import type { ModuleFixture, ModuleType } from "@/data/types";
import {
  ProjectMapCanvas,
  type ProjectMapCanvasRef,
} from "@/components/map";
import { useShell } from "@/lib/shell-context";

const BADGE_MAP: Record<ModuleType, { variant: BadgeVariant; label: string }> = {
  core: { variant: "lime", label: "Core" },
  api: { variant: "cyan", label: "API" },
  db: { variant: "blue", label: "DB" },
  ext: { variant: "amber", label: "Ext" },
};

interface RepoInfo {
  id: string;
  name: string;
  owner: string;
  defaultBranch: string;
  filesCount: number;
  modulesCount: number;
  depsCount: number;
  contributorsCount?: number;
  gitSyncStatus?: string;
  syncStatus?: string;
  latestCommitSha?: string;
  lastSyncedCommitSha?: string;
  lastGitSyncAt?: string;
  lastSuccessfulSyncAt?: string;
  lastSyncSummary?: string;
}

function OverviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapRef = useRef<ProjectMapCanvasRef>(null);
  const { activeRepoId, activeRepo } = useShell();

  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;

  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [modulesCount, setModulesCount] = useState<number>(0);
  const [depsCount, setDepsCount] = useState<number>(0);
  const [devsCount, setDevsCount] = useState<number>(0);
  const [filesCount, setFilesCount] = useState<number>(0);

  const [mapData, setMapData] = useState<ReturnType<typeof buildDynamicMapData>>({
    nodes: [],
    edges: [],
    world: { w: 1200, h: 800 },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<ModuleFixture | null>(null);
  const [questionInput, setQuestionInput] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadOverviewData() {
      if (!currentRepoId) return;

      try {
        const [reposRes, modsRes, depsRes, devsRes, filesRes] = await Promise.all([
          fetch("/api/repositories"),
          fetch(`/api/modules?repoId=${encodeURIComponent(currentRepoId)}`),
          fetch(`/api/deps?repoId=${encodeURIComponent(currentRepoId)}`),
          fetch(`/api/devs?repoId=${encodeURIComponent(currentRepoId)}`),
          fetch(`/api/files?repoId=${encodeURIComponent(currentRepoId)}`),
        ]);

        const reposData = await reposRes.json();
        const modsData = await modsRes.json();
        const depsData = await depsRes.json();
        const devsData = await devsRes.json();
        const filesData = await filesRes.json();

        if (!ignore) {
          if (reposData.success && Array.isArray(reposData.data)) {
            const found = reposData.data.find((r: RepoInfo) => r.id === currentRepoId || r.name === currentRepoId);
            if (found) setRepoInfo(found);
          }

          const dbModules = modsData.success && Array.isArray(modsData.data) ? modsData.data : [];
          const dbDeps = depsData.success && Array.isArray(depsData.data) ? depsData.data : [];
          const dbDevs = devsData.success && Array.isArray(devsData.data) ? devsData.data : [];
          const dbFiles = filesData.success && Array.isArray(filesData.data) ? filesData.data : [];

          setModulesCount(dbModules.length);
          setDepsCount(dbDeps.length);
          setDevsCount(dbDevs.length);
          setFilesCount(dbFiles.length);

          const dynamicMap = buildDynamicMapData(dbModules, dbDeps);
          setMapData(dynamicMap);
        }
      } catch (err) {
        console.error("Overview data load error:", err);
      }
    }

    loadOverviewData();

    return () => {
      ignore = true;
    };
  }, [currentRepoId]);

  const handleAskSubmit = (q?: string) => {
    const query = q || questionInput.trim();
    if (!query) return;
    router.push(`/app/ask?q=${encodeURIComponent(query)}&repoId=${encodeURIComponent(currentRepoId)}`);
  };

  const titleName = currentRepoId
    ? currentRepoId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : "Project Intelligence";

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head row between align-center" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">{titleName}</h1>
          <p className="page-sub mono">
            {repoInfo?.defaultBranch || "main"} • Connected repository: <b className="mono">{currentRepoId}</b>
          </p>
        </div>
        <div className="row gap8 align-center">
          {repoInfo?.gitSyncStatus === "SYNCING" ? (
            <Badge variant="amber">
              <span className="dot" />
              Syncing changes…
            </Badge>
          ) : repoInfo?.gitSyncStatus === "FAILED" ? (
            <Badge variant="error">
              <Icon name="alert" className="ic-sm" />
              Sync failed
            </Badge>
          ) : (
            <Badge variant="lime">
              <Icon name="checkCircle" className="ic-sm" />
              {repoInfo?.lastSyncSummary || "Synchronized"}
            </Badge>
          )}
          {repoInfo?.latestCommitSha && (
            <span
              className="mono t3 tiny"
              title={`Latest Synced Commit: ${repoInfo.latestCommitSha}`}
              style={{ padding: "4px 8px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4 }}
            >
              SHA: {repoInfo.latestCommitSha.slice(0, 7)}
            </span>
          )}
        </div>
      </div>

      {/* Metric Grid */}
      <div className="metric-grid">
        <MetricCard
          icon="file"
          value={filesCount || repoInfo?.filesCount || 0}
          label="Files indexed"
          delta="verified"
          deltaTone="up"
        />
        <MetricCard
          icon="modules"
          value={modulesCount || repoInfo?.modulesCount || 0}
          label="Modules detected"
          delta="architecture mapped"
          deltaTone="flat"
        />
        <MetricCard
          icon="deps"
          value={depsCount || repoInfo?.depsCount || 0}
          label="Dependencies"
          delta="internal & external"
          deltaTone="flat"
        />
        <MetricCard
          icon="users"
          value={devsCount || repoInfo?.contributorsCount || 0}
          label="Contributors"
          delta="tracked"
          deltaTone="up"
        />
      </div>

      {/* Overview Map Card */}
      <div className="card overview-map" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <div className="sec-title">Project Intelligence Map</div>
            <div className="sec-sub">
              Modules and dependencies for <b className="mono">{currentRepoId}</b>.
            </div>
          </div>

          <div className="om-toolbar">
            <Input
              icon="search"
              placeholder="Search modules…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 190, height: 32 }}
            />
            <Button
              variant="secondary"
              size="sm"
              id="om-focus"
              disabled={!selectedNode}
              onClick={() => selectedNode && mapRef.current?.focus(selectedNode.id)}
            >
              Focus selection
            </Button>
            <Link href={`/app/map?repoId=${encodeURIComponent(currentRepoId)}`}>
              <Button variant="secondary" size="sm">
                <Icon name="external" className="ic-sm" /> Open in Project Map
              </Button>
            </Link>
          </div>
        </div>

        {/* Map Canvas */}
        <div className="om-canvas" id="overview-map" style={{ position: "relative", height: 420 }}>
          {mapData.nodes.length === 0 ? (
            <div className="state" style={{ height: "100%", justifyContent: "center" }}>
              <span className="st-ic">
                <Icon name="modules" className="ic-lg" />
              </span>
              <div className="st-title">No module data ingested yet</div>
              <div className="st-sub">
                Re-index repository {currentRepoId} to generate architecture modules.
              </div>
            </div>
          ) : (
            <ProjectMapCanvas
              ref={mapRef}
              nodes={mapData.nodes}
              edges={mapData.edges}
              world={mapData.world}
              interactive
              minimap
              nodeWidth={170}
              selectedId={selectedNode?.id}
              onSelect={setSelectedNode}
              filterQuery={searchQuery}
            />
          )}

          {/* Quick Selected Module Overlay Panel */}
          {selectedNode && (
            <div
              className="card"
              style={{
                position: "absolute",
                left: 18,
                bottom: 18,
                width: 300,
                zIndex: 25,
                boxShadow: "var(--shadow-2)",
              }}
            >
              <div className="card-body" style={{ padding: 14 }}>
                <div className="row between align-center">
                  <b style={{ fontSize: 13.5 }}>{selectedNode.name}</b>
                  <Badge variant={BADGE_MAP[selectedNode.type]?.variant || "lime"}>
                    <span className="dot" />
                    {BADGE_MAP[selectedNode.type]?.label || selectedNode.type}
                  </Badge>
                </div>
                <div className="t3 tiny mt8">{selectedNode.desc}</div>
                <div
                  className="row mt12"
                  style={{
                    gap: 16,
                    fontSize: 11.5,
                    color: "var(--text-3)",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  <span>{selectedNode.files} files</span>
                  <span>{(selectedNode.deps || []).length} deps</span>
                  <span>{(selectedNode.dependents || []).length} dependents</span>
                </div>
                <div className="row mt12 gap8">
                  <Link href={`/app/modules/${selectedNode.id}?repoId=${encodeURIComponent(currentRepoId)}`}>
                    <Button variant="primary" size="sm">
                      View Module
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => mapRef.current?.focus(selectedNode.id)}
                  >
                    Focus
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ask DevMind Prompt Box */}
      <div className="mt24 ask-box">
        <div className="ask-head">
          <span className="cpu">
            <Icon name="brain" />
          </span>
          <div>
            <div className="sec-title">Ask DevMind AI Assistant ({currentRepoId})</div>
            <div className="sec-sub">
              Questions about repository <b className="mono">{currentRepoId}</b> — answered with real code evidence.
            </div>
          </div>
        </div>

        <div className="ask-suggest" id="om-suggests">
          {ASK_SUGGESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              className="chip"
              onClick={() => handleAskSubmit(q)}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="ask-input-row">
          <Input
            id="om-question"
            placeholder={`Ask anything about ${currentRepoId}…`}
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAskSubmit();
            }}
          />
          <Button
            variant="primary"
            id="om-ask"
            onClick={() => handleAskSubmit()}
          >
            <Icon name="arrowRight" /> Ask AI
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <OverviewPageContent />
    </Suspense>
  );
}
