"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon, Badge, Button, Tabs, useToast } from "@/components/ui";
import { useShell } from "@/lib/shell-context";

interface NotificationItem {
  id: string;
  userId: string;
  orgId?: string | null;
  projectId?: string | null;
  repoId?: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  entityId?: string | null;
  link?: string | null;
  createdAt: string;
  repo?: {
    id: string;
    name: string;
    owner: string;
  } | null;
}

type FilterType = "all" | "unread" | "sync" | "ingest";

function NotificationsContent() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { activeRepoId } = useShell();

  const repoIdFilter = searchParams.get("repoId") || activeRepoId || undefined;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<FilterType>("all");

  const loadNotifications = useCallback(async () => {
    try {
      const q = repoIdFilter ? `?repoId=${encodeURIComponent(repoIdFilter)}` : "";
      const res = await fetch(`/api/notifications${q}`);
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      if (data.success && data.data) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount || 0);
        setTotal(data.data.total || 0);
      }
    } catch (err) {
      console.error(err);
      toast("Failed to load notifications", "error");
    } finally {
      setLoading(false);
    }
  }, [repoIdFilter, toast]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const q = repoIdFilter ? `?repoId=${encodeURIComponent(repoIdFilter)}` : "";
        const res = await fetch(`/api/notifications${q}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!ignore && data.success && data.data) {
          setNotifications(data.data.notifications || []);
          setUnreadCount(data.data.unreadCount || 0);
          setTotal(data.data.total || 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [repoIdFilter]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
    } catch {
      toast("Error marking as read", "error");
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId: repoIdFilter }),
      });
      if (res.ok) {
        toast("All notifications marked as read", "success");
      }
    } catch {
      toast("Error marking all as read", "error");
    }
  };

  const filteredList = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "sync") return n.type.includes("SYNC");
    if (filter === "ingest") return n.type.includes("INGESTION") || n.type === "REPO_CONNECTED";
    return true;
  });

  const getIconName = (type: string) => {
    if (type.includes("INGESTION_COMPLETED")) return "checkCircle" as const;
    if (type.includes("FAILED") || type.includes("ISSUE")) return "alert" as const;
    if (type.includes("SYNC")) return "git" as const;
    if (type.includes("CONNECTED")) return "link" as const;
    return "bell" as const;
  };

  const getBadgeVariant = (type: string, read: boolean) => {
    if (read) return "gray" as const;
    if (type.includes("COMPLETED")) return "lime" as const;
    if (type.includes("FAILED")) return "error" as const;
    if (type.includes("ISSUE")) return "amber" as const;
    return "cyan" as const;
  };

  return (
    <div className="main narrow fade-up">
      <div className="page-head row between align-center">
        <div>
          <h1 className="page-title">Notifications</h1>
          <div className="page-sub">
            Engineering alerts, repository sync status, and indexing updates
          </div>
        </div>
        <div className="row gap8 align-center">
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllAsRead}
            >
              <Icon name="check" className="ic-sm" />
              Mark all as read ({unreadCount})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={loadNotifications}
            title="Refresh"
          >
            <Icon name="refresh" className="ic-sm" />
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Tabs
          items={[
            { id: "all", label: `All (${total})` },
            { id: "unread", label: `Unread (${unreadCount})` },
            { id: "sync", label: "Synchronization" },
            { id: "ingest", label: "Ingestion" },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as FilterType)}
        />
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>
          Loading notifications…
        </div>
      ) : filteredList.length === 0 ? (
        <div className="state card" style={{ padding: 48 }}>
          <div className="st-ic">
            <Icon name="bell" />
          </div>
          <div className="st-title">No notifications</div>
          <div className="st-sub">
            {filter === "unread"
              ? "You are all caught up! No unread notifications."
              : "No notification events have occurred yet for this workspace."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredList.map((n) => (
            <div
              key={n.id}
              className="card"
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                background: !n.read ? "rgba(200, 214, 43, 0.03)" : undefined,
                borderColor: !n.read ? "var(--brand-line, #39422f)" : undefined,
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  background: !n.read ? "var(--brand-soft, rgba(200,214,43,0.12))" : "var(--surface)",
                  color: !n.read ? "var(--brand)" : "var(--text-3)",
                  flexShrink: 0,
                }}
              >
                <Icon name={getIconName(n.type)} />
              </div>

              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row between align-center" style={{ gap: 12 }}>
                  <div className="row align-center gap8">
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</span>
                    <Badge variant={getBadgeVariant(n.type, n.read)}>
                      {n.type.replace(/_/g, " ")}
                    </Badge>
                    {n.repo && (
                      <span className="mono t3 tiny" style={{ color: "var(--text-3)" }}>
                        {n.repo.owner}/{n.repo.name}
                      </span>
                    )}
                  </div>
                  <span className="t3 tiny">
                    {new Date(n.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
                  {n.message}
                </p>

                <div className="row align-center gap12" style={{ marginTop: 12 }}>
                  {n.link && (
                    <Link
                      href={n.link}
                      className="btn btn-secondary btn-xs"
                      onClick={() => {
                        if (!n.read) handleMarkAsRead(n.id);
                      }}
                    >
                      <Icon name="arrowRight" className="ic-sm" />
                      View context
                    </Link>
                  )}
                  {!n.read && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="main narrow">Loading notifications…</div>}>
      <NotificationsContent />
    </Suspense>
  );
}
