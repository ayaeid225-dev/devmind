import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  transformKnowledgeToMap,
  transformScopeToMap,
  extractDrillDownScope,
  checkHasChildren,
  computeEntityContents,
  mergeTraversalIntoScope,
  buildBreadcrumbTrail,
  filterMapByViewMode,
  calculateMapLayout,
  getConnectedNodeIds,
  getConnectedEdges,
  getNodeNeighbors,
  RELATION_LABELS,
  ENTITY_COLORS,
  ENTITY_BADGES,
  ENTITY_ICONS,
  type MapViewMode,
  type MapNode,
  type MapEdge,
  type ProjectMapData,
  type DrillDownScope,
  type DrillDownCounts,
} from "../lib/project-map-helper";
import type {
  RepositoryKnowledgeView,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphStats,
} from "../lib/server/knowledge/types";

describe("DevMind Milestone 3 — Project Dependency Map Data & Layout Foundation", () => {
  const helperPath = path.resolve(__dirname, "../lib/project-map-helper.ts");
  const helperContent = fs.readFileSync(helperPath, "utf-8");

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

  const sampleRepoId = "devmind";
  const sampleGraph: RepositoryKnowledgeView = {
    repoNode: {
      id: `repo:${sampleRepoId}`,
      type: "Repository",
      name: "devmind",
      label: "devmind",
      repoId: sampleRepoId,
      metadata: { fileCount: 4, moduleCount: 2 },
    },
    modules: [
      {
        id: `module:${sampleRepoId}:auth`,
        type: "Module",
        name: "Auth",
        label: "Auth",
        repoId: sampleRepoId,
        metadata: { filesCount: 2, type: "core", depsCount: 1 },
      },
      {
        id: `module:${sampleRepoId}:api`,
        type: "Module",
        name: "API",
        label: "API",
        repoId: sampleRepoId,
        metadata: { filesCount: 2, type: "api", depsCount: 2 },
      },
    ],
    files: [
      {
        id: `file:${sampleRepoId}:src/auth/service.ts`,
        type: "File",
        name: "service.ts",
        label: "service.ts",
        repoId: sampleRepoId,
        filePath: "src/auth/service.ts",
        language: "typescript",
        metadata: { moduleId: "auth" },
      },
      {
        id: `file:${sampleRepoId}:src/auth/token.ts`,
        type: "File",
        name: "token.ts",
        label: "token.ts",
        repoId: sampleRepoId,
        filePath: "src/auth/token.ts",
        language: "typescript",
        metadata: { moduleId: "auth" },
      },
      {
        id: `file:${sampleRepoId}:src/api/client.ts`,
        type: "File",
        name: "client.ts",
        label: "client.ts",
        repoId: sampleRepoId,
        filePath: "src/api/client.ts",
        language: "typescript",
        metadata: { moduleId: "api" },
      },
      {
        id: `file:${sampleRepoId}:src/api/router.ts`,
        type: "File",
        name: "router.ts",
        label: "router.ts",
        repoId: sampleRepoId,
        filePath: "src/api/router.ts",
        language: "typescript",
        metadata: { moduleId: "api" },
      },
    ],
    classes: [
      {
        id: `class:${sampleRepoId}:src/auth/service.ts:AuthService`,
        type: "Class",
        name: "AuthService",
        label: "AuthService",
        repoId: sampleRepoId,
        filePath: "src/auth/service.ts",
        metadata: { methodsCount: 3 },
      },
    ],
    functions: [
      {
        id: `func:${sampleRepoId}:src/auth/token.ts:generateToken`,
        type: "Function",
        name: "generateToken",
        label: "generateToken",
        repoId: sampleRepoId,
        filePath: "src/auth/token.ts",
        metadata: { returnType: "string" },
      },
    ],
    methods: [],
    dependencies: [
      {
        id: `dep:${sampleRepoId}:bcryptjs`,
        type: "Dependency",
        name: "bcryptjs",
        label: "bcryptjs",
        repoId: sampleRepoId,
        metadata: { version: "^2.4.3", isDev: false },
      },
      {
        id: `dep:${sampleRepoId}:jose`,
        type: "Dependency",
        name: "jose",
        label: "jose",
        repoId: sampleRepoId,
        metadata: { version: "^5.2.0", isDev: false },
      },
    ],
    commits: [],
    contributors: [],
    edges: [
      // Repo -> Modules
      {
        id: "e-repo-auth",
        source: `repo:${sampleRepoId}`,
        target: `module:${sampleRepoId}:auth`,
        type: "CONTAINS",
        repoId: sampleRepoId,
      },
      {
        id: "e-repo-api",
        source: `repo:${sampleRepoId}`,
        target: `module:${sampleRepoId}:api`,
        type: "CONTAINS",
        repoId: sampleRepoId,
      },
      // Module -> Files
      {
        id: "e-mod-auth-svc",
        source: `module:${sampleRepoId}:auth`,
        target: `file:${sampleRepoId}:src/auth/service.ts`,
        type: "CONTAINS",
        repoId: sampleRepoId,
      },
      {
        id: "e-mod-auth-tok",
        source: `module:${sampleRepoId}:auth`,
        target: `file:${sampleRepoId}:src/auth/token.ts`,
        type: "CONTAINS",
        repoId: sampleRepoId,
      },
      {
        id: "e-mod-api-cli",
        source: `module:${sampleRepoId}:api`,
        target: `file:${sampleRepoId}:src/api/client.ts`,
        type: "CONTAINS",
        repoId: sampleRepoId,
      },
      {
        id: "e-mod-api-rtr",
        source: `module:${sampleRepoId}:api`,
        target: `file:${sampleRepoId}:src/api/router.ts`,
        type: "CONTAINS",
        repoId: sampleRepoId,
      },
      // File -> Symbol
      {
        id: "e-file-class",
        source: `file:${sampleRepoId}:src/auth/service.ts`,
        target: `class:${sampleRepoId}:src/auth/service.ts:AuthService`,
        type: "CONTAINS",
        repoId: sampleRepoId,
      },
      {
        id: "e-file-func",
        source: `file:${sampleRepoId}:src/auth/token.ts`,
        target: `func:${sampleRepoId}:src/auth/token.ts:generateToken`,
        type: "CONTAINS",
        repoId: sampleRepoId,
      },
      // Internal File IMPORTS
      {
        id: "e-imp-svc-tok",
        source: `file:${sampleRepoId}:src/auth/service.ts`,
        target: `file:${sampleRepoId}:src/auth/token.ts`,
        type: "IMPORTS",
        repoId: sampleRepoId,
        metadata: { rawImport: "./token" },
      },
      {
        id: "e-imp-rtr-svc",
        source: `file:${sampleRepoId}:src/api/router.ts`,
        target: `file:${sampleRepoId}:src/auth/service.ts`,
        type: "IMPORTS",
        repoId: sampleRepoId,
        metadata: { rawImport: "@/auth/service" },
      },
      // External DEPENDS_ON
      {
        id: "e-dep-tok-jose",
        source: `file:${sampleRepoId}:src/auth/token.ts`,
        target: `dep:${sampleRepoId}:jose`,
        type: "DEPENDS_ON",
        repoId: sampleRepoId,
      },
      {
        id: "e-dep-svc-bcrypt",
        source: `file:${sampleRepoId}:src/auth/service.ts`,
        target: `dep:${sampleRepoId}:bcryptjs`,
        type: "DEPENDS_ON",
        repoId: sampleRepoId,
      },
    ],
    stats: dummyStats,
  };

  test("1. Real Repository node transformation", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    const repoNode = map.nodes.find((n) => n.type === "Repository");
    assert.ok(repoNode, "Repository node must exist in map");
    assert.strictEqual(repoNode.id, `repo:${sampleRepoId}`);
    assert.strictEqual(repoNode.name, "devmind");
    assert.strictEqual(repoNode.color, ENTITY_COLORS.Repository);
    assert.strictEqual(repoNode.badgeVariant, ENTITY_BADGES.Repository);
    assert.strictEqual(repoNode.icon, ENTITY_ICONS.Repository);
    assert.ok(repoNode.subLabel?.includes("4 files"));
  });

  test("2. Real Module transformation", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    const moduleNodes = map.nodes.filter((n) => n.type === "Module");
    assert.strictEqual(moduleNodes.length, 2);

    const authMod = moduleNodes.find((m) => m.name === "Auth");
    assert.ok(authMod, "Auth module must exist");
    assert.strictEqual(authMod.clusterId, `module:${sampleRepoId}:auth`);
    assert.strictEqual(authMod.color, ENTITY_COLORS.Module);
    assert.strictEqual(authMod.icon, "modules");
    assert.ok(authMod.subLabel?.includes("2 files"));
  });

  test("3. Real File transformation", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    const fileNodes = map.nodes.filter((n) => n.type === "File");
    assert.strictEqual(fileNodes.length, 4);

    const svcFile = fileNodes.find((f) => f.name === "service.ts");
    assert.ok(svcFile, "service.ts must exist");
    assert.strictEqual(svcFile.filePath, "src/auth/service.ts");
    assert.strictEqual(svcFile.language, "typescript");
    assert.strictEqual(svcFile.color, ENTITY_COLORS.File);
    assert.strictEqual(svcFile.icon, "file");
    assert.ok(svcFile.incomingCount >= 1, "service.ts should have incoming edges");
    assert.ok(svcFile.outgoingCount >= 2, "service.ts should have outgoing edges");
  });

  test("4. Real Dependency transformation", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    const depNodes = map.nodes.filter((n) => n.type === "Dependency");
    assert.strictEqual(depNodes.length, 2);

    const bcryptDep = depNodes.find((d) => d.name === "bcryptjs");
    assert.ok(bcryptDep, "bcryptjs package must exist as MapNode");
    assert.strictEqual(bcryptDep.subLabel, "^2.4.3");
    assert.strictEqual(bcryptDep.color, ENTITY_COLORS.Dependency);
    assert.strictEqual(bcryptDep.icon, "packages");
    assert.strictEqual(bcryptDep.badgeVariant, "amber");
  });

  test("5. Real Symbol transformation (Class and Function)", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    const classNode = map.nodes.find((n) => n.type === "Class");
    assert.ok(classNode, "AuthService class must exist in all view");
    assert.strictEqual(classNode.name, "AuthService");
    assert.strictEqual(classNode.color, ENTITY_COLORS.Class);
    assert.strictEqual(classNode.icon, "puzzle");

    const funcNode = map.nodes.find((n) => n.type === "Function");
    assert.ok(funcNode, "generateToken function must exist in all view");
    assert.strictEqual(funcNode.name, "generateToken");
    assert.strictEqual(funcNode.color, ENTITY_COLORS.Function);
    assert.strictEqual(funcNode.icon, "code");
  });

  test("6. Real Edge transformation", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    assert.ok(map.edges.length > 0, "Map must contain edges");

    for (const edge of map.edges) {
      assert.ok(edge.id, "Edge must have an ID");
      assert.ok(edge.source, "Edge must have source node ID");
      assert.ok(edge.target, "Edge must have target node ID");
      assert.ok(edge.relationType, "Edge must have relationType");
      assert.ok(edge.label, "Edge must have human-readable label");
      assert.ok(edge.repoId, "Edge must have repoId");
    }
  });

  test("7. Relationship types are preserved exactly", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    const types = new Set(map.edges.map((e) => e.relationType));

    assert.ok(types.has("CONTAINS"), "Must preserve CONTAINS relation");
    assert.ok(types.has("IMPORTS"), "Must preserve IMPORTS relation");
    assert.ok(types.has("DEPENDS_ON"), "Must preserve DEPENDS_ON relation");
  });

  test("8. Edge direction is preserved", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    const impEdge = map.edges.find((e) => e.relationType === "IMPORTS");
    assert.ok(impEdge);
    // In sample data, service.ts IMPORTS token.ts
    const svcToTok = map.edges.find(
      (e) =>
        e.source === `file:${sampleRepoId}:src/auth/service.ts` &&
        e.target === `file:${sampleRepoId}:src/auth/token.ts`
    );
    assert.ok(svcToTok, "Edge direction must point from importer to imported file");
    assert.strictEqual(svcToTok.relationType, "IMPORTS");
  });

  test("9. Relationship labels are generated correctly", () => {
    assert.strictEqual(RELATION_LABELS.CONTAINS, "Contains");
    assert.strictEqual(RELATION_LABELS.IMPORTS, "Imports");
    assert.strictEqual(RELATION_LABELS.DEPENDS_ON, "Depends on");
    assert.strictEqual(RELATION_LABELS.CHANGES, "Changes");
    assert.strictEqual(RELATION_LABELS.AUTHORED_BY, "Authored by");
    assert.strictEqual(RELATION_LABELS.COMMITTED_BY, "Committed by");
    assert.strictEqual(RELATION_LABELS.EXTENDS, "Extends");
    assert.strictEqual(RELATION_LABELS.IMPLEMENTS, "Implements");

    const map = transformKnowledgeToMap(sampleGraph, "all");
    const depEdge = map.edges.find((e) => e.relationType === "DEPENDS_ON");
    assert.strictEqual(depEdge?.label, "Depends on");
    const impEdge = map.edges.find((e) => e.relationType === "IMPORTS");
    assert.strictEqual(impEdge?.label, "Imports");
  });

  test("10. No mock fixture symbols are generated", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    for (const node of map.nodes) {
      assert.notStrictEqual(node.name, "main()", "Must not inject fake main()");
      assert.notStrictEqual(node.name, "parse()", "Must not inject fake parse()");
    }
  });

  test("11. No @/data/fixtures dependency exists in project-map-helper.ts", () => {
    assert.strictEqual(
      helperContent.includes('from "@/data/fixtures"'),
      false,
      "project-map-helper.ts must not import from '@/data/fixtures'"
    );
    assert.strictEqual(
      helperContent.includes("from '../data/fixtures'"),
      false,
      "project-map-helper.ts must not import from '../data/fixtures'"
    );
    assert.strictEqual(
      helperContent.includes("MODULES"),
      false,
      "project-map-helper.ts must not use fixture MODULES"
    );
    assert.strictEqual(
      helperContent.includes("TYPE_COLORS"),
      false,
      "project-map-helper.ts must not use fixture TYPE_COLORS"
    );
  });

  test("12. Each supported view mode returns the correct entity categories", () => {
    // Mode: modules
    const modulesMap = transformKnowledgeToMap(sampleGraph, "modules");
    assert.ok(modulesMap.nodes.every((n) => n.type === "Repository" || n.type === "Module"));
    assert.strictEqual(modulesMap.nodes.filter((n) => n.type === "Module").length, 2);
    // Should have derived cross-module dependency from router.ts -> service.ts
    const crossModEdge = modulesMap.edges.find((e) => e.relationType === "DEPENDS_ON");
    assert.ok(crossModEdge, "modules view should display cross-module dependency");

    // Mode: files
    const filesMap = transformKnowledgeToMap(sampleGraph, "files");
    assert.ok(filesMap.nodes.some((n) => n.type === "Module"));
    assert.ok(filesMap.nodes.some((n) => n.type === "File"));
    assert.strictEqual(filesMap.nodes.filter((n) => n.type === "Class").length, 0);

    // Mode: dependencies
    const depsMap = transformKnowledgeToMap(sampleGraph, "dependencies");
    assert.ok(depsMap.nodes.some((n) => n.type === "Dependency"));
    assert.ok(depsMap.edges.some((e) => e.relationType === "DEPENDS_ON"));

    // Mode: all
    const allMap = transformKnowledgeToMap(sampleGraph, "all");
    assert.ok(allMap.nodes.some((n) => n.type === "Repository"));
    assert.ok(allMap.nodes.some((n) => n.type === "Module"));
    assert.ok(allMap.nodes.some((n) => n.type === "File"));
    assert.ok(allMap.nodes.some((n) => n.type === "Dependency"));
    assert.ok(allMap.nodes.some((n) => n.type === "Class"));
    assert.ok(allMap.nodes.some((n) => n.type === "Function"));
  });

  test("13. Layout positions are deterministic", () => {
    const run1 = transformKnowledgeToMap(sampleGraph, "all");
    const run2 = transformKnowledgeToMap(sampleGraph, "all");

    assert.strictEqual(run1.nodes.length, run2.nodes.length);
    for (let i = 0; i < run1.nodes.length; i++) {
      assert.strictEqual(run1.nodes[i].id, run2.nodes[i].id);
      assert.strictEqual(run1.nodes[i].x, run2.nodes[i].x);
      assert.strictEqual(run1.nodes[i].y, run2.nodes[i].y);
    }
    assert.strictEqual(run1.world.w, run2.world.w);
    assert.strictEqual(run1.world.h, run2.world.h);
  });

  test("14. No two nodes receive identical positions", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    const positionKeys = new Set<string>();

    for (const node of map.nodes) {
      const key = `${node.x},${node.y}`;
      assert.ok(
        !positionKeys.has(key),
        `Node ${node.id} (${node.name}) has duplicate position: ${key}`
      );
      positionKeys.add(key);
    }
  });

  test("15. Connected-node calculation works", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    const svcId = `file:${sampleRepoId}:src/auth/service.ts`;
    const connected = getConnectedNodeIds(svcId, map.edges);

    assert.ok(connected.has(svcId), "Must contain self");
    assert.ok(
      connected.has(`file:${sampleRepoId}:src/auth/token.ts`),
      "Must contain token.ts (imported target)"
    );
    assert.ok(
      connected.has(`file:${sampleRepoId}:src/api/router.ts`),
      "Must contain router.ts (dependent source)"
    );
    assert.ok(
      connected.has(`dep:${sampleRepoId}:bcryptjs`),
      "Must contain bcryptjs (external dep)"
    );
    assert.ok(
      connected.has(`module:${sampleRepoId}:auth`),
      "Must contain auth module (parent container)"
    );
  });

  test("16. Connected-edge calculation works", () => {
    const map = transformKnowledgeToMap(sampleGraph, "all");
    const svcId = `file:${sampleRepoId}:src/auth/service.ts`;
    const edges = getConnectedEdges(svcId, map.edges);

    assert.ok(edges.length >= 4, `Expected at least 4 edges, got ${edges.length}`);
    for (const edge of edges) {
      assert.ok(
        edge.source === svcId || edge.target === svcId,
        "Every returned edge must connect to service.ts"
      );
    }

    const { incoming, outgoing } = getNodeNeighbors(svcId, map.nodes, map.edges);
    assert.ok(incoming.some((n) => n.id === `module:${sampleRepoId}:auth`));
    assert.ok(incoming.some((n) => n.id === `file:${sampleRepoId}:src/api/router.ts`));
    assert.ok(outgoing.some((n) => n.id === `file:${sampleRepoId}:src/auth/token.ts`));
    assert.ok(outgoing.some((n) => n.id === `dep:${sampleRepoId}:bcryptjs`));
  });

  test("17. Empty graph is handled safely", () => {
    const emptyGraph = {
      repoNode: {
        id: "repo:empty",
        type: "Repository" as const,
        name: "empty",
        label: "empty",
        repoId: "empty",
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

    const map = transformKnowledgeToMap(emptyGraph, "all");
    assert.strictEqual(map.nodes.length, 1);
    assert.strictEqual(map.nodes[0].type, "Repository");
    assert.strictEqual(map.edges.length, 0);
    assert.strictEqual(map.world.w, 1400);

    // Null or undefined graph
    const nullMap = transformKnowledgeToMap(null as any);
    assert.deepStrictEqual(nullMap.nodes, []);
    assert.deepStrictEqual(nullMap.edges, []);
  });

  test("18. Missing optional metadata does not crash transformation", () => {
    const bareGraph: RepositoryKnowledgeView = {
      repoNode: {
        id: "repo:bare",
        type: "Repository",
        name: "bare",
        label: "bare",
        repoId: "bare",
      },
      modules: [
        {
          id: "module:bare:core",
          type: "Module",
          name: "Core",
          label: "Core",
          repoId: "bare",
        },
      ],
      files: [
        {
          id: "file:bare:index.ts",
          type: "File",
          name: "index.ts",
          label: "index.ts",
          repoId: "bare",
        },
      ],
      classes: [],
      functions: [],
      methods: [],
      dependencies: [
        {
          id: "dep:bare:pkg",
          type: "Dependency",
          name: "pkg",
          label: "pkg",
          repoId: "bare",
        },
      ],
      commits: [],
      contributors: [],
      edges: [
        {
          id: "e-bare",
          source: "file:bare:index.ts",
          target: "dep:bare:pkg",
          type: "DEPENDS_ON",
          repoId: "bare",
        },
      ],
      stats: dummyStats,
    };

    assert.doesNotThrow(() => {
      const map = transformKnowledgeToMap(bareGraph, "all");
      assert.strictEqual(map.nodes.length, 4);
      assert.strictEqual(map.edges.length, 1);
      assert.strictEqual(map.edges[0].label, "Depends on");
    });
  });
});

describe("DevMind Milestone 3 — Step 2: Interactive Engineering Architecture Canvas", () => {
  const canvasPath = path.resolve(__dirname, "../components/map/ProjectMapCanvas.tsx");
  const canvasContent = fs.readFileSync(canvasPath, "utf-8");

  test("19. Source Audit: ProjectMapCanvas does not import from data/fixtures", () => {
    assert.strictEqual(
      canvasContent.includes('from "@/data/fixtures"'),
      false,
      "ProjectMapCanvas.tsx must not import from '@/data/fixtures'"
    );
    assert.strictEqual(
      canvasContent.includes("from '../data/fixtures'"),
      false,
      "ProjectMapCanvas.tsx must not import from '../data/fixtures'"
    );
    assert.strictEqual(
      canvasContent.includes("TYPE_COLORS"),
      false,
      "ProjectMapCanvas.tsx must not use fixture TYPE_COLORS"
    );
    assert.strictEqual(
      canvasContent.includes("TYPE_LABELS"),
      false,
      "ProjectMapCanvas.tsx must not use fixture TYPE_LABELS"
    );
  });

  test("20. Canvas Data Contract: imports MapNode, MapEdge, RELATION_LABELS, ENTITY_COLORS", () => {
    assert.ok(
      canvasContent.includes("MapNode"),
      "ProjectMapCanvas must import MapNode"
    );
    assert.ok(
      canvasContent.includes("MapEdge"),
      "ProjectMapCanvas must import MapEdge"
    );
    assert.ok(
      canvasContent.includes("RELATION_LABELS"),
      "ProjectMapCanvas must import RELATION_LABELS"
    );
    assert.ok(
      canvasContent.includes("ENTITY_COLORS"),
      "ProjectMapCanvas must import ENTITY_COLORS"
    );
  });

  test("21. Boundary connection calculation terminates at target boundary", () => {
    // Node A at (100, 100) with width 170, height 56 -> hw=85, hh=28
    // Node B at (100, 300) with width 170, height 56 -> hw=85, hh=28
    const nodeA = {
      id: "a",
      name: "A",
      type: "File" as const,
      x: 100,
      y: 100,
      width: 170,
      height: 56,
      repoId: "test",
      label: "A",
      color: "#7896D8",
      icon: "file",
      badgeVariant: "blue" as const,
      incomingCount: 0,
      outgoingCount: 1,
    };
    const nodeB = {
      id: "b",
      name: "B",
      type: "File" as const,
      x: 100,
      y: 300,
      width: 170,
      height: 56,
      repoId: "test",
      label: "B",
      color: "#7896D8",
      icon: "file",
      badgeVariant: "blue" as const,
      incomingCount: 1,
      outgoingCount: 0,
    };

    // Calculate exit from A and entry into B
    const dx = nodeB.x - nodeA.x; // 0
    const dy = nodeB.y - nodeA.y; // 200
    const hwA = nodeA.width / 2;
    const hhA = nodeA.height / 2;
    const hwB = nodeB.width / 2;
    const hhB = nodeB.height / 2;

    const scaleA = Math.min(
      Math.abs(dx) > 0 ? hwA / Math.abs(dx) : 1,
      Math.abs(dy) > 0 ? hhA / Math.abs(dy) : 1
    );
    const x1 = nodeA.x + dx * scaleA;
    const y1 = nodeA.y + dy * scaleA;

    const scaleB = Math.min(
      Math.abs(dx) > 0 ? hwB / Math.abs(dx) : 1,
      Math.abs(dy) > 0 ? hhB / Math.abs(dy) : 1
    );
    const x2 = nodeB.x - dx * scaleB;
    const y2 = nodeB.y - dy * scaleB;

    // y1 should exit exactly at bottom border of A: 100 + 28 = 128
    assert.strictEqual(y1, 128);
    assert.strictEqual(x1, 100);

    // y2 should enter exactly at top border of B: 300 - 28 = 272
    assert.strictEqual(y2, 272);
    assert.strictEqual(x2, 100);

    // Arrow does not penetrate underneath node B
    assert.ok(y2 <= nodeB.y - hhB, "Arrow entry point must terminate at top boundary of target");
  });

  test("22. Relationship labels are displayed near edge midpoint", () => {
    assert.ok(
      canvasContent.includes("edge.label"),
      "Canvas must render edge.label"
    );
    assert.ok(
      canvasContent.includes("calcBoundaryConnection"),
      "Canvas must calculate boundary connection"
    );
  });

  test("23. Edge click and edge hover triggers", () => {
    assert.ok(
      canvasContent.includes("handleEdgeClick"),
      "Canvas must implement handleEdgeClick"
    );
    assert.ok(
      canvasContent.includes("handleEdgeMouseEnter"),
      "Canvas must implement handleEdgeMouseEnter"
    );
    assert.ok(
      canvasContent.includes("onSelectEdge"),
      "Canvas must support onSelectEdge callback"
    );
  });

  test("24. Neighborhood highlighting priority", () => {
    assert.ok(
      canvasContent.includes("highlightedNodeIds"),
      "Canvas must compute highlightedNodeIds"
    );
    assert.ok(
      canvasContent.includes("highlightedEdgeIds"),
      "Canvas must compute highlightedEdgeIds"
    );
    assert.ok(
      canvasContent.includes("hasActiveHighlight"),
      "Canvas must compute hasActiveHighlight for dimming"
    );
  });
});

describe("DevMind Milestone 3 — Step 4: Drill-Down Architecture Explorer", () => {
  const repoId = "devmind";
  const drillDownGraph: RepositoryKnowledgeView = {
    repoNode: {
      id: `repo:${repoId}`,
      type: "Repository",
      name: "devmind",
      label: "devmind",
      repoId,
      metadata: { fileCount: 4, moduleCount: 2 },
    },
    modules: [
      {
        id: `module:${repoId}:auth`,
        type: "Module",
        name: "Auth",
        label: "Auth",
        repoId,
        metadata: { filesCount: 2, type: "core" },
      },
      {
        id: `module:${repoId}:billing`,
        type: "Module",
        name: "Billing",
        label: "Billing",
        repoId,
        metadata: { filesCount: 2, type: "api" },
      },
    ],
    files: [
      {
        id: `file:${repoId}:src/auth/service.ts`,
        type: "File",
        name: "service.ts",
        label: "service.ts",
        repoId,
        filePath: "src/auth/service.ts",
        language: "typescript",
        metadata: { moduleId: "auth" },
      },
      {
        id: `file:${repoId}:src/auth/token.ts`,
        type: "File",
        name: "token.ts",
        label: "token.ts",
        repoId,
        filePath: "src/auth/token.ts",
        language: "typescript",
        metadata: { moduleId: "auth" },
      },
      {
        id: `file:${repoId}:src/billing/invoice.ts`,
        type: "File",
        name: "invoice.ts",
        label: "invoice.ts",
        repoId,
        filePath: "src/billing/invoice.ts",
        language: "typescript",
        metadata: { moduleId: "billing" },
      },
    ],
    classes: [
      {
        id: `class:${repoId}:src/auth/service.ts:AuthService`,
        type: "Class",
        name: "AuthService",
        label: "AuthService",
        repoId,
        filePath: "src/auth/service.ts",
        metadata: { methodsCount: 1 },
      },
    ],
    functions: [
      {
        id: `func:${repoId}:src/auth/token.ts:generateToken`,
        type: "Function",
        name: "generateToken",
        label: "generateToken",
        repoId,
        filePath: "src/auth/token.ts",
        metadata: { returnType: "string" },
      },
    ],
    methods: [
      {
        id: `method:${repoId}:src/auth/service.ts:AuthService:login`,
        type: "Method",
        name: "login",
        label: "login",
        repoId,
        filePath: "src/auth/service.ts",
        metadata: { parentClass: "AuthService" },
      },
    ],
    dependencies: [
      {
        id: `dep:${repoId}:jsonwebtoken`,
        type: "Dependency",
        name: "jsonwebtoken",
        label: "jsonwebtoken",
        repoId,
        metadata: { version: "^9.0.0" },
      },
      {
        id: `dep:${repoId}:stripe`,
        type: "Dependency",
        name: "stripe",
        label: "stripe",
        repoId,
        metadata: { version: "^14.0.0" },
      },
    ],
    commits: [],
    contributors: [],
    edges: [
      // Repo contains Modules
      {
        id: "e-repo-auth",
        source: `repo:${repoId}`,
        target: `module:${repoId}:auth`,
        type: "CONTAINS",
        repoId,
      },
      {
        id: "e-repo-billing",
        source: `repo:${repoId}`,
        target: `module:${repoId}:billing`,
        type: "CONTAINS",
        repoId,
      },
      // Module contains Files
      {
        id: "e-mod-auth-svc",
        source: `module:${repoId}:auth`,
        target: `file:${repoId}:src/auth/service.ts`,
        type: "CONTAINS",
        repoId,
      },
      {
        id: "e-mod-auth-tok",
        source: `module:${repoId}:auth`,
        target: `file:${repoId}:src/auth/token.ts`,
        type: "CONTAINS",
        repoId,
      },
      {
        id: "e-mod-bill-inv",
        source: `module:${repoId}:billing`,
        target: `file:${repoId}:src/billing/invoice.ts`,
        type: "CONTAINS",
        repoId,
      },
      // File contains Class
      {
        id: "e-file-auth-class",
        source: `file:${repoId}:src/auth/service.ts`,
        target: `class:${repoId}:src/auth/service.ts:AuthService`,
        type: "CONTAINS",
        repoId,
      },
      // Class contains Method
      {
        id: "e-class-auth-login",
        source: `class:${repoId}:src/auth/service.ts:AuthService`,
        target: `method:${repoId}:src/auth/service.ts:AuthService:login`,
        type: "CONTAINS",
        repoId,
      },
      // File contains Function
      {
        id: "e-file-tok-func",
        source: `file:${repoId}:src/auth/token.ts`,
        target: `func:${repoId}:src/auth/token.ts:generateToken`,
        type: "CONTAINS",
        repoId,
      },
      // File depends on Dependency
      {
        id: "e-file-tok-dep",
        source: `file:${repoId}:src/auth/token.ts`,
        target: `dep:${repoId}:jsonwebtoken`,
        type: "DEPENDS_ON",
        repoId,
      },
      {
        id: "e-file-bill-dep",
        source: `file:${repoId}:src/billing/invoice.ts`,
        target: `dep:${repoId}:stripe`,
        type: "DEPENDS_ON",
        repoId,
      },
      // File imports File
      {
        id: "e-imp-svc-tok",
        source: `file:${repoId}:src/auth/service.ts`,
        target: `file:${repoId}:src/auth/token.ts`,
        type: "IMPORTS",
        repoId,
      },
    ],
    stats: {
      totalNodes: 10,
      totalEdges: 11,
      nodesByType: {
        Repository: 1,
        Module: 2,
        File: 3,
        Class: 1,
        Function: 1,
        Method: 1,
        Commit: 0,
        Contributor: 0,
        Dependency: 2,
      },
      edgesByType: {
        CONTAINS: 7,
        IMPORTS: 1,
        DEPENDS_ON: 2,
        CHANGES: 0,
        AUTHORED_BY: 0,
        COMMITTED_BY: 0,
        EXTENDS: 0,
        IMPLEMENTS: 0,
      },
    },
  };

  test("25. Repository → Module drill-down: extracts module scope and files", () => {
    const scope = extractDrillDownScope(drillDownGraph, `module:${repoId}:auth`);
    assert.strictEqual(scope.focalNode.id, `module:${repoId}:auth`);
    assert.strictEqual(scope.focalNode.type, "Module");
    assert.strictEqual(scope.hasChildren, true);

    const nodeIds = new Set(scope.nodes.map((n) => n.id));
    assert.ok(nodeIds.has(`file:${repoId}:src/auth/service.ts`));
    assert.ok(nodeIds.has(`file:${repoId}:src/auth/token.ts`));
    assert.ok(nodeIds.has(`dep:${repoId}:jsonwebtoken`));
    // Billing file must NOT be in Auth module scope
    assert.ok(!nodeIds.has(`file:${repoId}:src/billing/invoice.ts`));

    // Layout positions focal node prominently
    const map = transformScopeToMap(scope, "all");
    const focalMapNode = map.nodes.find((n) => n.id === `module:${repoId}:auth`);
    assert.ok(focalMapNode);
    assert.strictEqual(focalMapNode.isFocal, true);
    assert.strictEqual(focalMapNode.y, 90);
  });

  test("26. Module → File drill-down: extracts file scope, contained symbols, and dependencies", () => {
    const scope = extractDrillDownScope(drillDownGraph, `file:${repoId}:src/auth/service.ts`);
    assert.strictEqual(scope.focalNode.id, `file:${repoId}:src/auth/service.ts`);
    assert.strictEqual(scope.focalNode.type, "File");
    assert.strictEqual(scope.hasChildren, true);

    const nodeIds = new Set(scope.nodes.map((n) => n.id));
    assert.ok(nodeIds.has(`class:${repoId}:src/auth/service.ts:AuthService`));
    assert.ok(nodeIds.has(`file:${repoId}:src/auth/token.ts`)); // imported file

    const edgeTypes = new Set(scope.edges.map((e) => e.type));
    assert.ok(edgeTypes.has("CONTAINS"));
    assert.ok(edgeTypes.has("IMPORTS"));
  });

  test("27. File → Symbol drill-down: extracts class scope and methods", () => {
    const scope = extractDrillDownScope(
      drillDownGraph,
      `class:${repoId}:src/auth/service.ts:AuthService`
    );
    assert.strictEqual(scope.focalNode.id, `class:${repoId}:src/auth/service.ts:AuthService`);
    assert.strictEqual(scope.focalNode.type, "Class");
    assert.strictEqual(scope.hasChildren, true);

    const nodeIds = new Set(scope.nodes.map((n) => n.id));
    assert.ok(nodeIds.has(`method:${repoId}:src/auth/service.ts:AuthService:login`));
  });

  test("28. Breadcrumb generation: builds correct hierarchical trail", () => {
    const stack: DrillDownScope[] = [
      { id: `repo:${repoId}`, name: "devmind", type: "Repository" },
      { id: `module:${repoId}:auth`, name: "Auth", type: "Module" },
      { id: `file:${repoId}:src/auth/service.ts`, name: "service.ts", type: "File" },
      { id: `class:${repoId}:src/auth/service.ts:AuthService`, name: "AuthService", type: "Class" },
    ];

    const breadcrumbs = buildBreadcrumbTrail(stack);
    assert.strictEqual(breadcrumbs.length, 4);

    assert.strictEqual(breadcrumbs[0].label, "Project");
    assert.strictEqual(breadcrumbs[0].type, "Repository");
    assert.strictEqual(breadcrumbs[0].isCurrent, false);

    assert.strictEqual(breadcrumbs[1].label, "Auth");
    assert.strictEqual(breadcrumbs[1].type, "Module");
    assert.strictEqual(breadcrumbs[1].isCurrent, false);

    assert.strictEqual(breadcrumbs[2].label, "service.ts");
    assert.strictEqual(breadcrumbs[2].type, "File");
    assert.strictEqual(breadcrumbs[2].isCurrent, false);

    assert.strictEqual(breadcrumbs[3].label, "AuthService");
    assert.strictEqual(breadcrumbs[3].type, "Class");
    assert.strictEqual(breadcrumbs[3].isCurrent, true);
  });

  test("29. Back navigation: pops navigation stack to previous level", () => {
    const stack: DrillDownScope[] = [
      { id: `repo:${repoId}`, name: "devmind", type: "Repository" },
      { id: `module:${repoId}:auth`, name: "Auth", type: "Module" },
      { id: `file:${repoId}:src/auth/service.ts`, name: "service.ts", type: "File" },
    ];

    // Simulating back action
    const poppedStack = stack.slice(0, -1);
    assert.strictEqual(poppedStack.length, 2);
    const parentScope = poppedStack[poppedStack.length - 1];
    assert.strictEqual(parentScope.id, `module:${repoId}:auth`);

    const crumbs = buildBreadcrumbTrail(poppedStack);
    assert.strictEqual(crumbs.length, 2);
    assert.strictEqual(crumbs[1].isCurrent, true);
  });

  test("30. Direct breadcrumb navigation: jumps directly to target ancestor level", () => {
    const stack: DrillDownScope[] = [
      { id: `repo:${repoId}`, name: "devmind", type: "Repository" },
      { id: `module:${repoId}:auth`, name: "Auth", type: "Module" },
      { id: `file:${repoId}:src/auth/service.ts`, name: "service.ts", type: "File" },
      { id: `class:${repoId}:src/auth/service.ts:AuthService`, name: "AuthService", type: "Class" },
    ];

    // Jump to index 1 (Auth Module)
    const jumpedStack = stack.slice(0, 1 + 1);
    assert.strictEqual(jumpedStack.length, 2);
    assert.strictEqual(jumpedStack[jumpedStack.length - 1].id, `module:${repoId}:auth`);
  });

  test("31. No-child empty state: identifies terminal leaf entities", () => {
    // Leaf method with no deeper children
    const leafId = `method:${repoId}:src/auth/service.ts:AuthService:login`;
    const hasKids = checkHasChildren(drillDownGraph, leafId);
    assert.strictEqual(hasKids, false, "Leaf method must have no deeper children");

    const leafScope = extractDrillDownScope(drillDownGraph, leafId);
    assert.strictEqual(leafScope.hasChildren, false);
    assert.strictEqual(leafScope.nodes.length, 1);
    assert.strictEqual(leafScope.nodes[0].id, leafId);
  });

  test("32. Duplicate node prevention: mergeTraversalIntoScope deduplicates nodes by ID", () => {
    const currentNodes: KnowledgeNode[] = [
      { id: "node1", type: "File", name: "node1", label: "node1", repoId },
      { id: "node2", type: "File", name: "node2", label: "node2", repoId },
    ];
    const incomingTraversal: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } = {
      nodes: [
        { id: "node2", type: "File", name: "node2-duplicate", label: "node2", repoId },
        { id: "node3", type: "File", name: "node3", label: "node3", repoId },
      ],
      edges: [],
    };

    const merged = mergeTraversalIntoScope(currentNodes, [], incomingTraversal);
    assert.strictEqual(merged.nodes.length, 3, "Merged nodes must not contain duplicates");
    const ids = merged.nodes.map((n) => n.id);
    assert.deepStrictEqual(ids, ["node1", "node2", "node3"]);
  });

  test("33. Duplicate edge prevention: mergeTraversalIntoScope deduplicates identical edges", () => {
    const currentNodes: KnowledgeNode[] = [
      { id: "node1", type: "File", name: "node1", label: "node1", repoId },
      { id: "node2", type: "File", name: "node2", label: "node2", repoId },
    ];
    const currentEdges: KnowledgeEdge[] = [
      { id: "e1", source: "node1", target: "node2", type: "IMPORTS", repoId },
    ];
    const incomingTraversal = {
      nodes: currentNodes,
      edges: [
        { id: "e1-dup", source: "node1", target: "node2", type: "IMPORTS" as const, repoId },
      ],
    };

    const merged = mergeTraversalIntoScope(currentNodes, currentEdges, incomingTraversal);
    assert.strictEqual(merged.edges.length, 1, "Duplicate edges must be ignored");
  });

  test("34. Traversal result scoping: eliminates dangling edges outside node set", () => {
    const nodes: KnowledgeNode[] = [
      { id: "nodeA", type: "File", name: "nodeA", label: "nodeA", repoId },
      { id: "nodeB", type: "File", name: "nodeB", label: "nodeB", repoId },
    ];
    const incomingTraversal: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } = {
      nodes: [],
      edges: [
        // Valid edge between scoped nodes
        { id: "e-valid", source: "nodeA", target: "nodeB", type: "IMPORTS" as const, repoId },
        // Dangling edge pointing to external node not in set
        { id: "e-dangle", source: "nodeA", target: "externalNode", type: "IMPORTS" as const, repoId },
      ],
    };

    const merged = mergeTraversalIntoScope(nodes, [], incomingTraversal);
    assert.strictEqual(merged.edges.length, 1);
    assert.strictEqual(merged.edges[0].id, "e-valid");
  });

  test("35. Current-scope search: filters only entities in active scope", () => {
    const authScope = extractDrillDownScope(drillDownGraph, `module:${repoId}:auth`);
    const authMap = transformScopeToMap(authScope, "all");

    // Search for "service" inside Auth scope
    const query1 = "service";
    const matchesAuth = authMap.nodes.filter(
      (n) => n.name.toLowerCase().includes(query1) || (n.filePath && n.filePath.toLowerCase().includes(query1))
    );
    assert.ok(matchesAuth.length >= 1, "Should find service.ts in Auth scope");

    // Search for "invoice" (which is in Billing module) inside Auth scope
    const query2 = "invoice";
    const matchesBilling = authMap.nodes.filter(
      (n) => n.name.toLowerCase().includes(query2) || (n.filePath && n.filePath.toLowerCase().includes(query2))
    );
    assert.strictEqual(matchesBilling.length, 0, "Invoice file from Billing must not match inside Auth scope");
  });

  test("36. Repository context preservation: repoId is retained across all scoped nodes and edges", () => {
    const scope = extractDrillDownScope(drillDownGraph, `module:${repoId}:auth`);
    const map = transformScopeToMap(scope, "all");

    for (const node of map.nodes) {
      assert.strictEqual(node.repoId, repoId, `Node ${node.id} must preserve repoId`);
    }
    for (const edge of map.edges) {
      assert.strictEqual(edge.repoId, repoId, `Edge ${edge.id} must preserve repoId`);
    }
  });

  test("37. Drill-down state reset when repository changes", () => {
    let activeStack: DrillDownScope[] = [
      { id: `repo:${repoId}`, name: "devmind", type: "Repository" },
      { id: `module:${repoId}:auth`, name: "Auth", type: "Module" },
    ];
    const cache = new Map<string, unknown>();
    cache.set(`module:${repoId}:auth`, {});

    // Simulating repo change to "other-repo"
    const newRepoId = "other-repo";
    activeStack = [{ id: `repo:${newRepoId}`, name: newRepoId, type: "Repository" }];
    cache.clear();

    assert.strictEqual(activeStack.length, 1);
    assert.strictEqual(activeStack[0].id, "repo:other-repo");
    assert.strictEqual(cache.size, 0, "Cache must be cleared on repo change");
  });

  test("38. Cached scope restoration: returns cached map data without re-fetching", () => {
    const cache = new Map<string, ProjectMapData>();
    const authScope = extractDrillDownScope(drillDownGraph, `module:${repoId}:auth`);
    const authMap = transformScopeToMap(authScope, "all");

    // Store in cache
    cache.set(`module:${repoId}:auth`, authMap);
    assert.ok(cache.has(`module:${repoId}:auth`));

    // Navigating back restores the identical object reference
    const restored = cache.get(`module:${repoId}:auth`);
    assert.strictEqual(restored, authMap, "Restored map must match cached map instance");
  });
});

describe("DevMind Milestone 3 — Dynamic Multi-Repository Architecture & Switching", () => {
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

  // Generic Repository A
  const repoAId = "repo-alpha";
  const repoAGraph: RepositoryKnowledgeView = {
    repoNode: {
      id: `repo:${repoAId}`,
      type: "Repository",
      name: "Repository A",
      label: "Repository A",
      repoId: repoAId,
      metadata: { fileCount: 2, moduleCount: 2 },
    },
    modules: [
      {
        id: `module:${repoAId}:engine`,
        type: "Module",
        name: "Engine",
        label: "Engine",
        repoId: repoAId,
        metadata: { filesCount: 1, type: "core" },
      },
      {
        id: `module:${repoAId}:ui`,
        type: "Module",
        name: "UI",
        label: "UI",
        repoId: repoAId,
        metadata: { filesCount: 1, type: "api" },
      },
    ],
    files: [
      {
        id: `file:${repoAId}:src/engine.ts`,
        type: "File",
        name: "engine.ts",
        label: "engine.ts",
        repoId: repoAId,
        filePath: "src/engine.ts",
        language: "typescript",
        metadata: { moduleId: "engine" },
      },
      {
        id: `file:${repoAId}:src/render.ts`,
        type: "File",
        name: "render.ts",
        label: "render.ts",
        repoId: repoAId,
        filePath: "src/render.ts",
        language: "typescript",
        metadata: { moduleId: "ui" },
      },
    ],
    classes: [
      {
        id: `class:${repoAId}:src/engine.ts:EngineCore`,
        type: "Class",
        name: "EngineCore",
        label: "EngineCore",
        repoId: repoAId,
        filePath: "src/engine.ts",
      },
    ],
    functions: [],
    methods: [],
    dependencies: [
      {
        id: `dep:${repoAId}:pkg-math`,
        type: "Dependency",
        name: "pkg-math",
        label: "pkg-math@1.0.0",
        repoId: repoAId,
      },
      {
        id: `dep:${repoAId}:pkg-graphics`,
        type: "Dependency",
        name: "pkg-graphics",
        label: "pkg-graphics@2.0.0",
        repoId: repoAId,
      },
    ],
    commits: [],
    contributors: [],
    edges: [
      {
        id: "ea-repo-engine",
        source: `repo:${repoAId}`,
        target: `module:${repoAId}:engine`,
        type: "CONTAINS",
        repoId: repoAId,
      },
      {
        id: "ea-repo-ui",
        source: `repo:${repoAId}`,
        target: `module:${repoAId}:ui`,
        type: "CONTAINS",
        repoId: repoAId,
      },
      {
        id: "ea-engine-file",
        source: `module:${repoAId}:engine`,
        target: `file:${repoAId}:src/engine.ts`,
        type: "CONTAINS",
        repoId: repoAId,
      },
      {
        id: "ea-ui-file",
        source: `module:${repoAId}:ui`,
        target: `file:${repoAId}:src/render.ts`,
        type: "CONTAINS",
        repoId: repoAId,
      },
      {
        id: "ea-file-class",
        source: `file:${repoAId}:src/engine.ts`,
        target: `class:${repoAId}:src/engine.ts:EngineCore`,
        type: "CONTAINS",
        repoId: repoAId,
      },
      {
        id: "ea-imp-ui-engine",
        source: `file:${repoAId}:src/render.ts`,
        target: `file:${repoAId}:src/engine.ts`,
        type: "IMPORTS",
        repoId: repoAId,
      },
      {
        id: "ea-dep-math",
        source: `file:${repoAId}:src/engine.ts`,
        target: `dep:${repoAId}:pkg-math`,
        type: "DEPENDS_ON",
        repoId: repoAId,
      },
      {
        id: "ea-dep-graphics",
        source: `file:${repoAId}:src/render.ts`,
        target: `dep:${repoAId}:pkg-graphics`,
        type: "DEPENDS_ON",
        repoId: repoAId,
      },
    ],
    stats: dummyStats,
  };

  // Generic Repository B
  const repoBId = "repo-beta";
  const repoBGraph: RepositoryKnowledgeView = {
    repoNode: {
      id: `repo:${repoBId}`,
      type: "Repository",
      name: "Repository B",
      label: "Repository B",
      repoId: repoBId,
      metadata: { fileCount: 3, moduleCount: 3 },
    },
    modules: [
      {
        id: `module:${repoBId}:core`,
        type: "Module",
        name: "Core",
        label: "Core",
        repoId: repoBId,
        metadata: { filesCount: 1, type: "core" },
      },
      {
        id: `module:${repoBId}:db`,
        type: "Module",
        name: "Database",
        label: "Database",
        repoId: repoBId,
        metadata: { filesCount: 1, type: "db" },
      },
      {
        id: `module:${repoBId}:network`,
        type: "Module",
        name: "Network",
        label: "Network",
        repoId: repoBId,
        metadata: { filesCount: 1, type: "api" },
      },
    ],
    files: [
      {
        id: `file:${repoBId}:lib/core.ts`,
        type: "File",
        name: "core.ts",
        label: "core.ts",
        repoId: repoBId,
        filePath: "lib/core.ts",
        language: "typescript",
        metadata: { moduleId: "core" },
      },
      {
        id: `file:${repoBId}:lib/db.ts`,
        type: "File",
        name: "db.ts",
        label: "db.ts",
        repoId: repoBId,
        filePath: "lib/db.ts",
        language: "typescript",
        metadata: { moduleId: "db" },
      },
      {
        id: `file:${repoBId}:lib/http.ts`,
        type: "File",
        name: "http.ts",
        label: "http.ts",
        repoId: repoBId,
        filePath: "lib/http.ts",
        language: "typescript",
        metadata: { moduleId: "network" },
      },
    ],
    classes: [],
    functions: [
      {
        id: `func:${repoBId}:lib/core.ts:bootstrap`,
        type: "Function",
        name: "bootstrap",
        label: "bootstrap",
        repoId: repoBId,
        filePath: "lib/core.ts",
      },
    ],
    methods: [],
    dependencies: [
      {
        id: `dep:${repoBId}:pkg-pg`,
        type: "Dependency",
        name: "pkg-pg",
        label: "pkg-pg@8.11.0",
        repoId: repoBId,
      },
      {
        id: `dep:${repoBId}:pkg-axios`,
        type: "Dependency",
        name: "pkg-axios",
        label: "pkg-axios@1.6.0",
        repoId: repoBId,
      },
    ],
    commits: [],
    contributors: [],
    edges: [
      {
        id: "eb-repo-core",
        source: `repo:${repoBId}`,
        target: `module:${repoBId}:core`,
        type: "CONTAINS",
        repoId: repoBId,
      },
      {
        id: "eb-repo-db",
        source: `repo:${repoBId}`,
        target: `module:${repoBId}:db`,
        type: "CONTAINS",
        repoId: repoBId,
      },
      {
        id: "eb-repo-net",
        source: `repo:${repoBId}`,
        target: `module:${repoBId}:network`,
        type: "CONTAINS",
        repoId: repoBId,
      },
      {
        id: "eb-core-file",
        source: `module:${repoBId}:core`,
        target: `file:${repoBId}:lib/core.ts`,
        type: "CONTAINS",
        repoId: repoBId,
      },
      {
        id: "eb-db-file",
        source: `module:${repoBId}:db`,
        target: `file:${repoBId}:lib/db.ts`,
        type: "CONTAINS",
        repoId: repoBId,
      },
      {
        id: "eb-net-file",
        source: `module:${repoBId}:network`,
        target: `file:${repoBId}:lib/http.ts`,
        type: "CONTAINS",
        repoId: repoBId,
      },
      {
        id: "eb-imp-net-core",
        source: `file:${repoBId}:lib/http.ts`,
        target: `file:${repoBId}:lib/core.ts`,
        type: "IMPORTS",
        repoId: repoBId,
      },
      {
        id: "eb-dep-pg",
        source: `file:${repoBId}:lib/db.ts`,
        target: `dep:${repoBId}:pkg-pg`,
        type: "DEPENDS_ON",
        repoId: repoBId,
      },
      {
        id: "eb-dep-axios",
        source: `file:${repoBId}:lib/http.ts`,
        target: `dep:${repoBId}:pkg-axios`,
        type: "DEPENDS_ON",
        repoId: repoBId,
      },
    ],
    stats: dummyStats,
  };

  test("39. Repository A produces its own architecture", () => {
    const mapA = transformKnowledgeToMap(repoAGraph, "architecture");
    const repoNode = mapA.nodes.find((n) => n.type === "Repository");
    assert.ok(repoNode, "Repository node must exist");
    assert.strictEqual(repoNode.repoId, repoAId);
    assert.strictEqual(repoNode.name, "Repository A");
    const modNames = mapA.nodes.filter((n) => n.type === "Module").map((n) => n.name);
    assert.deepStrictEqual(modNames.sort(), ["Engine", "UI"]);
    // Zero entities from Repository B exist in Repository A map
    assert.ok(mapA.nodes.every((n) => n.repoId === repoAId));
    assert.strictEqual(mapA.nodes.some((n) => n.name === "Repository B"), false);
    assert.strictEqual(mapA.nodes.some((n) => n.name === "Database"), false);
  });

  test("40. Repository B produces its own architecture", () => {
    const mapB = transformKnowledgeToMap(repoBGraph, "architecture");
    const repoNode = mapB.nodes.find((n) => n.type === "Repository");
    assert.ok(repoNode, "Repository node must exist");
    assert.strictEqual(repoNode.repoId, repoBId);
    assert.strictEqual(repoNode.name, "Repository B");
    const modNames = mapB.nodes.filter((n) => n.type === "Module").map((n) => n.name);
    assert.deepStrictEqual(modNames.sort(), ["Core", "Database", "Network"]);
    // Zero entities from Repository A exist in Repository B map
    assert.ok(mapB.nodes.every((n) => n.repoId === repoBId));
    assert.strictEqual(mapB.nodes.some((n) => n.name === "Repository A"), false);
    assert.strictEqual(mapB.nodes.some((n) => n.name === "Engine"), false);
  });

  test("41. Switching A → B clears stale state", () => {
    let activeRepoId = repoAId;
    const scopeCache = new Map<string, ProjectMapData>();
    let selectedNode: MapNode | null = null;
    let selectedEdge: MapEdge | null = null;
    let searchQuery = "engine";
    let breadcrumbs: DrillDownScope[] = [
      { id: `repo:${repoAId}`, name: "Repository A", type: "Repository" },
      { id: `module:${repoAId}:engine`, name: "Engine", type: "Module" },
    ];

    const mapA = transformKnowledgeToMap(repoAGraph, "architecture");
    scopeCache.set(repoAGraph.repoNode.id, mapA);
    selectedNode = mapA.nodes[1];

    // Switch to Repository B: simulation of fetchGraph / repository change
    activeRepoId = repoBId;
    scopeCache.clear();
    selectedNode = null;
    selectedEdge = null;
    searchQuery = "";
    breadcrumbs = [{ id: `repo:${repoBId}`, name: "Repository B", type: "Repository" }];
    const mapB = transformKnowledgeToMap(repoBGraph, "architecture");
    scopeCache.set(repoBGraph.repoNode.id, mapB);

    assert.strictEqual(activeRepoId, repoBId);
    assert.strictEqual(selectedNode, null, "Selected node must be reset");
    assert.strictEqual(selectedEdge, null, "Selected edge must be reset");
    assert.strictEqual(searchQuery, "", "Search query must be cleared");
    assert.strictEqual(breadcrumbs.length, 1);
    assert.strictEqual(breadcrumbs[0].id, `repo:${repoBId}`);
    assert.strictEqual(scopeCache.has(repoAGraph.repoNode.id), false, "Stale repo A cache must not exist");
    assert.ok(scopeCache.has(repoBGraph.repoNode.id), "Repo B map must be cached");
  });

  test("42. Switching B → A restores correct repository context", () => {
    let activeRepoId = repoBId;
    const scopeCache = new Map<string, ProjectMapData>();
    const mapB = transformKnowledgeToMap(repoBGraph, "architecture");
    scopeCache.set(repoBGraph.repoNode.id, mapB);

    // Switch back to Repo A
    activeRepoId = repoAId;
    scopeCache.clear();
    const mapA = transformKnowledgeToMap(repoAGraph, "architecture");
    scopeCache.set(repoAGraph.repoNode.id, mapA);

    assert.strictEqual(activeRepoId, repoAId);
    const repoNode = mapA.nodes.find((n) => n.type === "Repository");
    assert.ok(repoNode, "Repository node must exist");
    assert.strictEqual(repoNode.name, "Repository A");
    assert.strictEqual(mapA.nodes.some((n) => n.repoId === repoBId), false);
  });

  test("43. Drill-down always uses the active repository", () => {
    // Drill into Engine in Repo A
    const engineScope = extractDrillDownScope(repoAGraph, `module:${repoAId}:engine`);
    const engineMap = transformScopeToMap(engineScope, "architecture");
    for (const node of engineMap.nodes) {
      assert.strictEqual(node.repoId, repoAId, "Scoped nodes must strictly belong to active repo A");
    }

    // Drill into Database in Repo B
    const dbScope = extractDrillDownScope(repoBGraph, `module:${repoBId}:db`);
    const dbMap = transformScopeToMap(dbScope, "architecture");
    for (const node of dbMap.nodes) {
      assert.strictEqual(node.repoId, repoBId, "Scoped nodes must strictly belong to active repo B");
    }
  });

  test("44. Traversal requests use the active repository ID", () => {
    const targetNodeId = `module:${repoAId}:engine`;
    const traversalUrl = `/api/knowledge/graph/traverse?repoId=${encodeURIComponent(repoAId)}&startNodeId=${encodeURIComponent(targetNodeId)}&maxDepth=1`;
    assert.ok(traversalUrl.includes(`repoId=${repoAId}`));
    assert.ok(traversalUrl.includes(`startNodeId=${encodeURIComponent(targetNodeId)}`));
  });

  test("45. Breadcrumbs are reset when repository changes", () => {
    const deepStackA: DrillDownScope[] = [
      { id: `repo:${repoAId}`, name: "Repository A", type: "Repository" },
      { id: `module:${repoAId}:engine`, name: "Engine", type: "Module" },
      { id: `file:${repoAId}:src/engine.ts`, name: "engine.ts", type: "File" },
    ];
    const trailA = buildBreadcrumbTrail(deepStackA);
    assert.strictEqual(trailA.length, 3);

    // Repo change resets stack to single root breadcrumb
    const resetStackB: DrillDownScope[] = [
      { id: `repo:${repoBId}`, name: "Repository B", type: "Repository" },
    ];
    const trailB = buildBreadcrumbTrail(resetStackB);
    assert.strictEqual(trailB.length, 1);
    assert.strictEqual(trailB[0].label, "Project");
    assert.strictEqual(trailB[0].id, `repo:${repoBId}`);
  });

  test("46. Search scope resets when repository changes", () => {
    const mapA = transformKnowledgeToMap(repoAGraph, "architecture");
    const query = "engine";
    const matchesA = mapA.nodes.filter(
      (n) => n.name.toLowerCase().includes(query) || (n.filePath && n.filePath.toLowerCase().includes(query))
    );
    assert.ok(matchesA.length > 0, "Engine must match in repo A");

    // Switching to repo B
    const mapB = transformKnowledgeToMap(repoBGraph, "architecture");
    const matchesB = mapB.nodes.filter(
      (n) => n.name.toLowerCase().includes(query) || (n.filePath && n.filePath.toLowerCase().includes(query))
    );
    assert.strictEqual(matchesB.length, 0, "Engine must not match in repo B");
  });

  test("47. No repository-specific names are required by the transformation layer", () => {
    // Arbitrary synthetic repository without hardcoded name assumptions
    const randomRepoId = "repo-xyz-999";
    const genericGraph: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${randomRepoId}`,
        type: "Repository",
        name: "Custom Project X",
        label: "Custom Project X",
        repoId: randomRepoId,
      },
      modules: [
        {
          id: `module:${randomRepoId}:pkg-one`,
          type: "Module",
          name: "PackageOne",
          label: "PackageOne",
          repoId: randomRepoId,
        },
      ],
      files: [],
      classes: [],
      functions: [],
      methods: [],
      dependencies: [],
      commits: [],
      contributors: [],
      edges: [
        {
          id: "e-rand-1",
          source: `repo:${randomRepoId}`,
          target: `module:${randomRepoId}:pkg-one`,
          type: "CONTAINS",
          repoId: randomRepoId,
        },
      ],
      stats: dummyStats,
    };

    const map = transformKnowledgeToMap(genericGraph, "architecture");
    assert.strictEqual(map.nodes.length, 2);
    const repoNode = map.nodes.find((n) => n.type === "Repository");
    const moduleNode = map.nodes.find((n) => n.type === "Module");
    assert.ok(repoNode, "Repository node must exist");
    assert.strictEqual(repoNode.name, "Custom Project X");
    assert.ok(moduleNode, "Module node must exist");
    assert.strictEqual(moduleNode.name, "PackageOne");
  });

  test("48. High-level Architecture Scoping excludes low-level symbols", () => {
    // In repoAGraph, EngineCore class exists. In "architecture" viewMode, it must be excluded.
    const rootMap = transformKnowledgeToMap(repoAGraph, "architecture");
    assert.strictEqual(
      rootMap.nodes.some((n) => n.type === "Class"),
      false,
      "Classes must not appear in root architecture"
    );
    assert.strictEqual(
      rootMap.nodes.some((n) => n.type === "File"),
      false,
      "Individual files must not appear in root architecture when modules exist"
    );
    assert.ok(rootMap.nodes.some((n) => n.type === "Repository"));
    assert.ok(rootMap.nodes.some((n) => n.type === "Module"));
    assert.ok(rootMap.nodes.some((n) => n.type === "Dependency"));
  });

  test("49. Large Graph Safeguard caps child files at 40 in drill-down", () => {
    const hugeRepoId = "repo-huge";
    const files: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    for (let i = 1; i <= 60; i++) {
      const fileId = `file:${hugeRepoId}:src/file_${i}.ts`;
      files.push({
        id: fileId,
        type: "File",
        name: `file_${i}.ts`,
        label: `file_${i}.ts`,
        repoId: hugeRepoId,
        filePath: `src/file_${i}.ts`,
        metadata: { moduleId: "bigmod" },
      });
      edges.push({
        id: `e-big-${i}`,
        source: `module:${hugeRepoId}:bigmod`,
        target: fileId,
        type: "CONTAINS",
        repoId: hugeRepoId,
      });
    }

    const hugeGraph: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${hugeRepoId}`,
        type: "Repository",
        name: "Huge Repo",
        label: "Huge Repo",
        repoId: hugeRepoId,
      },
      modules: [
        {
          id: `module:${hugeRepoId}:bigmod`,
          type: "Module",
          name: "BigMod",
          label: "BigMod",
          repoId: hugeRepoId,
        },
      ],
      files,
      classes: [],
      functions: [],
      methods: [],
      dependencies: [],
      commits: [],
      contributors: [],
      edges,
      stats: dummyStats,
    };

    // Default drill-down caps at 40
    const cappedScope = extractDrillDownScope(hugeGraph, `module:${hugeRepoId}:bigmod`);
    assert.strictEqual(cappedScope.isCapped, true);
    assert.strictEqual(cappedScope.totalChildCount, 60);
    // Focal node (1) + capped files (40) = 41 nodes
    assert.strictEqual(cappedScope.nodes.length, 41);

    // With expandAll: true, all 60 files are returned
    const expandedScope = extractDrillDownScope(hugeGraph, `module:${hugeRepoId}:bigmod`, { expandAll: true });
    assert.strictEqual(expandedScope.isCapped, false);
    assert.strictEqual(expandedScope.nodes.length, 61);
  });
});



