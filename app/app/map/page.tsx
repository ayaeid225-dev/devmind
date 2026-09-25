"use client";

import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Icon,
  Badge,
  Button,
  Input,
  type BadgeVariant,
} from "@/components/ui";
import {
  transformKnowledgeToMap,
  transformScopeToMap,
  extractDrillDownScope,
  checkHasChildren,
  computeEntityContents,
  buildBreadcrumbTrail,
  mergeTraversalIntoScope,
  getConnectedEdges,
  RELATION_LABELS,
  ENTITY_COLORS,
  ENTITY_BADGES,
  type MapNode,
  type MapEdge,
  type ProjectMapData,
  type DrillDownScope,
  type DrillDownCounts,
  type MapViewMode,
} from "@/lib/project-map-helper";
import type {
  RepositoryKnowledgeView,
  KnowledgeNode,
  KnowledgeEdge,
} from "@/lib/server/knowledge/types";
import {
  ProjectMapCanvas,
  type ProjectMapCanvasRef,
} from "@/components/map";
import { useShell } from "@/lib/shell-context";

function MapPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapRef = useRef<ProjectMapCanvasRef>(null);
  const { activeRepoId, activeRepo } = useShell();

  // Dynamic repository resolution: URL searchParam -> shell activeRepoId -> activeRepo.name
  const currentRepoId =
    searchParams.get("repoId") || activeRepoId || activeRepo?.name || "";

  // Data & graph state
  const [fullGraph, setFullGraph] = useState<RepositoryKnowledgeView | null>(null);
  const [drillDownStack, setDrillDownStack] = useState<DrillDownScope[]>([]);
  const cachedScopes = useRef<Map<string, ProjectMapData>>(new Map());

  const emptyMapData: ProjectMapData = {
    nodes: [],
    edges: [],
    world: { w: 1400, h: 900 },
    stats: {
      totalNodes: 0,
      totalEdges: 0,
      nodesByType: {
        Repository: 0,
        Module: 0,
        File: 0,
        Class: 0,
        Function: 0,
        Method: 0,
        Commit: 0,
        Contributor: 0,
        Dependency: 0,
      },
      edgesByType: {
        CONTAINS: 0,
        IMPORTS: 0,
        DEPENDS_ON: 0,
        CHANGES: 0,
        AUTHORED_BY: 0,
        COMMITTED_BY: 0,
        EXTENDS: 0,
        IMPLEMENTS: 0,
      },
    },
  };

  const [mapData, setMapData] = useState<ProjectMapData>(emptyMapData);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<MapViewMode>("architecture");
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<MapEdge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullGraphWarning, setShowFullGraphWarning] = useState<boolean>(false);
  const [isScopeCapped, setIsScopeCapped] = useState<boolean>(false);
  const [totalChildCount, setTotalChildCount] = useState<number>(0);

  // Compute total entities in full repository graph for warnings
  const totalEntities = fullGraph
    ? (fullGraph.modules?.length || 0) +
      (fullGraph.files?.length || 0) +
      (fullGraph.dependencies?.length || 0) +
      (fullGraph.classes?.length || 0) +
      (fullGraph.functions?.length || 0) +
      (fullGraph.methods?.length || 0)
    : 0;

  // 1. Initial repository knowledge graph fetch — dynamic per repository
  const fetchGraph = useCallback(async () => {
    if (!currentRepoId) {
      setLoading(false);
      setFullGraph(null);
      setDrillDownStack([]);
      setSelectedNode(null);
      setSelectedEdge(null);
      setSearchQuery("");
      setShowFullGraphWarning(false);
      setIsScopeCapped(false);
      cachedScopes.current.clear();
      setMapData(emptyMapData);
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSearchQuery("");
    setShowFullGraphWarning(false);
    setIsScopeCapped(false);
    setTotalChildCount(0);
    setViewMode("architecture");
    cachedScopes.current.clear();

    try {
      const res = await fetch(`/api/knowledge/graph?repoId=${encodeURIComponent(currentRepoId)}`);
      const json = await res.json();

      if (json.success && json.data) {
        const graph: RepositoryKnowledgeView = json.data;
        setFullGraph(graph);

        const rootScope: DrillDownScope = {
          id: graph.repoNode?.id || `repo:${currentRepoId}`,
          name: graph.repoNode?.name || currentRepoId,
          type: "Repository",
        };
        setDrillDownStack([rootScope]);

        // Default root view is always high-level Architecture
        const rootMapData = transformKnowledgeToMap(graph, "architecture");
        setMapData(rootMapData);
        cachedScopes.current.set(rootScope.id, rootMapData);
        setTimeout(() => mapRef.current?.fit(), 60);
      } else {
        throw new Error(json.error || `Failed to load repository knowledge for "${currentRepoId}"`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error fetching repository knowledge";
      setError(msg);
      setFullGraph(null);
      setDrillDownStack([]);
      setMapData(emptyMapData);
    } finally {
      setLoading(false);
    }
  }, [currentRepoId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Current scope helper
  const currentScope = drillDownStack[drillDownStack.length - 1] || {
    id: `repo:${currentRepoId}`,
    name: currentRepoId,
    type: "Repository",
  };

  // View Mode selector (architecture, files, dependencies, all)
  const handleSelectViewMode = (mode: MapViewMode) => {
    if (!fullGraph) return;

    if (mode === "all" && totalEntities > 100 && viewMode !== "all") {
      setShowFullGraphWarning(true);
      return;
    }

    setShowFullGraphWarning(false);
    setViewMode(mode);
    setFilterType("all");
    setSelectedNode(null);
    setSelectedEdge(null);

    const data = transformKnowledgeToMap(fullGraph, mode);
    setMapData(data);
    cachedScopes.current.set(currentScope.id, data);
    setTimeout(() => mapRef.current?.fit(), 50);
  };

  // Confirm loading full large graph
  const handleConfirmLoadFullGraph = () => {
    if (!fullGraph) return;
    setShowFullGraphWarning(false);
    setViewMode("all");
    setFilterType("all");
    setSelectedNode(null);
    setSelectedEdge(null);

    const data = transformKnowledgeToMap(fullGraph, "all");
    setMapData(data);
    cachedScopes.current.set(currentScope.id, data);
    setTimeout(() => mapRef.current?.fit(), 50);
  };

  // 2. Drill-down action: enter entity internal architecture
  const handleDrillDown = async (node: MapNode | KnowledgeNode) => {
    if (!fullGraph) return;

    const newScope: DrillDownScope = {
      id: node.id,
      name: node.name,
      type: node.type,
      filePath: node.filePath,
    };

    // Check if scope is cached
    if (cachedScopes.current.has(newScope.id)) {
      const cached = cachedScopes.current.get(newScope.id)!;
      setMapData(cached);
      setDrillDownStack((prev) => [...prev, newScope]);
      setSelectedNode(null);
      setSelectedEdge(null);
      setSearchQuery("");
      setShowFullGraphWarning(false);
      setTimeout(() => mapRef.current?.fit(), 50);
      return;
    }

    // Synchronously compute initial drill-down scope
    const scopeResult = extractDrillDownScope(fullGraph, node.id);
    setIsScopeCapped(!!scopeResult.isCapped);
    setTotalChildCount(scopeResult.totalChildCount || scopeResult.nodes.length);

    const initialScopedMap = transformScopeToMap(scopeResult, "architecture");
    setMapData(initialScopedMap);
    cachedScopes.current.set(newScope.id, initialScopedMap);
    setDrillDownStack((prev) => [...prev, newScope]);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSearchQuery("");
    setShowFullGraphWarning(false);
    setTimeout(() => mapRef.current?.fit(), 50);

    // Asynchronously query traversal API to resolve multi-hop connected entities
    try {
      const travRes = await fetch(
        `/api/knowledge/graph/traverse?repoId=${encodeURIComponent(
          currentRepoId
        )}&startNodeId=${encodeURIComponent(node.id)}&maxDepth=1`
      );
      const travJson = await travRes.json();
      if (travJson.success && travJson.data) {
        const merged = mergeTraversalIntoScope(
          scopeResult.nodes,
          scopeResult.edges,
          travJson.data
        );
        const mergedScopeResult = {
          ...scopeResult,
          nodes: merged.nodes,
          edges: merged.edges,
        };
        const updatedMapData = transformScopeToMap(mergedScopeResult, "architecture");
        setMapData(updatedMapData);
        cachedScopes.current.set(newScope.id, updatedMapData);
      }
    } catch {
      // Traversal query failed gracefully; synchronous scoped map is preserved
    }
  };

  // Expand capped scope
  const handleExpandScope = () => {
    if (!fullGraph || drillDownStack.length <= 1) return;
    const scopeResult = extractDrillDownScope(fullGraph, currentScope.id, { expandAll: true });
    const expandedMap = transformScopeToMap(scopeResult, "architecture");
    setMapData(expandedMap);
    setIsScopeCapped(false);
    cachedScopes.current.set(currentScope.id, expandedMap);
    setTimeout(() => mapRef.current?.fit(), 50);
  };

  // 3. Back / Up one level navigation
  const handleBack = () => {
    if (drillDownStack.length <= 1) return;

    const newStack = drillDownStack.slice(0, -1);
    const targetScope = newStack[newStack.length - 1];
    setDrillDownStack(newStack);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSearchQuery("");
    setIsScopeCapped(false);
    setShowFullGraphWarning(false);

    if (cachedScopes.current.has(targetScope.id)) {
      setMapData(cachedScopes.current.get(targetScope.id)!);
    } else if (targetScope.type === "Repository" && fullGraph) {
      const rootMap = transformKnowledgeToMap(fullGraph, viewMode);
      setMapData(rootMap);
      cachedScopes.current.set(targetScope.id, rootMap);
    } else if (fullGraph) {
      const scopedResult = extractDrillDownScope(fullGraph, targetScope.id);
      setIsScopeCapped(!!scopedResult.isCapped);
      setTotalChildCount(scopedResult.totalChildCount || scopedResult.nodes.length);
      const scopedMap = transformScopeToMap(scopedResult, "architecture");
      setMapData(scopedMap);
      cachedScopes.current.set(targetScope.id, scopedMap);
    }
    setTimeout(() => mapRef.current?.fit(), 50);
  };

  // 4. Direct Breadcrumb Jump
  const handleJumpToBreadcrumb = (index: number) => {
    if (index >= drillDownStack.length - 1) return;

    const newStack = drillDownStack.slice(0, index + 1);
    const targetScope = newStack[newStack.length - 1];
    setDrillDownStack(newStack);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSearchQuery("");
    setIsScopeCapped(false);
    setShowFullGraphWarning(false);

    if (cachedScopes.current.has(targetScope.id)) {
      setMapData(cachedScopes.current.get(targetScope.id)!);
    } else if (targetScope.type === "Repository" && fullGraph) {
      const rootMap = transformKnowledgeToMap(fullGraph, viewMode);
      setMapData(rootMap);
      cachedScopes.current.set(targetScope.id, rootMap);
    } else if (fullGraph) {
      const scopedResult = extractDrillDownScope(fullGraph, targetScope.id);
      setIsScopeCapped(!!scopedResult.isCapped);
      setTotalChildCount(scopedResult.totalChildCount || scopedResult.nodes.length);
      const scopedMap = transformScopeToMap(scopedResult, "architecture");
      setMapData(scopedMap);
      cachedScopes.current.set(targetScope.id, scopedMap);
    }
    setTimeout(() => mapRef.current?.fit(), 50);
  };

  // Repository-wide search fallback
  const handleSearchRepositoryWide = () => {
    if (!fullGraph || !searchQuery) return;
    const q = searchQuery.toLowerCase();
    const allNodes: KnowledgeNode[] = [
      fullGraph.repoNode,
      ...(fullGraph.modules || []),
      ...(fullGraph.files || []),
      ...(fullGraph.classes || []),
      ...(fullGraph.functions || []),
      ...(fullGraph.dependencies || []),
    ].filter(Boolean) as KnowledgeNode[];

    const match = allNodes.find(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        (n.filePath && n.filePath.toLowerCase().includes(q))
    );

    if (match) {
      if (match.type === "Repository") {
        handleJumpToBreadcrumb(0);
      } else if (match.type === "Module" || match.type === "File") {
        handleDrillDown(match);
      } else {
        const parentFile = fullGraph.files?.find((f) => f.filePath === match.filePath);
        if (parentFile) {
          handleDrillDown(parentFile);
        } else {
          handleDrillDown(match);
        }
      }
    }
  };

  // Filter & Search matching
  const hasMatches = mapData.nodes.some((n) => {
    if (filterType !== "all") {
      if (filterType === "core" || filterType === "api" || filterType === "db" || filterType === "ext") {
        if ((n.metadata?.legacyType || n.metadata?.type) !== filterType) {
          return false;
        }
      } else if (n.type.toLowerCase() !== filterType.toLowerCase()) {
        return false;
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        n.name.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        (n.filePath && n.filePath.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const breadcrumbs = buildBreadcrumbTrail(drillDownStack);

  // Selected node inspection calculations
  const selectedContents: DrillDownCounts = selectedNode && fullGraph
    ? computeEntityContents(fullGraph, selectedNode.id)
    : {
        files: 0,
        modules: 0,
        classes: 0,
        functions: 0,
        methods: 0,
        dependencies: 0,
        incoming: 0,
        outgoing: 0,
      };

  const hasChildrenToExplore = selectedNode && fullGraph
    ? checkHasChildren(fullGraph, selectedNode.id)
    : false;

  const connectedEdgesToSelected = selectedNode
    ? getConnectedEdges(selectedNode.id, mapData.edges)
    : [];

  const incomingEdges = selectedNode
    ? connectedEdgesToSelected.filter((e) => e.target === selectedNode.id)
    : [];
  const outgoingEdges = selectedNode
    ? connectedEdgesToSelected.filter((e) => e.source === selectedNode.id)
    : [];

  return (
    <div className="map-screen">
      {/* Map Toolbar */}
      <div className="map-toolbar">
        {/* Navigation Section: Overview & Back Buttons */}
        <div className="row align-center gap8">
          <Link href={`/app/overview?repoId=${encodeURIComponent(currentRepoId)}`}>
            <Button variant="ghost" size="sm">
              <Icon name="arrowLeft" className="ic-sm" /> Overview
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={drillDownStack.length <= 1}
            aria-label="Back up one level"
            style={{
              opacity: drillDownStack.length <= 1 ? 0.35 : 1,
              cursor: drillDownStack.length <= 1 ? "not-allowed" : "pointer",
            }}
          >
            <Icon name="arrowLeft" className="ic-sm" /> Back
          </Button>
        </div>

        {/* Hierarchical Breadcrumb Navigation */}
        <nav
          className="breadcrumb-nav row align-center gap4"
          aria-label="Architecture hierarchy breadcrumbs"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            padding: "3px 8px",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        >
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              {idx > 0 && (
                <span
                  className="breadcrumb-sep"
                  style={{ color: "var(--text-3)", opacity: 0.5, fontSize: 11 }}
                >
                  ›
                </span>
              )}
              {crumb.isCurrent ? (
                <span
                  className="breadcrumb-item current mono"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#C8D62B",
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "rgba(200, 214, 43, 0.12)",
                  }}
                  aria-current="location"
                >
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="breadcrumb-item link mono"
                  onClick={() => handleJumpToBreadcrumb(idx)}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--text-2)",
                    cursor: "pointer",
                    background: "transparent",
                    border: "none",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {crumb.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Scope-Aware Search Input */}
        <Input
          icon="search"
          placeholder={
            drillDownStack.length > 1
              ? `Search in ${currentScope.name}…`
              : "Search architecture…"
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 220, height: 32 }}
        />

        {/* Category & View Filters */}
        <div className="chips row gap8" id="fm-filters">
          {drillDownStack.length <= 1 ? (
            /* Root View Modes */
            <>
              <button
                type="button"
                className={`chip ${viewMode === "architecture" ? "chip-active" : ""}`}
                onClick={() => handleSelectViewMode("architecture")}
              >
                Architecture ({mapData.nodes.length})
              </button>
              <button
                type="button"
                className={`chip ${viewMode === "files" ? "chip-active" : ""}`}
                onClick={() => handleSelectViewMode("files")}
              >
                <Icon name="file" className="ic-sm" /> Files
              </button>
              <button
                type="button"
                className={`chip ${viewMode === "dependencies" ? "chip-active" : ""}`}
                onClick={() => handleSelectViewMode("dependencies")}
              >
                <Icon name="packages" className="ic-sm" /> Dependencies
              </button>
              <button
                type="button"
                className={`chip ${viewMode === "all" ? "chip-active" : ""}`}
                onClick={() => handleSelectViewMode("all")}
              >
                <Icon name="overview" className="ic-sm" /> Full Graph
              </button>
            </>
          ) : (
            /* Contextual Drill-Down Filters */
            <>
              <button
                type="button"
                className={`chip ${filterType === "all" ? "chip-active" : ""}`}
                onClick={() => setFilterType("all")}
              >
                All ({mapData.nodes.length})
              </button>
              {mapData.nodes.some((n) => n.type === "File") && (
                <button
                  type="button"
                  className={`chip ${filterType === "file" ? "chip-active" : ""}`}
                  onClick={() => setFilterType("file")}
                >
                  <Icon name="file" className="ic-sm" /> Files
                </button>
              )}
              {mapData.nodes.some((n) => n.type === "Dependency") && (
                <button
                  type="button"
                  className={`chip ${filterType === "dependency" ? "chip-active" : ""}`}
                  onClick={() => setFilterType("dependency")}
                >
                  <Icon name="packages" className="ic-sm" /> Deps
                </button>
              )}
              {mapData.nodes.some((n) => n.type === "Class") && (
                <button
                  type="button"
                  className={`chip ${filterType === "class" ? "chip-active" : ""}`}
                  onClick={() => setFilterType("class")}
                >
                  <Icon name="puzzle" className="ic-sm" /> Classes
                </button>
              )}
              {mapData.nodes.some((n) => n.type === "Function" || n.type === "Method") && (
                <button
                  type="button"
                  className={`chip ${filterType === "function" ? "chip-active" : ""}`}
                  onClick={() => setFilterType("function")}
                >
                  <Icon name="code" className="ic-sm" /> Functions
                </button>
              )}
              {isScopeCapped && (
                <button
                  type="button"
                  className="chip"
                  onClick={handleExpandScope}
                  style={{
                    background: "rgba(200, 214, 43, 0.12)",
                    borderColor: "rgba(200, 214, 43, 0.4)",
                    color: "#C8D62B",
                    cursor: "pointer",
                  }}
                  title="Expand to show all child entities"
                >
                  Showing {mapData.nodes.length - 1} of {totalChildCount} files • Expand all
                </button>
              )}
            </>
          )}
        </div>

        {/* Current Scope Context Indicator */}
        <div
          className="mono tiny row align-center gap6"
          style={{
            color: "var(--text-3)",
            fontSize: 11,
            marginLeft: "auto",
            padding: "2px 8px",
            background: "rgba(255, 255, 255, 0.02)",
            borderRadius: 4,
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ color: "var(--text-2)" }}>Scope:</span>
          <span>{drillDownStack.map((s) => s.name).join(" / ")}</span>
        </div>
      </div>

      {/* Large Graph Warning Banner */}
      {showFullGraphWarning && (
        <div
          style={{
            background: "rgba(214, 167, 44, 0.1)",
            borderBottom: "1px solid rgba(214, 167, 44, 0.3)",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            zIndex: 10,
          }}
        >
          <div className="row align-center gap8">
            <Icon name="alert" className="ic-sm" style={{ color: "#D6A72C" }} />
            <span style={{ fontSize: 13, color: "var(--text-1)" }}>
              <strong>Large repository graph ({totalEntities} entities in {currentRepoId})</strong>: Rendering all nodes simultaneously may cause heavy visual overlap and reduced performance.
            </span>
          </div>
          <div className="row gap8 align-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleConfirmLoadFullGraph}
            >
              Load Full Graph ({totalEntities})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullGraphWarning(false)}
            >
              Keep Scoped View
            </Button>
          </div>
        </div>
      )}

      {/* Map Body Area */}
      <div
        className={`map-body ${selectedNode || selectedEdge ? "has-sel" : ""} ${
          !hasMatches && !loading ? "no-match" : ""
        }`}
        id="map-body"
      >
        {/* Floating Canvas Controls */}
        <div className="map-focus-btn row gap8">
          <Button
            variant="secondary"
            size="sm"
            id="fm-focus"
            disabled={!selectedNode}
            onClick={() => selectedNode && mapRef.current?.focus(selectedNode.id)}
          >
            <Icon name="focus" className="ic-sm" />{" "}
            {selectedNode ? `Focus on ${selectedNode.name}` : "Focus on selected"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => mapRef.current?.fit()}
            aria-label="Fit entire graph to view"
          >
            Fit View
          </Button>
        </div>

        {!currentRepoId ? (
          <div className="map-empty" style={{ textAlign: "center", padding: "64px 24px" }}>
            <div
              style={{
                margin: "0 auto 16px",
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="overview" className="ic-md" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-1)", marginBottom: 8 }}>
              No repository selected
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 380, margin: "0 auto 20px" }}>
              Please select a connected repository to view its project dependency map.
            </p>
          </div>
        ) : loading ? (
          <div className="state" style={{ minHeight: 320 }}>
            <div className="st-sub">Building intelligence map for {currentRepoId}...</div>
          </div>
        ) : error ? (
          <div className="map-empty" style={{ textAlign: "center", padding: "64px 24px" }}>
            <div
              style={{
                margin: "0 auto 16px",
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.1)",
                color: "#EF4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="alert" className="ic-md" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-1)", marginBottom: 8 }}>
              Failed to load knowledge map
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 380, margin: "0 auto 20px" }}>
              {error}
            </p>
            <div className="row gap8 justify-center">
              <Button variant="secondary" size="sm" onClick={fetchGraph}>
                Retry
              </Button>
              {drillDownStack.length > 1 && (
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  Go Back
                </Button>
              )}
            </div>
          </div>
        ) : mapData.nodes.length <= 1 && drillDownStack.length > 1 ? (
          /* Empty Children State when entity has no deeper contents */
          <div className="map-empty" style={{ textAlign: "center", padding: "64px 24px" }}>
            <div
              style={{
                margin: "0 auto 16px",
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="search" className="ic-md" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-1)", marginBottom: 8 }}>
              No deeper architecture available
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 380, margin: "0 auto 20px", lineHeight: 1.5 }}>
              This entity has no connected child entities in the current knowledge graph.
            </p>
            <Button variant="secondary" size="sm" onClick={handleBack}>
              <Icon name="arrowLeft" className="ic-sm" /> Up one level
            </Button>
          </div>
        ) : !hasMatches ? (
          <div className="map-empty" style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ margin: "0 auto 12px", display: "inline-block" }}>
              <Icon name="search" className="ic-md" />
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
              No entities found matching &quot;{searchQuery}&quot; in scope &quot;{currentScope.name}&quot;.
            </div>
            {drillDownStack.length > 1 && (
              <Button variant="secondary" size="sm" onClick={handleSearchRepositoryWide}>
                Search whole repository ({currentRepoId})
              </Button>
            )}
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
              selectedEdgeId={selectedEdge?.id}
              onSelect={setSelectedNode}
              onSelectEdge={setSelectedEdge}
              filterQuery={searchQuery}
              filterType={filterType}
            />
          </div>
        )}

        {/* Slide-over Detail Side Panel */}
        <div
          className={`map-panel ${selectedNode || selectedEdge ? "open" : ""}`}
          id="fm-panel"
        >
          {/* Node Detail View */}
          {selectedNode && (
            <>
              <div className="mp-head">
                <div>
                  <h3>{selectedNode.name}</h3>
                  <div className="t3 tiny mono mt8">
                    {selectedNode.filePath || selectedNode.id}
                  </div>
                </div>

                <div className="row gap8 align-center">
                  <Badge
                    variant={
                      selectedNode.badgeVariant === "purple"
                        ? "cyan"
                        : selectedNode.badgeVariant === "red"
                        ? "error"
                        : (selectedNode.badgeVariant as BadgeVariant) || "gray"
                    }
                  >
                    <span className="dot" />
                    {selectedNode.type}
                  </Badge>
                  <button
                    type="button"
                    className="mp-close"
                    id="mp-close"
                    aria-label="Close detail panel"
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
                {/* Real Contents Metric Box */}
                {(selectedContents.files > 0 ||
                  selectedContents.classes > 0 ||
                  selectedContents.functions > 0 ||
                  selectedContents.methods > 0 ||
                  selectedContents.dependencies > 0) && (
                  <div className="mp-block">
                    <div className="mp-block-t">Contents</div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginTop: 4,
                      }}
                    >
                      {selectedContents.files > 0 && (
                        <div
                          style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "8px 10px",
                          }}
                        >
                          <div className="mono bold" style={{ fontSize: 15, color: "#7896D8" }}>
                            {selectedContents.files}
                          </div>
                          <div className="t3 tiny">Files</div>
                        </div>
                      )}
                      {selectedContents.classes > 0 && (
                        <div
                          style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "8px 10px",
                          }}
                        >
                          <div className="mono bold" style={{ fontSize: 15, color: "#BA68C8" }}>
                            {selectedContents.classes}
                          </div>
                          <div className="t3 tiny">Classes</div>
                        </div>
                      )}
                      {selectedContents.functions > 0 && (
                        <div
                          style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "8px 10px",
                          }}
                        >
                          <div className="mono bold" style={{ fontSize: 15, color: "#E57373" }}>
                            {selectedContents.functions}
                          </div>
                          <div className="t3 tiny">Functions</div>
                        </div>
                      )}
                      {selectedContents.methods > 0 && (
                        <div
                          style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "8px 10px",
                          }}
                        >
                          <div className="mono bold" style={{ fontSize: 15, color: "#FF8A65" }}>
                            {selectedContents.methods}
                          </div>
                          <div className="t3 tiny">Methods</div>
                        </div>
                      )}
                      {selectedContents.dependencies > 0 && (
                        <div
                          style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "8px 10px",
                          }}
                        >
                          <div className="mono bold" style={{ fontSize: 15, color: "#D6A72C" }}>
                            {selectedContents.dependencies}
                          </div>
                          <div className="t3 tiny">Dependencies</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SubLabel / Metadata */}
                {selectedNode.subLabel && (
                  <div className="mp-block">
                    <div className="mp-block-t">Description & Summary</div>
                    <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
                      {selectedNode.subLabel}
                    </p>
                  </div>
                )}

                {/* Outgoing Relationships */}
                {outgoingEdges.length > 0 && (
                  <div className="mp-block">
                    <div className="mp-block-t">Outgoing Connections ({outgoingEdges.length})</div>
                    <div className="col gap6">
                      {outgoingEdges.slice(0, 8).map((edge) => {
                        const targetNode = mapData.nodes.find((n) => n.id === edge.target);
                        return (
                          <div
                            key={edge.id}
                            className="row justify-between align-center p6"
                            style={{
                              background: "rgba(255, 255, 255, 0.02)",
                              border: "1px solid var(--border)",
                              borderRadius: 4,
                              fontSize: 12,
                            }}
                          >
                            <span style={{ color: "var(--text-1)" }}>
                              {targetNode ? targetNode.name : edge.target.split(":").pop()}
                            </span>
                            <Badge variant="gray">
                              {RELATION_LABELS[edge.relationType] || edge.relationType}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Incoming Relationships */}
                {incomingEdges.length > 0 && (
                  <div className="mp-block">
                    <div className="mp-block-t">Incoming Connections ({incomingEdges.length})</div>
                    <div className="col gap6">
                      {incomingEdges.slice(0, 8).map((edge) => {
                        const sourceNode = mapData.nodes.find((n) => n.id === edge.source);
                        return (
                          <div
                            key={edge.id}
                            className="row justify-between align-center p6"
                            style={{
                              background: "rgba(255, 255, 255, 0.02)",
                              border: "1px solid var(--border)",
                              borderRadius: 4,
                              fontSize: 12,
                            }}
                          >
                            <span style={{ color: "var(--text-1)" }}>
                              {sourceNode ? sourceNode.name : edge.source.split(":").pop()}
                            </span>
                            <Badge variant="gray">
                              {RELATION_LABELS[edge.relationType] || edge.relationType}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Panel Footer Actions */}
              <div className="mp-foot col gap8">
                {hasChildrenToExplore ? (
                  <Button
                    variant="primary"
                    size="md"
                    className="btn-block"
                    onClick={() => handleDrillDown(selectedNode)}
                  >
                    Explore inside →
                  </Button>
                ) : (
                  <div
                    className="text-center py8 mono tiny"
                    style={{
                      color: "var(--text-3)",
                      background: "rgba(255, 255, 255, 0.02)",
                      borderRadius: 6,
                      border: "1px dashed var(--border)",
                      padding: "8px 12px",
                    }}
                  >
                    No deeper structure available
                  </div>
                )}

                {selectedNode.type === "Module" && (
                  <Link
                    href={`/app/modules/${selectedNode.id.split(":").pop()}?repoId=${encodeURIComponent(
                      currentRepoId
                    )}`}
                    className="btn btn-secondary btn-block"
                  >
                    View Module <Icon name="arrowRight" className="ic-sm" />
                  </Link>
                )}

                {selectedNode.type === "File" && selectedNode.filePath && (
                  <Link
                    href={`/app/files?repoId=${encodeURIComponent(
                      currentRepoId
                    )}&path=${encodeURIComponent(selectedNode.filePath)}`}
                    className="btn btn-secondary btn-block"
                  >
                    View File <Icon name="arrowRight" className="ic-sm" />
                  </Link>
                )}
              </div>
            </>
          )}

          {/* Edge Detail View */}
          {selectedEdge && !selectedNode && (
            <>
              <div className="mp-head">
                <div>
                  <h3>{selectedEdge.label || selectedEdge.relationType}</h3>
                  <div className="t3 tiny mono mt8">
                    {selectedEdge.source.split(":").pop()} → {selectedEdge.target.split(":").pop()}
                  </div>
                </div>

                <div className="row gap8 align-center">
                  <Badge variant="amber">{selectedEdge.relationType}</Badge>
                  <button
                    type="button"
                    className="mp-close"
                    id="mp-close"
                    aria-label="Close edge detail"
                    onClick={() => {
                      setSelectedEdge(null);
                      mapRef.current?.selectEdge(null);
                    }}
                  >
                    <Icon name="close" className="ic-sm" />
                  </button>
                </div>
              </div>

              <div className="mp-body">
                <div className="mp-block">
                  <div className="mp-block-t">Source Entity</div>
                  <p style={{ fontSize: 13, color: "var(--text-1)" }}>
                    {mapData.nodes.find((n) => n.id === selectedEdge.source)?.name || selectedEdge.source}
                  </p>
                  <span className="t3 tiny mono">{selectedEdge.source}</span>
                </div>

                <div className="mp-block">
                  <div className="mp-block-t">Target Entity</div>
                  <p style={{ fontSize: 13, color: "var(--text-1)" }}>
                    {mapData.nodes.find((n) => n.id === selectedEdge.target)?.name || selectedEdge.target}
                  </p>
                  <span className="t3 tiny mono">{selectedEdge.target}</span>
                </div>

                <div className="mp-block">
                  <div className="mp-block-t">Relationship Semantics</div>
                  <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
                    This directional edge represents a &quot;{selectedEdge.label}&quot; ({selectedEdge.relationType}) dependency between the two architectural components.
                  </p>
                </div>
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
