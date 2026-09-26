"use client";

import React, { useSyncExternalStore, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Dropdown, type DropdownItem, useToast } from "@/components/ui";
import { metaForPath } from "@/lib/nav";
import { BRANCHES, CONTRIB_COLORS } from "@/data/fixtures";
import { courseStats, useCourseDone } from "@/lib/course";
import { useShell } from "@/lib/shell-context";

interface ApiNotification {
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
}

function getNotificationIcon(
  type: string
): "checkCircle" | "alert" | "git" | "link" | "spark" | "bell" {
  switch (type) {
    case "INGESTION_COMPLETED":
      return "checkCircle";
    case "INGESTION_FAILED":
    case "SYNC_FAILED":
    case "GITHUB_SYNC_ISSUE":
      return "alert";
    case "SYNC_COMPLETED":
      return "git";
    case "REPO_CONNECTED":
      return "link";
    case "ACTIVITY":
      return "spark";
    default:
      return "bell";
  }
}

function getNotificationColor(type: string, read: boolean): string {
  if (read) return "var(--text-3)";

  switch (type) {
    case "INGESTION_COMPLETED":
      return "var(--brand, #C8D62B)";
    case "SYNC_COMPLETED":
      return "#60a5fa";
    case "INGESTION_FAILED":
    case "SYNC_FAILED":
      return "#f87171";
    case "GITHUB_SYNC_ISSUE":
      return "#fbbf24";
    default:
      return "var(--brand, #C8D62B)";
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();

    if (isNaN(diffMs)) return "Just now";

    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return "Just now";

    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1d ago";
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(dateStr).toLocaleDateString();
  } catch {
    return "Recently";
  }
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const {
    activeRepoId,
    activeRepo,
    branch,
    user,
    setBranch,
    setUser,
    openPalette,
  } = useShell();

  const doneLessons = useCourseDone();
  const stats = courseStats(doneLessons);
  const shellMeta = metaForPath(pathname);

  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(true);

  const isMac = useSyncExternalStore(
    () => () => {},
    () =>
      typeof navigator !== "undefined" &&
      navigator.platform
        ? navigator.platform.toUpperCase().indexOf("MAC") >= 0
        : false,
    () => false
  );

  useEffect(() => {
    let ignore = false;

    async function fetchNotifs() {
      try {
        const q = activeRepoId
          ? `?repoId=${encodeURIComponent(activeRepoId)}`
          : "";

        const res = await fetch(`/api/notifications${q}`);

        if (!res.ok) return;

        const data = await res.json();

        if (!ignore && data.success && data.data) {
          setNotifications(data.data.notifications || []);
          setUnreadCount(
            typeof data.data.unreadCount === "number"
              ? data.data.unreadCount
              : 0
          );
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        if (!ignore) setLoadingNotifs(false);
      }
    }

    fetchNotifs();

    const interval = setInterval(fetchNotifs, 15000);
    const onFocus = () => fetchNotifs();

    window.addEventListener("focus", onFocus);

    return () => {
      ignore = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [activeRepoId]);

  const handleNotificationClick = async (notif: ApiNotification) => {
    if (!notif.read) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id ? { ...n, read: true } : n
        )
      );

      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await fetch(`/api/notifications/${notif.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        });
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }

    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
    setUnreadCount(0);

    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: activeRepoId || undefined,
        }),
      });

      toast("All notifications marked as read", "info");
    } catch {
      toast("Failed to mark all as read", "error");
    }
  };

  const branchItems: DropdownItem[] = [
    { kind: "label", label: "Branch" },
    ...BRANCHES.map((b) => ({
      pick: `branch:${b}`,
      label: (
        <span
          className="row between grow align-center"
          style={{ width: "100%" }}
        >
          <span>{b}</span>

          {(activeRepo.branch || branch) === b && (
            <span style={{ color: "var(--brand)" }}>
              <Icon name="check" className="ic-sm" />
            </span>
          )}
        </span>
      ),
      icon: "branch" as const,
    })),
  ];

  const handleBranchSelect = (pick: string) => {
    if (pick.startsWith("branch:")) {
      const targetBranch = pick.slice(7);
      setBranch(targetBranch);
      toast(`Switched to branch ${targetBranch}`, "info");
    }
  };

  const notificationItems: DropdownItem[] = [
    {
      kind: "custom",
      node: (
        <div
          className="row between align-center"
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)",
            minWidth: 320,
            maxWidth: 360,
          }}
        >
          <div className="row align-center gap8">
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Notifications
            </span>

            {unreadCount > 0 && (
              <span
                style={{
                  background: "var(--brand)",
                  color: "#0c0e08",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 999,
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                color: "var(--brand)",
                fontSize: 11,
                cursor: "pointer",
                padding: "2px 4px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleMarkAllRead();
              }}
            >
              Mark all read
            </button>
          )}
        </div>
      ),
    },

    ...(loadingNotifs && notifications.length === 0
      ? [
          {
            kind: "custom" as const,
            node: (
              <div
                style={{
                  padding: "20px 16px",
                  textAlign: "center",
                  color: "var(--text-3)",
                  fontSize: 12,
                }}
              >
                Loading notifications…
              </div>
            ),
          },
        ]
      : notifications.length === 0
        ? [
            {
              kind: "custom" as const,
              node: (
                <div
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    color: "var(--text-3)",
                    fontSize: 12,
                  }}
                >
                  <div style={{ marginBottom: 4 }}>
                    No notifications yet
                  </div>
                  <div className="t3 tiny">
                    Activity updates and sync results will appear here
                  </div>
                </div>
              ),
            },
          ]
        : notifications.map((n) => ({
            kind: "custom" as const,
            node: (
              <div
                key={n.id}
                className="menu-item"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "9px 12px",
                  cursor: "pointer",
                  background: !n.read
                    ? "rgba(200, 214, 43, 0.05)"
                    : undefined,
                  borderLeft: !n.read
                    ? "3px solid var(--brand)"
                    : "3px solid transparent",
                  maxWidth: 360,
                }}
                onClick={() => handleNotificationClick(n)}
              >
                <span
                  style={{
                    color: getNotificationColor(n.type, n.read),
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    name={getNotificationIcon(n.type)}
                    className="ic-sm"
                  />
                </span>

                <span className="grow" style={{ minWidth: 0 }}>
                  <div
                    className="row between align-center"
                    style={{ gap: 8 }}
                  >
                    <b
                      className="ellip"
                      style={{
                        fontSize: 12,
                        color: !n.read
                          ? "var(--text-1)"
                          : "var(--text-2)",
                      }}
                    >
                      {n.title}
                    </b>

                    <span
                      className="t3 tiny"
                      style={{
                        fontSize: 10,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>

                  <div
                    className="t3 tiny"
                    style={{
                      fontSize: 11.5,
                      lineHeight: 1.35,
                      marginTop: 2,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {n.message}
                  </div>
                </span>
              </div>
            ),
          }))),

    ...(notifications.length > 0
      ? [
          { kind: "sep" as const },
          {
            kind: "custom" as const,
            node: (
              <div
                style={{
                  padding: "6px 12px",
                  textAlign: "center",
                }}
              >
                <Link
                  href={
                    activeRepoId
                      ? `/app/notifications?repoId=${encodeURIComponent(
                          activeRepoId
                        )}`
                      : "/app/notifications"
                  }
                  style={{
                    fontSize: 11,
                    color: "var(--brand)",
                    textDecoration: "none",
                  }}
                >
                  View full notifications center →
                </Link>
              </div>
            ),
          },
        ]
      : []),

    // Preserve the original course notification from the base branch.
    {
      kind: "custom",
      node: (
        <div className="menu-item">
          <Icon name="checkCircle" />

          <span className="grow">
            <b>Analysis complete</b>

            <div className="t3 tiny">
              {activeRepo.name} is ready to explore
            </div>
          </span>
        </div>
      ),
    },

    {
      kind: "custom",
      node: (
        <div className="menu-item">
          <Icon name="learning" />

          <span className="grow">
            <b>Course progress</b>

            <div className="t3 tiny">
              {stats.done} of {stats.total} lessons completed
            </div>
          </span>
        </div>
      ),
    },
  ];

  const avatarItems: DropdownItem[] = [
    {
      kind: "custom",
      node: (
        <div style={{ padding: "10px 12px" }}>
          <b style={{ fontSize: 13 }}>
            {user?.name || "Authenticated User"}
          </b>

          <div className="t3 tiny">
            {user?.email || "user@domain.com"}
          </div>
        </div>
      ),
    },

    { kind: "sep" },

    { pick: "notifications", label: "Notifications", icon: "bell" },
    { pick: "settings", label: "Settings", icon: "settings" },
    { pick: "help", label: "Help & shortcuts", icon: "help" },

    { kind: "sep" },

    { pick: "signout", label: "Sign out", icon: "external" },
  ];

  const handleAvatarSelect = async (pick: string) => {
    const qParam = activeRepoId
      ? `?repoId=${encodeURIComponent(activeRepoId)}`
      : "";

    if (pick === "notifications") {
      router.push(`/app/notifications${qParam}`);
    } else if (pick === "settings") {
      router.push(`/app/settings${qParam}`);
    } else if (pick === "help") {
      router.push(`/app/help${qParam}`);
    } else if (pick === "signout") {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // ignore network error
      }

      setUser(null);
      toast("Signed out", "info");
      router.push("/login");
    }
  };

  return (
    <header className="topbar">
      {shellMeta.back && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginRight: 8 }}
          onClick={() => {
            const qParam = activeRepoId
              ? `?repoId=${encodeURIComponent(activeRepoId)}`
              : "";

            router.push(`${shellMeta.back!.href}${qParam}`);
          }}
        >
          <Icon name="arrowLeft" className="ic-sm" />
          Back to {shellMeta.back.label}
        </button>
      )}

      <Link
        href="/"
        className="tb-icon"
        id="tb-home"
        title="Back to landing page"
      >
        <Icon name="logo" />
      </Link>

      <div className="tb-crumb grow">
        {shellMeta.crumb.map((c, i) => (
          <React.Fragment key={i}>
            <span>
              {i === shellMeta.crumb.length - 1 ? <b>{c}</b> : c}
            </span>

            {i < shellMeta.crumb.length - 1 && (
              <Icon name="chevronRight" className="ic-sm" />
            )}
          </React.Fragment>
        ))}
      </div>

      <button
        type="button"
        className="tb-search"
        id="tb-search"
        onClick={openPalette}
      >
        <Icon name="search" />
        <span>Search {activeRepo.name}…</span>
        <kbd>{isMac ? "⌘" : "Ctrl"} K</kbd>
      </button>

      <Dropdown
        trigger={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            id="tb-branch"
          >
            <Icon name="branch" className="ic-sm" />
            {activeRepo.branch || branch || "main"}
            <Icon name="chevronDown" className="ic-sm" />
          </button>
        }
        items={branchItems}
        onSelect={handleBranchSelect}
      />

      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            className="tb-icon"
            id="tb-bell"
            title={
              unreadCount > 0
                ? `${unreadCount} unread notification${
                    unreadCount === 1 ? "" : "s"
                  }`
                : "Notifications"
            }
          >
            <Icon name="bell" />
            {unreadCount > 0 && <span className="tb-dot" />}
          </button>
        }
        items={notificationItems}
      />

      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            className="tb-avatar"
            id="tb-avatar"
            style={{
              background: CONTRIB_COLORS[0],
              display: "grid",
              placeItems: "center",
              fontSize: "11px",
              color: "#0c0e08",
              fontWeight: 600,
            }}
          >
            {user?.initials || "AR"}
          </button>
        }
        items={avatarItems}
        onSelect={handleAvatarSelect}
      />
    </header>
  );
}