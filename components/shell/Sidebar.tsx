"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Logo, Dropdown, type DropdownItem, useToast } from "@/components/ui";
import { NAV_WORKSPACE, NAV_DEV, NAV_SYSTEM, metaForPath } from "@/lib/nav";
import { courseStats, useCourseDone } from "@/lib/course";
import { REPOS, type Repo } from "@/data/fixtures";
import { useShell } from "@/lib/shell-context";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { repo, branch, analysisDone, setRepo } = useShell();
  const doneLessons = useCourseDone();
  const stats = courseStats(doneLessons);
  const shellMeta = metaForPath(pathname);

  const repoDropdownItems: DropdownItem[] = [
    { pick: "overview", label: "Project Overview", icon: "overview" },
    { pick: "map", label: "Open Intelligence Map", icon: "map" },
    { kind: "sep" },
    { kind: "label", label: "Switch to" },
    ...REPOS.map((r: Repo) => ({
      pick: `repo:${r.name}`,
      label: r.name,
      icon: "git" as const,
    })),
  ];

  const handleRepoSelect = (pick: string) => {
    if (pick === "overview") {
      router.push("/app/overview");
    } else if (pick === "map") {
      router.push("/app/map");
    } else if (pick.startsWith("repo:")) {
      const repoName = pick.slice(5);
      const targetRepo = REPOS.find((r) => r.name === repoName);
      if (targetRepo) {
        setRepo(targetRepo);
        toast(`Switched to ${targetRepo.name}`, "info");
        router.push("/app/overview");
      }
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
          return (
            <Link
              key={item.id}
              href={item.href}
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
          return (
            <Link
              key={item.id}
              href={item.href}
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
          return (
            <Link
              key={item.id}
              href={item.href}
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
                  {repo.owner}/{repo.name}
                </div>
                <div className="sb-repo-branch">{repo.branch || branch || "main"}</div>
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
