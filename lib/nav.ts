import type { IconName } from "@/components/ui";
import {
  ADRS,
  DEVS,
  DOCS,
  EVIDENCE_ID_BY_PATH,
  FILE_LIST,
  MODULES,
  PATH,
} from "@/data/fixtures";

export interface NavEntry {
  id: string;
  label: string;
  icon: IconName;
  href: string;
}

/* app.js sidebar() NAV_MAIN / mid / bottom triples */
export const NAV_WORKSPACE: NavEntry[] = [
  { id: "overview", label: "Overview", icon: "overview", href: "/app/overview" },
  { id: "map", label: "Project Map", icon: "map", href: "/app/map" },
  { id: "modules", label: "Modules", icon: "modules", href: "/app/modules" },
  { id: "files", label: "Files", icon: "file", href: "/app/files" },
  { id: "deps", label: "Dependencies", icon: "deps", href: "/app/deps" },
  { id: "ask", label: "AI Assistant", icon: "ask", href: "/app/ask" },
  { id: "docs", label: "Documentation", icon: "book", href: "/app/docs" },
  { id: "devs", label: "Developer Insights", icon: "users", href: "/app/devs" },
];

export const NAV_DEV: NavEntry[] = [
  { id: "learning", label: "Learning Path", icon: "learning", href: "/app/learning" },
  { id: "knowledge", label: "Engineering Knowledge", icon: "brain", href: "/app/knowledge" },
  { id: "activity", label: "Activity", icon: "log", href: "/app/activity" },
  { id: "design", label: "Design \u2194 Code", icon: "puzzle", href: "/app/design" },
];

export const NAV_SYSTEM: NavEntry[] = [
  { id: "settings", label: "Settings", icon: "settings", href: "/app/settings" },
  { id: "help", label: "Help", icon: "help", href: "/app/help" },
];

/* app.js SUB_META */
export interface SubMeta {
  title: string;
  icon: IconName;
  crumb: string[];
}

export const SUB_META: Record<string, SubMeta> = {
  overview: { title: "Overview", icon: "overview", crumb: ["clinic-management"] },
  map: { title: "Project Intelligence Map", icon: "map", crumb: ["clinic-management", "Intelligence Map"] },
  modules: { title: "Modules", icon: "modules", crumb: ["clinic-management", "Modules"] },
  files: { title: "Files", icon: "file", crumb: ["clinic-management", "Files"] },
  deps: { title: "Dependencies", icon: "deps", crumb: ["clinic-management", "Dependencies"] },
  ask: { title: "AI Assistant", icon: "ask", crumb: ["clinic-management", "Ask DevMind"] },
  docs: { title: "Documentation", icon: "book", crumb: ["clinic-management", "Documentation"] },
  devs: { title: "Developer Insights", icon: "users", crumb: ["clinic-management", "Developer Insights"] },
  knowledge: { title: "Engineering Knowledge", icon: "brain", crumb: ["clinic-management", "Engineering Knowledge"] },
  activity: { title: "Activity", icon: "log", crumb: ["clinic-management", "Activity"] },
  design: { title: "Design \u2194 Code", icon: "puzzle", crumb: ["clinic-management", "Design \u2194 Code"] },
  learning: { title: "Learning Path", icon: "learning", crumb: ["clinic-management", "Learning Path"] },
  settings: { title: "Settings", icon: "settings", crumb: ["Workspace"] },
  help: { title: "Help", icon: "help", crumb: ["Help"] },
};

export interface ShellMeta {
  /** Sidebar item id highlighted for this route. */
  active: string;
  crumb: string[];
  back?: { href: string; label: string };
}

/*
 * Resolves sidebar highlight + breadcrumb from the pathname, mirroring how
 * renderAppShell picks SUB_META[sub] and how the detail renderers build
 * their own meta (module/evidence/doc/dev/lesson) with a back button.
 * Unknown subs fall back to overview meta.
 */
export function metaForPath(pathname: string): ShellMeta {
  const clean = pathname.split("?")[0].split("#")[0];
  const parts = clean.split("/").filter(Boolean);
  const seg = parts[1] ?? "overview";
  const arg = parts[2] ?? "";
  const arg2 = parts[3] ?? "";
  const arg3 = parts[4] ?? "";

  if (seg === "modules" && arg) {
    const m = MODULES.find((x) => x.id === arg);
    return {
      active: "modules",
      crumb: ["clinic-management", "Modules", m?.name ?? "Module"],
      back: { href: "/app/modules", label: "Modules" },
    };
  }

  if (seg === "evidence" && arg) {
    const entry =
      FILE_LIST.find((f) => EVIDENCE_ID_BY_PATH[f.path] === arg) ??
      FILE_LIST.find((f) => f.path.split("/").pop()?.replace(/\.\w+$/, "") === arg);
    const fileName = entry?.path.split("/").pop() ?? arg;
    return {
      active: "files",
      crumb: ["clinic-management", "Files", fileName],
      back: { href: "/app/files", label: "Files" },
    };
  }

  if (seg === "docs" && arg) {
    const doc = DOCS.find((d) => d.id === arg) ?? ADRS.find((a) => a.id === arg);
    return {
      active: "docs",
      crumb: ["clinic-management", "Documentation", doc?.title ?? arg],
      back: { href: "/app/docs", label: "Documentation" },
    };
  }

  if (seg === "devs" && arg) {
    const dev = DEVS.find((d) => d.id === arg);
    return {
      active: "devs",
      crumb: ["clinic-management", "Developer Insights", dev?.name ?? arg],
      back: { href: "/app/devs", label: "Developer Insights" },
    };
  }

  if (seg === "learning" && arg === "lesson" && arg2 && arg3) {
    const step = PATH.find((p) => p.id === arg2);
    const lesson = step?.lessons.find((l) => l.id === arg3);
    return {
      active: "learning",
      crumb: ["clinic-management", "Course", step?.title ?? "Step", lesson?.title ?? "Lesson"],
      back: { href: "/app/learning", label: "Course" },
    };
  }

  const meta = SUB_META[seg] ?? SUB_META.overview;
  return { active: SUB_META[seg] ? seg : "overview", crumb: [...meta.crumb] };
}
