"use client";

import React, { use, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Badge, Button, useToast } from "@/components/ui";
import { useShell } from "@/lib/shell-context";

interface DbDocument {
  id: string;
  repoId: string;
  category: string;
  title: string;
  summary: string;
  author: string;
  status: string;
  coverage: number;
  contentJson: string;
  createdAt: string;
}

interface ParsedSection {
  h?: string;
  body?: string;
}

function getStatusVariant(status: string): "lime" | "amber" | "gray" | "outline" {
  switch (status) {
    case "verified": return "lime";
    case "current": return "lime";
    case "draft": return "amber";
    case "outdated": return "amber";
    default: return "gray";
  }
}

function DocDetailContent({
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

  const [doc, setDoc] = useState<DbDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/docs/${id}`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && data.data) {
            setDoc(data.data);
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

  if (loading) {
    return (
      <div className="fade-up">
        <div className="state" style={{ minHeight: 320 }}>
          <div className="st-sub">Loading document...</div>
        </div>
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div className="fade-up">
        <div className="page-head">
          <h1 className="page-title">Document Not Found</h1>
          <p className="page-sub">No document matches ID &quot;{id}&quot;.</p>
        </div>
        <div className="mt24">
          <Link href={repoId ? `/app/docs?repoId=${encodeURIComponent(repoId)}` : "/app/docs"}>
            <Button variant="primary">
              <Icon name="arrowLeft" className="ic-sm" /> Back to Documentation
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Parse the contentJson sections if possible
  let sections: ParsedSection[] = [];
  try {
    const parsed = JSON.parse(doc.contentJson);
    if (Array.isArray(parsed)) {
      sections = parsed;
    }
  } catch {
    // contentJson may be raw string
  }

  const initials = doc.author
    .split(" ")
    .map((w) => w[0])
    .join("");

  const statusVariant = getStatusVariant(doc.status);

  return (
    <div className="fade-up dv-wrap">
      {/* Table of Contents Sidebar */}
      <div className="dv-side">
        <div className="dv-side-t">On this page</div>
        {sections.length > 0 ? (
          sections
            .filter((s) => s.h)
            .map((s, idx) => (
              <div
                key={idx}
                className="dv-toc-item"
                onClick={() => {
                  const target = document.getElementById(
                    `section-${(s.h || "").toLowerCase().replace(/\s+/g, "-")}`
                  );
                  if (target) target.scrollIntoView({ behavior: "smooth" });
                }}
                style={{ cursor: "pointer" }}
              >
                {s.h}
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
              <Icon name="book" className="ic-sm" /> {doc.category}
            </Badge>
            <Badge variant={statusVariant} small dot>
              {doc.status}
            </Badge>
          </div>

          <h1 className="page-title" style={{ fontSize: 24 }}>
            {doc.title}
          </h1>
          <p className="page-sub">{doc.summary}</p>

          <div className="dv-byline">
            <span className="dv-av" style={{ background: "#4a5242" }}>
              {initials}
            </span>
            <span className="grow">
              <b>{doc.author}</b>
              <div className="t3 tiny">
                {new Date(doc.createdAt).toLocaleDateString()}
              </div>
            </span>
            <Badge variant="outline" small>
              <Icon name="shield" className="ic-sm" /> Evidence-backed
            </Badge>
          </div>
        </div>

        {/* Render Document Sections */}
        <div className="dv-body">
          {sections.length > 0 ? (
            sections.map((s, idx) => (
              <React.Fragment key={idx}>
                {s.h && (
                  <h2
                    id={`section-${s.h.toLowerCase().replace(/\s+/g, "-")}`}
                    className="dv-h2"
                  >
                    {s.h}
                  </h2>
                )}
                {s.body && <p className="dv-p">{s.body}</p>}
              </React.Fragment>
            ))
          ) : (
            <p className="dv-p">{doc.summary}</p>
          )}
        </div>
      </div>

      {/* Right Side Info Panel */}
      <div className="dv-side-info">
        <div className="dv-side-block">
          <div className="dv-sb-title">
            <Icon name="book" className="ic-sm" /> Document Info
          </div>
          <div className="col gap6">
            <div className="t3 tiny">
              <b>Category:</b> {doc.category}
            </div>
            <div className="t3 tiny">
              <b>Status:</b> {doc.status}
            </div>
            <div className="t3 tiny">
              <b>Coverage:</b> {doc.coverage}%
            </div>
            <div className="t3 tiny">
              <b>Repository:</b> <span className="mono">{doc.repoId}</span>
            </div>
          </div>
        </div>

        <div className="col gap8 mt16">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast(`Editing mode enabled for ${doc.title}`, "info")}
          >
            <Icon name="fileText" className="ic-sm" /> Edit Document
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              router.push(
                `/app/ask?q=${encodeURIComponent(`Explain ${doc.title}`)}`
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

export default function DocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <DocDetailContent params={params} />
    </Suspense>
  );
}
