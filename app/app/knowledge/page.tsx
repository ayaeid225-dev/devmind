"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Badge, Button } from "@/components/ui";
import { TEAM_KNOWLEDGE, CONCENTRATION, RECS, DEVS, MODULES } from "@/data/fixtures";

function getDevByName(name: string) {
  return DEVS.find((d) => d.name === name);
}

function getModuleById(id: string) {
  return MODULES.find((m) => m.id === id);
}

export default function KnowledgePage() {
  const router = useRouter();

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Engineering Knowledge</h1>
        <p className="page-sub">
          Who knows what, what’s documented, and where the team should focus — one connected view.
        </p>
      </div>

      {/* Team Knowledge Map Card */}
      <div className="col gap16 mb24">
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Team Knowledge Map</div>
            <div className="sec-sub">
              developers → modules → technologies → knowledge areas
            </div>
          </div>
          <div className="card-body col gap8">
            {TEAM_KNOWLEDGE.map((t, idx) => {
              const dev = getDevByName(t.dev);
              const initials = t.dev
                .split(" ")
                .map((w) => w[0])
                .join("");

              const devHref = dev ? `/app/devs/${dev.id}` : "#";

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

      {/* Knowledge Concentration Card */}
      <div className="col gap16 mb24">
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Knowledge Concentration</div>
            <div className="sec-sub">
              project resilience insights — not individual reviews
            </div>
          </div>
          <div className="card-body">
            {CONCENTRATION.map((c, idx) => {
              const targetModule = getModuleById(c.module);
              const targetHref = targetModule
                ? `/app/modules/${c.module}`
                : `/app/docs`;

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

      {/* DevMind Recommendations Card */}
      <div className="col gap16">
        <div className="card">
          <div className="card-header">
            <div className="sec-title">DevMind Recommendations</div>
            <div className="sec-sub">prioritized by project impact</div>
          </div>
          <div className="card-body col gap10">
            {RECS.map((r, idx) => {
              const targetHref = r.module
                ? `/app/modules/${r.module}`
                : `/app/docs`;

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
    </div>
  );
}
