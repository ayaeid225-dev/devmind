"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icon, Button, useToast, type IconName } from "@/components/ui";
import { useShell } from "@/lib/shell-context";

interface ActivityRecordItem {
  id: string;
  repoId: string;
  text: string;
  byUser: string;
  category: string;
  icon: string;
  timestampText: string;
  createdAt: string;
}

function getActivityIcon(iconName: string): IconName {
  if (iconName === "book") return "book";
  if (iconName === "git" || iconName === "branch") return "git";
  if (iconName === "ask") return "spark";
  return "log";
}

function ActivityPageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { activeRepoId, activeRepo } = useShell();

  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;

  const [activities, setActivities] = useState<ActivityRecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    if (!currentRepoId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/activity?repoId=${encodeURIComponent(currentRepoId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setActivities(data.data);
      } else {
        setActivities([]);
      }
    } catch {
      toast("Failed to load activity logs", "error");
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
        const res = await fetch(`/api/activity?repoId=${encodeURIComponent(currentRepoId)}`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && Array.isArray(data.data)) {
            setActivities(data.data);
          } else {
            setActivities([]);
          }
        }
      } catch {
        if (!ignore) toast("Failed to load activity logs", "error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [currentRepoId, toast]);

  const handleLogManualActivity = async () => {
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: currentRepoId,
          text: `Triggered repository intelligence re-index for ${currentRepoId}`,
          category: "analysis",
          icon: "spark",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast("Logged workspace action", "success");
        fetchActivity();
      }
    } catch {
      toast("Failed to log activity", "error");
    }
  };

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="row between align-center mb16">
        <div className="page-head" style={{ margin: 0 }}>
          <h1 className="page-title">Activity ({currentRepoId})</h1>
          <p className="page-sub">
            Recent commits, documentation changes, and intelligence signals for repository <b className="mono">{currentRepoId}</b>.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleLogManualActivity}>
          <Icon name="plus" className="ic-sm" /> Log Signal
        </Button>
      </div>

      {/* Recent Activity Card */}
      <div className="card">
        <div className="card-header">
          <div className="sec-title">Recent activity</div>
          <div className="sec-sub">
            {activities.length} events logged
          </div>
        </div>
        <div className="card-body col">
          {loading ? (
            <div className="state" style={{ minHeight: 180 }}>
              <div className="st-sub">Loading activity feed for {currentRepoId}...</div>
            </div>
          ) : activities.length === 0 ? (
            <div className="state" style={{ minHeight: 260 }}>
              <span className="st-ic">
                <Icon name="log" className="ic-lg" />
              </span>
              <div className="st-title">No activity logged yet</div>
              <div className="st-sub">
                Actions, commits, and AI analyses for repository {currentRepoId} will automatically appear here.
              </div>
              <div className="mt16">
                <Button variant="primary" onClick={handleLogManualActivity}>
                  <Icon name="plus" className="ic-sm" /> Log First Signal
                </Button>
              </div>
            </div>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="act-row">
                <span className="act-ic">
                  <Icon name={getActivityIcon(a.icon)} className="ic-sm" />
                </span>
                <div className="grow">
                  <div className="act-text">
                    {a.text} <b className="t2">• {a.byUser}</b>
                  </div>
                  <div className="act-meta">
                    {a.category} • {a.timestampText}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <ActivityPageContent />
    </Suspense>
  );
}
