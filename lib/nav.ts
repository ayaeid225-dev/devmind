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

export interface SubMeta {
  title: string;
  icon: IconName;
  crumb: string[];
}

export const SUB_META: Record<string, SubMeta> = {
  overview: { title: "Overview", icon: "overview", crumb: ["Workspace"] },
  map: { title: "Project Intelligence Map", icon: "map", crumb: ["Workspace", "Intelligence Map"] },
  modules: { title: "Modules", icon: "modules", crumb: ["Workspace", "Modules"] },
  files: { title: "Files", icon: "file", crumb: ["Workspace", "Files"] },
  deps: { title: "Dependencies", icon: "deps", crumb: ["Workspace", "Dependencies"] },
  ask: { title: "AI Assistant", icon: "ask", crumb: ["Workspace", "Ask DevMind"] },
  docs: { title: "Documentation", icon: "book", crumb: ["Workspace", "Documentation"] },
  devs: { title: "Developer Insights", icon: "users", crumb: ["Workspace", "Developer Insights"] },
  knowledge: { title: "Engineering Knowledge", icon: "brain", crumb: ["Workspace", "Engineering Knowledge"] },
  activity: { title: "Activity", icon: "log", crumb: ["Workspace", "Activity"] },
  design: { title: "Design \u2194 Code", icon: "puzzle", crumb: ["Workspace", "Design \u2194 Code"] },
  learning: { title: "Learning Path", icon: "learning", crumb: ["Workspace", "Learning Path"] },
  settings: { title: "Settings", icon: "settings", crumb: ["Workspace", "Settings"] },
  help: { title: "Help", icon: "help", crumb: ["Workspace", "Help"] },
};

export interface ShellMeta {
  active: string;
  crumb: string[];
  back?: { href: string; label: string };
}

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
      crumb: ["Workspace", "Modules", m?.name ?? "Module"],
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
      crumb: ["Workspace", "Files", fileName],
      back: { href: "/app/files", label: "Files" },
    };
  }

  if (seg === "docs" && arg) {
    const doc = DOCS.find((d) => d.id === arg) ?? ADRS.find((a) => a.id === arg);
    return {
      active: "docs",
      crumb: ["Workspace", "Documentation", doc?.title ?? arg],
      back: { href: "/app/docs", label: "Documentation" },
    };
  }

  if (seg === "devs" && arg) {
    const dev = DEVS.find((d) => d.id === arg);
    return {
      active: "devs",
      crumb: ["Workspace", "Developer Insights", dev?.name ?? arg],
      back: { href: "/app/devs", label: "Developer Insights" },
    };
  }

  if (seg === "learning" && arg === "lesson" && arg2 && arg3) {
    const step = PATH.find((p) => p.id === arg2);
    const lesson = step?.lessons.find((l) => l.id === arg3);
    return {
      active: "learning",
      crumb: ["Workspace", "Course", step?.title ?? "Step", lesson?.title ?? "Lesson"],
      back: { href: "/app/learning", label: "Course" },
    };
  }

  const meta = SUB_META[seg] ?? SUB_META.overview;
  return { active: SUB_META[seg] ? seg : "overview", crumb: [...meta.crumb] };
}
