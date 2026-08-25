"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Badge, Button, useToast } from "@/components/ui";
import { DOCS, DOC_CATS, ADRS, DEVS, MODULES, FILES } from "@/data/fixtures";
import type { DocItem } from "@/data/types";

function getDocCategoryName(catId: string) {
  const c = DOC_CATS.find((cat) => cat.id === catId);
  return c ? c.name : catId;
}

function getDocCategoryIcon(catId: string) {
  const c = DOC_CATS.find((cat) => cat.id === catId);
  return c ? c.icon : "book";
}

function getModuleById(id: string) {
  return MODULES.find((m) => m.id === id);
}

function getFileByKey(key: string) {
  return FILES[key];
}

function getDevById(id: string) {
  return DEVS.find((d) => d.id === id);
}

function parseRichText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<b key={match.index}>{token.slice(2, -2)}</b>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={match.index}>{token.slice(1, -1)}</code>);
    }
    lastIdx = match.index + token.length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}

export default function DocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();

  // Find document in DOCS or fallback to ADRS
  let doc: DocItem | undefined = DOCS.find((d) => d.id === id);

  if (!doc) {
    const adr = ADRS.find((a) => a.id === id);
    if (adr) {
      doc = {
        id: adr.id,
        title: adr.title,
        category: "decisions",
        author: adr.author,
        updated: adr.date,
        status: "current",
        coverage: 90,
        modules: [adr.module],
        relFiles: adr.linkedFiles,
        relDecisions: [],
        owner: "dev-aya",
        tags: ["adr"],
        summary: adr.summary,
        sections: [
          { t: "h2", text: "Decision Overview" },
          { t: "p", text: adr.summary },
        ],
      };
    }
  }

  if (!doc) {
    return (
      <div className="fade-up">
        <div className="page-head">
          <h1 className="page-title">Document Not Found</h1>
          <p className="page-sub">No document matches ID &quot;{id}&quot;.</p>
        </div>
        <div className="mt24">
          <Link href="/app/docs">
            <Button variant="primary">
              <Icon name="arrowLeft" className="ic-sm" /> Back to Documentation
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const catName = getDocCategoryName(doc.category);
  const catIcon = getDocCategoryIcon(doc.category);
  const dev = getDevById(doc.owner);
  const initials = dev
    ? dev.name
        .split(" ")
        .map((w) => w[0])
        .join("")
    : doc.author
        .split(" ")
        .map((w) => w[0])
        .join("");

  const headings = doc.sections.filter(
    (s): s is { t: "h2"; text: string } => s.t === "h2"
  );

  const scrollToHeading = (text: string) => {
    const target = document.getElementById(
      `section-${text.toLowerCase().replace(/\s+/g, "-")}`
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="fade-up dv-wrap">
      {/* Table of Contents Sidebar */}
      <div className="dv-side">
        <div className="dv-side-t">On this page</div>
        {headings.length > 0 ? (
          headings.map((h, idx) => (
            <div
              key={idx}
              className="dv-toc-item"
              onClick={() => scrollToHeading(h.text)}
              style={{ cursor: "pointer" }}
            >
              {h.text}
            </div>
          ))
        ) : (
          <div className="t3 tiny">No sections</div>
        )}
      </div>

      {/* Main Document Content */}
      <div className="dv-main">
        <div className="dv-head">
          <div className="row gap8 mb8 align-center">
            <Badge variant="gray" small>
              <Icon name={catIcon} className="ic-sm" /> {catName}
            </Badge>

            {doc.match && (
              <Badge variant="success" small dot>
                Documentation matches current implementation
              </Badge>
            )}

            {doc.outdated && (
              <Badge variant="amber" small>
                <Icon name="alert" className="ic-sm" /> Documentation may be outdated
              </Badge>
            )}
          </div>

          <h1 className="page-title" style={{ fontSize: 24 }}>
            {doc.title}
          </h1>
          <p className="page-sub">{doc.summary}</p>

          <div className="dv-byline">
            <span
              className="dv-av"
              style={{ background: dev ? dev.color : "#4a5242" }}
            >
              {initials}
            </span>
            <span className="grow">
              <b>{doc.author}</b>
              <div className="t3 tiny">
                {doc.updated} {dev ? `• ${dev.role}` : ""}
              </div>
            </span>
            <Badge variant="outline" small>
              <Icon name="shield" className="ic-sm" /> Evidence-backed
            </Badge>
          </div>
        </div>

        {/* Match / Outdated Banner */}
        {doc.match && (
          <div className="mt24">
            <div className="dv-match ok">
              <span className="ai-ic">
                <Icon name="checkCircle" />
              </span>
              <div>
                <b>Matches current implementation</b>
                <p>
                  DevMind compared this document against{" "}
                  {(doc.relFiles || []).length} related files. No drift detected.
                </p>
              </div>
            </div>
          </div>
        )}

        {doc.outdated && (
          <div className="mt24">
            <div className="dv-match warn">
              <span className="ai-ic">
                <Icon name="alert" />
              </span>
              <div>
                <b>Documentation may be outdated</b>
                <p>
                  <b>Detected change:</b> {doc.outdated.changed}
                </p>
                <p>
                  <b>Documentation last updated:</b> {doc.outdated.lastDocUpdate}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                id="dv-review"
                onClick={() =>
                  toast(
                    `Reviewing drift in ${doc.outdated?.changeFiles?.join(", ") || "source files"}`,
                    "info"
                  )
                }
              >
                Review Difference
              </Button>
            </div>
          </div>
        )}

        {/* Render Document Sections */}
        <div className="dv-body">
          {doc.sections.map((s, idx) => {
            if (s.t === "h2") {
              const anchorId = `section-${s.text.toLowerCase().replace(/\s+/g, "-")}`;
              return (
                <h2 key={idx} id={anchorId} className="dv-h2">
                  {s.text}
                </h2>
              );
            }

            if (s.t === "p") {
              return (
                <p key={idx} className="dv-p">
                  {parseRichText(s.text)}
                </p>
              );
            }

            if (s.t === "list") {
              return (
                <ul key={idx} className="dv-list">
                  {s.items.map((item, itemIdx) => (
                    <li key={itemIdx}>{parseRichText(item)}</li>
                  ))}
                </ul>
              );
            }

            if (s.t === "code") {
              return (
                <div key={idx} className="ls-code">
                  <div className="ls-code-head">
                    <span className="dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="cv-file">{s.lang || "dart"}</span>
                  </div>
                  <pre className="ls-code-pre">
                    <code>{s.code}</code>
                  </pre>
                </div>
              );
            }

            if (s.t === "flow") {
              return (
                <div key={idx} className="dv-flow">
                  {s.items.map((item, itemIdx) => (
                    <React.Fragment key={itemIdx}>
                      <div className="dv-flow-item">
                        <span className="dv-flow-dot" />
                        {item}
                      </div>
                      {itemIdx < s.items.length - 1 && (
                        <div className="dv-flow-arrow">
                          <Icon name="chevronDown" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              );
            }

            if (s.t === "modules") {
              return (
                <div key={idx} className="dv-block">
                  <div className="dv-block-t">
                    <Icon name="modules" className="ic-sm" /> Related Modules
                  </div>
                  <div className="row wrap gap8">
                    {s.ids.map((modId) => {
                      const mm = getModuleById(modId);
                      if (!mm) return null;
                      return (
                        <Link
                          key={modId}
                          href={`/app/modules/${modId}`}
                          className="mp-chip"
                          style={{ textDecoration: "none" }}
                        >
                          {mm.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (s.t === "evidence") {
              return (
                <div key={idx} className="dv-block">
                  <div className="dv-block-t">
                    <Icon name="file" className="ic-sm" /> Related Files
                  </div>
                  <div className="ev-chips">
                    {s.files.map((fid) => {
                      const f = getFileByKey(fid);
                      if (!f) return null;
                      const fileName = f.path.split("/").pop() || f.path;
                      return (
                        <Link
                          key={fid}
                          href={`/app/evidence/${fid}`}
                          className="ev-chip"
                          style={{ textDecoration: "none" }}
                        >
                          <Icon name="file" className="ic-sm" /> {fileName}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (s.t === "decisions") {
              return (
                <div key={idx} className="dv-block">
                  <div className="dv-block-t">
                    <Icon name="branch" className="ic-sm" /> Related Decisions
                  </div>
                  <div className="row wrap gap8">
                    {s.ids.map((aid) => {
                      const adr = ADRS.find((a) => a.id === aid);
                      if (!adr) return null;
                      return (
                        <Link
                          key={aid}
                          href={`/app/docs/${aid}`}
                          className="mp-chip"
                          style={{ textDecoration: "none" }}
                        >
                          {adr.id} — {adr.title}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (s.t === "endpoint") {
              return (
                <div key={idx} className="dv-endpoint">
                  <span className="dv-end-method">{s.method}</span>
                  <code className="dv-end-path">{s.path}</code>
                  <span className="dv-end-desc">{s.desc}</span>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Right Side Info Panel */}
      <div className="dv-side-info">
        {doc.modules && doc.modules.length > 0 && (
          <div className="dv-side-block">
            <div className="dv-sb-title">
              <Icon name="modules" className="ic-sm" /> Related Modules
            </div>
            <div className="row wrap gap8">
              {doc.modules.map((modId) => {
                const mm = getModuleById(modId);
                if (!mm) return null;
                return (
                  <Link
                    key={modId}
                    href={`/app/modules/${modId}`}
                    className="mp-chip"
                    style={{ textDecoration: "none" }}
                  >
                    {mm.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {doc.relFiles && doc.relFiles.length > 0 && (
          <div className="dv-side-block">
            <div className="dv-sb-title">
              <Icon name="file" className="ic-sm" /> Related Files
            </div>
            <div className="ev-chips">
              {doc.relFiles.map((fid) => {
                const f = getFileByKey(fid);
                if (!f) return null;
                const fileName = f.path.split("/").pop() || f.path;
                return (
                  <Link
                    key={fid}
                    href={`/app/evidence/${fid}`}
                    className="ev-chip"
                    style={{ textDecoration: "none" }}
                  >
                    <Icon name="file" className="ic-sm" /> {fileName}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {doc.relDecisions && doc.relDecisions.length > 0 && (
          <div className="dv-side-block">
            <div className="dv-sb-title">
              <Icon name="branch" className="ic-sm" /> Related Decisions
            </div>
            <div className="row wrap gap8">
              {doc.relDecisions.map((aid) => {
                const adr = ADRS.find((a) => a.id === aid);
                if (!adr) return null;
                return (
                  <Link
                    key={aid}
                    href={`/app/docs/${aid}`}
                    className="mp-chip"
                    style={{ textDecoration: "none" }}
                  >
                    {adr.id}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="col gap8 mt16">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast(`Editing mode enabled for ${doc?.title}`, "info")
            }
          >
            <Icon name="fileText" className="ic-sm" /> Edit Document
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              router.push(
                `/app/ask?q=${encodeURIComponent(`Explain ${doc?.title}`)}`
              )
            }
          >
            <Icon name="ask" className="ic-sm" /> Ask DevMind about this doc
          </Button>
        </div>
      </div>
    </div>
  );
}
