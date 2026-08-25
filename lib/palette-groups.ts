import type { PaletteGroup } from "@/components/ui";
import {
  ADRS,
  DEPS_EXTERNAL,
  DEVS,
  DOC_CATS,
  DOCS,
  EVIDENCE_ID_BY_PATH,
  FILE_LIST,
  MODULES,
  PATH,
  QA,
} from "@/data/fixtures";

/*
 * Port of ui.js U.renderPaletteResults() group construction. The router
 * navigation is injected as `go` so this stays framework-only here.
 * Per-source caps from the prototype live on each group (`max`) and are
 * enforced by CommandPalette at rest state too.
 */
export function buildPaletteGroups(go: (href: string) => void): PaletteGroup[] {
  return [
    {
      label: "Files",
      max: 4,
      items: FILE_LIST.map((f) => ({
        id: `file:${f.path}`,
        icon: "file" as const,
        name: f.path.split("/").pop() ?? f.path,
        sub: f.path,
        cat: "File",
        keywords: f.module,
        onSelect: () =>
          go(`/app/evidence/${EVIDENCE_ID_BY_PATH[f.path] ?? "appointment_service"}`),
      })),
    },
    {
      label: "Modules",
      items: MODULES.filter((m) => m.type !== "ext" && m.type !== "db").map((m) => ({
        id: `module:${m.id}`,
        icon: "modules" as const,
        name: m.name,
        sub: `${m.type} module \u2022 ${m.files} files`,
        cat: "Module",
        keywords: m.id,
        onSelect: () => go(`/app/module/${m.id}`),
      })),
    },
    {
      label: "Dependencies",
      items: DEPS_EXTERNAL.map((d) => ({
        id: `dep:${d.name}`,
        icon: "packages" as const,
        name: d.name,
        sub: d.purpose,
        cat: "Dep",
        onSelect: () => go("/app/deps"),
      })),
    },
    {
      label: "Course lessons",
      items: PATH.flatMap((st) =>
        st.lessons.map((l) => ({
          id: `lesson:${st.id}/${l.id}`,
          icon: "learning" as const,
          name: l.title,
          sub: `${st.title} \u2022 Course lesson`,
          cat: "Lesson",
          keywords: `${st.title} learning course lesson path`,
          onSelect: () => go(`/app/lesson/${st.id}/${l.id}`),
        }))
      ),
    },
    {
      label: "Documentation",
      max: 4,
      items: DOCS.map((d) => ({
        id: `doc:${d.id}`,
        icon: "book" as const,
        name: d.title,
        sub: `${DOC_CATS.find((c) => c.id === d.category)?.name ?? d.category} \u2022 ${d.updated}`,
        cat: "Doc",
        keywords: `${d.category} ${d.summary}`,
        onSelect: () => go(`/app/doc/${d.id}`),
      })),
    },
    {
      label: "Architecture decisions",
      max: 3,
      items: ADRS.map((a) => ({
        id: `adr:${a.id}`,
        icon: "branch" as const,
        name: `${a.id} \u2014 ${a.title}`,
        sub: `${a.status} \u2022 ${a.summary}`,
        cat: "ADR",
        keywords: a.id,
        onSelect: () => go(`/app/doc/${a.id}`),
      })),
    },
    {
      label: "Developers",
      max: 4,
      items: DEVS.map((d) => ({
        id: `dev:${d.id}`,
        icon: "users" as const,
        name: d.name,
        sub: `${d.role} \u2022 ${d.coverage}% knowledge coverage`,
        cat: "Dev",
        keywords: `${d.role} ${d.strongAreas.join(" ")} ${d.modules
          .map((mid) => MODULES.find((m) => m.id === mid)?.name ?? mid)
          .join(" ")}`,
        onSelect: () => go(`/app/dev/${d.id}`),
      })),
    },
    {
      label: "Actions",
      items: [
        { icon: "ask" as const, name: "Ask DevMind anything", sub: "Search the project with AI", href: "/app/ask", cat: "Ask" },
        { icon: "learning" as const, name: "Open Learning Path", sub: "Text-based onboarding course", href: "/app/learning", cat: "Path" },
        { icon: "book" as const, name: "Open Documentation", sub: "Docs hub and doc health", href: "/app/docs", cat: "Action" },
        { icon: "users" as const, name: "Open Developer Insights", sub: "Team skill map and profiles", href: "/app/devs", cat: "Action" },
        { icon: "map" as const, name: "Open Project Intelligence Map", sub: "Full architecture graph", href: "/app/map", cat: "Action" },
        { icon: "settings" as const, name: "Settings", sub: "Workspace and connection", href: "/app/settings", cat: "Action" },
      ].map((a) => ({
        id: `action:${a.name}`,
        icon: a.icon,
        name: a.name,
        sub: a.sub,
        cat: a.cat,
        onSelect: () => go(a.href),
      })),
    },
    {
      label: "Ask DevMind",
      when: "query",
      items: QA.map((qa) => ({
        id: `ask:${qa.q}`,
        icon: "ask" as const,
        name: qa.q,
        sub: "Evidence-backed answer",
        cat: "Ask",
        onSelect: () => go(`/app/ask?q=${encodeURIComponent(qa.q)}`),
      })),
    },
  ];
}
