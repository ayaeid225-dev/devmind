"use client";

import React from "react";
import { Icon, type IconName } from "@/components/ui";
import { ACTIVITY } from "@/data/fixtures";

function getActivityIcon(iconName: IconName): IconName {
  if (iconName === "book") return "book";
  if (iconName === "git" || iconName === "branch") return "git";
  if (iconName === "ask") return "spark";
  return "log";
}

export default function ActivityPage() {
  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Activity</h1>
        <p className="page-sub">
          Recent commits, documentation changes, and intelligence signals across the
          workspace.
        </p>
      </div>

      {/* Recent Activity Card */}
      <div className="card">
        <div className="card-header">
          <div className="sec-title">Recent activity</div>
          <div className="sec-sub">
            {ACTIVITY.length} events • last 14 days
          </div>
        </div>
        <div className="card-body col">
          {ACTIVITY.map((a, idx) => (
            <div key={idx} className="act-row">
              <span className="act-ic">
                <Icon name={getActivityIcon(a.icon)} className="ic-sm" />
              </span>
              <div className="grow">
                <div className="act-text">
                  {a.text} <b className="t2">• {a.by}</b>
                </div>
                <div className="act-meta">
                  {a.cat} • {a.when}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
