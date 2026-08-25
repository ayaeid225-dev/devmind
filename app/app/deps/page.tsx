"use client";

import React, { useState } from "react";
import { Icon, Badge } from "@/components/ui";
import { REPO, DEPS_INTERNAL, DEPS_EXTERNAL } from "@/data/fixtures";

export default function DependenciesPage() {
  const [activeTab, setActiveTab] = useState<"int" | "ext">("int");

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Dependencies</h1>
        <p className="page-sub">
          {REPO.deps || 36} dependency edges — internal architecture and external services.
        </p>
      </div>

      {/* Dependencies Card with Tabs */}
      <div className="card">
        <div className="tabs">
          <button
            type="button"
            className={`tab ${activeTab === "int" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("int")}
          >
            Internal
          </button>
          <button
            type="button"
            className={`tab ${activeTab === "ext" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("ext")}
          >
            External Services
          </button>
        </div>

        <div id="dep-body">
          {activeTab === "int" ? (
            DEPS_INTERNAL.map((d, idx) => (
              <div key={idx} className="dep-row">
                <span className="dep-arrow">
                  {d.from} <Icon name="arrowRight" className="ic-sm" /> {d.to}
                </span>
                <span className="grow" />
                <Badge variant="gray" small>
                  {d.kind}
                </Badge>
              </div>
            ))
          ) : (
            DEPS_EXTERNAL.map((d, idx) => (
              <div key={idx} className="dep-row">
                <span className="repo-ic" style={{ width: 34, height: 34 }}>
                  <Icon
                    name={d.type === "db" ? "db" : "cloud"}
                    className="ic-sm"
                  />
                </span>
                <span className="grow">
                  <div className="row gap8 align-center">
                    <span className="dep-name">{d.name}</span>
                    <span className="dep-ver">{d.ver}</span>
                  </div>
                  <div className="dep-purpose">{d.purpose}</div>
                </span>
                <Badge variant="success" small dot>
                  {d.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
