"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Logo, Dropdown, type DropdownItem, useToast } from "@/components/ui";
import { NAV_WORKSPACE, NAV_DEV, NAV_SYSTEM, metaForPath } from "@/lib/nav";
import { courseStats, useCourseDone } from "@/lib/course";
import { useShell } from "@/lib/shell-context";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { activeRepoId, activeRepo, availableRepos, branch, analysisDone, setActiveRepoId } = useShell();
  const doneLessons = useCourseDone();
  const stats = courseStats(doneLessons);
  const shellMeta = metaForPath(pathname);

  const repoDropdownItems: DropdownItem[] = [
    { pick: "overview", label: "Project Overview", icon: "overview" },
    { pick: "map", label: "Open Intelligence Map", icon: "map" },
    { pick: "select_new", label: "+ Connect New Repository", icon: "git" },
    { kind: "sep" },
    { kind: "label", label: "Switch Repository" },
    ...(availableRepos.length > 0
      ? availableRepos.map((r) => ({
          pick: `repo:${r.id || r.name}`,
          label: `${r.owner}/${r.name}`,
          icon: "git" as const,
        }))
      : [
          {
            pick: `repo:${activeRepo.name}`,
            label: `${activeRepo.owner}/${activeRepo.name}`,
            icon: "git" as const,
          },
        ]),
  ];

  const handleRepoSelect = (pick: string) => {
    if (pick === "overview") {
      router.push(`/app/overview?repoId=${encodeURIComponent(activeRepoId || activeRepo.name)}`);
    } else if (pick === "map") {
      router.push(`/app/map?repoId=${encodeURIComponent(activeRepoId || activeRepo.name)}`);
    } else if (pick === "select_new") {
      router.push("/repos");
    } else if (pick.startsWith("repo:")) {
      const targetId = pick.slice(5);
      setActiveRepoId(targetId);
      toast(`Switched workspace to ${targetId}`, "info");
      router.push(`/app/overview?repoId=${encodeURIComponent(targetId)}`);
    }
  };

  return (
    <aside className="sidebar">
      <Link href="/" className="sb-brand" id="sb-brand" title="Back to landing page">
        <Logo />
        <div>
          <div className="sb-name">DevMind</div>
          <div className="sb-sub">Engineering Intel</div>
        </div>
      </Link>

      <div className="sb-nav">
        <div className="sb-group">Workspace</div>
        {NAV_WORKSPACE.map((item) => {
          const isActive = shellMeta.active === item.id;
          const hrefWithRepo = activeRepoId ? `${item.href}?repoId=${encodeURIComponent(activeRepoId)}` : item.href;
          return (
            <Link
              key={item.id}
              href={hrefWithRepo}
              className={`sb-item ${isActive ? "sb-item-active" : ""}`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}

        <div className="sb-group">Development</div>
        {NAV_DEV.map((item) => {
          const isActive = shellMeta.active === item.id;
          const showBadge = item.id === "learning" && stats.pct > 0;
          const hrefWithRepo = activeRepoId ? `${item.href}?repoId=${encodeURIComponent(activeRepoId)}` : item.href;
          return (
            <Link
              key={item.id}
              href={hrefWithRepo}
              className={`sb-item ${isActive ? "sb-item-active" : ""}`}
            >
              <Icon name={item.icon} />
              {item.label}
              {showBadge && <span className="sb-badge">{stats.pct}%</span>}
            </Link>
          );
        })}

        <div className="sb-group">System</div>
        {NAV_SYSTEM.map((item) => {
          const isActive = shellMeta.active === item.id;
          const hrefWithRepo = activeRepoId ? `${item.href}?repoId=${encodeURIComponent(activeRepoId)}` : item.href;
          return (
            <Link
              key={item.id}
              href={hrefWithRepo}
              className={`sb-item ${isActive ? "sb-item-active" : ""}`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="sb-foot">
        <Dropdown
          trigger={
            <div className="sb-repo" id="sb-repo">
              <span className="sb-repo-ic">
                <Icon name="git" />
              </span>
              <span className="grow">
                <div className="sb-repo-name ellip">
                  {activeRepo.owner}/{activeRepo.name}
                </div>
                <div className="sb-repo-branch">{activeRepo.branch || branch || "main"}</div>
              </span>
            </div>
          }
          items={repoDropdownItems}
          onSelect={handleRepoSelect}
          block
        />

        <div className="sb-status">
          <span className="live-dot" />
          {analysisDone ? "Analysis complete" : "Ready to analyze"}
        </div>
      </div>
    </aside>
  );
}
