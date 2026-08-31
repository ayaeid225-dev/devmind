"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icon, Badge, Input, useToast, type BadgeVariant } from "@/components/ui";
import { useShell } from "@/lib/shell-context";

interface DbFileRecord {
  id: string;
  repoId: string;
  moduleId: string | null;
  path: string;
  size: string;
  type: string;
  updatedText: string;
  module?: { name: string; type: string } | null;
}

const BADGE_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  core: { variant: "lime", label: "Core" },
  api: { variant: "cyan", label: "API" },
  db: { variant: "blue", label: "DB" },
  ext: { variant: "amber", label: "Ext" },
};

function FilesPageContent() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { activeRepoId, activeRepo } = useShell();

  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;

  const [files, setFiles] = useState<DbFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadFiles() {
      if (!currentRepoId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/files?repoId=${encodeURIComponent(currentRepoId)}`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && Array.isArray(data.data)) {
            setFiles(data.data);
          } else {
            setFiles([]);
          }
        }
      } catch {
        if (!ignore) setFiles([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadFiles();
    return () => {
      ignore = true;
    };
  }, [currentRepoId]);

  const filteredFiles = files.filter(
    (f) =>
      !searchQuery ||
      f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups: Record<string, DbFileRecord[]> = {};
  filteredFiles.forEach((f) => {
    const groupKey = f.module?.name || f.moduleId || "Root / General";
    (groups[groupKey] = groups[groupKey] || []).push(f);
  });

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Files ({currentRepoId})</h1>
        <p className="page-sub">
          {files.length} source code &amp; doc files indexed for repository <b className="mono">{currentRepoId}</b>.
        </p>
      </div>

      {/* Toolbar */}
      <div className="row gap8 mb16 align-center">
        <div className="input-wrap" style={{ flex: 1, maxWidth: 380 }}>
          <Input
            icon="search"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <span className="badge badge-gray">
          <Icon name="folder" className="ic-sm" /> Indexed Code Files: {files.length}
        </span>
      </div>

      {/* File List */}
      <div id="file-tree" className="file-tree">
        {loading ? (
          <div className="state">
            <div className="st-sub">Loading file tree for {currentRepoId}...</div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="state">
            <span className="st-ic">
              <Icon name="search" />
            </span>
            <div className="st-title">No files found for this repository</div>
            <div className="st-sub">
              {searchQuery
                ? `Nothing matches "${searchQuery}".`
                : `No file records found for repository "${currentRepoId}".`}
            </div>
          </div>
        ) : (
          Object.keys(groups).map((modName) => {
            const groupFiles = groups[modName];
            const sampleType = groupFiles[0]?.module?.type || "core";

            return (
              <div key={modName} className="ft-group">
                <div className="ft-head">
                  <Badge variant={BADGE_MAP[sampleType]?.variant || "lime"}>
                    <span className="dot" />
                    {BADGE_MAP[sampleType]?.label || "Module"}
                  </Badge>
                  <span className="ft-name">{modName}</span>
                  <span className="ft-count">{groupFiles.length}</span>
                </div>

                {groupFiles.map((f) => {
                  const fileName = f.path.split("/").pop() || f.path;
                  return (
                    <div
                      key={f.id}
                      className="ft-row"
                      onClick={() => toast(`Selected file: ${f.path}`, "info")}
                      style={{ cursor: "pointer" }}
                    >
                      <span style={{ color: "var(--text-3)" }}>
                        <Icon name="file" />
                      </span>
                      <span className="grow">
                        <div className="ft-file">{fileName}</div>
                        <div className="ft-path">{f.path}</div>
                      </span>
                      <span className="t3 tiny mono">{f.size}</span>
                      <span className="t3 tiny">{f.updatedText || "Indexed"}</span>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function FilesPage() {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <FilesPageContent />
    </Suspense>
  );
}
