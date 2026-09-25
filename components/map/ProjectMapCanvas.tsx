"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import type {
  MapNode,
  MapEdge,
  MapWorld,
} from "@/lib/project-map-helper";
import type {
  KnowledgeEntityType,
  KnowledgeRelationType,
} from "@/lib/server/knowledge/types";
import {
  RELATION_LABELS,
  ENTITY_COLORS,
  ENTITY_BADGES,
  ENTITY_ICONS,
  NODE_DIMENSIONS,
} from "@/lib/project-map-helper";

export interface ProjectMapCanvasProps {
  nodes: (MapNode | any)[];
  edges: (MapEdge | any)[];
  world: MapWorld | { w: number; h: number };
  interactive?: boolean;
  minimap?: boolean;
  zoomUI?: boolean;
  nodeWidth?: number;
  selectedId?: string | null;
  selectedEdgeId?: string | null;
  onSelect?: (node: any) => void;
  onSelectEdge?: (edge: MapEdge | null) => void;
  filterQuery?: string;
  filterType?: string;
  className?: string;
}

export interface ProjectMapCanvasRef {
  focus: (id: string) => void;
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  selectNone: () => void;
  selectEdge: (id: string | null) => void;
}

interface NormalizedNode extends MapNode {
  isLegacy?: boolean;
}

interface NormalizedEdge extends MapEdge {
  isLegacy?: boolean;
}

/**
 * Calculates entry and exit connection coordinates at the rectangle boundary
 * of source and target nodes so arrowheads and edges terminate cleanly at borders.
 */
function calcBoundaryConnection(
  source: NormalizedNode,
  target: NormalizedNode,
  curveIndex = 0
): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pathD: string;
  midX: number;
  midY: number;
} {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  const hwA = (source.width || 170) / 2;
  const hhA = (source.height || 56) / 2;
  const hwB = (target.width || 170) / 2;
  const hhB = (target.height || 56) / 2;

  // Find boundary exit point for source node
  const scaleXA = Math.abs(dx) > 0 ? hwA / Math.abs(dx) : 1;
  const scaleYA = Math.abs(dy) > 0 ? hhA / Math.abs(dy) : 1;
  const scaleA = Math.min(scaleXA, scaleYA);
  const x1 = source.x + dx * scaleA;
  const y1 = source.y + dy * scaleA;

  // Find boundary entry point for target node (with small 2px offset for arrowhead tip)
  const scaleXB = Math.abs(dx) > 0 ? hwB / Math.abs(dx) : 1;
  const scaleYB = Math.abs(dy) > 0 ? hhB / Math.abs(dy) : 1;
  const scaleB = Math.min(scaleXB, scaleYB);
  const offsetTarget = Math.max(0, scaleB);
  const x2 = target.x - dx * offsetTarget;
  const y2 = target.y - dy * offsetTarget;

  // Normal to edge direction for curve displacement when multiple parallel edges exist
  const normX = -dy / dist;
  const normY = dx / dist;
  const curveOffset = curveIndex * 24;

  const midBaseX = (x1 + x2) / 2;
  const midBaseY = (y1 + y2) / 2;

  // Smooth control points
  const c1x = x1 + (dx * 0.4) + normX * curveOffset;
  const c1y = y1 + (dy * 0.4) + normY * curveOffset;
  const c2x = x2 - (dx * 0.4) + normX * curveOffset;
  const c2y = y2 - (dy * 0.4) + normY * curveOffset;

  // Midpoint on cubic bezier curve at t = 0.5
  const midX =
    0.125 * x1 + 0.375 * c1x + 0.375 * c2x + 0.125 * x2;
  const midY =
    0.125 * y1 + 0.375 * c1y + 0.375 * c2y + 0.125 * y2;

  const pathD = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;

  return { x1, y1, x2, y2, pathD, midX, midY };
}

export const ProjectMapCanvas = forwardRef<
  ProjectMapCanvasRef,
  ProjectMapCanvasProps
>(function ProjectMapCanvas(
  {
    nodes,
    edges,
    world,
    interactive = true,
    minimap = true,
    zoomUI = true,
    nodeWidth,
    selectedId: externalSelectedId = null,
    selectedEdgeId: externalSelectedEdgeId = null,
    onSelect,
    onSelectEdge,
    filterQuery = "",
    filterType = "all",
    className,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [internalSelectedEdgeId, setInternalSelectedEdgeId] = useState<string | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const [tooltip, setTooltip] = useState<{
    title: string;
    sub: string;
    badge?: string;
    color?: string;
    x: number;
    y: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number }>(
    { x: 0, y: 0, ox: 0, oy: 0 }
  );

  const selectedNodeId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const selectedEdgeId = externalSelectedEdgeId !== undefined ? externalSelectedEdgeId : internalSelectedEdgeId;

  // 1. Normalize Nodes (handles both new MapNode and legacy ModuleFixture)
  const normalizedNodes = useMemo<NormalizedNode[]>(() => {
    return (nodes || []).map((n) => {
      // Check if it's already a complete MapNode
      const entityType = n.type as KnowledgeEntityType;
      if (
        entityType === "Repository" ||
        entityType === "Module" ||
        entityType === "File" ||
        entityType === "Dependency" ||
        entityType === "Class" ||
        entityType === "Function" ||
        entityType === "Method" ||
        entityType === "Commit" ||
        entityType === "Contributor"
      ) {
        return {
          ...n,
          type: entityType,
          width: nodeWidth || n.width || (NODE_DIMENSIONS[entityType]?.width ?? 170),
          height: n.height || (NODE_DIMENSIONS[entityType]?.height ?? 56),
          color: n.color || ENTITY_COLORS[entityType] || "#7896D8",
          icon: n.icon || ENTITY_ICONS[entityType] || "file",
          badgeVariant: n.badgeVariant || ENTITY_BADGES[entityType] || "blue",
          incomingCount: n.incomingCount ?? 0,
          outgoingCount: n.outgoingCount ?? 0,
        };
      }

      // Legacy ModuleFixture normalization
      const defaultDims = NODE_DIMENSIONS.Module;
      return {
        id: n.id,
        type: "Module",
        name: n.name,
        label: n.name,
        repoId: n.repoId || "repo",
        x: n.x,
        y: n.y,
        width: nodeWidth || defaultDims.width,
        height: defaultDims.height,
        color: ENTITY_COLORS.Module,
        icon: "modules",
        badgeVariant: "cyan",
        incomingCount: n.dependents?.length || 0,
        outgoingCount: n.deps?.length || 0,
        subLabel: `${n.files || 0} files`,
        metadata: {
          desc: n.desc,
          files: n.files,
          deps: n.deps,
          dependents: n.dependents,
          ai: n.ai,
          keyFns: n.keyFns,
          legacyType: n.type,
        },
        isLegacy: true,
      };
    });
  }, [nodes, nodeWidth]);

  // Fast map lookup by ID
  const nodeMap = useMemo(() => {
    const map = new Map<string, NormalizedNode>();
    for (const node of normalizedNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [normalizedNodes]);

  // 2. Normalize Edges (handles both MapEdge and legacy [string, string])
  const normalizedEdges = useMemo<NormalizedEdge[]>(() => {
    return (edges || []).map((e, idx) => {
      // Legacy tuple edge [source, target]
      if (Array.isArray(e)) {
        const sourceId = e[0];
        const targetId = e[1];
        return {
          id: `legacy-edge-${sourceId}->${targetId}-${idx}`,
          source: sourceId,
          target: targetId,
          relationType: "DEPENDS_ON",
          label: RELATION_LABELS.DEPENDS_ON,
          repoId: "repo",
          isLegacy: true,
        };
      }

      // MapEdge
      const relType = (e.relationType || "DEPENDS_ON") as KnowledgeRelationType;
      return {
        id: e.id || `edge-${e.source}->${e.target}-${idx}`,
        source: e.source,
        target: e.target,
        relationType: relType,
        label: e.label || RELATION_LABELS[relType] || "Depends on",
        repoId: e.repoId || "repo",
        metadata: e.metadata,
      };
    });
  }, [edges]);

  // Precompute incident edges for O(1) neighborhood highlights
  const incidentEdgesMap = useMemo(() => {
    const map = new Map<string, NormalizedEdge[]>();
    for (const edge of normalizedEdges) {
      if (!map.has(edge.source)) map.set(edge.source, []);
      if (!map.has(edge.target)) map.set(edge.target, []);
      map.get(edge.source)!.push(edge);
      map.get(edge.target)!.push(edge);
    }
    return map;
  }, [normalizedEdges]);

  // 3. Highlight Sets Calculation (Selection Priority)
  // Priority: Selected > Hovered > Connected Neighbors > Others
  const { highlightedNodeIds, highlightedEdgeIds, hasActiveHighlight } = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    const activeNode = selectedNodeId || hoveredNodeId;
    const activeEdge = selectedEdgeId || hoveredEdgeId;

    if (activeNode) {
      nodeIds.add(activeNode);
      const incident = incidentEdgesMap.get(activeNode) || [];
      for (const e of incident) {
        edgeIds.add(e.id);
        nodeIds.add(e.source);
        nodeIds.add(e.target);
      }
    }

    if (activeEdge) {
      edgeIds.add(activeEdge);
      const edge = normalizedEdges.find((e) => e.id === activeEdge);
      if (edge) {
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
      }
    }

    return {
      highlightedNodeIds: nodeIds,
      highlightedEdgeIds: edgeIds,
      hasActiveHighlight: Boolean(activeNode || activeEdge),
    };
  }, [selectedNodeId, hoveredNodeId, selectedEdgeId, hoveredEdgeId, incidentEdgesMap, normalizedEdges]);

  // 4. Viewport Fitting
  const fit = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth || 800;
    const h = containerRef.current.clientHeight || 500;
    const worldW = world.w || 1400;
    const worldH = world.h || 900;
    let k = Math.min(w / (worldW + 240), h / (worldH + 240));
    k = Math.min(Math.max(k, 0.25), 0.85);
    const x = (w - worldW * k) / 2;
    const y = (h - worldH * k) / 2 + 10;
    setTransform({ x, y, k });
  }, [world.w, world.h]);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  // 5. Focus & Zoom Actions
  const focus = useCallback(
    (id: string) => {
      const target = nodeMap.get(id);
      if (!target || !containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const nk = Math.max(0.75, Math.min(1.35, transform.k));
      const x = w / 2 - target.x * nk;
      const y = h / 2 - target.y * nk;
      setTransform({ x, y, k: nk });
      if (externalSelectedId === undefined) {
        setInternalSelectedId(id);
      }
      if (onSelect) {
        onSelect(target);
      }
    },
    [transform.k, externalSelectedId, nodeMap, onSelect]
  );

  const selectNone = useCallback(() => {
    if (externalSelectedId === undefined) {
      setInternalSelectedId(null);
    }
    if (externalSelectedEdgeId === undefined) {
      setInternalSelectedEdgeId(null);
    }
    if (onSelect) {
      onSelect(null);
    }
    if (onSelectEdge) {
      onSelectEdge(null);
    }
  }, [externalSelectedId, externalSelectedEdgeId, onSelect, onSelectEdge]);

  const selectEdge = useCallback(
    (id: string | null) => {
      if (externalSelectedEdgeId === undefined) {
        setInternalSelectedEdgeId(id);
      }
      if (onSelectEdge) {
        const edge = id ? normalizedEdges.find((e) => e.id === id) || null : null;
        onSelectEdge(edge);
      }
    },
    [externalSelectedEdgeId, normalizedEdges, onSelectEdge]
  );

  const zoomAt = useCallback((nk: number) => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    setTransform((prev) => {
      const newK = Math.max(0.18, Math.min(2.4, nk));
      return {
        k: newK,
        x: cx - ((cx - prev.x) / prev.k) * newK,
        y: cy - ((cy - prev.y) / prev.k) * newK,
      };
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus,
      fit,
      zoomIn: () => zoomAt(transform.k * 1.28),
      zoomOut: () => zoomAt(transform.k / 1.28),
      selectNone,
      selectEdge,
    }),
    [focus, fit, zoomAt, transform.k, selectNone, selectEdge]
  );

  // 6. Node Interaction Handlers
  const handleNodeClick = (e: React.MouseEvent, node: NormalizedNode) => {
    e.stopPropagation();
    if (!interactive) return;
    const nextId = selectedNodeId === node.id ? null : node.id;
    if (externalSelectedId === undefined) {
      setInternalSelectedId(nextId);
    }
    if (externalSelectedEdgeId === undefined) {
      setInternalSelectedEdgeId(null);
    }
    if (onSelect) {
      onSelect(nextId ? node : null);
    }
    if (onSelectEdge) {
      onSelectEdge(null);
    }
  };

  const handleEdgeClick = (e: React.MouseEvent, edge: NormalizedEdge) => {
    e.stopPropagation();
    if (!interactive) return;
    const nextEdgeId = selectedEdgeId === edge.id ? null : edge.id;
    if (externalSelectedEdgeId === undefined) {
      setInternalSelectedEdgeId(nextEdgeId);
    }
    if (externalSelectedId === undefined) {
      setInternalSelectedId(null);
    }
    if (onSelectEdge) {
      onSelectEdge(nextEdgeId ? edge : null);
    }
    if (onSelect) {
      onSelect(null);
    }
  };

  const handleBackgroundClick = () => {
    if (!interactive) return;
    selectNone();
  };

  // 7. Pan Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return;
    if ((e.target as HTMLElement).closest(".node-g, .edge-interactive")) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: transform.x,
      oy: transform.y,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setTransform((prev) => ({
        ...prev,
        x: dragStartRef.current.ox + dx,
        y: dragStartRef.current.oy + dy,
      }));
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 8. Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!interactive || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14;

    setTransform((prev) => {
      const nk = Math.max(0.18, Math.min(2.4, prev.k * factor));
      return {
        k: nk,
        x: mx - ((mx - prev.x) / prev.k) * nk,
        y: my - ((my - prev.y) / prev.k) * nk,
      };
    });
  };

  // 9. Tooltips
  const handleNodeMouseEnter = (e: React.MouseEvent, node: NormalizedNode) => {
    if (!interactive) return;
    setHoveredNodeId(node.id);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      title: node.name,
      sub: `${node.type.toUpperCase()} • ${node.subLabel || node.id}`,
      badge: node.type,
      color: node.color,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleNodeMouseLeave = () => {
    setHoveredNodeId(null);
    setTooltip(null);
  };

  const handleEdgeMouseEnter = (e: React.MouseEvent, edge: NormalizedEdge) => {
    if (!interactive) return;
    setHoveredEdgeId(edge.id);
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      title: edge.label,
      sub: `${sourceNode ? sourceNode.name : edge.source} → ${targetNode ? targetNode.name : edge.target}`,
      badge: edge.relationType,
      color: "var(--brand, #C8D62B)",
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleEdgeMouseLeave = () => {
    setHoveredEdgeId(null);
    setTooltip(null);
  };

  // 10. Filter Matching
  const isNodeMatching = (node: NormalizedNode) => {
    if (filterType !== "all") {
      if (filterType === "core" || filterType === "api" || filterType === "db" || filterType === "ext") {
        if ((node.metadata?.legacyType || node.metadata?.type) !== filterType) {
          return false;
        }
      } else if (node.type.toLowerCase() !== filterType.toLowerCase()) {
        return false;
      }
    }
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      return (
        node.name.toLowerCase().includes(q) ||
        node.id.toLowerCase().includes(q) ||
        (node.filePath && node.filePath.toLowerCase().includes(q))
      );
    }
    return true;
  };

  // 11. Minimap Viewport and Coordinates
  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const cx = px * 200;
    const cy = py * 132;
    const k = Math.max(0.4, transform.k);
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    setTransform({
      k,
      x: w / 2 - (cx / 200) * (world.w || 1400) * k,
      y: h / 2 - (cy / 132) * (world.h || 900) * k,
    });
  };

  const worldW = world.w || 1400;
  const worldH = world.h || 900;
  const miniViewport = containerRef.current
    ? {
        w: (containerRef.current.clientWidth / transform.k / worldW) * 200,
        h: (containerRef.current.clientHeight / transform.k / worldH) * 132,
        x: (-transform.x / transform.k / worldW) * 200,
        y: (-transform.y / transform.k / worldH) * 132,
      }
    : { w: 60, h: 40, x: 0, y: 0 };

  return (
    <div
      ref={containerRef}
      className={`map-canvas-container ${className || ""}`}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        background: "transparent",
      }}
      onWheel={handleWheel}
    >
      <svg
        width="100%"
        height="100%"
        style={{
          display: "block",
          background: "transparent",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onClick={handleBackgroundClick}
      >
        <defs>
          {/* Default muted arrowhead marker */}
          <marker
            id="arrow-def"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(151,163,134,0.65)" />
          </marker>

          {/* Highlighted active arrowhead marker */}
          <marker
            id="arrow-lit"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7.5"
            markerHeight="7.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#C8D62B" />
          </marker>

          {/* Subtle grid pattern for architectural canvas */}
          <pattern
            id="map-grid-pattern"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="20" cy="20" r="0.8" fill="rgba(255,255,255,0.04)" />
          </pattern>
        </defs>

        <g
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
            transition: isDragging ? "none" : "transform .25s cubic-bezier(.2,.7,.3,1)",
          }}
        >
          {/* Background area capturing drag & pan */}
          <rect
            x={-300}
            y={-300}
            width={worldW + 600}
            height={worldH + 600}
            fill="url(#map-grid-pattern)"
            className="map-bg"
          />

          {/* Render Edges */}
          {normalizedEdges.map((edge, idx) => {
            const sourceNode = nodeMap.get(edge.source);
            const targetNode = nodeMap.get(edge.target);
            if (!sourceNode || !targetNode) return null;

            const isEdgeLit = highlightedEdgeIds.has(edge.id);
            const isEdgeSelected = selectedEdgeId === edge.id;
            const isDimmed = hasActiveHighlight && !isEdgeLit;

            const { pathD, midX, midY } = calcBoundaryConnection(
              sourceNode,
              targetNode,
              idx % 2 === 1 ? 0.5 : 0
            );

            return (
              <g
                key={`edge-group-${edge.id}`}
                className={`edge-interactive ${isEdgeLit ? "lit" : ""} ${isDimmed ? "dimmed" : ""}`}
                onClick={(e) => handleEdgeClick(e, edge)}
                onMouseEnter={(e) => handleEdgeMouseEnter(e, edge)}
                onMouseLeave={handleEdgeMouseLeave}
                style={{
                  cursor: interactive ? "pointer" : "default",
                  opacity: isDimmed ? 0.16 : 1,
                  transition: "opacity .2s ease",
                }}
              >
                {/* Visible Edge Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    isEdgeSelected
                      ? "#C8D62B"
                      : isEdgeLit
                      ? "rgba(200, 214, 43, 0.75)"
                      : "rgba(151, 163, 134, 0.32)"
                  }
                  strokeWidth={isEdgeSelected ? 2.2 : isEdgeLit ? 1.8 : 1.3}
                  markerEnd={isEdgeLit || isEdgeSelected ? "url(#arrow-lit)" : "url(#arrow-def)"}
                  strokeDasharray={
                    edge.relationType === "DEPENDS_ON"
                      ? "4 3"
                      : edge.relationType === "EXTENDS" || edge.relationType === "IMPLEMENTS"
                      ? "6 3"
                      : undefined
                  }
                />

                {/* Wider Invisible Hit Target for easy hovering/clicking */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                />

                {/* Subtle Relationship Label Pill positioned along edge midpoint */}
                {edge.label && (
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    style={{ pointerEvents: "none" }}
                  >
                    <rect
                      x={-28}
                      y={-9}
                      width={56}
                      height={18}
                      rx={5}
                      fill="var(--elevated, #131715)"
                      stroke={
                        isEdgeLit
                          ? "rgba(200, 214, 43, 0.5)"
                          : "rgba(255, 255, 255, 0.12)"
                      }
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={3.5}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={500}
                      fill={isEdgeLit ? "#C8D62B" : "var(--text-3, #97A386)"}
                      fontFamily="var(--font-geist-mono), monospace"
                    >
                      {edge.label.toUpperCase()}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Render Nodes */}
          {normalizedNodes.map((n) => {
            const isSelected = selectedNodeId === n.id;
            const isLit = highlightedNodeIds.has(n.id);
            const isMatching = isNodeMatching(n);
            const isDimmed = hasActiveHighlight && !isLit;

            const w = n.width;
            const h = n.height;
            const color = n.color || ENTITY_COLORS[n.type] || "#7896D8";
            const isRepo = n.type === "Repository";
            const isModule = n.type === "Module";

            return (
              <g
                key={n.id}
                className={`node-g ${isLit ? "lit" : ""} ${isSelected ? "selected" : ""} ${
                  isMatching ? "matched" : "unmatched"
                } ${isDimmed ? "dimmed" : ""}`}
                transform={`translate(${n.x},${n.y})`}
                onClick={(e) => handleNodeClick(e, n)}
                onMouseEnter={(e) => handleNodeMouseEnter(e, n)}
                onMouseLeave={handleNodeMouseLeave}
                style={{
                  cursor: interactive ? "pointer" : "default",
                  opacity: isDimmed ? 0.32 : isMatching ? 1 : 0.45,
                  transition: "opacity .2s ease, transform .15s ease",
                }}
              >
                {/* Node Box Rect */}
                <rect
                  x={-w / 2}
                  y={-h / 2}
                  width={w}
                  height={h}
                  rx={isRepo ? 12 : isModule ? 10 : 8}
                  style={{
                    fill: isSelected ? "var(--elevated, #1A1F1C)" : "var(--elevated, #131715)",
                    stroke: isSelected
                      ? "#C8D62B"
                      : isLit
                      ? "rgba(200, 214, 43, 0.6)"
                      : n.isFocal
                      ? "#C8D62B"
                      : isRepo
                      ? "rgba(139, 195, 74, 0.45)"
                      : "var(--border, rgba(255, 255, 255, 0.08))",
                    strokeWidth: isSelected ? 1.8 : isLit ? 1.5 : n.isFocal ? 1.8 : 1,
                  }}
                />

                {/* Selection / Lit Glow Outline */}
                {isSelected && (
                  <rect
                    x={-w / 2 - 3}
                    y={-h / 2 - 3}
                    width={w + 6}
                    height={h + 6}
                    rx={isRepo ? 14 : isModule ? 12 : 10}
                    fill="none"
                    stroke="#C8D62B"
                    strokeWidth={1.2}
                    opacity={0.45}
                  />
                )}

                {/* Focal Root Indicator Glow */}
                {n.isFocal && !isSelected && (
                  <rect
                    x={-w / 2 - 2}
                    y={-h / 2 - 2}
                    width={w + 4}
                    height={h + 4}
                    rx={isRepo ? 14 : isModule ? 12 : 10}
                    fill="none"
                    stroke="#C8D62B"
                    strokeWidth={1}
                    opacity={0.35}
                  />
                )}

                {/* Entity Color Indicator Pill / Dot */}
                <rect
                  x={-w / 2 + 10}
                  y={-h / 2 + 11}
                  width={6}
                  height={h - 22}
                  rx={3}
                  fill={color}
                />

                {/* Primary Node Name */}
                <text
                  x={-w / 2 + 24}
                  y={h >= 56 ? -h / 2 + 21 : 0}
                  fontSize={isRepo ? 13.5 : isModule ? 12.5 : 11.5}
                  fontWeight={600}
                  fill="var(--text-1, #EDEDEC)"
                  fontFamily="Geist, sans-serif"
                >
                  {n.name.length > 18 ? `${n.name.slice(0, 16)}…` : n.name}
                </text>

                {/* Subtitle / Metadata Line */}
                {h >= 56 && (
                  <text
                    x={-w / 2 + 24}
                    y={-h / 2 + 37}
                    fontSize={10}
                    fill="var(--text-3, #97A386)"
                    fontFamily="Geist, sans-serif"
                  >
                    {n.subLabel || n.type}
                  </text>
                )}

                {/* Focal Node "EXPLORING" Badge */}
                {n.isFocal && (
                  <g transform={`translate(${w / 2 - 96}, ${-h / 2 + 8})`}>
                    <rect
                      x={0}
                      y={0}
                      width={56}
                      height={14}
                      rx={3}
                      fill="rgba(200, 214, 43, 0.12)"
                      stroke="rgba(200, 214, 43, 0.35)"
                      strokeWidth={0.8}
                    />
                    <text
                      x={28}
                      y={10}
                      textAnchor="middle"
                      fontSize={7.5}
                      fontWeight={600}
                      fill="#C8D62B"
                      fontFamily="var(--font-geist-mono), monospace"
                    >
                      EXPLORING
                    </text>
                  </g>
                )}

                {/* Type Badge in Top-Right Corner */}
                <g transform={`translate(${w / 2 - 36}, ${-h / 2 + 8})`}>
                  <rect
                    x={0}
                    y={0}
                    width={28}
                    height={14}
                    rx={3}
                    fill="rgba(255, 255, 255, 0.05)"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth={0.7}
                  />
                  <text
                    x={14}
                    y={10}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight={600}
                    fill={color}
                    fontFamily="var(--font-geist-mono), monospace"
                  >
                    {n.type === "Repository"
                      ? "REPO"
                      : n.type === "Dependency"
                      ? "PKG"
                      : n.type === "Module"
                      ? "MOD"
                      : n.type.slice(0, 4).toUpperCase()}
                  </text>
                </g>

                {/* Connected Edges Count Pills (Bottom-Right) */}
                {(n.incomingCount > 0 || n.outgoingCount > 0) && (
                  <text
                    x={w / 2 - 10}
                    y={h / 2 - 10}
                    textAnchor="end"
                    fontSize={8.5}
                    fill="var(--text-3, #6F756A)"
                    fontFamily="var(--font-geist-mono), monospace"
                  >
                    {n.incomingCount > 0 ? `↓${n.incomingCount} ` : ""}
                    {n.outgoingCount > 0 ? `↑${n.outgoingCount}` : ""}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover Tooltip */}
      {tooltip && (
        <div
          className="tooltip show"
          style={{
            position: "fixed",
            left: Math.max(
              12,
              Math.min(window.innerWidth - 240, tooltip.x - 110)
            ),
            top: tooltip.y - 48,
            pointerEvents: "none",
            zIndex: 100,
            background: "var(--elevated, #1A1F1C)",
            border: "1px solid var(--border, rgba(255,255,255,0.12))",
            borderRadius: 8,
            padding: "6px 10px",
            boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
          }}
        >
          <div
            className="tt-title row gap6 align-center"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1, #EDEDEC)" }}
          >
            {tooltip.badge && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: tooltip.color || "var(--brand, #C8D62B)",
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                [{tooltip.badge}]
              </span>
            )}
            <span>{tooltip.title}</span>
          </div>
          <div
            className="tt-sub"
            style={{ fontSize: 10.5, color: "var(--text-3, #97A386)", marginTop: 2 }}
          >
            {tooltip.sub}
          </div>
        </div>
      )}

      {/* Zoom UI Controls */}
      {interactive && zoomUI && (
        <div className="map-zoom">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomAt(transform.k * 1.28)}
          >
            <svg
              className="ic"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomAt(transform.k / 1.28)}
          >
            <svg
              className="ic"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Fit map view"
            onClick={fit}
          >
            <svg
              className="ic"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
        </div>
      )}

      {/* Minimap UI */}
      {interactive && minimap && (
        <div className="map-minimap">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 200 132"
            onClick={handleMinimapClick}
          >
            <g>
              {normalizedNodes.map((n) => (
                <circle
                  key={`mini-${n.id}`}
                  cx={(n.x / worldW) * 200}
                  cy={(n.y / worldH) * 132}
                  r={n.type === "Repository" ? 3.5 : n.type === "Module" ? 3 : 2}
                  opacity={0.88}
                  style={{ fill: n.color || "#6F756A" }}
                />
              ))}
            </g>
            <rect
              x={Math.max(0, miniViewport.x)}
              y={Math.max(0, miniViewport.y)}
              width={Math.min(200, Math.max(10, miniViewport.w))}
              height={Math.min(132, Math.max(10, miniViewport.h))}
              fill="rgba(200, 214, 43, 0.10)"
              stroke="rgba(200, 214, 43, 0.55)"
              strokeWidth={1}
            />
          </svg>
        </div>
      )}
    </div>
  );
});
