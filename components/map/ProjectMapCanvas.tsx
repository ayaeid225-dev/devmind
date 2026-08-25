"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import type {
  ModuleFixture,
  GraphEdge,
  WorldDimensions,
} from "@/data/types";
import { TYPE_COLORS, TYPE_LABELS } from "@/data/fixtures";

export interface ProjectMapCanvasProps {
  nodes: ModuleFixture[];
  edges: GraphEdge[];
  world: WorldDimensions;
  interactive?: boolean;
  minimap?: boolean;
  zoomUI?: boolean;
  nodeWidth?: number;
  selectedId?: string | null;
  onSelect?: (node: ModuleFixture | null) => void;
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
}

function calcEdgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const mx = x1 + dx * 0.5;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
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
    nodeWidth = 170,
    selectedId: externalSelectedId = null,
    onSelect,
    filterQuery = "",
    filterType = "all",
    className,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    null
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    node: ModuleFixture;
    x: number;
    y: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number }>(
    { x: 0, y: 0, ox: 0, oy: 0 }
  );

  const selectedId = externalSelectedId ?? internalSelectedId;

  const nodeMap = useRef<Record<string, ModuleFixture>>({});
  useEffect(() => {
    const map: Record<string, ModuleFixture> = {};
    nodes.forEach((n) => {
      map[n.id] = n;
    });
    nodeMap.current = map;
  }, [nodes]);

  // Fit map to container
  const fit = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth || 800;
    const h = containerRef.current.clientHeight || 500;
    let k = Math.min(w / (world.w + 220), h / (world.h + 220));
    k = Math.min(k, 0.82);
    const x = (w - world.w * k) / 2;
    const y = (h - world.h * k) / 2 + 8;
    setTransform({ x, y, k });
  }, [world.w, world.h]);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  const focus = useCallback(
    (id: string) => {
      const target = nodeMap.current[id];
      if (!target || !containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const nk = Math.max(0.75, transform.k);
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
    [transform.k, externalSelectedId, onSelect]
  );

  const selectNone = useCallback(() => {
    if (externalSelectedId === undefined) {
      setInternalSelectedId(null);
    }
    if (onSelect) {
      onSelect(null);
    }
  }, [externalSelectedId, onSelect]);

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
    }),
    [focus, fit, zoomAt, transform.k, selectNone]
  );

  const handleNodeClick = (e: React.MouseEvent, node: ModuleFixture) => {
    e.stopPropagation();
    if (!interactive) return;
    const nextId = selectedId === node.id ? null : node.id;
    if (externalSelectedId === undefined) {
      setInternalSelectedId(nextId);
    }
    if (onSelect) {
      onSelect(nextId ? node : null);
    }
  };

  const handleBackgroundClick = () => {
    if (!interactive) return;
    selectNone();
  };

  // Dragging / Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return;
    if ((e.target as HTMLElement).closest(".node-g")) return;
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

  // Wheel Zoom
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

  // Hover Tooltip
  const handleNodeMouseEnter = (e: React.MouseEvent, node: ModuleFixture) => {
    if (!interactive) return;
    setHoveredNodeId(node.id);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      node,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  };

  const handleNodeMouseLeave = () => {
    setHoveredNodeId(null);
    setTooltip(null);
  };

  // Filter verification
  const isNodeMatching = (node: ModuleFixture) => {
    if (filterType !== "all" && node.type !== filterType) {
      return false;
    }
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      return (
        node.name.toLowerCase().includes(q) || node.id.toLowerCase().includes(q)
      );
    }
    return true;
  };

  const activeHighlightId = selectedId || hoveredNodeId;

  // Minimap Navigation
  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const cx = px * 200;
    const cy = py * 132;
    const k = Math.max(0.5, transform.k);
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    setTransform({
      k,
      x: w / 2 - (cx / 200) * world.w * k,
      y: h / 2 - (cy / 132) * world.h * k,
    });
  };

  // Minimap viewport box
  const miniViewport = containerRef.current
    ? {
        w: (containerRef.current.clientWidth / transform.k / world.w) * 200,
        h: (containerRef.current.clientHeight / transform.k / world.h) * 132,
        x: (-transform.x / transform.k / world.w) * 200,
        y: (-transform.y / transform.k / world.h) * 132,
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
          <marker
            id="arrow-def"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(151,163,134,0.9)" />
          </marker>
          <marker
            id="arrow-lit"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(200,214,43,0.95)" />
          </marker>
        </defs>

        <g
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
            transition: isDragging ? "none" : "transform .3s cubic-bezier(.2,.7,.3,1)",
          }}
        >
          {/* Background area to capture drag clicks */}
          <rect
            x={-120}
            y={-120}
            width={world.w + 240}
            height={world.h + 240}
            fill="transparent"
            className="map-bg"
          />

          {/* Render Edges */}
          {edges.map((e, idx) => {
            const a = nodeMap.current[e[0]];
            const b = nodeMap.current[e[1]];
            if (!a || !b) return null;
            const isConnected =
              activeHighlightId === a.id || activeHighlightId === b.id;
            const pathD = calcEdgePath(a.x, a.y + 34, b.x, b.y - 34);

            return (
              <path
                key={`edge-${idx}`}
                d={pathD}
                className="edge-line"
                fill="none"
                stroke={
                  isConnected ? "rgba(200,214,43,0.5)" : "rgba(151,163,134,0.32)"
                }
                strokeWidth={isConnected ? 1.6 : 1.4}
                markerEnd={
                  isConnected ? "url(#arrow-lit)" : "url(#arrow-def)"
                }
              />
            );
          })}

          {/* Render Nodes */}
          {nodes.map((n) => {
            const isSelected = selectedId === n.id;
            const isMatching = isNodeMatching(n);
            const color = TYPE_COLORS[n.type] || TYPE_COLORS.core;
            const typeLabel = TYPE_LABELS[n.type] || n.type;
            const w = nodeWidth;

            return (
              <g
                key={n.id}
                className={`node-g ${isMatching ? "lit" : ""}`}
                transform={`translate(${n.x},${n.y})`}
                onClick={(e) => handleNodeClick(e, n)}
                onMouseEnter={(e) => handleNodeMouseEnter(e, n)}
                onMouseLeave={handleNodeMouseLeave}
                style={{ cursor: interactive ? "pointer" : "default" }}
              >
                {/* Rect Body */}
                <rect
                  x={-w / 2}
                  y={-34}
                  width={w}
                  height={68}
                  rx={11}
                  style={{
                    fill: "var(--elevated)",
                    stroke: isSelected
                      ? "rgba(200,214,43,0.65)"
                      : "var(--border)",
                    strokeWidth: 1,
                  }}
                />

                {/* Highlight Outline */}
                <rect
                  x={-w / 2}
                  y={-34}
                  width={w}
                  height={68}
                  rx={11}
                  style={{
                    fill: "none",
                    stroke: "var(--brand)",
                    strokeWidth: 1.6,
                    opacity: isSelected ? 1 : 0,
                  }}
                />

                {/* Type Dot */}
                <circle
                  cx={-w / 2 + 16}
                  cy={-17}
                  r={3.2}
                  style={{ fill: color }}
                />

                {/* Node Name */}
                <text
                  x={-w / 2 + 27}
                  y={-13}
                  fontSize={12.5}
                  fontWeight={550}
                  style={{
                    fill: "var(--text-1)",
                    fontFamily: "Geist, sans-serif",
                  }}
                >
                  {n.name}
                </text>

                {/* Subtitle 1: Type & Files */}
                <text
                  x={-w / 2 + 16}
                  y={6}
                  fontSize={10.5}
                  style={{
                    fill: "var(--text-3)",
                    fontFamily: "Geist, sans-serif",
                  }}
                >
                  {typeLabel} • {n.files} files
                </text>

                {/* Subtitle 2: Node ID */}
                <text
                  x={-w / 2 + 16}
                  y={22}
                  fontSize={10.5}
                  style={{
                    fill: "var(--text-3)",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  {n.id}
                </text>
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
              8,
              Math.min(window.innerWidth - 220, tooltip.x - 100)
            ),
            top: tooltip.y - 48,
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          <div className="tt-title">{tooltip.node.name}</div>
          <div className="tt-sub">
            {(TYPE_LABELS[tooltip.node.type] || tooltip.node.type) +
              " • " +
              tooltip.node.files +
              " files • " +
              (tooltip.node.desc || tooltip.node.id)}
          </div>
        </div>
      )}

      {/* Zoom UI */}
      {interactive && zoomUI && (
        <div className="map-zoom">
          <button type="button" onClick={() => zoomAt(transform.k * 1.28)}>
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
          <button type="button" onClick={() => zoomAt(transform.k / 1.28)}>
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
          <button type="button" onClick={fit}>
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
              {nodes.map((n) => (
                <circle
                  key={`mini-${n.id}`}
                  cx={(n.x / world.w) * 200}
                  cy={(n.y / world.h) * 132}
                  r={3}
                  opacity={0.9}
                  style={{ fill: TYPE_COLORS[n.type] || "#6F756A" }}
                />
              ))}
            </g>
            <rect
              x={miniViewport.x}
              y={miniViewport.y}
              width={miniViewport.w}
              height={miniViewport.h}
              fill="rgba(200,214,43,.10)"
              stroke="rgba(200,214,43,.5)"
              strokeWidth={1}
            />
          </svg>
        </div>
      )}
    </div>
  );
});
