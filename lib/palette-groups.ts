import type { PaletteGroup, PaletteItem } from "@/components/ui";

export interface SearchPaletteItem {
  id: string;
  type: "file" | "chunk" | "module" | "doc" | "symbol";
  title: string;
  path: string;
  snippet?: string;
  startLine?: number;
  endLine?: number;
  language?: string;
  moduleId?: string | null;
  moduleName?: string;
  score: number;
  url: string;
  icon: "file" | "code" | "modules" | "fileText" | "spark";
  cat: string;
}

export interface RepoContext {
  id?: string | null;
  name: string;
  owner?: string;
  defaultBranch?: string;
  modules?: Array<{ id: string; name: string; filesCount?: number; type?: string }>;
}

/**
 * Builds command palette groups dynamically from real semantic search results.
 * Respects strict repository scoping and displays real metadata.
 */
export function buildPaletteGroupsFromSearchResults(
  results: readonly SearchPaletteItem[],
  query: string,
  repoContext: RepoContext,
  go: (href: string) => void
): PaletteGroup[] {
  const repoId = repoContext.id || repoContext.name;
  const groups: PaletteGroup[] = [];

  const fileItems: PaletteItem[] = [];
  const codeItems: PaletteItem[] = [];
  const moduleItems: PaletteItem[] = [];
  const docItems: PaletteItem[] = [];
  const symbolItems: PaletteItem[] = [];

  for (const item of results) {
    const paletteItem: PaletteItem = {
      id: item.id,
      icon: item.icon,
      name: item.title,
      sub: item.snippet ? `${item.path} — ${item.snippet}` : item.path,
      cat: item.cat,
      keywords: `${item.path} ${item.moduleName || ""} ${item.language || ""}`,
      onSelect: () => go(item.url),
    };

    if (item.type === "file") {
      fileItems.push(paletteItem);
    } else if (item.type === "chunk") {
      codeItems.push(paletteItem);
    } else if (item.type === "module") {
      moduleItems.push(paletteItem);
    } else if (item.type === "doc") {
      docItems.push(paletteItem);
    } else if (item.type === "symbol") {
      symbolItems.push(paletteItem);
    }
  }

  if (fileItems.length > 0) {
    groups.push({
      label: "Files",
      items: fileItems,
    });
  }

  if (codeItems.length > 0) {
    groups.push({
      label: "Code & Semantic Evidence",
      items: codeItems,
    });
  }

  if (symbolItems.length > 0) {
    groups.push({
      label: "Code Symbols",
      items: symbolItems,
    });
  }

  if (moduleItems.length > 0) {
    groups.push({
      label: "Modules",
      items: moduleItems,
    });
  }

  if (docItems.length > 0) {
    groups.push({
      label: "Documentation",
      items: docItems,
    });
  }

  // Ask DevMind Action for natural-language questions
  if (query.trim().length > 0) {
    groups.push({
      label: "AI Assistant",
      items: [
        {
          id: `ask:${query}`,
          icon: "ask",
          name: `Ask DevMind: "${query.trim()}"`,
          sub: `Synthesize answers from ${repoContext.name} code evidence with AI`,
          cat: "Ask",
          onSelect: () =>
            go(`/app/ask?q=${encodeURIComponent(query.trim())}&repoId=${encodeURIComponent(repoId)}`),
        },
      ],
    });
  }

  return groups;
}

/**
 * Builds initial command palette groups when search input is empty.
 * Returns only verified real repository actions and modules.
 * Absolutely NO mock data or static fixture items.
 */
export function buildDefaultPaletteGroups(
  repoContext: RepoContext,
  go: (href: string) => void
): PaletteGroup[] {
  const repoId = repoContext.id || repoContext.name;
  const groups: PaletteGroup[] = [];

  // Actions for the currently selected repository
  groups.push({
    label: "Quick Actions",
    items: [
      {
        id: "action:ask",
        icon: "ask",
        name: "Ask DevMind",
        sub: `Ask AI questions about ${repoContext.name} codebase`,
        cat: "AI",
        onSelect: () => go(`/app/ask?repoId=${encodeURIComponent(repoId)}`),
      },
      {
        id: "action:map",
        icon: "map",
        name: "Project Intelligence Map",
        sub: `Interactive architecture diagram for ${repoContext.name}`,
        cat: "Architecture",
        onSelect: () => go(`/app/map?repoId=${encodeURIComponent(repoId)}`),
      },
      {
        id: "action:files",
        icon: "file",
        name: "Browse Indexed Files",
        sub: `View full repository file tree for ${repoContext.name}`,
        cat: "Files",
        onSelect: () => go(`/app/files?repoId=${encodeURIComponent(repoId)}`),
      },
      {
        id: "action:docs",
        icon: "fileText",
        name: "Repository Documentation",
        sub: `Engineering documentation & health for ${repoContext.name}`,
        cat: "Docs",
        onSelect: () => go(`/app/docs?repoId=${encodeURIComponent(repoId)}`),
      },
    ],
  });

  // If repository has indexed modules, include them
  if (repoContext.modules && repoContext.modules.length > 0) {
    groups.push({
      label: "Modules",
      items: repoContext.modules.map((m) => ({
        id: `module:${m.id}`,
        icon: "modules",
        name: m.name,
        sub: `${m.type || "core"} module${m.filesCount ? ` • ${m.filesCount} files` : ""}`,
        cat: "Module",
        keywords: m.name,
        onSelect: () => go(`/app/modules/${m.id}?repoId=${encodeURIComponent(repoId)}`),
      })),
    });
  }

  return groups;
}
