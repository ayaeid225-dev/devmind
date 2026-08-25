"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Badge, Input, useToast, type BadgeVariant } from "@/components/ui";
import { REPO, MODULES, FILE_LIST, EVIDENCE_ID_BY_PATH } from "@/data/fixtures";
import type { FileListItem, ModuleType } from "@/data/types";

const BADGE_MAP: Record<ModuleType, { variant: BadgeVariant; label: string }> = {
  core: { variant: "lime", label: "Core" },
  api: { variant: "cyan", label: "API" },
  db: { variant: "blue", label: "DB" },
  ext: { variant: "amber", label: "Ext" },
};

function getModuleById(id: string) {
  return MODULES.find((m) => m.id === id);
}

export default function FilesPage() {
  const router = useRouter();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFiles = FILE_LIST.filter(
    (f) =>
      !searchQuery ||
      f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups: Record<string, FileListItem[]> = {};
  filteredFiles.forEach((f) => {
    (groups[f.module] = groups[f.module] || []).push(f);
  });

  const handleRowClick = (f: FileListItem) => {
    const evidenceId = EVIDENCE_ID_BY_PATH[f.path];
    if (evidenceId) {
      router.push(`/app/evidence/${evidenceId}`);
    } else {
      const fileName = f.path.split("/").pop() || f.path;
      toast(`Selected file: ${fileName}`, "info");
    }
  };

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Files</h1>
        <p className="page-sub">
          {REPO.files || 248} files indexed across {REPO.modules || 12} modules.
        </p>
      </div>

      {/* Toolbar / Badges Row */}
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
          <Icon name="folder" className="ic-sm" /> lib/ 142 files
        </span>
        <span className="badge badge-gray">
          <Icon name="fileText" className="ic-sm" /> test/ 18 files
        </span>
      </div>

      {/* File Tree Container */}
      <div id="file-tree" className="file-tree">
        {filteredFiles.length === 0 ? (
          <div className="state">
            <span className="st-ic">
              <Icon name="search" />
            </span>
            <div className="st-title">No files found</div>
            <div className="st-sub">
              Nothing matches &quot;{searchQuery}&quot;. Try a different query.
            </div>
          </div>
        ) : (
          Object.keys(groups).map((modKey) => {
            const m = getModuleById(modKey);
            const groupFiles = groups[modKey];

            return (
              <div key={modKey} className="ft-group">
                <div className="ft-head">
                  {m && (
                    <Badge variant={BADGE_MAP[m.type].variant}>
                      <span className="dot" />
                      {BADGE_MAP[m.type].label}
                    </Badge>
                  )}
                  <span className="ft-name">{m ? m.name : modKey}</span>
                  <span className="ft-count">{groupFiles.length}</span>
                </div>

                {groupFiles.map((f) => {
                  const fileName = f.path.split("/").pop() || f.path;
                  const evidenceId = EVIDENCE_ID_BY_PATH[f.path];

                  if (evidenceId) {
                    return (
                      <Link
                        key={f.path}
                        href={`/app/evidence/${evidenceId}`}
                        className="ft-row"
                        style={{ textDecoration: "none" }}
                      >
                        <span style={{ color: "var(--text-3)" }}>
                          <Icon name="file" />
                        </span>
                        <span className="grow">
                          <div className="ft-file">{fileName}</div>
                          <div className="ft-path">{f.path}</div>
                        </span>
                        <span className="t3 tiny mono">{f.size}</span>
                        <span className="t3 tiny">{f.updated}</span>
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={f.path}
                      className="ft-row"
                      onClick={() => handleRowClick(f)}
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
                      <span className="t3 tiny">{f.updated}</span>
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
