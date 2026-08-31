"use client";

import React, { use, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Badge, Button, useToast, type BadgeVariant } from "@/components/ui";
import { useShell } from "@/lib/shell-context";
import type { ModuleType } from "@/data/types";

const BADGE_MAP: Record<ModuleType, { variant: BadgeVariant; label: string }> = {
  core: { variant: "lime", label: "Core" },
  api: { variant: "cyan", label: "API" },
  db: { variant: "blue", label: "DB" },
  ext: { variant: "amber", label: "Ext" },
};

interface DbModule {
  id: string;
  repoId: string;
  name: string;
  type: ModuleType;
  desc: string;
  aiSummary: string | null;
  filesCount: number;
  depsCount: number;
  dependentsCount: number;
}

interface DbFileRecord {
  id: string;
  path: string;
  size: string;
  type: string;
  updatedText: string;
  moduleId: string | null;
}

function ModuleDetailContent({
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

  const [module, setModule] = useState<DbModule | null>(null);
  const [files, setFiles] = useState<DbFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [refreshingAi, setRefreshingAi] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const url = repoId
          ? `/api/modules/${id}?repoId=${encodeURIComponent(repoId)}`
          : `/api/modules/${id}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!ignore) {
          if (data.success && data.data) {
            setModule(data.data);
            setAiSummary(data.data.aiSummary || data.data.desc || "");
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
  }, [id, repoId]);

  // Load files belonging to this module
  useEffect(() => {
    if (!module || !repoId) return;
    let ignore = false;
    async function loadFiles() {
      try {
        const res = await fetch(`/api/files?repoId=${encodeURIComponent(repoId)}`);
        const data = await res.json();
        if (!ignore && data.success && Array.isArray(data.data)) {
          setFiles(data.data.filter((f: DbFileRecord) => f.moduleId === module!.id));
        }
      } catch {
        // ignore
      }
    }
    loadFiles();
    return () => { ignore = true; };
  }, [module, repoId]);

  const refreshAiSummary = async () => {
    if (!module) return;
    setRefreshingAi(true);
    try {
      const res = await fetch(`/api/modules/${module.id}/ai`, { method: "POST" });
      const data = await res.json();
      setRefreshingAi(false);
      if (data.success && data.data?.aiSummary) {
        setAiSummary(data.data.aiSummary);
        toast("Refreshed module AI summary via Gemini 3.6 Flash!", "success");
      } else {
        toast("Refreshed module summary!", "info");
      }
    } catch {
      setRefreshingAi(false);
      toast("Refreshed module summary!", "info");
    }
  };

  if (loading) {
    return (
      <div className="fade-up">
        <div className="state" style={{ minHeight: 320 }}>
          <div className="st-sub">Loading module details...</div>
        </div>
      </div>
    );
  }

  if (notFound || !module) {
    return (
      <div className="fade-up">
        <div className="page-head">
          <h1 className="page-title">Module Not Found</h1>
          <p className="page-sub">No module matches ID &quot;{id}&quot;.</p>
        </div>
        <div className="mt24">
          <Link href={repoId ? `/app/modules?repoId=${encodeURIComponent(repoId)}` : "/app/modules"}>
            <Button variant="primary">
              <Icon name="arrowLeft" className="ic-sm" /> Back to Modules
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const badgeInfo = BADGE_MAP[module.type] ?? { variant: "gray" as BadgeVariant, label: module.type };

  return (
    <div className="fade-up">
      {/* Module Hero Card */}
      <div className="card mod-hero">
        <span className="mod-badge-wrap">
          <Icon
            name={module.type === "db" ? "db" : module.type === "api" ? "code" : "modules"}
            className="ic-lg"
          />
        </span>
        <div className="grow">
          <h1>
            {module.name}{" "}
            <Badge variant={badgeInfo.variant}>
              <span className="dot" />
              {badgeInfo.label}
            </Badge>
          </h1>
          <p className="desc">{module.desc}</p>
          <div className="meta-row">
            <span className="row gap5 align-center">
              <Icon name="file" className="ic-sm" /> {module.filesCount || 0} files
            </span>
            <span className="row gap5 align-center">
              <Icon name="deps" className="ic-sm" /> {module.depsCount || 0} dependencies
            </span>
            <span className="row gap5 align-center">
              <Icon name="modules" className="ic-sm" /> {module.dependentsCount || 0} dependents
            </span>
          </div>
        </div>
        <div className="col gap8" style={{ alignItems: "flex-end" }}>
          <Button
            variant="primary"
            id="mod-ask"
            onClick={() =>
              router.push(
                `/app/ask?q=${encodeURIComponent(`How does ${module.name} work?`)}`
              )
            }
          >
            <Icon name="ask" /> Ask DevMind about this module
          </Button>
          <Button variant="secondary" size="sm" onClick={refreshAiSummary} disabled={refreshingAi}>
            <Icon name="refresh" className="ic-sm" /> {refreshingAi ? "Analyzing..." : "Refresh AI Summary"}
          </Button>
        </div>
      </div>

      {/* DevMind AI Summary Note */}
      <div className="mt24 ai-note">
        <span className="ai-ic">
          <Icon name="brain" />
        </span>
        <div>
          <b className="small" style={{ color: "var(--brand)" }}>
            DevMind summary (Gemini 3.6 Flash)
          </b>
          <p>{aiSummary || "No AI summary available. Click Refresh AI Summary to generate one."}</p>
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
            <div className="sec-sub">{files.length} indexed</div>
          </div>
          <div className="card-body col gap10">
            {files.length ? (
              files.map((file) => (
                <Link
                  key={file.id}
                  href={`/app/evidence/${file.id}`}
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
              ))
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

        {/* Right Column: Module Info */}
        <div className="col gap16">
          {/* Module Stats */}
          <div className="card">
            <div className="card-header">
              <div className="sec-title">Module Stats</div>
            </div>
            <div className="card-body col gap8">
              <div className="fn-row">
                <span className="grow">
                  <div className="fn-name">Files indexed</div>
                  <div className="fn-sig">{module.filesCount || 0} files tracked in this module</div>
                </span>
                <Icon name="file" className="ic-sm" />
              </div>
              <div className="fn-row">
                <span className="grow">
                  <div className="fn-name">Dependencies</div>
                  <div className="fn-sig">{module.depsCount || 0} outgoing dependencies</div>
                </span>
                <Icon name="deps" className="ic-sm" />
              </div>
              <div className="fn-row">
                <span className="grow">
                  <div className="fn-name">Dependents</div>
                  <div className="fn-sig">{module.dependentsCount || 0} modules depend on this</div>
                </span>
                <Icon name="modules" className="ic-sm" />
              </div>
            </div>
          </div>

          {/* Repository */}
          <div className="card">
            <div className="card-header">
              <div className="sec-title">Repository</div>
            </div>
            <div className="card-body">
              <div className="t3 small mono">{module.repoId}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <ModuleDetailContent params={params} />
    </Suspense>
  );
}
