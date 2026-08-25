"use client";

import React, { use } from "react";
import Link from "next/link";
import { Icon, Badge, Button, useToast } from "@/components/ui";
import { FILES, MODULES, DOCS, DOC_CATS } from "@/data/fixtures";

function getModuleById(id: string) {
  return MODULES.find((m) => m.id === id);
}

function getDocCategoryName(catId: string): string {
  const cat = DOC_CATS.find((c) => c.id === catId);
  return cat ? cat.name : catId;
}

const DART_KEYWORDS = new Set([
  "import",
  "class",
  "final",
  "const",
  "var",
  "Future",
  "void",
  "String",
  "int",
  "double",
  "bool",
  "DateTime",
  "return",
  "if",
  "else",
  "for",
  "while",
  "throw",
  "required",
  "this",
  "super",
  "new",
  "try",
  "catch",
  "static",
  "enum",
  "Map",
  "List",
  "Set",
  "await",
  "async",
  "extends",
  "implements",
  "typedef",
  "package",
  "abstract",
  "sync",
]);

function formatTokenizedLine(line: string): string {
  const commentIdx = line.indexOf("//");
  let codePart = line;
  let commentPart = "";

  if (commentIdx !== -1) {
    codePart = line.slice(0, commentIdx);
    commentPart = line.slice(commentIdx);
  }

  // Tokenize keywords and strings in codePart
  const formattedCode = codePart
    .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (str) => `<span class="cv-tok-s">${escapeHtml(str)}</span>`)
    .split(/(\s+|[(){}[\];,.<>:=+*\/\-\?!])/)
    .map((tok) => {
      if (tok.startsWith('<span class="cv-tok-s">')) return tok;
      if (DART_KEYWORDS.has(tok.trim())) {
        return `<span class="cv-tok-k">${escapeHtml(tok)}</span>`;
      }
      return escapeHtml(tok);
    })
    .join("");

  const formattedComment = commentPart
    ? `<span class="cv-tok-c">${escapeHtml(commentPart)}</span>`
    : "";

  return formattedCode + formattedComment;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function EvidenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const toast = useToast();

  const file = FILES[id];

  if (!file) {
    return (
      <div className="fade-up">
        <div className="page-head">
          <h1 className="page-title">Evidence File Not Found</h1>
          <p className="page-sub">No code snippet indexed for evidence ID &quot;{id}&quot;.</p>
        </div>
        <div className="mt24">
          <Link href="/app/files">
            <Button variant="primary">
              <Icon name="arrowLeft" className="ic-sm" /> Back to Files
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const m = getModuleById(file.module);
  const fileName = file.path.split("/").pop() || file.path;
  const hlSet = new Set(file.code.hl || []);

  const relDocs = DOCS.filter(
    (d) =>
      (d.relFiles || []).includes(id) ||
      (d.modules || []).includes(file.module)
  ).slice(0, 3);

  const handleCopy = () => {
    const txt = file.code.lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt);
    }
    toast(`Copied ${fileName} to clipboard`, "info");
  };

  const firstHl = file.code.hl[0] || 1;
  const lastHl = file.code.hl[file.code.hl.length - 1] || 1;

  return (
    <div className="fade-up">
      {/* Code Header */}
      <div className="code-head">
        <div className="row between align-center">
          <div className="ch-path">{file.path}</div>
          <div className="row gap8 align-center">
            <Badge variant="lime">
              <Icon name="checkCircle" className="ic-sm" /> Referenced by DevMind
            </Badge>
            <Button variant="secondary" size="sm" id="ev-copy" onClick={handleCopy}>
              <Icon name="copy" className="ic-sm" /> Copy
            </Button>
          </div>
        </div>

        <div className="ch-meta">
          <span className="row gap5 align-center">
            <Icon name="modules" className="ic-sm" /> Module:{" "}
            <Link
              href={`/app/modules/${file.module}`}
              className="t2"
              style={{ cursor: "pointer", fontWeight: 600, textDecoration: "none" }}
            >
              {m ? m.name : file.module}
            </Link>
          </span>
          <span className="row gap5 align-center">
            <Icon name="file" className="ic-sm" /> Type: {file.type}
          </span>
          <span className="row gap5 align-center">
            <Icon name="clock" className="ic-sm" /> Last indexed 5h ago
          </span>
        </div>

        <div className="ai-note" style={{ margin: 0 }}>
          <span className="ai-ic">
            <Icon name="brain" className="ic-sm" />
          </span>
          <p style={{ fontSize: 12.5 }}>
            <b>Why DevMind referenced this file:</b> {file.note}
          </p>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="mt16 code-view">
        <div className="cv-head">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          <span className="cv-file">{file.path}</span>
          <span className="cv-badge badge badge-gray badge-sm">
            {firstHl}–{lastHl} highlighted
          </span>
        </div>

        <div className="cv-lines">
          {file.code.lines.map((line, idx) => {
            const lineNum = idx + 1;
            const isHl = hlSet.has(lineNum);
            const htmlContent = formatTokenizedLine(line);

            return (
              <div
                key={lineNum}
                className={`cv-line ${isHl ? "hl" : ""}`}
              >
                <span className="ln">{lineNum}</span>
                <span
                  className="lc"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Related Documentation */}
      {relDocs.length > 0 && (
        <div className="card mt16">
          <div className="card-header">
            <div className="sec-title">Related Documentation</div>
            <div className="sec-sub">docs that reference this file or module</div>
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
                  <div className="t3 tiny">{getDocCategoryName(doc.category)}</div>
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
