"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Badge, Button } from "@/components/ui";
import { useShell } from "@/lib/shell-context";
import type { RepositoryKnowledgeView } from "@/lib/server/knowledge/types";
import {
  deriveAllKnowledge,
  type DerivedTeamKnowledge,
  type DerivedConcentration,
  type DerivedRecommendation,
} from "@/lib/knowledge-helper";

function KnowledgePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeRepoId, activeRepo } = useShell();

  const currentRepoId =
    searchParams.get("repoId") || activeRepoId || activeRepo?.name || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teamKnowledge, setTeamKnowledge] = useState<DerivedTeamKnowledge[]>([]);
  const [concentration, setConcentration] = useState<DerivedConcentration[]>([]);
  const [recommendations, setRecommendations] = useState<DerivedRecommendation[]>([]);

  const loadKnowledge = useCallback(async () => {
    if (!currentRepoId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/knowledge/graph?repoId=${encodeURIComponent(currentRepoId)}`
      );
      const json = await res.json();

      if (!res.ok || !json.success || !json.data) {
        setError(json.error || `Failed to fetch knowledge graph for "${currentRepoId}"`);
        setTeamKnowledge([]);
        setConcentration([]);
        setRecommendations([]);
        return;
      }

      const graphData: RepositoryKnowledgeView = json.data;
      const {
        teamKnowledge: derivedTeam,
        concentration: derivedConc,
        recommendations: derivedRecs,
      } = deriveAllKnowledge(graphData);

      setTeamKnowledge(derivedTeam);
      setConcentration(derivedConc);
      setRecommendations(derivedRecs);
    } catch (err: any) {
      console.error("KnowledgePage load error:", err);
      setError(err?.message || "Failed to load engineering knowledge data");
      setTeamKnowledge([]);
      setConcentration([]);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [currentRepoId]);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  const isEmpty =
    !loading &&
    !error &&
    teamKnowledge.length === 0 &&
    concentration.length === 0 &&
    recommendations.length === 0;

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Engineering Knowledge</h1>
        <p className="page-sub">
          Who knows what, what’s documented, and where the team should focus — one connected view
          {currentRepoId && (
            <span>
              {" "}
              for <b className="mono">{currentRepoId}</b>
            </span>
          )}.
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="state" style={{ minHeight: 240 }}>
          <div className="st-sub">
            Loading engineering knowledge for <b className="mono">{currentRepoId}</b>...
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="state" style={{ minHeight: 300 }}>
          <span className="st-ic" style={{ color: "var(--amber)" }}>
            <Icon name="alert" className="ic-lg" />
          </span>
          <div className="st-title">Failed to load engineering knowledge</div>
          <div className="st-sub">{error}</div>
          <div className="mt16">
            <Button variant="secondary" onClick={loadKnowledge}>
              <Icon name="refresh" className="ic-sm" /> Retry
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="state" style={{ minHeight: 320 }}>
          <span className="st-ic">
            <Icon name="spark" className="ic-lg" />
          </span>
          <div className="st-title">No knowledge data available yet</div>
          <div className="st-sub">
            Ingest or index repository <b className="mono">{currentRepoId}</b> to generate the team
            knowledge map, concentration insights, and recommendations.
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && !isEmpty && (
        <>
          {/* Team Knowledge Map Card */}
          {teamKnowledge.length > 0 && (
            <div className="col gap16 mb24">
              <div className="card">
                <div className="card-header">
                  <div className="sec-title">Team Knowledge Map</div>
                  <div className="sec-sub">
                    developers → modules → technologies → knowledge areas
                  </div>
                </div>
                <div className="card-body col gap8">
                  {teamKnowledge.map((t, idx) => {
                    const initials = t.dev
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    const devHref = `/app/devs?repoId=${encodeURIComponent(currentRepoId)}`;

                    return (
                      <Link
                        key={idx}
                        href={devHref}
                        className="card card-pad km-row card-hover"
                        style={{ textDecoration: "none" }}
                      >
                        <span
                          className="dev-av"
                          style={{
                            width: 36,
                            height: 36,
                            fontSize: 12,
                            background: t.color,
                          }}
                        >
                          {initials}
                        </span>
                        <b className="km-dev">{t.dev}</b>
                        <span className="grow row wrap gap8 align-center">
                          {t.links.map((l, lIdx) => {
                            const iconName =
                              l[1] === "module"
                                ? "modules"
                                : l[1] === "tech"
                                ? "packages"
                                : "spark";
                            return (
                              <span key={lIdx} className="km-link">
                                {lIdx > 0 && (
                                  <span className="km-arrow">
                                    <Icon name="arrowRight" className="ic-sm" />
                                  </span>
                                )}
                                <Icon name={iconName} className="ic-sm" />
                                {l[0]}
                              </span>
                            );
                          })}
                        </span>
                        <span className="km-go">
                          <Icon name="arrowUpRight" className="ic-sm" />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Knowledge Concentration Card */}
          {concentration.length > 0 && (
            <div className="col gap16 mb24">
              <div className="card">
                <div className="card-header">
                  <div className="sec-title">Knowledge Concentration</div>
                  <div className="sec-sub">
                    project resilience insights — not individual reviews
                  </div>
                </div>
                <div className="card-body">
                  {concentration.map((c, idx) => {
                    const targetHref = c.module
                      ? `/app/modules/${c.module}?repoId=${encodeURIComponent(currentRepoId)}`
                      : `/app/docs?repoId=${encodeURIComponent(currentRepoId)}`;

                    return (
                      <div key={idx} className="card card-pad conc-card mb16">
                        <div className="row gap8 mb8 align-center">
                          <Badge variant="amber" small>
                            <Icon name="alert" className="ic-sm" />{" "}
                            {c.level === "high"
                              ? "High knowledge concentration"
                              : "Medium concentration"}
                          </Badge>
                          <Link
                            href={targetHref}
                            className="t2"
                            style={{
                              fontWeight: 600,
                              cursor: "pointer",
                              textDecoration: "none",
                            }}
                          >
                            {c.title}
                          </Link>
                        </div>
                        <p className="dv-p">{c.insight}</p>
                        <div className="t3 small mt8" style={{ lineHeight: 1.6 }}>
                          <b className="t2">Evidence:</b> {c.evidence}
                        </div>
                        <div className="conc-actions mt12 align-center">
                          <span
                            className="t3 tiny cap"
                            style={{ marginRight: 8, textTransform: "uppercase" }}
                          >
                            Suggested actions
                          </span>
                          {c.actions.map((a, aIdx) => (
                            <Badge key={aIdx} variant="outline" small>
                              <Icon name="check" className="ic-sm" /> {a}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* DevMind Recommendations Card */}
          {recommendations.length > 0 && (
            <div className="col gap16">
              <div className="card">
                <div className="card-header">
                  <div className="sec-title">DevMind Recommendations</div>
                  <div className="sec-sub">prioritized by project impact</div>
                </div>
                <div className="card-body col gap10">
                  {recommendations.map((r, idx) => {
                    const targetHref = r.module
                      ? `/app/modules/${r.module}?repoId=${encodeURIComponent(currentRepoId)}`
                      : `/app/docs?repoId=${encodeURIComponent(currentRepoId)}`;

                    return (
                      <div key={idx} className="card card-pad rec-card">
                        <div className="rec-num">{idx + 1}</div>
                        <div className="grow">
                          <b className="rec-title">{r.title}</b>
                          <div className="rec-row mt8">
                            <span className="rec-label">Why this matters</span>
                            <span className="t2 small">{r.why}</span>
                          </div>
                          <div className="rec-row">
                            <span className="rec-label">Evidence</span>
                            <span className="t2 small">{r.evidence}</span>
                          </div>
                          <div className="rec-row">
                            <span className="rec-label">Suggested action</span>
                            <b className="t2 small" style={{ color: "var(--brand)" }}>
                              {r.action}
                            </b>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => router.push(targetHref)}
                        >
                          View details <Icon name="arrowRight" className="ic-sm" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <KnowledgePageContent />
    </Suspense>
  );
}
