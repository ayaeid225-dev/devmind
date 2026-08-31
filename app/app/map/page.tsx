"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Icon,
  Badge,
  Button,
  Input,
  type BadgeVariant,
} from "@/components/ui";
import { buildDynamicMapData } from "@/lib/map-helper";
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

function MapPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapRef = useRef<ProjectMapCanvasRef>(null);
  const { activeRepoId, activeRepo } = useShell();

  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedNode, setSelectedNode] = useState<ModuleFixture | null>(null);

  const [mapData, setMapData] = useState<ReturnType<typeof buildDynamicMapData>>({
    nodes: [],
    edges: [],
    world: { w: 1200, h: 800 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function fetchMapData() {
      if (!currentRepoId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [modsRes, depsRes] = await Promise.all([
          fetch(`/api/modules?repoId=${encodeURIComponent(currentRepoId)}`),
          fetch(`/api/deps?repoId=${encodeURIComponent(currentRepoId)}`),
        ]);
        const modsData = await modsRes.json();
        const depsData = await depsRes.json();

        if (!ignore) {
          const dbModules = modsData.success && Array.isArray(modsData.data) ? modsData.data : [];
          const dbDeps = depsData.success && Array.isArray(depsData.data) ? depsData.data : [];

          const dynamicData = buildDynamicMapData(dbModules, dbDeps);
          setMapData(dynamicData);
        }
      } catch {
        if (!ignore) {
          setMapData({ nodes: [], edges: [], world: { w: 1200, h: 800 } });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchMapData();
    return () => {
      ignore = true;
    };
  }, [currentRepoId]);

  const getModuleById = (id: string): ModuleFixture | undefined => {
    return mapData.nodes.find((m) => m.id === id);
  };

  const hasMatches = mapData.nodes.some((n) => {
    if (filterType !== "all" && n.type !== filterType) return false;
    if (
      searchQuery &&
      !n.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !n.id.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="map-screen">
      {/* Map Toolbar */}
      <div className="map-toolbar">
        <Link href={`/app/overview?repoId=${encodeURIComponent(currentRepoId)}`}>
          <Button variant="ghost" size="sm">
            <Icon name="arrowLeft" className="ic-sm" /> Overview ({currentRepoId})
          </Button>
        </Link>

        <Input
          icon="search"
          placeholder="Search modules…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 220, height: 32 }}
        />

        <div className="chips row gap8" id="fm-filters">
          <button
            type="button"
            className={`chip ${filterType === "all" ? "chip-active" : ""}`}
            onClick={() => setFilterType("all")}
          >
            All ({mapData.nodes.length})
          </button>
          <button
            type="button"
            className={`chip ${filterType === "core" ? "chip-active" : ""}`}
            onClick={() => setFilterType("core")}
          >
            <Icon name="modules" className="ic-sm" /> Core
          </button>
          <button
            type="button"
            className={`chip ${filterType === "api" ? "chip-active" : ""}`}
            onClick={() => setFilterType("api")}
          >
            <Icon name="code" className="ic-sm" /> API
          </button>
          <button
            type="button"
            className={`chip ${filterType === "db" ? "chip-active" : ""}`}
            onClick={() => setFilterType("db")}
          >
            <Icon name="db" className="ic-sm" /> Database
          </button>
          <button
            type="button"
            className={`chip ${filterType === "ext" ? "chip-active" : ""}`}
            onClick={() => setFilterType("ext")}
          >
            <Icon name="cloud" className="ic-sm" /> External
          </button>
        </div>

        <div className="map-legend">
          <span className="lg">
            <i style={{ background: "var(--t-core)" }} /> Core Module
          </span>
          <span className="lg">
            <i style={{ background: "var(--t-api)" }} /> API
          </span>
          <span className="lg">
            <i style={{ background: "var(--t-db)" }} /> Database
          </span>
          <span className="lg">
            <i style={{ background: "var(--t-ext)" }} /> External
          </span>
        </div>
      </div>

      {/* Map Body Area */}
      <div
        className={`map-body ${selectedNode ? "has-sel" : ""} ${
          !hasMatches ? "no-match" : ""
        }`}
        id="map-body"
      >
        <div className="map-focus-btn">
          <Button
            variant="secondary"
            size="sm"
            id="fm-focus"
            disabled={!selectedNode}
            onClick={() => selectedNode && mapRef.current?.focus(selectedNode.id)}
          >
            <Icon name="focus" className="ic-sm" />{" "}
            {selectedNode ? `Focus on ${selectedNode.name}` : "Focus on selected module"}
          </Button>
        </div>

        {loading ? (
          <div className="state" style={{ minHeight: 320 }}>
            <div className="st-sub">Building intelligence map for {currentRepoId}...</div>
          </div>
        ) : !hasMatches ? (
          <div className="map-empty">
            <Icon name="search" /> <span>No modules found for repository &quot;{currentRepoId}&quot;.</span>
          </div>
        ) : (
          <div id="fm-canvas" style={{ width: "100%", height: "100%" }}>
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
              filterType={filterType}
            />
          </div>
        )}

        {/* Slide-over Module Detail Side Panel */}
        <div className={`map-panel ${selectedNode ? "open" : ""}`} id="fm-panel">
          {selectedNode && (
            <>
              <div className="mp-head">
                <div>
                  <h3>{selectedNode.name}</h3>
                  <div className="t3 tiny mono mt8">
                    {selectedNode.id} • {selectedNode.files} files
                  </div>
                </div>

                <div className="row gap8 align-center">
                  <Badge variant={BADGE_MAP[selectedNode.type]?.variant || "gray"}>
                    <span className="dot" />
                    {BADGE_MAP[selectedNode.type]?.label || selectedNode.type}
                  </Badge>
                  <button
                    type="button"
                    className="mp-close"
                    id="mp-close"
                    onClick={() => {
                      setSelectedNode(null);
                      mapRef.current?.selectNone();
                    }}
                  >
                    <Icon name="close" className="ic-sm" />
                  </button>
                </div>
              </div>

              <div className="mp-body">
                {/* Description Block */}
                <div className="mp-block">
                  <div className="mp-block-t">Description</div>
                  <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
                    {selectedNode.desc}
                  </p>
                </div>

                {/* Dependencies Block */}
                {selectedNode.deps && selectedNode.deps.length > 0 && (
                  <div className="mp-block">
                    <div className="mp-block-t">Dependencies</div>
                    <div className="row wrap gap8">
                      {selectedNode.deps.map((depId) => {
                        const target = getModuleById(depId);
                        return (
                          <span
                            key={depId}
                            className="mp-chip"
                            onClick={() => router.push(`/app/modules/${depId}?repoId=${encodeURIComponent(currentRepoId)}`)}
                          >
                            {target ? target.name : depId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Dependents Block */}
                {selectedNode.dependents && selectedNode.dependents.length > 0 && (
                  <div className="mp-block">
                    <div className="mp-block-t">Dependents</div>
                    <div className="row wrap gap8">
                      {selectedNode.dependents.map((depId) => {
                        const target = getModuleById(depId);
                        return (
                          <span
                            key={depId}
                            className="mp-chip"
                            onClick={() => router.push(`/app/modules/${depId}?repoId=${encodeURIComponent(currentRepoId)}`)}
                          >
                            {target ? target.name : depId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* DevMind Understanding Block */}
                <div className="mp-block">
                  <div className="mp-block-t">DevMind understanding</div>
                  <div className="ai-note" style={{ marginTop: 0 }}>
                    <span className="ai-ic">
                      <Icon name="brain" className="ic-sm" />
                    </span>
                    <p style={{ fontSize: 12 }}>{selectedNode.ai}</p>
                  </div>
                </div>
              </div>

              {/* Panel Footer */}
              <div className="mp-foot">
                <Link
                  href={`/app/modules/${selectedNode.id}?repoId=${encodeURIComponent(currentRepoId)}`}
                  className="btn btn-primary btn-block"
                >
                  View Module <Icon name="arrowRight" className="ic-sm" />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <MapPageContent />
    </Suspense>
  );
}
