"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icon, Badge, Button, Input, Modal, useToast } from "@/components/ui";
import { useShell } from "@/lib/shell-context";

interface DependencyRecordItem {
  id: string;
  repoId: string;
  kind: string;
  name: string | null;
  version: string | null;
  purpose: string | null;
  status: string | null;
  fromModule: string | null;
  toModule: string | null;
}

function DependenciesPageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { activeRepoId, activeRepo } = useShell();

  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;

  const [deps, setDeps] = useState<DependencyRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"int" | "ext">("int");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [kindInput, setKindInput] = useState<"internal" | "external">("external");
  const [nameInput, setNameInput] = useState("");
  const [verInput, setVerInput] = useState("");
  const [purposeInput, setPurposeInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDeps = useCallback(async () => {
    if (!currentRepoId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deps?repoId=${encodeURIComponent(currentRepoId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDeps(data.data);
      } else {
        setDeps([]);
      }
    } catch {
      toast("Failed to load dependencies", "error");
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
        const res = await fetch(`/api/deps?repoId=${encodeURIComponent(currentRepoId)}`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && Array.isArray(data.data)) {
            setDeps(data.data);
          } else {
            setDeps([]);
          }
        }
      } catch {
        if (!ignore) toast("Failed to load dependencies", "error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [currentRepoId, toast]);

  const handleAddDep = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/deps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: currentRepoId,
          kind: kindInput,
          name: nameInput.trim() || undefined,
          version: verInput.trim() || undefined,
          purpose: purposeInput.trim() || undefined,
          fromModule: fromInput.trim() || undefined,
          toModule: toInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (data.success) {
        toast("Dependency added successfully", "success");
        setIsAddModalOpen(false);
        setNameInput("");
        setVerInput("");
        setPurposeInput("");
        setFromInput("");
        setToInput("");
        fetchDeps();
      } else {
        toast(data.error || "Failed to add dependency", "error");
      }
    } catch {
      setSubmitting(false);
      toast("Error adding dependency", "error");
    }
  };

  const handleDeleteDep = async (id: string) => {
    try {
      const res = await fetch(`/api/deps/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast("Dependency removed", "info");
        fetchDeps();
      }
    } catch {
      toast("Failed to remove dependency", "error");
    }
  };

  const internalDeps = deps.filter((d) => d.kind === "internal" || Boolean(d.fromModule));
  const externalDeps = deps.filter((d) => d.kind === "external" || Boolean(d.name));

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="row between align-center mb16">
        <div className="page-head" style={{ margin: 0 }}>
          <h1 className="page-title">Dependencies ({currentRepoId})</h1>
          <p className="page-sub">
            {deps.length} dependency edges for repository <b className="mono">{currentRepoId}</b>.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
          <Icon name="plus" className="ic-sm" /> Add Dependency
        </Button>
      </div>

      {/* Dependencies Card with Tabs */}
      <div className="card">
        <div className="tabs">
          <button
            type="button"
            className={`tab ${activeTab === "int" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("int")}
          >
            Internal ({internalDeps.length})
          </button>
          <button
            type="button"
            className={`tab ${activeTab === "ext" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("ext")}
          >
            External Services ({externalDeps.length})
          </button>
        </div>

        <div id="dep-body">
          {loading ? (
            <div className="state" style={{ minHeight: 180 }}>
              <div className="st-sub">Loading dependencies for {currentRepoId}...</div>
            </div>
          ) : activeTab === "int" ? (
            internalDeps.length === 0 ? (
              <div className="state" style={{ minHeight: 220 }}>
                <span className="st-ic">
                  <Icon name="deps" className="ic-lg" />
                </span>
                <div className="st-title">No internal module dependencies</div>
                <div className="st-sub">Add an architectural dependency edge between system modules.</div>
                <div className="mt16">
                  <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
                    <Icon name="plus" className="ic-sm" /> Add Internal Dependency
                  </Button>
                </div>
              </div>
            ) : (
              internalDeps.map((d) => (
                <div key={d.id} className="dep-row row between align-center">
                  <span className="dep-arrow">
                    {d.fromModule || "Module A"} <Icon name="arrowRight" className="ic-sm" /> {d.toModule || "Module B"}
                  </span>
                  <div className="row gap8 align-center">
                    <Badge variant="gray" small>
                      internal
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDep(d.id)}
                      style={{ color: "var(--error)" }}
                    >
                      <Icon name="trash" className="ic-sm" />
                    </Button>
                  </div>
                </div>
              ))
            )
          ) : externalDeps.length === 0 ? (
            <div className="state" style={{ minHeight: 220 }}>
              <span className="st-ic">
                <Icon name="cloud" className="ic-lg" />
              </span>
              <div className="st-title">No external service dependencies</div>
              <div className="st-sub">Track third-party packages, databases, and APIs used in this codebase.</div>
              <div className="mt16">
                <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
                  <Icon name="plus" className="ic-sm" /> Add External Dependency
                </Button>
              </div>
            </div>
          ) : (
            externalDeps.map((d) => (
              <div key={d.id} className="dep-row row between align-center">
                <span className="repo-ic" style={{ width: 34, height: 34 }}>
                  <Icon name="cloud" className="ic-sm" />
                </span>
                <span className="grow">
                  <div className="row gap8 align-center">
                    <span className="dep-name">{d.name || "Package"}</span>
                    <span className="dep-ver">{d.version || "v1.0.0"}</span>
                  </div>
                  <div className="dep-purpose">{d.purpose || "Integration package"}</div>
                </span>
                <div className="row gap8 align-center">
                  <Badge variant="success" small dot>
                    {d.status || "active"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDep(d.id)}
                    style={{ color: "var(--error)" }}
                  >
                    <Icon name="trash" className="ic-sm" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Dependency Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Codebase Dependency"
      >
        <div className="col gap12 mt12">
          <div>
            <label className="t3 small mb4 block">Dependency Type</label>
            <select
              className="ui-input"
              value={kindInput}
              onChange={(e) => setKindInput(e.target.value as "internal" | "external")}
              style={{ width: "100%", background: "var(--bg-card)", color: "var(--text-1)" }}
            >
              <option value="external">External Service / Package</option>
              <option value="internal">Internal Module Edge</option>
            </select>
          </div>

          {kindInput === "external" ? (
            <>
              <div>
                <label className="t3 small mb4 block">Package / Service Name</label>
                <Input
                  placeholder="e.g. Stripe API"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>
              <div>
                <label className="t3 small mb4 block">Version</label>
                <Input
                  placeholder="e.g. ^3.2.0"
                  value={verInput}
                  onChange={(e) => setVerInput(e.target.value)}
                />
              </div>
              <div>
                <label className="t3 small mb4 block">Purpose</label>
                <Input
                  placeholder="e.g. Payment processing gateway"
                  value={purposeInput}
                  onChange={(e) => setPurposeInput(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="t3 small mb4 block">Source Module (From)</label>
                <Input
                  placeholder="e.g. appointments"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                />
              </div>
              <div>
                <label className="t3 small mb4 block">Target Module (To)</label>
                <Input
                  placeholder="e.g. auth"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-foot mt16" style={{ justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddDep} disabled={submitting}>
            {submitting ? "Saving..." : "Save Dependency"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function DependenciesPage() {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <DependenciesPageContent />
    </Suspense>
  );
}
