"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Icon,
  Badge,
  Button,
  Input,
  MetricCard,
  Modal,
  useToast,
} from "@/components/ui";
import { DOCS, DOC_CATS, MODULES } from "@/data/fixtures";
import type { DocItem } from "@/data/types";

function getModuleById(id: string) {
  return MODULES.find((m) => m.id === id);
}

function getDocCategoryName(catId: string) {
  const c = DOC_CATS.find((cat) => cat.id === catId);
  return c ? c.name : catId;
}

function renderDocStatusBadge(status: DocItem["status"]) {
  if (status === "current") {
    return (
      <Badge variant="success" small dot>
        Up to date
      </Badge>
    );
  }
  if (status === "review") {
    return (
      <Badge variant="amber" small>
        <Icon name="alert" className="ic-sm" /> Needs review
      </Badge>
    );
  }
  if (status === "outdated") {
    return (
      <Badge variant="error" small>
        <Icon name="alert" className="ic-sm" /> May be outdated
      </Badge>
    );
  }
  return <Badge variant="gray" small>Draft</Badge>;
}

export default function DocsPage() {
  const router = useRouter();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  const filteredDocs = DOCS.filter((d) => {
    if (activeCategory && d.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.author.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const healthIssues = [
    "3 documents may be outdated",
    "2 modules have missing documentation",
    "1 API endpoint has no documentation",
  ];

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Documentation</h1>
        <p className="page-sub">
          Everything your engineering team needs to understand and work on this project.
        </p>
      </div>

      {/* Top Toolbar */}
      <div className="row gap8 mb16 align-center" style={{ flexWrap: "wrap" }}>
        <div className="input-wrap" style={{ flex: 1, maxWidth: 420 }}>
          <Input
            icon="search"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Link href="/app/docgen">
          <Button variant="primary">
            <Icon name="fileText" /> Add Documentation
          </Button>
        </Link>
        <Link href="/app/docgen">
          <Button variant="secondary">
            <Icon name="spark" /> Generate Documentation
          </Button>
        </Link>
      </div>

      {/* Metric Grid */}
      <div className="metric-grid">
        <MetricCard
          icon="book"
          value={DOCS.length}
          label="Documents"
          delta="indexed & curated"
          deltaTone="flat"
        />
        <MetricCard
          icon="modules"
          value={DOC_CATS.length}
          label="Categories"
          delta="organization-wide"
          deltaTone="flat"
        />
        <MetricCard
          icon="checkCircle"
          value="92%"
          label="Documentation Coverage"
          delta="+4% this month"
          deltaTone="up"
        />
        <MetricCard
          icon="clock"
          value="Updated"
          label="Last Updated"
          delta="2 hours ago"
          deltaTone="flat"
        />
      </div>

      {/* Documentation Health Card */}
      <div className="col gap16 mb24 mt16">
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Documentation Health</div>
            <div className="sec-sub">
              DevMind’s view of what’s documented and what’s drifting
            </div>
          </div>
          <div className="card-body">
            <div className="dh-row">
              <div className="dh-big">
                <div className="dh-pct">92%</div>
                <div className="dh-label">Health</div>
              </div>
              <div className="grow">
                <div className="progress" style={{ height: 10 }}>
                  <span style={{ transform: "scaleX(0.92)" }} />
                </div>
                <div className="dh-issues mt16">
                  {healthIssues.map((issue, idx) => (
                    <div key={idx} className="dh-issue">
                      <span style={{ color: "var(--warning)" }}>
                        <Icon name="alert" className="ic-sm" />
                      </span>
                      {issue}
                    </div>
                  ))}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                id="doc-health-review"
                onClick={() => setIsHealthModalOpen(true)}
              >
                Review Issues
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="sec-head">
        <div className="sec-title">Categories</div>
        <div className="sec-sub">{DOC_CATS.length} total</div>
      </div>

      <div className="doc-cats">
        {DOC_CATS.map((c) => {
          const docCount = DOCS.filter((d) => d.category === c.id).length;
          const isActive = activeCategory === c.id;

          return (
            <div
              key={c.id}
              className={`card doc-cat card-hover ${isActive ? "active" : ""}`}
              onClick={() => {
                if (docCount > 0) {
                  setActiveCategory(isActive ? null : c.id);
                } else {
                  toast("Empty category", "info");
                }
              }}
            >
              <span className="dc-ic">
                <Icon name={c.icon} />
              </span>
              <div className="grow">
                <div className="dc-name">{c.name}</div>
                <div className="dc-meta">
                  {docCount} document{docCount === 1 ? "" : "s"} • Updated {c.updated}
                </div>
              </div>
              <div className="dc-cov">
                <span className="dc-cov-pct">{c.coverage}%</span>
                <div className="progress dc-progress">
                  <span style={{ transform: `scaleX(${c.coverage / 100})` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Documents List Section */}
      <div className="sec-head mt32">
        <div className="sec-title">Documents</div>
        <div className="sec-sub">
          {filteredDocs.length} document{filteredDocs.length === 1 ? "" : "s"}
          {activeCategory && (
            <>
              {" "}
              • filtered by <b className="t2">{getDocCategoryName(activeCategory)}</b>
            </>
          )}
        </div>
        {activeCategory && (
          <Button
            variant="ghost"
            size="sm"
            id="doc-clear-filter"
            onClick={() => setActiveCategory(null)}
          >
            <Icon name="close" className="ic-sm" /> Clear filter
          </Button>
        )}
      </div>

      <div id="doc-list" className="col gap10">
        {filteredDocs.length === 0 ? (
          <div className="state">
            <span className="st-ic">
              <Icon name="search" />
            </span>
            <div className="st-title">No documents found</div>
            <div className="st-sub">Nothing matches &quot;{searchQuery}&quot;.</div>
          </div>
        ) : (
          filteredDocs.map((d) => {
            const relMods = (d.modules || [])
              .map((modId) => getModuleById(modId))
              .filter(Boolean);

            return (
              <Link
                key={d.id}
                href={`/app/docs/${d.id}`}
                className="card doc-row card-hover"
                style={{ textDecoration: "none" }}
              >
                <span className="dr-ic">
                  <Icon name="fileText" />
                </span>
                <div className="grow">
                  <div className="row gap8 align-center">
                    <b className="dr-title">{d.title}</b>
                    {renderDocStatusBadge(d.status)}
                  </div>
                  <div className="dr-meta">
                    {getDocCategoryName(d.category)} • by {d.author} • updated {d.updated}
                  </div>
                  {relMods.length > 0 && (
                    <div className="dr-mods">
                      Related:{" "}
                      {relMods.map((m) => (
                        <span key={m!.id} className="mp-chip">
                          {m!.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="dr-go">
                  <Icon name="arrowRight" className="ic-sm" />
                </span>
              </Link>
            );
          })
        )}
      </div>

      {/* Health Review Modal */}
      <Modal
        open={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        title="Documentation health"
      >
        <div className="col gap8">
          {healthIssues.map((issue, idx) => (
            <div
              key={idx}
              className="row gap8 align-center"
              style={{
                padding: "9px 0",
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
              <span style={{ color: "var(--warning)" }}>
                <Icon name="alert" />
              </span>
              <span className="grow">{issue}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  toast("Opened the related document for review", "info");
                  setIsHealthModalOpen(false);
                }}
              >
                Review
              </Button>
            </div>
          ))}
        </div>
        <div className="modal-foot mt16" style={{ justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setIsHealthModalOpen(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setIsHealthModalOpen(false);
              router.push("/app/docgen");
            }}
          >
            Generate missing docs
          </Button>
        </div>
      </Modal>
    </div>
  );
}
