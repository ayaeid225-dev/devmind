import type { RepositoryKnowledgeView } from "@/lib/server/knowledge/types";

export interface DerivedTeamKnowledge {
  dev: string;
  color: string;
  contributorId?: string;
  links: [string, "module" | "tech" | "area"][];
}

export interface DerivedConcentration {
  module: string | null;
  level: "high" | "medium";
  devs: number;
  title: string;
  cover: string;
  insight: string;
  evidence: string;
  actions: string[];
}

export interface DerivedRecommendation {
  title: string;
  why: string;
  evidence: string;
  action: string;
  module: string | null;
}

export const PALETTE = [
  "#8BC34A",
  "#62C4C7",
  "#7896D8",
  "#D6A72C",
  "#E57373",
  "#BA68C8",
  "#4DB6AC",
  "#FF8A65",
];

export function deriveTeamKnowledge(
  graphData: RepositoryKnowledgeView
): DerivedTeamKnowledge[] {
  const {
    modules = [],
    files = [],
    classes = [],
    functions = [],
    dependencies = [],
    contributors = [],
    edges = [],
  } = graphData;

  return contributors.map((contributor, idx) => {
    const authoredCommitIds = new Set(
      edges
        .filter((e) => e.type === "AUTHORED_BY" && e.target === contributor.id)
        .map((e) => e.source)
    );

    const touchedFileIds = new Set(
      edges
        .filter((e) => e.type === "CHANGES" && authoredCommitIds.has(e.source))
        .map((e) => e.target)
    );

    const touchedFiles = files.filter((f) => touchedFileIds.has(f.id));

    const touchedModuleIds = new Set(
      edges
        .filter(
          (e) =>
            e.type === "CONTAINS" &&
            touchedFileIds.has(e.target) &&
            e.source.startsWith("module:")
        )
        .map((e) => e.source)
    );

    const touchedModules = modules.filter((m) => touchedModuleIds.has(m.id));

    const depIds = new Set(
      edges
        .filter((e) => e.type === "DEPENDS_ON" && touchedFileIds.has(e.source))
        .map((e) => e.target)
    );
    const touchedDeps = dependencies.filter((d) => depIds.has(d.id));

    const touchedClasses = classes.filter((c) =>
      touchedFiles.some((f) => f.filePath === c.filePath)
    );
    const touchedFunctions = functions.filter((fn) =>
      touchedFiles.some((f) => f.filePath === fn.filePath)
    );

    const links: [string, "module" | "tech" | "area"][] = [];

    if (touchedModules.length > 0) {
      links.push([touchedModules[0].name, "module"]);
      if (touchedModules.length > 1) {
        links.push([touchedModules[1].name, "module"]);
      }
    }

    if (touchedDeps.length > 0) {
      links.push([touchedDeps[0].name, "tech"]);
    }

    if (touchedClasses.length > 0) {
      links.push([touchedClasses[0].name, "area"]);
    } else if (touchedFunctions.length > 0) {
      links.push([touchedFunctions[0].name, "area"]);
    }

    if (links.length === 0 && touchedFiles.length > 0) {
      const firstFile = touchedFiles[0];
      if (firstFile?.language) {
        links.push([firstFile.language, "tech"]);
      }
      const dir = firstFile?.filePath
        ? firstFile.filePath.split("/").slice(0, -1).pop() || "Core"
        : "Core";
      links.push([dir, "area"]);
    }

    if (links.length === 0) {
      links.push(["Architecture", "area"]);
    }

    return {
      dev: contributor.name,
      color: PALETTE[idx % PALETTE.length],
      contributorId: contributor.id,
      links,
    };
  });
}

export function deriveConcentration(
  graphData: RepositoryKnowledgeView
): DerivedConcentration[] {
  const {
    repoNode,
    modules = [],
    files = [],
    dependencies = [],
    commits = [],
    contributors = [],
    edges = [],
  } = graphData;

  const derivedConc: DerivedConcentration[] = [];

  if (modules.length > 0) {
    for (const m of modules) {
      const modSlug = m.id.split(":").pop() || m.name;
      const mFiles = files.filter(
        (f) =>
          f.metadata?.moduleId === modSlug || f.metadata?.moduleId === m.name
      );
      const mFileIds = new Set(mFiles.map((f) => f.id));

      const mCommits = commits.filter((c) =>
        edges.some(
          (e) => e.type === "CHANGES" && e.source === c.id && mFileIds.has(e.target)
        )
      );

      const authorCounts = new Map<string, number>();
      for (const c of mCommits) {
        const authEdge = edges.find(
          (e) => e.type === "AUTHORED_BY" && e.source === c.id
        );
        if (authEdge) {
          authorCounts.set(
            authEdge.target,
            (authorCounts.get(authEdge.target) || 0) + 1
          );
        }
      }

      let topCount = 0;
      let topAuthId = "";
      for (const [authId, count] of authorCounts.entries()) {
        if (count > topCount) {
          topCount = count;
          topAuthId = authId;
        }
      }

      const topContributor = contributors.find((c) => c.id === topAuthId);
      const devCount = authorCounts.size || 1;
      const totalMCommits = mCommits.length || 1;
      const ratio = topCount / totalMCommits;
      const isHigh = ratio >= 0.6 || devCount === 1;

      derivedConc.push({
        module: modSlug,
        level: isHigh ? "high" : "medium",
        devs: devCount,
        title: m.name,
        cover: `${m.name} module contains ${mFiles.length} file${
          mFiles.length === 1 ? "" : "s"
        } and ${m.metadata?.depsCount || 0} dependencies`,
        insight: isHigh
          ? `${m.name} currently has a high dependency on a small number of contributors${
              topContributor
                ? ` (${topContributor.name} accounts for ${Math.round(
                    ratio * 100
                  )}% of module changes)`
                : ""
            }.`
          : `${m.name} knowledge is shared among ${devCount} team members across ${mFiles.length} files.`,
        evidence: `${mFiles.length} file${
          mFiles.length === 1 ? "" : "s"
        } in module; ${devCount} contributor${
          devCount === 1 ? "" : "s"
        } touched this area across ${mCommits.length} commits.`,
        actions: isHigh
          ? [
              `Document ${m.name} architecture`,
              "Share module ownership",
              "Cross-train another developer",
              "Pair on upcoming tasks",
            ]
          : [
              `Document key ${m.name} workflows`,
              "Expand code review participation",
              "Pair on critical changes",
            ],
      });
    }
  } else if (contributors.length > 0) {
    const topContrib = contributors[0];
    const topCommits =
      (topContrib.metadata?.authoredCommitsCount as number) ||
      (topContrib.metadata?.totalCommitsCount as number) ||
      1;
    const totalC = commits.length || 1;
    const ratio = topCommits / totalC;
    const isHigh = ratio >= 0.5 || contributors.length === 1;

    derivedConc.push({
      module: null,
      level: isHigh ? "high" : "medium",
      devs: contributors.length,
      title: repoNode.name,
      cover: `${repoNode.name} spans ${files.length} files and ${dependencies.length} external dependencies`,
      insight: isHigh
        ? `Repository development is centered around ${topContrib.name} (${Math.round(
            ratio * 100
          )}% of total commits).`
        : `Repository knowledge is distributed across ${contributors.length} contributors.`,
      evidence: `${topContrib.name} authored ${topCommits} of ${commits.length} total commits across ${files.length} tracked files.`,
      actions: [
        "Document core architecture",
        "Share codebase ownership",
        "Broaden code review rotations",
      ],
    });
  }

  return derivedConc;
}

export function deriveRecommendations(
  graphData: RepositoryKnowledgeView,
  concentration: DerivedConcentration[]
): DerivedRecommendation[] {
  const {
    modules = [],
    files = [],
    classes = [],
    functions = [],
    methods = [],
    dependencies = [],
    commits = [],
    contributors = [],
  } = graphData;

  const derivedRecs: DerivedRecommendation[] = [];

  const highConc = concentration.find((c) => c.level === "high");
  if (highConc) {
    derivedRecs.push({
      title: `${highConc.title} knowledge is concentrated around ${highConc.devs} developer${
        highConc.devs === 1 ? "" : "s"
      }.`,
      why: "Module resilience: if a primary contributor is unavailable, development in this area slows down.",
      evidence: highConc.evidence,
      action: `Create a shared ${highConc.title} module guide.`,
      module: highConc.module,
    });
  }

  if (classes.length > 0 || functions.length > 0) {
    derivedRecs.push({
      title: `Architecture defines ${classes.length} classes and ${functions.length} standalone functions.`,
      why: "Comprehensive symbol documentation accelerates onboarding and avoids duplicated logic.",
      evidence: `${files.length} parsed source files define ${classes.length} classes and ${methods.length} methods.`,
      action: "Document public interfaces and export boundaries.",
      module: modules[0] ? modules[0].id.split(":").pop() || null : null,
    });
  }

  if (dependencies.length > 0) {
    const depNames = dependencies.slice(0, 3).map((d) => d.name).join(", ");
    derivedRecs.push({
      title: `${dependencies.length} external package dependencies tracked across modules.`,
      why: "External package updates, security audits, and licensing require continuous visibility.",
      evidence: `Detected packages: ${depNames}${
        dependencies.length > 3 ? ` and ${dependencies.length - 3} more` : ""
      }.`,
      action: "Review dependency tree and audit package boundaries.",
      module: null,
    });
  }

  if (commits.length > 0) {
    derivedRecs.push({
      title: `${commits.length} historical commits analyzed across ${contributors.length} contributors.`,
      why: "Commit history provides objective evidence of code ownership and architectural evolution.",
      evidence: `Git history links ${commits.length} commits affecting ${files.length} tracked files.`,
      action: "Maintain regular Git sync to keep the team knowledge map fresh.",
      module: null,
    });
  }

  return derivedRecs;
}

export function deriveAllKnowledge(graphData: RepositoryKnowledgeView): {
  teamKnowledge: DerivedTeamKnowledge[];
  concentration: DerivedConcentration[];
  recommendations: DerivedRecommendation[];
} {
  const teamKnowledge = deriveTeamKnowledge(graphData);
  const concentration = deriveConcentration(graphData);
  const recommendations = deriveRecommendations(graphData, concentration);
  return { teamKnowledge, concentration, recommendations };
}
