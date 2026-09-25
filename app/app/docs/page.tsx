"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Icon,
  Badge,
  Button,
  Card,
  Input,
  MetricCard,
  Skeleton,
  EmptyState,
  useToast,
  type BadgeVariant,
} from "@/components/ui";
import { useShell } from "@/lib/shell-context";
import {
  generateVerifiedDocumentation,
  type VerifiedProjectDocumentation,
  type DocModuleDetail,
  type DocTechStackItem,
} from "@/lib/docs-helper";
import type { RepositoryKnowledgeView } from "@/lib/server/knowledge/types";

function DocsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { activeRepoId, activeRepo } = useShell();

  // Dynamic repository resolution: URL searchParam -> Shell activeRepoId -> Shell activeRepo name
  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo?.name || "";

  const [graphData, setGraphData] = useState<RepositoryKnowledgeView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState("");

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

      try {
        const res = await fetch(`/api/knowledge/graph?repoId=${encodeURIComponent(currentRepoId)}`);
        const json = await res.json();

        if (ignore) return;

        if (json.success && json.data) {
          setGraphData(json.data);
        } else {
          setError(json.error || "Failed to load project knowledge for documentation");
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

  // Generate verified documentation from knowledge graph
  const doc: VerifiedProjectDocumentation | null = useMemo(() => {
    if (!graphData) return null;
    return generateVerifiedDocumentation(graphData, { repoIdOverride: currentRepoId });
  }, [graphData, currentRepoId]);

  // Handle PDF Export
  const handleExportPdf = () => {
    if (typeof window === "undefined" || !doc) return;
    const originalTitle = document.title;
    document.title = `DevMind-Documentation-${doc.repoName}`;
    toast("Opening print/PDF export dialog...", "info");
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Filter modules
  const filteredModules = useMemo(() => {
    if (!doc) return [];
    if (!moduleFilter.trim()) return doc.coreModules;
    const q = moduleFilter.toLowerCase();
    return doc.coreModules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.keyFiles.some((f) => f.path.toLowerCase().includes(q))
    );
  }, [doc, moduleFilter]);

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
        <div className="grid grid-4 gap16 mb24">
          <Skeleton style={{ height: 80, width: "100%" }} />
          <Skeleton style={{ height: 80, width: "100%" }} />
          <Skeleton style={{ height: 80, width: "100%" }} />
          <Skeleton style={{ height: 80, width: "100%" }} />
        </div>
        <Card className="mb24" pad>
          <Skeleton style={{ height: 260, width: "100%" }} />
        </Card>
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
          sub="Connect or select a repository from the workspace dropdown to generate verified architecture and module documentation."
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
  if (error || !doc || doc.isEmpty) {
    return (
      <div className="fade-up">
        <div className="page-head mb24">
          <h1 className="page-title">Project Documentation: {currentRepoId}</h1>
          <p className="page-sub">
            Verified architecture and module documentation derived from the project knowledge model.
          </p>
        </div>
        <EmptyState
          title="Knowledge Graph Incomplete"
          sub={
            error ||
            doc?.emptyReason ||
            "No modules or files have been indexed for this repository yet. Run repository ingestion to extract documentation evidence."
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

  const { summary, architectureOverview, techStack, projectStructure, dependencies, entryPoints, statistics, gitActivity } = doc;

  // --------------------------------------------------------------------------
  // RENDER: Verified Documentation Experience
  // --------------------------------------------------------------------------
  return (
    <div className="fade-up doc-container">
      {/* 0. Print-Only Document Cover Header */}
      <div className="print-only mb24" style={{ borderBottom: "2px solid #0f172a", paddingBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>DevMind Engineering Documentation</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#475569", marginTop: 4 }}>
              Repository: {doc.repoName} {doc.repoOwner ? `(${doc.repoOwner})` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: "#64748b" }}>
            <div>Generated: {doc.generatedAt}</div>
            <div>Source: Verified Knowledge Model</div>
          </div>
        </div>
      </div>

      {/* 1. Web Page Header */}
      <div className="page-head no-print">
        <div className="row between align-center wrap gap12">
          <div>
            <div className="row gap8 align-center mb8">
              <Badge variant="cyan" small dot>
                Verified Knowledge Model
              </Badge>
              <Badge variant="lime" small>
                {summary.projectType}
              </Badge>
              <Badge variant="gray" small>
                Generated {doc.generatedAt}
              </Badge>
            </div>
            <h1 className="page-title">Project Documentation: {doc.repoName}</h1>
            <p className="page-sub">
              Verified architecture, module responsibilities, dependencies, and code relationships generated directly from the repository knowledge model.
            </p>
          </div>

          <div className="row gap8 align-center">
            <Button variant="primary" size="sm" onClick={handleExportPdf} title="Export documentation as a multi-page PDF">
              <Icon name="fileText" className="ic-sm" /> Export PDF
            </Button>
            <Link
              href={`/app/map?repoId=${encodeURIComponent(currentRepoId)}`}
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: "none" }}
            >
              <Icon name="map" className="ic-sm" /> Architecture Map
            </Link>
            <Link
              href={`/app/modules?repoId=${encodeURIComponent(currentRepoId)}`}
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: "none" }}
            >
              <Icon name="modules" className="ic-sm" /> Modules
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Interactive Quick Jump Bar (no-print) */}
      <div
        className="card mb24 no-print"
        style={{
          padding: "10px 16px",
          display: "flex",
          gap: 12,
          alignItems: "center",
          overflowX: "auto",
          background: "var(--surface)",
        }}
      >
        <span className="tiny font-mono t3 uppercase flex-shrink-0">Jump to:</span>
        <a href="#summary" className="tiny t2 font-mono" style={{ textDecoration: "none" }}>
          1. Summary
        </a>
        <span className="t3 tiny">•</span>
        <a href="#architecture" className="tiny t2 font-mono" style={{ textDecoration: "none" }}>
          2. Architecture
        </a>
        <span className="t3 tiny">•</span>
        <a href="#tech-stack" className="tiny t2 font-mono" style={{ textDecoration: "none" }}>
          3. Tech Stack
        </a>
        <span className="t3 tiny">•</span>
        <a href="#structure" className="tiny t2 font-mono" style={{ textDecoration: "none" }}>
          4. Structure
        </a>
        <span className="t3 tiny">•</span>
        <a href="#core-modules" className="tiny t2 font-mono" style={{ textDecoration: "none" }}>
          5. Core Modules ({doc.coreModules.length})
        </a>
        <span className="t3 tiny">•</span>
        <a href="#dependencies" className="tiny t2 font-mono" style={{ textDecoration: "none" }}>
          6. Dependencies
        </a>
        <span className="t3 tiny">•</span>
        <a href="#entry-points" className="tiny t2 font-mono" style={{ textDecoration: "none" }}>
          7. Entry Points
        </a>
        <span className="t3 tiny">•</span>
        <a href="#statistics" className="tiny t2 font-mono" style={{ textDecoration: "none" }}>
          8. Statistics
        </a>
      </div>

      {/* ======================================================================
          SECTION 1: PROJECT SUMMARY
          ====================================================================== */}
      <section id="summary" className="doc-section mb32">
        <div className="row between align-center mb12">
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
            1. Project Summary
          </h2>
          <Badge variant="gray" small>
            Verified Repository Facts
          </Badge>
        </div>

        {/* Repository Statistics Grid */}
        <div className="grid grid-4 gap12 mb16">
          <div className="card card-pad">
            <div className="tiny font-mono t3 uppercase mb4">Source Files</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-1)" }}>
              {summary.stats.filesCount}
            </div>
            <div className="tiny t3 mt4">{summary.primaryLanguage} primary</div>
          </div>
          <div className="card card-pad">
            <div className="tiny font-mono t3 uppercase mb4">Architectural Modules</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--brand)" }}>
              {summary.stats.modulesCount}
            </div>
            <div className="tiny t3 mt4">Modular boundaries</div>
          </div>
          <div className="card card-pad">
            <div className="tiny font-mono t3 uppercase mb4">External Dependencies</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-1)" }}>
              {summary.stats.dependenciesCount}
            </div>
            <div className="tiny t3 mt4">Verified packages</div>
          </div>
          <div className="card card-pad">
            <div className="tiny font-mono t3 uppercase mb4">AST Symbols</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-1)" }}>
              {summary.stats.classesCount + summary.stats.functionsCount}
            </div>
            <div className="tiny t3 mt4">
              {summary.stats.classesCount} classes • {summary.stats.functionsCount} functions
            </div>
          </div>
        </div>

        {/* Summary Description Card */}
        <div className="card card-pad">
          <div className="grid grid-2 gap24">
            <div>
              <div className="tiny font-mono t3 uppercase mb6">Verified Project Metadata</div>
              <table style={{ width: "100%", fontSize: 13 }}>
                <tbody>
                  <tr>
                    <td style={{ width: 140, color: "var(--text-3)", padding: "4px 0" }}>Project Name</td>
                    <td style={{ fontWeight: 600, color: "var(--text-1)", padding: "4px 0" }}>{summary.projectName}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-3)", padding: "4px 0" }}>Project Type</td>
                    <td style={{ color: "var(--text-1)", padding: "4px 0" }}>{summary.projectType}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-3)", padding: "4px 0" }}>Primary Language</td>
                    <td style={{ color: "var(--text-1)", padding: "4px 0" }}>
                      <span className="font-mono" style={{ color: "var(--brand)" }}>{summary.primaryLanguage}</span>
                    </td>
                  </tr>
                  {doc.repoOwner && (
                    <tr>
                      <td style={{ color: "var(--text-3)", padding: "4px 0" }}>Owner / Org</td>
                      <td style={{ color: "var(--text-1)", padding: "4px 0" }}>{doc.repoOwner}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <div className="tiny font-mono t3 uppercase mb6">Key Frameworks & Technologies</div>
              <div className="row gap6 wrap mt8">
                {summary.keyTechnologies.length > 0 ? (
                  summary.keyTechnologies.map((tech) => (
                    <Badge key={tech} variant="gray" small>
                      {tech}
                    </Badge>
                  ))
                ) : (
                  <span className="tiny t3">No external framework dependencies detected.</span>
                )}
              </div>
              <p className="tiny t3 mt12" style={{ lineHeight: 1.5 }}>
                Derived solely from source code file extensions, package manifests, and WebAssembly Tree-sitter AST extraction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================
          SECTION 2: ARCHITECTURE OVERVIEW & DIAGRAM
          ====================================================================== */}
      <section id="architecture" className="doc-section mb32 print-avoid-break">
        <div className="row between align-center mb12">
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
            2. Architecture Overview
          </h2>
          <Badge variant="cyan" small>
            High-Level Topology
          </Badge>
        </div>

        <div className="card card-pad mb16">
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-1)", margin: "0 0 16px 0" }}>
            {architectureOverview.description}
          </p>

          {/* Architecture Vector SVG Diagram */}
          {architectureOverview.diagram && architectureOverview.diagram.nodes.length > 0 && (
            <div
              className="doc-diagram print-avoid-break"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-soft)",
                borderRadius: 8,
                padding: "16px",
                overflowX: "auto",
                textAlign: "center",
              }}
            >
              <div className="tiny font-mono t3 uppercase mb12 text-left">
                Verified Architecture Diagram (Derived from Cross-Module Imports)
              </div>

              <svg
                viewBox={`0 0 ${architectureOverview.diagram.width} ${architectureOverview.diagram.height}`}
                style={{ width: "100%", maxWidth: 760, height: "auto", display: "inline-block" }}
              >
                <defs>
                  <marker
                    id="doc-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--text-3)" opacity={0.8} />
                  </marker>
                </defs>

                {/* Render Directed Edges */}
                {architectureOverview.diagram.edges.map((edge) => (
                  <g key={edge.id}>
                    <line
                      x1={edge.sourceX}
                      y1={edge.sourceY}
                      x2={edge.targetX}
                      y2={edge.targetY}
                      stroke="var(--text-3)"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                      markerEnd="url(#doc-arrow)"
                      opacity={0.65}
                    />
                  </g>
                ))}

                {/* Render Module Nodes */}
                {architectureOverview.diagram.nodes.map((node) => (
                  <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                    <rect
                      width={node.width}
                      height={node.height}
                      rx={6}
                      fill={node.color}
                      stroke={node.border}
                      strokeWidth="1.5"
                    />
                    <text
                      x={node.width / 2}
                      y={24}
                      textAnchor="middle"
                      fill="var(--text-1)"
                      fontSize="12.5"
                      fontWeight="600"
                      fontFamily="var(--font-sans)"
                    >
                      {node.label}
                    </text>
                    <text
                      x={node.width / 2}
                      y={42}
                      textAnchor="middle"
                      fill="var(--text-3)"
                      fontSize="9.5"
                      fontFamily="var(--mono)"
                    >
                      {node.type.toUpperCase()} MODULE
                    </text>
                  </g>
                ))}
              </svg>

              <div className="row center gap16 mt12 tiny font-mono t3">
                <span className="row gap4 align-center">
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "#62C4C7" }} /> API Gateway
                </span>
                <span className="row gap4 align-center">
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "#8BC34A" }} /> Core Application
                </span>
                <span className="row gap4 align-center">
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "#7896D8" }} /> Data Persistence
                </span>
                <span className="row gap4 align-center">
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "#D6A72C" }} /> External Adapters
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ======================================================================
          SECTION 3: TECHNOLOGY STACK TABLE
          ====================================================================== */}
      <section id="tech-stack" className="doc-section mb32 print-avoid-break">
        <div className="row between align-center mb12">
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
            3. Technology Stack
          </h2>
          <Badge variant="gray" small>
            {techStack.length} Technologies Detected
          </Badge>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <table className="table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border-soft)" }}>
                <th style={{ textAlign: "left", padding: "10px 14px" }}>Technology</th>
                <th style={{ textAlign: "left", padding: "10px 14px", width: 180 }}>Type</th>
                <th style={{ textAlign: "left", padding: "10px 14px" }}>Verified Usage in Project</th>
                <th style={{ textAlign: "left", padding: "10px 14px", width: 110 }}>Version</th>
              </tr>
            </thead>
            <tbody>
              {techStack.map((item, idx) => (
                <tr
                  key={`${item.name}-${idx}`}
                  style={{ borderBottom: "1px solid var(--border-soft)" }}
                >
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-1)" }}>
                    <span className="font-mono">{item.name}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge variant={item.category === "framework" ? "cyan" : item.category === "database" ? "blue" : "gray"} small>
                      {item.type}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--text-2)" }}>{item.verifiedUsage}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", color: "var(--text-3)", fontSize: 12 }}>
                    {item.version || "detected"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ======================================================================
          SECTION 4: PROJECT STRUCTURE
          ====================================================================== */}
      <section id="structure" className="doc-section mb32 print-avoid-break">
        <div className="row between align-center mb12">
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
            4. Project Structure & Modules Overview
          </h2>
          <Badge variant="gray" small>
            {projectStructure.modulesOverview.length} Modules
          </Badge>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <table className="table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border-soft)" }}>
                <th style={{ textAlign: "left", padding: "10px 14px", width: 220 }}>Module</th>
                <th style={{ textAlign: "left", padding: "10px 14px", width: 120 }}>Category</th>
                <th style={{ textAlign: "left", padding: "10px 14px", width: 100 }}>Files</th>
                <th style={{ textAlign: "left", padding: "10px 14px" }}>Verified Architectural Role</th>
              </tr>
            </thead>
            <tbody>
              {projectStructure.modulesOverview.map((mod) => (
                <tr key={mod.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-1)" }}>
                    <Link
                      href={`/app/modules/${encodeURIComponent(mod.id)}?repoId=${encodeURIComponent(currentRepoId)}`}
                      className="font-mono t1 no-print"
                    >
                      {mod.name}
                    </Link>
                    <span className="font-mono print-only">{mod.name}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge variant={mod.type === "api" ? "cyan" : mod.type === "db" ? "blue" : "lime"} small>
                      {mod.type.toUpperCase()}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", color: "var(--text-2)" }}>
                    {mod.filesCount}
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--text-2)" }}>{mod.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ======================================================================
          SECTION 5: CORE MODULES DETAILED SPECIFICATION
          ====================================================================== */}
      <section id="core-modules" className="doc-section mb32 print-page-break">
        <div className="row between align-center mb12 wrap gap12">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
              5. Core Modules Detailed Specification
            </h2>
            <p className="tiny t3 mt4">
              Comprehensive role breakdown, key files, symbols, dependencies, and inbound callers.
            </p>
          </div>

          <div className="no-print" style={{ width: 240 }}>
            <Input
              placeholder="Filter modules or files..."
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap20">
          {filteredModules.map((mod, idx) => (
            <div key={mod.id} className="card print-avoid-break" style={{ overflow: "hidden" }}>
              {/* Module Card Header */}
              <div
                style={{
                  padding: "16px 20px",
                  background: "var(--surface)",
                  borderBottom: "1px solid var(--border-soft)",
                }}
                className="row between align-center wrap gap12"
              >
                <div className="row gap8 align-center">
                  <span
                    className="font-mono t3"
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    5.{idx + 1}
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
                    {mod.name}
                  </h3>
                  <Badge variant={mod.type === "api" ? "cyan" : mod.type === "db" ? "blue" : "lime"} small>
                    {mod.type.toUpperCase()}
                  </Badge>
                </div>

                <div className="row gap8 align-center no-print">
                  <Link
                    href={`/app/map?repoId=${encodeURIComponent(currentRepoId)}&node=${encodeURIComponent(mod.id)}`}
                    className="btn btn-ghost btn-xs"
                    style={{ textDecoration: "none" }}
                  >
                    <Icon name="map" className="ic-xs" /> Map
                  </Link>
                  <Link
                    href={`/app/modules/${encodeURIComponent(mod.id)}?repoId=${encodeURIComponent(currentRepoId)}`}
                    className="btn btn-ghost btn-xs"
                    style={{ textDecoration: "none" }}
                  >
                    <Icon name="modules" className="ic-xs" /> Details
                  </Link>
                </div>
              </div>

              {/* Module Card Body */}
              <div style={{ padding: "20px" }} className="flex flex-col gap16">
                {/* Role */}
                <div>
                  <div className="tiny font-mono t3 uppercase mb4">Architectural Role</div>
                  <p style={{ fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.55, margin: 0 }}>
                    {mod.role}
                  </p>
                </div>

                {/* Key Files */}
                <div>
                  <div className="tiny font-mono t3 uppercase mb6">
                    Key Files ({mod.keyFiles.length} of {mod.stats.filesCount})
                  </div>
                  <div className="flex flex-col gap4">
                    {mod.keyFiles.map((file) => (
                      <div
                        key={file.id}
                        className="row between align-center gap8"
                        style={{
                          padding: "6px 10px",
                          background: "var(--bg-subtle)",
                          borderRadius: 6,
                          fontSize: 12,
                          fontFamily: "var(--mono)",
                        }}
                      >
                        <span className="text-ellipsis" style={{ color: "var(--text-1)" }}>
                          {file.path}
                        </span>
                        <div className="row gap6 align-center flex-shrink-0">
                          {file.language && <span className="tiny t3">{file.language}</span>}
                          <Link
                            href={`/app/files?repoId=${encodeURIComponent(currentRepoId)}&search=${encodeURIComponent(file.path.split("/").pop() || file.path)}`}
                            className="tiny t2 no-print"
                            style={{ textDecoration: "none" }}
                          >
                            Code →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Classes & Functions */}
                {(mod.classes.length > 0 || mod.functions.length > 0) && (
                  <div className="grid grid-2 gap12">
                    {mod.classes.length > 0 && (
                      <div>
                        <div className="tiny font-mono t3 uppercase mb4">Classes ({mod.classes.length})</div>
                        <div className="row gap4 wrap">
                          {mod.classes.map((cls, cIdx) => (
                            <span
                              key={cIdx}
                              className="font-mono"
                              style={{
                                padding: "2px 8px",
                                background: "rgba(120, 150, 216, 0.1)",
                                border: "1px solid rgba(120, 150, 216, 0.25)",
                                borderRadius: 4,
                                fontSize: 11.5,
                                color: "#7896D8",
                              }}
                            >
                              class {cls.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {mod.functions.length > 0 && (
                      <div>
                        <div className="tiny font-mono t3 uppercase mb4">Functions ({mod.functions.length})</div>
                        <div className="row gap4 wrap">
                          {mod.functions.map((fn, fIdx) => (
                            <span
                              key={fIdx}
                              className="font-mono"
                              style={{
                                padding: "2px 8px",
                                background: "rgba(214, 167, 44, 0.1)",
                                border: "1px solid rgba(214, 167, 44, 0.25)",
                                borderRadius: 4,
                                fontSize: 11.5,
                                color: "#D6A72C",
                              }}
                            >
                              {fn.name}()
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Dependencies & Dependents */}
                <div className="grid grid-2 gap12">
                  {/* Outgoing Dependencies */}
                  <div>
                    <div className="tiny font-mono t3 uppercase mb4">Dependencies ({mod.dependencies.length})</div>
                    {mod.dependencies.length > 0 ? (
                      <div className="flex flex-col gap4">
                        {mod.dependencies.map((dep, dIdx) => (
                          <div
                            key={dIdx}
                            className="row between align-center gap6 tiny"
                            style={{
                              padding: "4px 8px",
                              background: "var(--bg-subtle)",
                              borderRadius: 4,
                            }}
                          >
                            <span className="font-mono text-ellipsis" style={{ color: "var(--text-1)" }}>
                              {dep.name}
                            </span>
                            <span className="t3 font-mono tiny">{dep.relationLabel}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="tiny t3">No external or internal dependencies.</div>
                    )}
                  </div>

                  {/* Incoming Dependents */}
                  <div>
                    <div className="tiny font-mono t3 uppercase mb4">Dependents / Callers ({mod.dependents.length})</div>
                    {mod.dependents.length > 0 ? (
                      <div className="flex flex-col gap4">
                        {mod.dependents.map((dep, dIdx) => (
                          <div
                            key={dIdx}
                            className="row between align-center gap6 tiny"
                            style={{
                              padding: "4px 8px",
                              background: "var(--bg-subtle)",
                              borderRadius: 4,
                            }}
                          >
                            <span className="font-mono text-ellipsis" style={{ color: "var(--text-1)" }}>
                              {dep.name}
                            </span>
                            <span className="t3 font-mono tiny">{dep.relationLabel}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="tiny t3">No internal modules depend on this. Top-level consumer.</div>
                    )}
                  </div>
                </div>

                {/* Relationships Summary */}
                <div
                  style={{
                    padding: "8px 12px",
                    background: "var(--bg-subtle)",
                    borderRadius: 6,
                    borderLeft: "3px solid var(--brand)",
                    fontSize: 12,
                    color: "var(--text-2)",
                  }}
                >
                  {mod.relationships.join(" ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================================
          SECTION 6: DEPENDENCIES SPECIFICATION
          ====================================================================== */}
      <section id="dependencies" className="doc-section mb32 print-avoid-break">
        <div className="row between align-center mb12">
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
            6. External Dependencies Specification
          </h2>
          <Badge variant="gray" small>
            {dependencies.length} Packages
          </Badge>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <table className="table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border-soft)" }}>
                <th style={{ textAlign: "left", padding: "10px 14px" }}>Package Name</th>
                <th style={{ textAlign: "left", padding: "10px 14px", width: 120 }}>Version</th>
                <th style={{ textAlign: "left", padding: "10px 14px", width: 120 }}>Type</th>
                <th style={{ textAlign: "left", padding: "10px 14px" }}>Used By Architectural Modules</th>
              </tr>
            </thead>
            <tbody>
              {dependencies.map((dep, idx) => (
                <tr key={`${dep.name}-${idx}`} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-1)" }}>
                    <span className="font-mono">{dep.name}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", color: "var(--text-3)", fontSize: 12 }}>
                    {dep.version ? `v${dep.version}` : "unpinned"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge variant="gray" small>
                      {dep.dependencyType}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {dep.usedByModules.length > 0 ? (
                      <div className="row gap4 wrap">
                        {dep.usedByModules.map((m) => (
                          <Badge key={m} variant="lime" small>
                            {m}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="tiny t3 font-mono">Direct manifest dependency</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ======================================================================
          SECTION 7: ENTRY POINTS
          ====================================================================== */}
      <section id="entry-points" className="doc-section mb32 print-avoid-break">
        <div className="row between align-center mb12">
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
            7. Verified Application Entry Points
          </h2>
          <Badge variant="lime" small>
            {entryPoints.length} Identified
          </Badge>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <table className="table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border-soft)" }}>
                <th style={{ textAlign: "left", padding: "10px 14px" }}>Entry File</th>
                <th style={{ textAlign: "left", padding: "10px 14px", width: 160 }}>Type</th>
                <th style={{ textAlign: "left", padding: "10px 14px", width: 140 }}>Parent Module</th>
                <th style={{ textAlign: "left", padding: "10px 14px" }}>Verified Entry Heuristic</th>
              </tr>
            </thead>
            <tbody>
              {entryPoints.map((ep, idx) => (
                <tr key={`${ep.filePath}-${idx}`} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-1)" }}>
                    <div className="font-mono text-ellipsis">{ep.filePath}</div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <Badge variant={ep.type === "Primary Entry" ? "lime" : "cyan"} small>
                      {ep.type}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", color: "var(--text-2)" }}>
                    {ep.moduleName || "Root"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--text-2)", fontSize: 12.5 }}>
                    {ep.verifiedReason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ======================================================================
          SECTION 8: REPOSITORY STATISTICS & CHARTS
          ====================================================================== */}
      <section id="statistics" className="doc-section mb32 print-avoid-break">
        <div className="row between align-center mb12">
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
            8. Repository Statistics & Distribution
          </h2>
          <Badge variant="gray" small>
            Codebase Metrics
          </Badge>
        </div>

        <div className="grid grid-2 gap16 mb16">
          {/* Language Breakdown */}
          <div className="card card-pad">
            <h3 style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }} className="t3 mb12">
              Language Distribution
            </h3>

            {/* Stacked bar */}
            <div style={{ height: 12, borderRadius: 6, display: "flex", overflow: "hidden", marginBottom: 16 }}>
              {statistics.languages.map((l) => (
                <div
                  key={l.language}
                  title={`${l.language}: ${l.count} files (${l.percentage}%)`}
                  style={{
                    width: `${l.percentage}%`,
                    background: l.color,
                  }}
                />
              ))}
            </div>

            {/* Legend list */}
            <div className="flex flex-col gap6">
              {statistics.languages.map((l) => (
                <div key={l.language} className="row between align-center tiny font-mono">
                  <span className="row gap6 align-center">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
                    <span style={{ color: "var(--text-1)" }}>{l.language}</span>
                  </span>
                  <span className="t3">
                    {l.count} files ({l.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Module Type Distribution */}
          <div className="card card-pad">
            <h3 style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }} className="t3 mb12">
              Modules by Architectural Type
            </h3>

            <div className="flex flex-col gap10 mt8">
              {statistics.modulesByType.map((m) => (
                <div key={m.type}>
                  <div className="row between align-center tiny mb4 font-mono">
                    <span style={{ color: "var(--text-1)" }}>{m.label}</span>
                    <span className="t3">{m.count} module{m.count === 1 ? "" : "s"}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-subtle)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.round((m.count / Math.max(1, summary.stats.modulesCount)) * 100)}%`,
                        height: "100%",
                        background: m.color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Git Activity (if present) */}
        {gitActivity && (
          <div className="card card-pad print-avoid-break">
            <div className="row between align-center mb8">
              <h3 style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }} className="t3">
                Verified Git History & Authorship
              </h3>
              {gitActivity.latestCommitSha && (
                <span className="tiny font-mono t3">
                  Latest SHA: <span style={{ color: "var(--brand)" }}>{gitActivity.latestCommitSha.slice(0, 7)}</span>
                </span>
              )}
            </div>

            <div className="grid grid-2 gap12 mt12">
              <div>
                <span className="tiny t3">Total Ingested Commits:</span>{" "}
                <b style={{ color: "var(--text-1)" }}>{gitActivity.commitsCount}</b>
              </div>
              <div>
                <span className="tiny t3">Total Contributors:</span>{" "}
                <b style={{ color: "var(--text-1)" }}>{gitActivity.contributorsCount}</b>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Running Document Footer for Print */}
      <div
        className="print-only mt32 pt16"
        style={{
          borderTop: "1px solid #cbd5e1",
          fontSize: 9,
          color: "#94a3b8",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>DevMind Engineering Knowledge Platform • {doc.repoName}</span>
        <span>Page verified from Git and Code AST Knowledge Graph</span>
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense
      fallback={
        <div className="fade-up">
          <Skeleton style={{ height: 32, width: 340, marginBottom: 8 }} />
          <Skeleton style={{ height: 18, width: 560, marginBottom: 24 }} />
          <Skeleton style={{ height: 400, width: "100%" }} />
        </div>
      }
    >
      <DocsPageContent />
    </Suspense>
  );
}
