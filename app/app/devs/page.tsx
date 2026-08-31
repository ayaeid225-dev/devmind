"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon, Badge, Button, Input, MetricCard, Modal, useToast } from "@/components/ui";
import { useShell } from "@/lib/shell-context";

interface DeveloperRecordItem {
  id: string;
  repoId: string;
  name: string;
  role: string;
  color: string;
  coverage: number;
  blurb: string;
  recentContribution: string;
}

function DevsPageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { activeRepoId, activeRepo } = useShell();

  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;

  const [devs, setDevs] = useState<DeveloperRecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [colorInput, setColorInput] = useState("#C8D62B");
  const [blurbInput, setBlurbInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDevs = useCallback(async () => {
    if (!currentRepoId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/devs?repoId=${encodeURIComponent(currentRepoId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDevs(data.data);
      } else {
        setDevs([]);
      }
    } catch {
      toast("Failed to load developers", "error");
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
        const res = await fetch(`/api/devs?repoId=${encodeURIComponent(currentRepoId)}`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && Array.isArray(data.data)) {
            setDevs(data.data);
          } else {
            setDevs([]);
          }
        }
      } catch {
        if (!ignore) toast("Failed to load developers", "error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [currentRepoId, toast]);

  const handleAddDev = async () => {
    if (!nameInput.trim() || !roleInput.trim()) {
      toast("Please enter name and role", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/devs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: currentRepoId,
          name: nameInput.trim(),
          role: roleInput.trim(),
          color: colorInput,
          blurb: blurbInput.trim(),
        }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (data.success) {
        toast(`Contributor "${nameInput}" added successfully`, "success");
        setIsAddModalOpen(false);
        setNameInput("");
        setRoleInput("");
        setBlurbInput("");
        fetchDevs();
      } else {
        toast(data.error || "Failed to add contributor", "error");
      }
    } catch {
      setSubmitting(false);
      toast("Error adding contributor", "error");
    }
  };

  const handleDeleteDev = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/devs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast(`Contributor "${name}" removed`, "info");
        fetchDevs();
      }
    } catch {
      toast("Failed to remove contributor", "error");
    }
  };

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="row between align-center mb16">
        <div className="page-head" style={{ margin: 0 }}>
          <h1 className="page-title">Developer Insights ({currentRepoId})</h1>
          <p className="page-sub">
            Understand team technical strengths and ownership areas for <b className="mono">{currentRepoId}</b>.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
          <Icon name="plus" className="ic-sm" /> Add Contributor
        </Button>
      </div>

      {/* Metric Grid */}
      <div className="metric-grid mb24">
        <MetricCard
          icon="users"
          value={devs.length}
          label="Developers"
          delta="in this repository"
          deltaTone="flat"
        />
        <MetricCard
          icon="checkCircle"
          value={devs.length}
          label="Active Contributors"
          delta="tracked"
          deltaTone="flat"
        />
        <MetricCard
          icon="spark"
          value="85%"
          label="Knowledge Coverage"
          delta="across repository"
          deltaTone="flat"
        />
        <MetricCard
          icon="alert"
          value={0}
          label="Critical Gaps"
          delta="healthy"
          deltaTone="flat"
        />
      </div>

      {/* Developers Section */}
      <div className="sec-head">
        <div className="sec-title">Contributors</div>
        <div className="sec-sub">{devs.length} active contributors</div>
      </div>

      {loading ? (
        <div className="state" style={{ minHeight: 220 }}>
          <div className="st-sub">Loading developers for {currentRepoId}...</div>
        </div>
      ) : devs.length === 0 ? (
        <div className="state" style={{ minHeight: 320 }}>
          <span className="st-ic">
            <Icon name="users" className="ic-lg" />
          </span>
          <div className="st-title">No developers added yet</div>
          <div className="st-sub">
            Add team contributors to track code ownership across repository {currentRepoId}.
          </div>
          <div className="mt16">
            <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
              <Icon name="plus" className="ic-sm" /> Add First Contributor
            </Button>
          </div>
        </div>
      ) : (
        <div className="dev-grid">
          {devs.map((d) => {
            const initials = d.name
              .split(" ")
              .map((w) => w[0])
              .join("");

            return (
              <div key={d.id} className="card dev-card">
                <div className="row gap12 align-center">
                  <span className="dev-av" style={{ background: d.color }}>
                    {initials}
                  </span>
                  <div className="grow">
                    <div className="dev-name">{d.name}</div>
                    <div className="dev-role">{d.role}</div>
                  </div>
                  <Badge variant="outline" small>
                    {d.coverage || 80}% coverage
                  </Badge>
                </div>

                <div className="t3 tiny mt12">{d.blurb}</div>

                <div className="dev-recent mt12">
                  <span style={{ color: "var(--text-3)" }}>
                    <Icon name="log" className="ic-sm" />
                  </span>{" "}
                  Recent: <b className="t2">{d.recentContribution}</b>
                </div>

                <div className="row between align-center mt16">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDev(d.id, d.name)}
                    style={{ color: "var(--error)" }}
                  >
                    <Icon name="trash" className="ic-sm" /> Remove
                  </Button>
                  <Link href={`/app/devs/${d.id}?repoId=${encodeURIComponent(currentRepoId)}`}>
                    <Button variant="secondary" size="sm">
                      Insights <Icon name="arrowRight" className="ic-sm" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Contributor Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Team Contributor"
      >
        <div className="col gap12 mt12">
          <div>
            <label className="t3 small mb4 block">Full Name</label>
            <Input
              placeholder="e.g. Anjali Rao"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>
          <div>
            <label className="t3 small mb4 block">Role / Title</label>
            <Input
              placeholder="e.g. Lead Architect"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
            />
          </div>
          <div>
            <label className="t3 small mb4 block">Avatar Color</label>
            <input
              type="color"
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              style={{ width: "100%", height: 38, background: "var(--bg-card)", border: "1px solid var(--border-soft)", borderRadius: 6, cursor: "pointer" }}
            />
          </div>
          <div>
            <label className="t3 small mb4 block">Bio / Expertise Blurb</label>
            <Input
              placeholder="Specializing in core backend and auth..."
              value={blurbInput}
              onChange={(e) => setBlurbInput(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot mt16" style={{ justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddDev} disabled={submitting}>
            {submitting ? "Adding..." : "Add Contributor"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function DevsPage() {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <DevsPageContent />
    </Suspense>
  );
}
