"use client";

import React, { use, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Badge, Button, CodeViewer, useToast } from "@/components/ui";
import { useShell } from "@/lib/shell-context";

interface DbFileRecord {
  id: string;
  repoId: string;
  moduleId: string | null;
  path: string;
  size: string;
  type: string;
  updatedText: string;
  module?: { id: string; name: string; type: string } | null;
  documentChunks?: Array<{
    id: string;
    content: string;
    startLine: number;
    endLine: number;
    chunkIndex: number;
  }>;
}

const DART_KEYWORDS = new Set([
  "import", "class", "final", "const", "var", "Future", "void", "String",
  "int", "double", "bool", "DateTime", "return", "if", "else", "for",
  "while", "throw", "required", "this", "super", "new", "try", "catch",
  "static", "enum", "Map", "List", "Set", "await", "async", "extends",
  "implements", "typedef", "package", "abstract", "sync",
]);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTokenizedLine(line: string): string {
  const commentIdx = line.indexOf("//");
  let codePart = line;
  let commentPart = "";

  if (commentIdx !== -1) {
    codePart = line.slice(0, commentIdx);
    commentPart = line.slice(commentIdx);
  }

  const formattedCode = codePart
    .replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, (str) => `<span class="cv-tok-s">${escapeHtml(str)}</span>`)
    .split(/(\s+|[(){}[\];,.<>:=+*\/\-?!])/)
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

function EvidenceDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { activeRepoId, activeRepo } = useShell();

  const repoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;

  const [file, setFile] = useState<DbFileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/files/${id}`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && data.data) {
            setFile(data.data);
          } else {
            setNotFound(true);
          }
        }
      } catch {
        if (!ignore) setNotFound(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [id]);

  const targetLine = searchParams.get("line") ? parseInt(searchParams.get("line")!, 10) : undefined;

  const codeLines = React.useMemo(() => {
    if (!file?.documentChunks || file.documentChunks.length === 0) {
      if (file?.updatedText && file.updatedText.includes("\n")) {
        return file.updatedText.split("\n");
      }
      return [];
    }
    const lines: string[] = [];
    for (const chunk of file.documentChunks) {
      const chunkLines = chunk.content.split("\n");
      for (let i = 0; i < chunkLines.length; i++) {
        const lineIdx = chunk.startLine + i - 1;
        lines[lineIdx] = chunkLines[i];
      }
    }
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === undefined) lines[i] = "";
    }
    return lines;
  }, [file]);

  if (loading) {
    return (
      <div className="fade-up">
        <div className="state" style={{ minHeight: 320 }}>
          <div className="st-sub">Loading file details...</div>
        </div>
      </div>
    );
  }

  if (notFound || !file) {
    return (
      <div className="fade-up">
        <div className="page-head">
          <h1 className="page-title">Evidence File Not Found</h1>
          <p className="page-sub">No code file indexed for evidence ID &quot;{id}&quot;.</p>
        </div>
        <div className="mt24">
          <Link href={repoId ? `/app/files?repoId=${encodeURIComponent(repoId)}` : "/app/files"}>
            <Button variant="primary">
              <Icon name="arrowLeft" className="ic-sm" /> Back to Files
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const fileName = file.path.split("/").pop() || file.path;

  const handleCopy = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(file.path);
    }
    toast(`Copied ${fileName} path to clipboard`, "info");
  };

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
              <Icon name="copy" className="ic-sm" /> Copy Path
            </Button>
          </div>
        </div>

        <div className="ch-meta">
          {file.module && (
            <span className="row gap5 align-center">
              <Icon name="modules" className="ic-sm" /> Module:{" "}
              <Link
                href={`/app/modules/${file.module.id}?repoId=${encodeURIComponent(repoId)}`}
                className="t2"
                style={{ cursor: "pointer", fontWeight: 600, textDecoration: "none" }}
              >
                {file.module.name}
              </Link>
            </span>
          )}
          <span className="row gap5 align-center">
            <Icon name="file" className="ic-sm" /> Type: {file.type}
          </span>
          <span className="row gap5 align-center">
            <Icon name="clock" className="ic-sm" /> {file.updatedText || "Indexed"}
          </span>
          <span className="row gap5 align-center">
            <Icon name="spark" className="ic-sm" /> Size: {file.size}
          </span>
        </div>

        <div className="ai-note" style={{ margin: 0 }}>
          <span className="ai-ic">
            <Icon name="brain" className="ic-sm" />
          </span>
          <p style={{ fontSize: 12.5 }}>
            <b>Repository:</b> <span className="mono">{file.repoId}</span>
          </p>
        </div>
      </div>

      {/* File Info Card */}
      <div className="card mt16">
        <div className="card-header">
          <div className="sec-title">File Information</div>
        </div>
        <div className="card-body col gap10">
          <div className="fn-row">
            <span className="grow">
              <div className="fn-name">Full Path</div>
              <div className="fn-sig mono">{file.path}</div>
            </span>
          </div>
          <div className="fn-row">
            <span className="grow">
              <div className="fn-name">File Type</div>
              <div className="fn-sig">{file.type}</div>
            </span>
          </div>
          <div className="fn-row">
            <span className="grow">
              <div className="fn-name">Size</div>
              <div className="fn-sig">{file.size}</div>
            </span>
          </div>
          {file.module && (
            <div className="fn-row">
              <span className="grow">
                <div className="fn-name">Module</div>
                <div className="fn-sig">
                  <Link
                    href={`/app/modules/${file.module.id}?repoId=${encodeURIComponent(repoId)}`}
                    style={{ color: "var(--brand)", textDecoration: "none" }}
                  >
                    {file.module.name}
                  </Link>
                </div>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Source Code Viewer Section */}
      {codeLines.length > 0 && (
        <div className="card mt16">
          <div className="card-header row between align-center">
            <div className="sec-title">File Source Content</div>
            {targetLine && (
              <Badge variant="lime" small>
                Line {targetLine} highlighted
              </Badge>
            )}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <CodeViewer
              path={file.path}
              lines={codeLines}
              highlight={targetLine ? [targetLine] : undefined}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="card mt16">
        <div className="card-header">
          <div className="sec-title">Actions</div>
        </div>
        <div className="card-body row gap8">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              router.push(`/app/ask?q=${encodeURIComponent(`Explain the file: ${file.path}`)}`)
            }
          >
            <Icon name="ask" className="ic-sm" /> Ask DevMind about this file
          </Button>
          {file.module && (
            <Link
              href={`/app/modules/${file.module.id}?repoId=${encodeURIComponent(repoId)}`}
            >
              <Button variant="secondary" size="sm">
                <Icon name="modules" className="ic-sm" /> View Module
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EvidenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <EvidenceDetailContent params={params} />
    </Suspense>
  );
}
