import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  generateVerifiedDocumentation,
  detectTechStack,
  extractEntryPoints,
  calculateDocLanguageStats,
  calculateDocModuleStats,
  buildDocArchitectureDiagram,
  extractCoreModuleDocs,
  type VerifiedProjectDocumentation,
} from "../lib/docs-helper";
import type {
  RepositoryKnowledgeView,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphStats,
} from "../lib/server/knowledge/types";

describe("DevMind Milestone 6 — Docs (Verified Architecture & Module Documentation)", () => {
  const dummyStats: KnowledgeGraphStats = {
    totalNodes: 0,
    totalEdges: 0,
    nodesByType: {
      Repository: 1,
      Module: 0,
      File: 0,
      Class: 0,
      Function: 0,
      Method: 0,
      Commit: 0,
      Contributor: 0,
      Dependency: 0,
    },
    edgesByType: {
      CONTAINS: 0,
      IMPORTS: 0,
      DEPENDS_ON: 0,
      CHANGES: 0,
      AUTHORED_BY: 0,
      COMMITTED_BY: 0,
      EXTENDS: 0,
      IMPLEMENTS: 0,
    },
  };

  // --------------------------------------------------------------------------
  // TEST FIXTURES: Generic Repository A
  // --------------------------------------------------------------------------
  const repoAId = "repo-alpha";

  const repoAGraph: RepositoryKnowledgeView = {
    repoNode: {
      id: `repo:${repoAId}`,
      type: "Repository",
      name: "AlphaService",
      label: "AlphaService",
      repoId: repoAId,
      metadata: { owner: "acme-corp", latestCommitSha: "a1b2c3d4e5" },
    },
    modules: [
      {
        id: `module:${repoAId}:gateway`,
        type: "Module",
        name: "ApiGateway",
        label: "Module ApiGateway (api)",
        repoId: repoAId,
        metadata: { type: "api", desc: "Routes external HTTP requests" },
      },
      {
        id: `module:${repoAId}:core`,
        type: "Module",
        name: "CoreDomain",
        label: "Module CoreDomain (core)",
        repoId: repoAId,
        metadata: { type: "core", desc: "Core business workflows and domain entities" },
      },
      {
        id: `module:${repoAId}:db`,
        type: "Module",
        name: "Persistence",
        label: "Module Persistence (db)",
        repoId: repoAId,
        metadata: { type: "db", desc: "PostgreSQL models and query execution" },
      },
    ],
    files: [
      {
        id: `file:${repoAId}:src/gateway/index.ts`,
        type: "File",
        name: "index.ts",
        label: "src/gateway/index.ts",
        filePath: "src/gateway/index.ts",
        language: "TypeScript",
        repoId: repoAId,
        metadata: { moduleId: "gateway", size: "3.2 KB" },
      },
      {
        id: `file:${repoAId}:src/core/workflow.ts`,
        type: "File",
        name: "workflow.ts",
        label: "src/core/workflow.ts",
        filePath: "src/core/workflow.ts",
        language: "TypeScript",
        repoId: repoAId,
        metadata: { moduleId: "core", size: "5.1 KB" },
      },
      {
        id: `file:${repoAId}:src/db/client.ts`,
        type: "File",
        name: "client.ts",
        label: "src/db/client.ts",
        filePath: "src/db/client.ts",
        language: "TypeScript",
        repoId: repoAId,
        metadata: { moduleId: "db", size: "2.8 KB" },
      },
      {
        id: `file:${repoAId}:src/db/schema.sql`,
        type: "File",
        name: "schema.sql",
        label: "src/db/schema.sql",
        filePath: "src/db/schema.sql",
        language: "SQL",
        repoId: repoAId,
        metadata: { moduleId: "db", size: "1.4 KB" },
      },
    ],
    classes: [
      {
        id: `cls:${repoAId}:WorkflowManager`,
        type: "Class",
        name: "WorkflowManager",
        label: "class WorkflowManager",
        repoId: repoAId,
        filePath: "src/core/workflow.ts",
        startLine: 10,
        endLine: 50,
      },
      {
        id: `cls:${repoAId}:DatabaseClient`,
        type: "Class",
        name: "DatabaseClient",
        label: "class DatabaseClient",
        repoId: repoAId,
        filePath: "src/db/client.ts",
        startLine: 4,
        endLine: 35,
      },
    ],
    functions: [
      {
        id: `fn:${repoAId}:startServer`,
        type: "Function",
        name: "startServer",
        label: "function startServer",
        repoId: repoAId,
        filePath: "src/gateway/index.ts",
        startLine: 12,
        endLine: 30,
      },
    ],
    methods: [],
    dependencies: [
      {
        id: `dep:${repoAId}:express`,
        type: "Dependency",
        name: "express",
        label: "express@^4.18.2",
        repoId: repoAId,
        metadata: { version: "4.18.2", dependencyType: "manifest" },
      },
      {
        id: `dep:${repoAId}:pg`,
        type: "Dependency",
        name: "pg",
        label: "pg@^8.11.0",
        repoId: repoAId,
        metadata: { version: "8.11.0", dependencyType: "manifest" },
      },
    ],
    commits: [
      {
        id: `commit:${repoAId}:c1`,
        type: "Commit",
        name: "Initial commit",
        label: "Initial commit",
        repoId: repoAId,
      },
    ],
    contributors: [
      {
        id: `contrib:${repoAId}:alice`,
        type: "Contributor",
        name: "Alice Engineer",
        label: "Alice Engineer",
        repoId: repoAId,
        metadata: { commitsCount: 14 },
      },
    ],
    edges: [
      // Containment
      {
        id: "e-m-1",
        source: `module:${repoAId}:gateway`,
        target: `file:${repoAId}:src/gateway/index.ts`,
        type: "CONTAINS",
        repoId: repoAId,
      },
      {
        id: "e-m-2",
        source: `module:${repoAId}:core`,
        target: `file:${repoAId}:src/core/workflow.ts`,
        type: "CONTAINS",
        repoId: repoAId,
      },
      {
        id: "e-m-3",
        source: `module:${repoAId}:db`,
        target: `file:${repoAId}:src/db/client.ts`,
        type: "CONTAINS",
        repoId: repoAId,
      },
      {
        id: "e-m-4",
        source: `module:${repoAId}:db`,
        target: `file:${repoAId}:src/db/schema.sql`,
        type: "CONTAINS",
        repoId: repoAId,
      },

      // Code Imports
      // Gateway -> Core
      {
        id: "e-imp-1",
        source: `file:${repoAId}:src/gateway/index.ts`,
        target: `file:${repoAId}:src/core/workflow.ts`,
        type: "IMPORTS",
        repoId: repoAId,
      },
      // Core -> DB
      {
        id: "e-imp-2",
        source: `file:${repoAId}:src/core/workflow.ts`,
        target: `file:${repoAId}:src/db/client.ts`,
        type: "IMPORTS",
        repoId: repoAId,
      },

      // External Dependencies
      {
        id: "e-dep-1",
        source: `file:${repoAId}:src/gateway/index.ts`,
        target: `dep:${repoAId}:express`,
        type: "DEPENDS_ON",
        repoId: repoAId,
      },
      {
        id: "e-dep-2",
        source: `file:${repoAId}:src/db/client.ts`,
        target: `dep:${repoAId}:pg`,
        type: "DEPENDS_ON",
        repoId: repoAId,
      },
    ],
    stats: dummyStats,
  };

  // --------------------------------------------------------------------------
  // TESTS
  // --------------------------------------------------------------------------

  test("1. Source Audit: docs helper does not import mock fixtures", () => {
    const helperPath = path.resolve(__dirname, "../lib/docs-helper.ts");
    const content = fs.readFileSync(helperPath, "utf-8");
    assert.strictEqual(
      content.includes("@/data/fixtures"),
      false,
      "docs-helper.ts must NOT import mock fixtures"
    );
    assert.strictEqual(
      content.includes("clinic-management"),
      false,
      "docs-helper.ts must NOT hardcode clinic-management"
    );
  });

  test("2. Generates verified Project Summary statistics", () => {
    const doc = generateVerifiedDocumentation(repoAGraph);
    assert.strictEqual(doc.repoName, "AlphaService");
    assert.strictEqual(doc.summary.stats.filesCount, 4);
    assert.strictEqual(doc.summary.stats.modulesCount, 3);
    assert.strictEqual(doc.summary.stats.dependenciesCount, 2);
    assert.strictEqual(doc.summary.stats.classesCount, 2);
    assert.strictEqual(doc.summary.stats.functionsCount, 1);
    assert.strictEqual(doc.summary.primaryLanguage, "TypeScript");
    assert.strictEqual(doc.summary.projectType, "Node.js REST API Server");
  });

  test("3. Architecture Overview generates SVG diagram with verified relationships", () => {
    const doc = generateVerifiedDocumentation(repoAGraph);
    assert.ok(doc.architectureOverview.diagram, "Architecture diagram must exist");

    const diagram = doc.architectureOverview.diagram!;
    assert.strictEqual(diagram.nodes.length, 3);

    // Verify nodes contain the modules
    const nodeLabels = diagram.nodes.map((n) => n.label);
    assert.ok(nodeLabels.includes("ApiGateway"));
    assert.ok(nodeLabels.includes("CoreDomain"));
    assert.ok(nodeLabels.includes("Persistence"));

    // Verify cross-module edges were derived: Gateway -> Core, Core -> Persistence
    assert.strictEqual(diagram.edges.length, 2);
    const edgeDescriptions = diagram.edges.map((e) => `${e.source}->${e.target}`);
    assert.ok(edgeDescriptions.some((k) => k.includes("gateway") && k.includes("core")));
    assert.ok(edgeDescriptions.some((k) => k.includes("core") && k.includes("db")));
  });

  test("4. Technology Stack detects primary languages and external dependencies", () => {
    const doc = generateVerifiedDocumentation(repoAGraph);
    const techNames = doc.techStack.map((t) => t.name);

    assert.ok(techNames.includes("TypeScript"), "Must detect TypeScript language");
    assert.ok(techNames.includes("express"), "Must detect express framework");
    assert.ok(techNames.includes("pg"), "Must detect pg database driver");

    const expressItem = doc.techStack.find((t) => t.name === "express")!;
    assert.strictEqual(expressItem.category, "framework");
    assert.strictEqual(expressItem.type, "HTTP Server Framework");
    assert.strictEqual(expressItem.version, "v4.18.2");

    const pgItem = doc.techStack.find((t) => t.name === "pg")!;
    assert.strictEqual(pgItem.category, "database");
    assert.strictEqual(pgItem.type, "Database Driver");
  });

  test("5. Project Structure reflects verified modules overview", () => {
    const doc = generateVerifiedDocumentation(repoAGraph);
    assert.strictEqual(doc.projectStructure.modulesOverview.length, 3);

    const gatewayMod = doc.projectStructure.modulesOverview.find((m) => m.name === "ApiGateway")!;
    assert.strictEqual(gatewayMod.filesCount, 1);
    assert.strictEqual(gatewayMod.type, "api");
  });

  test("6. Core Modules detail includes real files, classes, functions, and relationships", () => {
    const doc = generateVerifiedDocumentation(repoAGraph);
    assert.strictEqual(doc.coreModules.length, 3);

    // Inspect CoreDomain
    const coreMod = doc.coreModules.find((m) => m.name === "CoreDomain")!;
    assert.ok(coreMod, "CoreDomain must exist");

    // Key files
    assert.strictEqual(coreMod.keyFiles.length, 1);
    assert.strictEqual(coreMod.keyFiles[0].path, "src/core/workflow.ts");

    // Classes
    assert.strictEqual(coreMod.classes.length, 1);
    assert.strictEqual(coreMod.classes[0].name, "WorkflowManager");

    // Dependents: ApiGateway calls CoreDomain
    assert.ok(coreMod.dependents.some((d) => d.name === "ApiGateway"));

    // Dependencies: CoreDomain calls Persistence
    assert.ok(coreMod.dependencies.some((d) => d.name === "Persistence"));

    // Relationships text
    assert.ok(coreMod.relationships.some((r) => r.includes("ApiGateway")));
    assert.ok(coreMod.relationships.some((r) => r.includes("Persistence")));
  });

  test("7. External Dependencies table maps packages to consuming modules", () => {
    const doc = generateVerifiedDocumentation(repoAGraph);
    assert.strictEqual(doc.dependencies.length, 2);

    const expressDep = doc.dependencies.find((d) => d.name === "express")!;
    assert.strictEqual(expressDep.version, "4.18.2");
    assert.ok(expressDep.usedByModules.includes("ApiGateway"));

    const pgDep = doc.dependencies.find((d) => d.name === "pg")!;
    assert.strictEqual(pgDep.version, "8.11.0");
    assert.ok(pgDep.usedByModules.includes("Persistence"));
  });

  test("8. Entry Points detects index.ts with verified reason", () => {
    const doc = generateVerifiedDocumentation(repoAGraph);
    assert.strictEqual(doc.entryPoints.length, 1);
    assert.strictEqual(doc.entryPoints[0].name, "index.ts");
    assert.strictEqual(doc.entryPoints[0].filePath, "src/gateway/index.ts");
    assert.strictEqual(doc.entryPoints[0].moduleName, "ApiGateway");
    assert.strictEqual(doc.entryPoints[0].type, "Primary Entry");
  });

  test("9. Language and Module Statistics compute accurate distributions", () => {
    const doc = generateVerifiedDocumentation(repoAGraph);

    // 4 files: 3 TypeScript (75%), 1 SQL (25%)
    const tsStat = doc.statistics.languages.find((l) => l.language === "TypeScript")!;
    assert.strictEqual(tsStat.count, 3);
    assert.strictEqual(tsStat.percentage, 75);

    const sqlStat = doc.statistics.languages.find((l) => l.language === "SQL")!;
    assert.strictEqual(sqlStat.count, 1);
    assert.strictEqual(sqlStat.percentage, 25);

    // Modules by type: 1 api, 1 core, 1 db
    assert.strictEqual(doc.statistics.modulesByType.length, 3);
  });

  test("10. Git activity is populated when verified commits and contributors exist", () => {
    const doc = generateVerifiedDocumentation(repoAGraph);
    assert.ok(doc.gitActivity);
    assert.strictEqual(doc.gitActivity?.latestCommitSha, "a1b2c3d4e5");
    assert.strictEqual(doc.gitActivity?.commitsCount, 1);
    assert.strictEqual(doc.gitActivity?.contributorsCount, 1);
    assert.strictEqual(doc.gitActivity?.topContributors[0].name, "Alice Engineer");
  });

  test("11. Multi-Repository Scoping: Repo A vs Repo B produce completely isolated docs", () => {
    const repoBId = "repo-beta";
    const repoBGraph: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${repoBId}`,
        type: "Repository",
        name: "BetaFlutter",
        label: "BetaFlutter",
        repoId: repoBId,
      },
      modules: [
        {
          id: `module:${repoBId}:mobile`,
          type: "Module",
          name: "MobileClient",
          label: "Module MobileClient",
          repoId: repoBId,
          metadata: { type: "core" },
        },
      ],
      files: [
        {
          id: `file:${repoBId}:lib/main.dart`,
          type: "File",
          name: "main.dart",
          label: "lib/main.dart",
          filePath: "lib/main.dart",
          language: "Dart",
          repoId: repoBId,
          metadata: { moduleId: "mobile" },
        },
      ],
      classes: [],
      functions: [],
      methods: [],
      dependencies: [
        {
          id: `dep:${repoBId}:flutter`,
          type: "Dependency",
          name: "flutter",
          label: "flutter",
          repoId: repoBId,
        },
      ],
      commits: [],
      contributors: [],
      edges: [],
      stats: dummyStats,
    };

    const docA = generateVerifiedDocumentation(repoAGraph);
    const docB = generateVerifiedDocumentation(repoBGraph);

    assert.strictEqual(docA.repoName, "AlphaService");
    assert.strictEqual(docB.repoName, "BetaFlutter");
    assert.strictEqual(docB.summary.primaryLanguage, "Dart");
    assert.strictEqual(docB.summary.projectType, "Flutter Mobile / Cross-Platform Application");

    // Zero cross-contamination
    assert.strictEqual(docA.coreModules.some((m) => m.name === "MobileClient"), false);
    assert.strictEqual(docB.coreModules.some((m) => m.name === "ApiGateway"), false);
  });

  test("12. Empty repository returns safe empty documentation state", () => {
    const emptyRepoId = "repo-empty";
    const emptyGraph: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${emptyRepoId}`,
        type: "Repository",
        name: "EmptyRepo",
        label: "EmptyRepo",
        repoId: emptyRepoId,
      },
      modules: [],
      files: [],
      classes: [],
      functions: [],
      methods: [],
      dependencies: [],
      commits: [],
      contributors: [],
      edges: [],
      stats: dummyStats,
    };

    const docEmpty = generateVerifiedDocumentation(emptyGraph);
    assert.strictEqual(docEmpty.isEmpty, true);
    assert.strictEqual(docEmpty.coreModules.length, 0);
    assert.ok(docEmpty.emptyReason);
  });
});
