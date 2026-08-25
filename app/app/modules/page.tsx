"use client";

import React from "react";
import Link from "next/link";
import { Icon, Badge, type BadgeVariant } from "@/components/ui";
import { REPO, MODULES } from "@/data/fixtures";
import type { ModuleFixture, ModuleType } from "@/data/types";

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

function renderModuleBlock(title: string, list: ModuleFixture[]) {
  if (!list.length) return null;
  return (
    <div className="mb24" key={title}>
      <div className="sec-head">
        <div className="sec-title">{title}</div>
        <div className="sec-sub">{list.length} modules</div>
      </div>
      <div className="col gap12">
        {list.map((m) => (
          <Link
            key={m.id}
            href={`/app/modules/${m.id}`}
            className="rel-mod"
            style={{ textDecoration: "none" }}
          >
            <span className="repo-ic" style={{ width: 34, height: 34 }}>
              <Icon name={getIconForType(m.type)} className="ic-sm" />
            </span>
            <span className="grow">
              <div className="rm-name">{m.name}</div>
              <div className="rm-sub">
                {m.files ? `${m.files} files` : "external"} • {m.desc}
              </div>
            </span>
            <Badge variant={BADGE_MAP[m.type].variant}>
              <span className="dot" />
              {BADGE_MAP[m.type].label}
            </Badge>
            <span className="t3 tiny mono">
              {(m.deps || []).length} deps
            </span>
            <Icon name="chevronRight" className="ic-sm" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ModulesPage() {
  const core = MODULES.filter((m) => m.type === "core");
  const api = MODULES.filter((m) => m.type === "api");
  const db = MODULES.filter((m) => m.type === "db");
  const ext = MODULES.filter((m) => m.type === "ext");

  return (
    <div className="fade-up">
      <div className="page-head">
        <h1 className="page-title">Modules</h1>
        <p className="page-sub">
          {REPO.modules || MODULES.length} detected modules — the building blocks of your
          architecture.
        </p>
      </div>

      {renderModuleBlock("Core Modules", core)}
      {renderModuleBlock("API & Integrations", api)}
      {renderModuleBlock("Data Stores", db)}
      {renderModuleBlock("External Services", ext)}
    </div>
  );
}
