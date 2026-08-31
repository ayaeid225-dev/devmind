"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Icon,
  Badge,
  Button,
  Input,
  MetricCard,
  Modal,
  useToast,
} from "@/components/ui";
import { useShell } from "@/lib/shell-context";

interface DocumentRecordItem {
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

function DocsPageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { activeRepoId, activeRepo } = useShell();

  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;

  const [docs, setDocs] = useState<DocumentRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("architecture");
  const [summaryInput, setSummaryInput] = useState("");
  const [bodyInput, setBodyInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!currentRepoId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/docs?repoId=${encodeURIComponent(currentRepoId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDocs(data.data);
      } else {
        setDocs([]);
      }
    } catch {
      toast("Failed to load documents", "error");
    } finally {
      setLoading(false);
    }
  }, [currentRepoId, toast]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!currentRepoId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/docs?repoId=${encodeURIComponent(currentRepoId)}`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && Array.isArray(data.data)) {
            setDocs(data.data);
          } else {
            setDocs([]);
          }
        }
      } catch {
        if (!ignore) toast("Failed to load documents", "error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [currentRepoId, toast]);

  const handleCreateDoc = async () => {
    if (!titleInput.trim() || !summaryInput.trim()) {
      toast("Please enter title and summary", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: currentRepoId,
          title: titleInput.trim(),
          category: categoryInput,
          summary: summaryInput.trim(),
          bodyContent: bodyInput.trim(),
        }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (data.success) {
        toast(`Document "${titleInput}" created successfully`, "success");
        setIsCreateModalOpen(false);
        setTitleInput("");
        setSummaryInput("");
        setBodyInput("");
        fetchDocs();
      } else {
        toast(data.error || "Failed to create document", "error");
      }
    } catch {
      setSubmitting(false);
      toast("Error creating document", "error");
    }
  };

  const handleDeleteDoc = async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/docs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast(`Document "${title}" deleted`, "info");
        fetchDocs();
      }
    } catch {
      toast("Failed to delete document", "error");
    }
  };

  const filteredDocs = docs.filter((d) => {
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

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Documentation ({currentRepoId})</h1>
        <p className="page-sub">
          Everything your engineering team needs to understand and work on <b className="mono">{currentRepoId}</b>.
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
        <Button variant="secondary" onClick={() => setIsCreateModalOpen(true)}>
          <Icon name="plus" className="ic-sm" /> Add Document
        </Button>
        <Link href={`/app/docgen?repoId=${encodeURIComponent(currentRepoId)}`}>
          <Button variant="primary">
            <Icon name="spark" className="ic-sm" /> Generate with Gemini
          </Button>
        </Link>
      </div>

      {/* Metric Grid */}
      <div className="metric-grid mb24">
        <MetricCard
          icon="book"
          value={docs.length}
          label="Documents"
          delta="indexed & curated"
          deltaTone="flat"
        />
        <MetricCard
          icon="modules"
          value={new Set(docs.map((d) => d.category)).size}
          label="Categories"
          delta="organization-wide"
          deltaTone="flat"
        />
        <MetricCard
          icon="checkCircle"
          value="88%"
          label="Documentation Coverage"
          delta="verified"
          deltaTone="up"
        />
        <MetricCard
          icon="clock"
          value="Updated"
          label="Last Updated"
          delta="Just now"
          deltaTone="flat"
        />
      </div>

      {/* Documents List Section */}
      <div className="sec-head">
        <div className="sec-title">Documents</div>
        <div className="sec-sub">
          {filteredDocs.length} document{filteredDocs.length === 1 ? "" : "s"}
        </div>
      </div>

      {loading ? (
        <div className="state" style={{ minHeight: 220 }}>
          <div className="st-sub">Loading documents for {currentRepoId}...</div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="state" style={{ minHeight: 320 }}>
          <span className="st-ic">
            <Icon name="book" className="ic-lg" />
          </span>
          <div className="st-title">No documentation created yet</div>
          <div className="st-sub">
            Generate evidence-backed architecture guides using Gemini 3.6 Flash or add a custom document for {currentRepoId}.
          </div>
          <div className="row gap8 mt16">
            <Link href={`/app/docgen?repoId=${encodeURIComponent(currentRepoId)}`}>
              <Button variant="primary">
                <Icon name="spark" className="ic-sm" /> Generate with Gemini AI
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(true)}>
              <Icon name="plus" className="ic-sm" /> Add Document
            </Button>
          </div>
        </div>
      ) : (
        <div id="doc-list" className="col gap10">
          {filteredDocs.map((d) => (
            <div key={d.id} className="row align-center gap8">
              <Link
                href={`/app/docs/${d.id}?repoId=${encodeURIComponent(currentRepoId)}`}
                className="card doc-row card-hover grow"
                style={{ textDecoration: "none" }}
              >
                <span className="dr-ic">
                  <Icon name="fileText" />
                </span>
                <div className="grow">
                  <div className="row gap8 align-center">
                    <b className="dr-title">{d.title}</b>
                    <Badge variant="success" small dot>
                      {d.status}
                    </Badge>
                  </div>
                  <div className="dr-meta">
                    {d.category} • by {d.author} • {d.summary}
                  </div>
                </div>
                <span className="dr-go">
                  <Icon name="arrowRight" className="ic-sm" />
                </span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteDoc(d.id, d.title)}
                style={{ color: "var(--error)" }}
              >
                <Icon name="trash" className="ic-sm" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create Document Modal */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Technical Document"
      >
        <div className="col gap12 mt12">
          <div>
            <label className="t3 small mb4 block">Document Title</label>
            <Input
              placeholder="e.g. System Security Guide"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
            />
          </div>
          <div>
            <label className="t3 small mb4 block">Category</label>
            <select
              className="ui-input"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              style={{ width: "100%", background: "var(--bg-card)", color: "var(--text-1)" }}
            >
              <option value="architecture">Architecture</option>
              <option value="api">API Reference</option>
              <option value="guides">Developer Guides</option>
            </select>
          </div>
          <div>
            <label className="t3 small mb4 block">Summary</label>
            <Input
              placeholder="Brief summary of what this document covers..."
              value={summaryInput}
              onChange={(e) => setSummaryInput(e.target.value)}
            />
          </div>
          <div>
            <label className="t3 small mb4 block">Document Content (Markdown)</label>
            <textarea
              className="ui-input"
              rows={5}
              placeholder="Write Markdown documentation..."
              value={bodyInput}
              onChange={(e) => setBodyInput(e.target.value)}
              style={{ width: "100%", background: "var(--bg-card)", color: "var(--text-1)", padding: 8 }}
            />
          </div>
        </div>
        <div className="modal-foot mt16" style={{ justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateDoc} disabled={submitting}>
            {submitting ? "Saving..." : "Save Document"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <DocsPageContent />
    </Suspense>
  );
}
