"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon, Badge, Button, Input, Modal, useToast, type BadgeVariant } from "@/components/ui";
import { useShell } from "@/lib/shell-context";
import type { ModuleType } from "@/data/types";

interface ModuleRecordItem {
  id: string;
  name: string;
  type: ModuleType;
  desc: string;
  aiSummary: string | null;
  filesCount: number;
  depsCount: number;
  dependentsCount: number;
}

const BADGE_MAP: Record<ModuleType, { variant: BadgeVariant; label: string }> = {
  core: { variant: "lime", label: "Core" },
  api: { variant: "cyan", label: "API" },
  db: { variant: "blue", label: "DB" },
  ext: { variant: "amber", label: "Ext" },
};

function getIconForType(type: ModuleType): "modules" | "code" | "db" | "cloud" {
  switch (type) {
    case "core":
      return "modules";
    case "api":
      return "code";
    case "db":
      return "db";
    case "ext":
      return "cloud";
  }
}

function ModulesPageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { activeRepoId, activeRepo } = useShell();

  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;

  const [modules, setModules] = useState<ModuleRecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [typeInput, setTypeInput] = useState<ModuleType>("core");
  const [submitting, setSubmitting] = useState(false);

  const fetchModules = useCallback(async () => {
    if (!currentRepoId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/modules?repoId=${encodeURIComponent(currentRepoId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setModules(data.data);
      } else {
        setModules([]);
      }
    } catch {
      toast("Failed to load modules", "error");
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
        const res = await fetch(`/api/modules?repoId=${encodeURIComponent(currentRepoId)}`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && Array.isArray(data.data)) {
            setModules(data.data);
          } else {
            setModules([]);
          }
        }
      } catch {
        if (!ignore) toast("Failed to load modules", "error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [currentRepoId, toast]);

  const handleCreateModule = async () => {
    if (!nameInput.trim() || !descInput.trim()) {
      toast("Please enter module name and description", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: currentRepoId,
          name: nameInput.trim(),
          type: typeInput,
          desc: descInput.trim(),
        }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (data.success) {
        toast(`Module "${nameInput}" created successfully`, "success");
        setIsCreateModalOpen(false);
        setNameInput("");
        setDescInput("");
        fetchModules();
      } else {
        toast(data.error || "Failed to create module", "error");
      }
    } catch {
      setSubmitting(false);
      toast("Error creating module", "error");
    }
  };

  const handleDeleteModule = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/modules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast(`Module "${name}" deleted`, "info");
        fetchModules();
      }
    } catch {
      toast("Failed to delete module", "error");
    }
  };

  const renderModuleBlock = (title: string, list: ModuleRecordItem[]) => {
    if (!list.length) return null;
    return (
      <div className="mb24" key={title}>
        <div className="sec-head">
          <div className="sec-title">{title}</div>
          <div className="sec-sub">{list.length} modules</div>
        </div>
        <div className="col gap12">
          {list.map((m) => (
            <div key={m.id} className="row align-center gap8">
              <Link
                href={`/app/modules/${m.id}?repoId=${encodeURIComponent(currentRepoId)}`}
                className="rel-mod grow"
                style={{ textDecoration: "none" }}
              >
                <span className="repo-ic" style={{ width: 34, height: 34 }}>
                  <Icon name={getIconForType(m.type)} className="ic-sm" />
                </span>
                <span className="grow">
                  <div className="rm-name">{m.name}</div>
                  <div className="rm-sub">
                    {m.filesCount ? `${m.filesCount} files` : "0 files"} • {m.desc}
                  </div>
                </span>
                <Badge variant={BADGE_MAP[m.type]?.variant || "gray"}>
                  <span className="dot" />
                  {BADGE_MAP[m.type]?.label || m.type}
                </Badge>
                <span className="t3 tiny mono">{m.depsCount} deps</span>
                <Icon name="chevronRight" className="ic-sm" />
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteModule(m.id, m.name)}
                style={{ color: "var(--error)" }}
              >
                <Icon name="trash" className="ic-sm" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const core = modules.filter((m) => m.type === "core");
  const api = modules.filter((m) => m.type === "api");
  const dbMods = modules.filter((m) => m.type === "db");
  const ext = modules.filter((m) => m.type === "ext");

  return (
    <div className="fade-up">
      <div className="row between align-center mb16">
        <div className="page-head" style={{ margin: 0 }}>
          <h1 className="page-title">Modules ({currentRepoId})</h1>
          <p className="page-sub">
            {modules.length} detected modules for repository <b className="mono">{currentRepoId}</b>.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          <Icon name="plus" className="ic-sm" /> Create Module
        </Button>
      </div>

      {loading ? (
        <div className="state" style={{ minHeight: 220 }}>
          <div className="st-sub">Loading modules for {currentRepoId}...</div>
        </div>
      ) : modules.length === 0 ? (
        <div className="state" style={{ minHeight: 320 }}>
          <span className="st-ic">
            <Icon name="modules" className="ic-lg" />
          </span>
          <div className="st-title">No modules detected yet</div>
          <div className="st-sub">
            Create your first architecture module or re-index your repository to populate modules.
          </div>
          <div className="mt16">
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              <Icon name="plus" className="ic-sm" /> Create First Module
            </Button>
          </div>
        </div>
      ) : (
        <>
          {renderModuleBlock("Core Modules", core)}
          {renderModuleBlock("API & Integrations", api)}
          {renderModuleBlock("Data Stores", dbMods)}
          {renderModuleBlock("External Services", ext)}
        </>
      )}

      {/* Create Module Modal */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Architecture Module"
      >
        <div className="col gap12 mt12">
          <div>
            <label className="t3 small mb4 block">Module Name</label>
            <Input
              placeholder="e.g. Authentication Service"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>
          <div>
            <label className="t3 small mb4 block">Module Type</label>
            <select
              className="ui-input"
              value={typeInput}
              onChange={(e) => setTypeInput(e.target.value as ModuleType)}
              style={{ width: "100%", background: "var(--bg-card)", color: "var(--text-1)" }}
            >
              <option value="core">Core</option>
              <option value="api">API</option>
              <option value="db">Database</option>
              <option value="ext">External Service</option>
            </select>
          </div>
          <div>
            <label className="t3 small mb4 block">Description</label>
            <Input
              placeholder="Brief summary of module responsibilities..."
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot mt16" style={{ justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateModule} disabled={submitting}>
            {submitting ? "Creating..." : "Create Module"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function ModulesPage() {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <ModulesPageContent />
    </Suspense>
  );
}
