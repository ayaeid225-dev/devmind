"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Badge, Button } from "@/components/ui";
import { DEVS, MODULES, DOCS, DOC_CATS } from "@/data/fixtures";
import type { Developer } from "@/data/types";

function getModuleById(id: string) {
  return MODULES.find((m) => m.id === id);
}

function getDocCategoryName(catId: string) {
  const c = DOC_CATS.find((cat) => cat.id === catId);
  return c ? c.name : catId;
}

function DevRadarSvg({ dev }: { dev: Developer }) {
  const cats = dev.radar.map((r) => r[0]);
  const vals = dev.radar.map((r) => r[1]);
  const n = vals.length;
  const cx = 60;
  const cy = 60;
  const R = 48;

  function pt(i: number, r: number) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }

  function ring(r: number) {
    const p: string[] = [];
    for (let i = 0; i < n; i++) p.push(pt(i, r));
    return p.join(" ");
  }

  const polygonPoints: string[] = [];
  for (let i = 0; i < n; i++) {
    polygonPoints.push(pt(i, (vals[i] / 100) * R));
  }

  const gridRings = [0.25, 0.5, 0.75, 1].map((g) => ring(R * g));

  const labelElements: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const lx = (cx + (R + 16) * Math.cos(a)).toFixed(1);
    const ly = (cy + (R + 16) * Math.sin(a)).toFixed(1);
    labelElements.push(
      <text
        key={cats[i]}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        className="radar-label"
      >
        {cats[i]}
      </text>
    );
  }

  return (
    <svg viewBox="0 0 120 120" className="radar-svg">
      {gridRings.map((g, i) => (
        <polygon
          key={i}
          points={g}
          fill="none"
          stroke="#293024"
          strokeWidth={0.5}
          strokeOpacity={i === 3 ? 0.3 : 1}
        />
      ))}
      <polygon
        points={polygonPoints.join(" ")}
        fill="rgba(200,214,43,.14)"
        stroke="#C8D62B"
        strokeWidth={1.2}
      />
      <circle cx={cx} cy={cy} r={1.5} fill="#C8D62B" />
      {labelElements}
    </svg>
  );
}

export default function DevDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const d = DEVS.find((dev) => dev.id === id);

  if (!d) {
    return (
      <div className="fade-up">
        <div className="page-head">
          <h1 className="page-title">Developer Not Found</h1>
          <p className="page-sub">No developer profile matches ID &quot;{id}&quot;.</p>
        </div>
        <div className="mt24">
          <Link href="/app/devs">
            <Button variant="primary">
              <Icon name="arrowLeft" className="ic-sm" /> Back to Developer Insights
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const initials = d.name
    .split(" ")
    .map((w) => w[0])
    .join("");

  const firstName = d.name.split(" ")[0];

  const docsByDev = DOCS.filter((doc) => doc.owner === d.id);

  const relatedModules = (d.modules || [])
    .map((modId) => getModuleById(modId))
    .filter(Boolean);

  return (
    <div className="fade-up">
      {/* Developer Hero Card */}
      <div className="card mod-hero">
        <span
          className="dev-av"
          style={{
            width: 52,
            height: 52,
            borderRadius: 13,
            background: d.color,
            fontSize: 16,
          }}
        >
          {initials}
        </span>
        <div className="grow">
          <h1>{d.name}</h1>
          <p className="desc">
            {d.role} • {d.blurb}
          </p>
          <div className="meta-row">
            <span className="row gap5 align-center">
              <Icon name="spark" className="ic-sm" /> Knowledge coverage {d.coverage}%
            </span>
            <span className="row gap5 align-center">
              <Icon name="modules" className="ic-sm" /> {d.modules.length} modules
            </span>
            <span className="row gap5 align-center">
              <Icon name="clock" className="ic-sm" /> Recent: {d.recent}
            </span>
          </div>
        </div>
        <div className="col gap8" style={{ alignItems: "flex-end" }}>
          <Button
            variant="primary"
            onClick={() =>
              router.push(
                `/app/ask?q=${encodeURIComponent(
                  `How does ${d.name}'s work fit into the architecture?`
                )}`
              )
            }
          >
            <Icon name="ask" /> Ask about {firstName}’s areas
          </Button>
        </div>
      </div>

      {/* DevMind AI Insight Note */}
      <div className="ai-note mt24">
        <span className="ai-ic">
          <Icon name="brain" />
        </span>
        <div>
          <b className="small" style={{ color: "var(--brand)" }}>
            DevMind insight
          </b>
          <p>
            Insights are derived from repository activity, module ownership, and
            documentation authorship — they reflect contribution areas, not performance.
          </p>
        </div>
      </div>

      {/* Row 1: Technical Strengths & Strong Contribution Areas */}
      <div
        className="mt24"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Technical Strengths</div>
          </div>
          <div className="card-body col gap8">
            {d.strongAreas.map((area) => (
              <div key={area} className="strength-row">
                <span className="row gap8 align-center" style={{ flex: 1 }}>
                  <Icon name="spark" className="ic-sm" />
                  <span>{area}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="sec-title">Strong Contribution Areas</div>
          </div>
          <div className="card-body col gap8">
            {relatedModules.length > 0 ? (
              <div className="row wrap gap8">
                {relatedModules.map((m) => (
                  <Link
                    key={m!.id}
                    href={`/app/modules/${m!.id}`}
                    className="mp-chip"
                    style={{ textDecoration: "none" }}
                  >
                    {m!.name}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="t3 small">No module ownership detected</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Knowledge Areas & Strengths Radar Visualization */}
      <div
        className="mt16"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Knowledge Areas</div>
            <div className="sec-sub">based on authored code and docs</div>
          </div>
          <div className="card-body">
            <div className="kb-block">
              <div className="kb-t">Strong</div>
              <div className="row wrap gap8">
                {d.strongAreas.map((area) => (
                  <Badge key={area} variant="success" small dot>
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="kb-block">
              <div className="kb-t">Developing</div>
              <div className="row wrap gap8">
                {d.developingAreas.map((area) => (
                  <Badge key={area} variant="amber" small>
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="kb-block" style={{ marginBottom: 0 }}>
              <div className="kb-t">Related knowledge</div>
              <div className="row wrap gap8">
                {d.knowledge.map((area) => (
                  <Badge key={area} variant="gray" small>
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="sec-title">Strengths Visualization</div>
            <div className="sec-sub">relative to the team</div>
          </div>
          <div className="card-body" style={{ display: "grid", placeItems: "center" }}>
            <DevRadarSvg dev={d} />
          </div>
        </div>
      </div>

      {/* Row 3: Focus Areas & Recommended Learning */}
      <div
        className="mt16"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Focus Areas</div>
            <div className="sec-sub">growth opportunities</div>
          </div>
          <div className="card-body">
            <ul className="dv-list" style={{ margin: 0 }}>
              {d.focus.map((f, idx) => (
                <li key={idx}>{f}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="sec-title">Recommended Learning</div>
            <div className="sec-sub">a suggested sequence</div>
          </div>
          <div className="card-body">
            <ul className="dv-list" style={{ margin: 0 }}>
              {d.learning.map((l, idx) => (
                <li key={idx}>
                  {idx + 1}. {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Row 4: Recent Contributions & Documentation */}
      <div
        className="mt16"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Recent Contributions</div>
          </div>
          <div className="card-body col gap6">
            {d.contributions.map((c, idx) => (
              <div key={idx} className="contribution-row">
                <Icon name="checkCircle" className="ic-sm" /> {c}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="sec-title">Documentation</div>
            <div className="sec-sub">authored or maintained</div>
          </div>
          <div className="card-body col gap8">
            {docsByDev.length > 0 ? (
              docsByDev.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/app/docs/${doc.id}`}
                  className="doc-link-row"
                  style={{ textDecoration: "none" }}
                >
                  <Icon name="book" className="ic-sm" />
                  <span className="grow">
                    <b>{doc.title}</b>
                    <div className="t3 tiny">
                      {getDocCategoryName(doc.category)} • {doc.status}
                    </div>
                  </span>
                  <Icon name="arrowUpRight" className="ic-sm" />
                </Link>
              ))
            ) : (
              <div className="t3 small">No authored documentation yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 5: Modules Owned / Contributed */}
      {relatedModules.length > 0 && (
        <div className="card mt16">
          <div className="card-header">
            <div className="sec-title">Modules Owned / Contributed</div>
          </div>
          <div className="card-body col gap8">
            {relatedModules.map((mm) => (
              <Link
                key={mm!.id}
                href={`/app/modules/${mm!.id}`}
                className="rel-mod"
                style={{ textDecoration: "none" }}
              >
                <span className="mod-badge-wrap" style={{ width: 34, height: 34 }}>
                  <Icon
                    name={mm!.type === "db" ? "db" : "modules"}
                    className="ic-sm"
                  />
                </span>
                <span className="grow">
                  <div className="rm-name">{mm!.name}</div>
                  <div className="rm-sub">{(mm!.desc || "").slice(0, 60)}</div>
                </span>
                <Badge variant="gray" small>
                  {mm!.files} files
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
