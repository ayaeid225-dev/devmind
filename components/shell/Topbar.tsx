"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Dropdown, type DropdownItem, useToast } from "@/components/ui";
import { metaForPath } from "@/lib/nav";
import { BRANCHES, CONTRIB_COLORS } from "@/data/fixtures";
import { courseStats, useCourseDone } from "@/lib/course";
import { useShell } from "@/lib/shell-context";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { activeRepoId, activeRepo, branch, user, setBranch, setUser, openPalette } = useShell();
  const doneLessons = useCourseDone();
  const stats = courseStats(doneLessons);
  const shellMeta = metaForPath(pathname);

  const isMac = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && navigator.platform ? navigator.platform.toUpperCase().indexOf("MAC") >= 0 : false,
    () => false
  );

  const branchItems: DropdownItem[] = [
    { kind: "label", label: "Branch" },
    ...BRANCHES.map((b) => ({
      pick: `branch:${b}`,
      label: (
        <span className="row between grow align-center" style={{ width: "100%" }}>
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
    { kind: "label", label: "Notifications" },
    {
      kind: "custom",
      node: (
        <div className="menu-item">
          <Icon name="checkCircle" />
          <span className="grow">
            <b>Analysis complete</b>
            <div className="t3 tiny">{activeRepo.name} is ready to explore</div>
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
          <b style={{ fontSize: 13 }}>{user?.name || "Authenticated User"}</b>
          <div className="t3 tiny">{user?.email || "user@domain.com"}</div>
        </div>
      ),
    },
    { kind: "sep" },
    { pick: "settings", label: "Settings", icon: "settings" },
    { pick: "help", label: "Help & shortcuts", icon: "help" },
    { kind: "sep" },
    { pick: "signout", label: "Sign out", icon: "external" },
  ];

  const handleAvatarSelect = async (pick: string) => {
    const qParam = activeRepoId ? `?repoId=${encodeURIComponent(activeRepoId)}` : "";
    if (pick === "settings") {
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
            const qParam = activeRepoId ? `?repoId=${encodeURIComponent(activeRepoId)}` : "";
            router.push(`${shellMeta.back!.href}${qParam}`);
          }}
        >
          <Icon name="arrowLeft" className="ic-sm" />
          Back to {shellMeta.back.label}
        </button>
      )}

      <Link href="/" className="tb-icon" id="tb-home" title="Back to landing page">
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
          <button type="button" className="btn btn-secondary btn-sm" id="tb-branch">
            <Icon name="branch" className="ic-sm" />
            {activeRepo.branch || branch || "main"}
            <Icon name="chevronDown" className="ic-sm" />
          </button>
        }
        items={branchItems}
        onSelect={handleBranchSelect}
      />

      <Dropdown
        trigger={
          <button type="button" className="tb-icon" id="tb-bell">
            <Icon name="bell" />
            <span className="tb-dot" />
          </button>
        }
        items={notificationItems}
      />

      <Dropdown
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
