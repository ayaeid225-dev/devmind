"use client";

import React from "react";
import Link from "next/link";
import { Icon, Badge, Button, MetricCard } from "@/components/ui";
import { DEVS, TEAM_SKILLS, MODULES } from "@/data/fixtures";

function getModuleById(id: string) {
  return MODULES.find((m) => m.id === id);
}

export default function DevsPage() {
  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Developer Insights</h1>
        <p className="page-sub">
          Understand your team’s technical strengths, ownership areas, and knowledge gaps.
        </p>
      </div>

      {/* Metric Grid */}
      <div className="metric-grid">
        <MetricCard
          icon="users"
          value={DEVS.length}
          label="Developers"
          delta="in this workspace"
          deltaTone="flat"
        />
        <MetricCard
          icon="checkCircle"
          value={14}
          label="Active Contributors"
          delta="last 30 days"
          deltaTone="flat"
        />
        <MetricCard
          icon="spark"
          value="78%"
          label="Knowledge Coverage"
          delta="across modules"
          deltaTone="flat"
        />
        <MetricCard
          icon="alert"
          value={6}
          label="Critical Areas"
          delta="need attention"
          deltaTone="flat"
        />
      </div>

      {/* Team Skill Map */}
      <div className="col gap16 mb24 mt16">
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Team Skill Map</div>
            <div className="sec-sub">
              Team coverage by knowledge area — where the team knows things, and where it doesn’t
            </div>
          </div>
          <div
            className="card-body"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px 40px",
            }}
          >
            {TEAM_SKILLS.map((s) => (
              <div key={s.area} className="skill-row">
                <span className="skill-name">{s.area}</span>
                <div className="progress skill-bar">
                  <span style={{ transform: `scaleX(${s.coverage / 100})` }} />
                </div>
                <span className="skill-pct mono">{s.coverage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Developers Section */}
      <div className="sec-head">
        <div className="sec-title">Developers</div>
        <div className="sec-sub">{DEVS.length} active contributors</div>
      </div>

      <div className="dev-grid">
        {DEVS.map((d) => {
          const initials = d.name
            .split(" ")
            .map((w) => w[0])
            .join("");

          const relMods = (d.modules || [])
            .map((modId) => getModuleById(modId))
            .filter(Boolean);

          return (
            <Link
              key={d.id}
              href={`/app/devs/${d.id}`}
              className="card dev-card card-hover"
              style={{ textDecoration: "none" }}
            >
              <div className="row gap12 align-center">
                <span className="dev-av" style={{ background: d.color }}>
                  {initials}
                </span>
                <div className="grow">
                  <div className="dev-name">{d.name}</div>
                  <div className="dev-role">{d.role}</div>
                </div>
                <Badge variant="outline" small>
                  {d.coverage}% knowledge
                </Badge>
              </div>

              <div className="dev-areas mt12">
                {d.strongAreas.map((area) => (
                  <Badge key={area} variant="gray" small>
                    {area}
                  </Badge>
                ))}
              </div>

              {relMods.length > 0 && (
                <div className="dev-mods mt12">
                  {relMods.map((m) => (
                    <span key={m!.id} className="mp-chip">
                      {m!.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="dev-recent mt12">
                <span style={{ color: "var(--text-3)" }}>
                  <Icon name="log" className="ic-sm" />
                </span>{" "}
                Recent contribution: <b className="t2">{d.recent}</b>
              </div>

              <div className="mt16" style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="secondary" size="sm">
                  View Developer Insights <Icon name="arrowRight" className="ic-sm" />
                </Button>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
