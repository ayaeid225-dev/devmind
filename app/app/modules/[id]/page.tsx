"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Badge, Button, type BadgeVariant } from "@/components/ui";
import { MODULES, FILES, DOCS, DOC_CATS, EVIDENCE_ID_BY_PATH } from "@/data/fixtures";
import type { ModuleFixture, ModuleType } from "@/data/types";

const BADGE_MAP: Record<ModuleType, { variant: BadgeVariant; label: string }> = {
  core: { variant: "lime", label: "Core" },
  api: { variant: "cyan", label: "API" },
  db: { variant: "blue", label: "DB" },
  ext: { variant: "amber", label: "Ext" },
};

function getModuleById(id: string): ModuleFixture | undefined {
  return MODULES.find((m) => m.id === id);
}

function getDocCategoryName(catId: string): string {
  const cat = DOC_CATS.find((c) => c.id === catId);
  return cat ? cat.name : catId;
}

export default function ModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const m = getModuleById(id);

  if (!m) {
    return (
      <div className="fade-up">
        <div className="page-head">
          <h1 className="page-title">Module Not Found</h1>
          <p className="page-sub">No module matches ID &quot;{id}&quot;.</p>
        </div>
        <div className="mt24">
          <Link href="/app/modules">
            <Button variant="primary">
              <Icon name="arrowLeft" className="ic-sm" /> Back to Modules
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Files belonging to this module
  const moduleFiles = Object.entries(FILES)
    .filter(([, file]) => file.module === m.id)
    .map(([fileId, file]) => ({ id: fileId, ...file }));

  // Related docs referencing this module
  const relDocs = DOCS.filter((d) => (d.modules || []).includes(m.id));

  return (
    <div className="fade-up">
      {/* Module Hero Card */}
      <div className="card mod-hero">
        <span className="mod-badge-wrap">
          <Icon
            name={m.type === "db" ? "db" : m.type === "api" ? "code" : "modules"}
            className="ic-lg"
          />
        </span>
        <div className="grow">
          <h1>
            {m.name}{" "}
            <Badge variant={BADGE_MAP[m.type].variant}>
              <span className="dot" />
              {BADGE_MAP[m.type].label}
            </Badge>
          </h1>
          <p className="desc">{m.desc}</p>
          <div className="meta-row">
            <span className="row gap5 align-center">
              <Icon name="file" className="ic-sm" /> {m.files || 0} files
            </span>
            <span className="row gap5 align-center">
              <Icon name="deps" className="ic-sm" /> {(m.deps || []).length} dependencies
            </span>
            <span className="row gap5 align-center">
              <Icon name="users" className="ic-sm" /> {(m.dependents || []).length} dependents
            </span>
            <span className="row gap5 align-center">
              <Icon name="clock" className="ic-sm" /> last indexed 5h ago
            </span>
          </div>
        </div>
        <div className="col gap8" style={{ alignItems: "flex-end" }}>
          <Button
            variant="primary"
            id="mod-ask"
            onClick={() =>
              router.push(
                `/app/ask?q=${encodeURIComponent(`How does ${m.name} work?`)}`
              )
            }
          >
            <Icon name="ask" /> Ask DevMind about this module
          </Button>
          <Link href="/app/map">
            <Button variant="ghost" size="sm">
              View in map
            </Button>
          </Link>
        </div>
      </div>

      {/* DevMind AI Summary Note */}
      <div className="mt24 ai-note">
        <span className="ai-ic">
          <Icon name="brain" />
        </span>
        <div>
          <b className="small" style={{ color: "var(--brand)" }}>
            DevMind summary
          </b>
          <p>{m.ai || m.desc}</p>
        </div>
      </div>

      {/* Two Column Section */}
      <div
        className="mt24"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* Left Column: Important Files */}
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Important Files</div>
            <div className="sec-sub">{moduleFiles.length} indexed</div>
          </div>
          <div className="card-body col gap10">
            {moduleFiles.length ? (
              moduleFiles.map((file) => {
                const evidenceId =
                  file.id || EVIDENCE_ID_BY_PATH[file.path] || file.id;
                return (
                  <Link
                    key={file.id}
                    href={`/app/evidence/${evidenceId}`}
                    className="file-row"
                    style={{ textDecoration: "none" }}
                  >
                    <span className="fr-ic">
                      <Icon name="file" className="ic-sm" />
                    </span>
                    <span className="grow">
                      <div className="fr-name">{file.path.split("/").pop()}</div>
                      <div className="fr-path">{file.path}</div>
                    </span>
                    <Badge variant="gray">{file.type}</Badge>
                    <Icon name="chevronRight" className="ic-sm" />
                  </Link>
                );
              })
            ) : (
              <div className="state" style={{ padding: 24 }}>
                <span className="st-ic">
                  <Icon name="file" />
                </span>
                <div className="st-sub">No files indexed for this module yet.</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Key Functions, Dependencies, Related */}
        <div className="col gap16">
          {/* Key Functions */}
          <div className="card">
            <div className="card-header">
              <div className="sec-title">Key Functions</div>
            </div>
            <div className="card-body col gap8">
              {m.keyFns && m.keyFns.length > 0 ? (
                m.keyFns.map((fn, idx) => (
                  <div key={idx} className="fn-row">
                    <span className="grow">
                      <div className="fn-name">{fn[0]}</div>
                      <div className="fn-sig">{fn[1]}</div>
                    </span>
                    <Icon name="code" className="ic-sm" />
                  </div>
                ))
              ) : (
                <div className="t3 small">No exported functions detected.</div>
              )}
            </div>
          </div>

          {/* Dependencies */}
          <div className="card">
            <div className="card-header">
              <div className="sec-title">Dependencies</div>
              <div className="sec-sub">{(m.deps || []).length}</div>
            </div>
            <div className="card-body row wrap gap8">
              {m.deps && m.deps.length > 0 ? (
                m.deps.map((depId) => {
                  const target = getModuleById(depId);
                  if (!target) return null;
                  return (
                    <Link
                      key={depId}
                      href={`/app/modules/${depId}`}
                      className="mp-chip"
                      style={{ textDecoration: "none" }}
                    >
                      {target.name}
                    </Link>
                  );
                })
              ) : (
                <span className="t3 small">No internal dependencies.</span>
              )}
            </div>
          </div>

          {/* Related Modules */}
          <div className="card">
            <div className="card-header">
              <div className="sec-title">Related Modules</div>
            </div>
            <div className="card-body row wrap gap8">
              {m.related && m.related.length > 0 ? (
                m.related.map((relId) => {
                  const target = getModuleById(relId);
                  if (!target) return null;
                  return (
                    <Link
                      key={relId}
                      href={`/app/modules/${relId}`}
                      className="mp-chip"
                      style={{ textDecoration: "none" }}
                    >
                      {target.name}
                    </Link>
                  );
                })
              ) : (
                <span className="t3 small">None.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Related Documentation */}
      {relDocs.length > 0 && (
        <div className="card mt16">
          <div className="card-header">
            <div className="sec-title">Related Documentation</div>
            <div className="sec-sub">
              {relDocs.length} documents referencing this module
            </div>
          </div>
          <div className="card-body col gap8">
            {relDocs.map((doc) => (
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
