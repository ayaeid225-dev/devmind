"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Icon,
  Badge,
  MetricCard,
  Button,
  Input,
  type BadgeVariant,
} from "@/components/ui";
import {
  REPO,
  MODULES,
  EDGES,
  WORLD,
  ASK_SUGGESTIONS,
} from "@/data/fixtures";
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

export default function OverviewPage() {
  const router = useRouter();
  const { repo, branch } = useShell();
  const mapRef = useRef<ProjectMapCanvasRef>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<ModuleFixture | null>(null);
  const [questionInput, setQuestionInput] = useState("");

  const activeRepo = repo || REPO;
  const currentBranch = activeRepo.branch || branch || "main";

  const handleAskSubmit = (q?: string) => {
    const query = q || questionInput.trim();
    if (!query) return;
    router.push(`/app/ask?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">{activeRepo.desc ? activeRepo.name.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) + " Platform" : "Clinic Management Platform"}</h1>
        <p className="page-sub mono">
          {currentBranch} • Analysis complete • last indexed 5 hours ago
        </p>
      </div>

      {/* Metric Grid */}
      <div className="metric-grid">
        <MetricCard
          icon="file"
          value={activeRepo.files || 248}
          label="Files indexed"
          delta="+12 this week"
          deltaTone="up"
        />
        <MetricCard
          icon="modules"
          value={activeRepo.modules || 12}
          label="Modules detected"
          delta="architecture mapped"
          deltaTone="flat"
        />
        <MetricCard
          icon="deps"
          value={activeRepo.deps || 36}
          label="Dependencies"
          delta="6 external"
          deltaTone="flat"
        />
        <MetricCard
          icon="users"
          value={activeRepo.contributors || 18}
          label="Contributors"
          delta="2 active today"
          deltaTone="up"
        />
      </div>

      {/* Overview Map Card */}
      <div className="card overview-map" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <div className="sec-title">Project Intelligence Map</div>
            <div className="sec-sub">
              Modules, dependencies, and data flow — the structure of your codebase.
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
            <Link href="/app/map">
              <Button variant="secondary" size="sm">
                <Icon name="external" className="ic-sm" /> Open in Project Map
              </Button>
            </Link>
          </div>
        </div>

        {/* Map Canvas with Quick Overlay */}
        <div className="om-canvas" id="overview-map" style={{ position: "relative", height: 420 }}>
          <ProjectMapCanvas
            ref={mapRef}
            nodes={MODULES}
            edges={EDGES}
            world={WORLD}
            interactive
            minimap
            nodeWidth={170}
            selectedId={selectedNode?.id}
            onSelect={setSelectedNode}
            filterQuery={searchQuery}
          />

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
                  <Badge variant={BADGE_MAP[selectedNode.type].variant}>
                    <span className="dot" />
                    {BADGE_MAP[selectedNode.type].label}
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
                  <Link href={`/app/modules/${selectedNode.id}`}>
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
            <div className="sec-title">Ask DevMind</div>
            <div className="sec-sub">
              Questions about this project — answered with code evidence.
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
            placeholder="Ask anything about this project…"
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
            <Icon name="arrowRight" /> Ask
          </Button>
        </div>
      </div>
    </div>
  );
}
