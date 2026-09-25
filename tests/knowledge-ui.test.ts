import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  deriveAllKnowledge,
  deriveTeamKnowledge,
  deriveConcentration,
  deriveRecommendations,
  PALETTE,
} from "../lib/knowledge-helper";
import type { RepositoryKnowledgeView, KnowledgeGraphStats } from "../lib/server/knowledge/types";

describe("DevMind Milestone 2.4 — Engineering Knowledge UI & Live Data Derivation", () => {
  const pagePath = path.resolve(__dirname, "../app/app/knowledge/page.tsx");
  const pageContent = fs.readFileSync(pagePath, "utf-8");

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

  test("1. Source Audit: page.tsx does not import mock fixtures or mock constants", () => {
    // Assert no import from data/fixtures
    assert.strictEqual(
      pageContent.includes('from "@/data/fixtures"'),
      false,
      "page.tsx must not import from '@/data/fixtures'"
    );
    assert.strictEqual(
      pageContent.includes("from '../data/fixtures'"),
      false,
      "page.tsx must not import from '../data/fixtures'"
    );

    // Assert mock fixture identifiers are not imported or used
    assert.strictEqual(
      pageContent.includes("TEAM_KNOWLEDGE"),
      false,
      "page.tsx must not use fixture TEAM_KNOWLEDGE"
    );
    assert.strictEqual(
      pageContent.includes("CONCENTRATION"),
      false,
      "page.tsx must not use fixture CONCENTRATION"
    );
    assert.strictEqual(
      pageContent.includes("RECS"),
      false,
      "page.tsx must not use fixture RECS"
    );
  });

  test("2. Source Audit: page.tsx calls /api/knowledge/graph and derives live data", () => {
    assert.ok(
      pageContent.includes("/api/knowledge/graph"),
      "page.tsx must query the real /api/knowledge/graph endpoint"
    );
    assert.ok(
      pageContent.includes("deriveAllKnowledge"),
      "page.tsx must derive live knowledge data using deriveAllKnowledge"
    );
  });

  test("3. Derivation: empty repository returns clean empty states", () => {
    const emptyGraph: RepositoryKnowledgeView = {
      repoNode: {
        id: "repo:test-empty",
        type: "Repository",
        name: "test-empty",
        label: "test-empty",
        repoId: "test-empty",
        metadata: { fileCount: 0, moduleCount: 0 },
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

    const result = deriveAllKnowledge(emptyGraph);
    assert.deepStrictEqual(result.teamKnowledge, []);
    assert.deepStrictEqual(result.concentration, []);
    assert.deepStrictEqual(result.recommendations, []);
  });

  test("4. Derivation: derives team knowledge with modules, tech, and areas", () => {
    const repoId = "devmind";
    const graphData: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${repoId}`,
        type: "Repository",
        name: "devmind",
        label: "devmind",
        repoId,
        metadata: { fileCount: 2, moduleCount: 1 },
      },
      modules: [
        {
          id: `module:${repoId}:auth`,
          type: "Module",
          name: "Auth",
          label: "Auth",
          repoId,
          metadata: { depsCount: 1 },
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
        },
      ],
      functions: [],
      methods: [],
      dependencies: [
        {
          id: `dep:${repoId}:bcrypt`,
          type: "Dependency",
          name: "bcrypt",
          label: "bcrypt",
          repoId,
        },
      ],
      commits: [
        {
          id: `commit:${repoId}:c1`,
          type: "Commit",
          name: "Add auth service",
          label: "Add auth service",
          repoId,
        },
      ],
      contributors: [
        {
          id: `contrib:${repoId}:alice@example.com`,
          type: "Contributor",
          name: "Alice Smith",
          label: "Alice Smith",
          repoId,
        },
      ],
      edges: [
        {
          id: "e1",
          source: `commit:${repoId}:c1`,
          target: `contrib:${repoId}:alice@example.com`,
          type: "AUTHORED_BY",
          repoId,
        },
        {
          id: "e2",
          source: `commit:${repoId}:c1`,
          target: `file:${repoId}:src/auth/service.ts`,
          type: "CHANGES",
          repoId,
        },
        {
          id: "e3",
          source: `module:${repoId}:auth`,
          target: `file:${repoId}:src/auth/service.ts`,
          type: "CONTAINS",
          repoId,
        },
        {
          id: "e4",
          source: `file:${repoId}:src/auth/service.ts`,
          target: `dep:${repoId}:bcrypt`,
          type: "DEPENDS_ON",
          repoId,
        },
      ],
      stats: dummyStats,
    };

    const team = deriveTeamKnowledge(graphData);
    assert.strictEqual(team.length, 1);
    assert.strictEqual(team[0].dev, "Alice Smith");
    assert.strictEqual(team[0].color, PALETTE[0]);

    // Alice should have module "Auth", tech "bcrypt", and area "AuthService"
    const linkNames = team[0].links.map(([name]) => name);
    assert.ok(linkNames.includes("Auth"), "Expected link to Auth module");
    assert.ok(linkNames.includes("bcrypt"), "Expected link to bcrypt dependency");
    assert.ok(linkNames.includes("AuthService"), "Expected link to AuthService class");
  });

  test("5. Derivation: calculates concentration and identifies high bus-factor risk", () => {
    const repoId = "devmind";
    const graphData: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${repoId}`,
        type: "Repository",
        name: "devmind",
        label: "devmind",
        repoId,
      },
      modules: [
        {
          id: `module:${repoId}:billing`,
          type: "Module",
          name: "Billing",
          label: "Billing",
          repoId,
          metadata: { depsCount: 0 },
        },
      ],
      files: [
        {
          id: `file:${repoId}:src/billing/invoice.ts`,
          type: "File",
          name: "invoice.ts",
          label: "invoice.ts",
          repoId,
          filePath: "src/billing/invoice.ts",
          metadata: { moduleId: "billing" },
        },
      ],
      classes: [],
      functions: [],
      methods: [],
      dependencies: [],
      commits: [
        { id: `commit:${repoId}:c1`, type: "Commit", name: "c1", label: "c1", repoId },
        { id: `commit:${repoId}:c2`, type: "Commit", name: "c2", label: "c2", repoId },
      ],
      contributors: [
        {
          id: `contrib:${repoId}:bob@example.com`,
          type: "Contributor",
          name: "Bob Jones",
          label: "Bob Jones",
          repoId,
        },
      ],
      edges: [
        {
          id: "e1",
          source: `commit:${repoId}:c1`,
          target: `contrib:${repoId}:bob@example.com`,
          type: "AUTHORED_BY",
          repoId,
        },
        {
          id: "e2",
          source: `commit:${repoId}:c2`,
          target: `contrib:${repoId}:bob@example.com`,
          type: "AUTHORED_BY",
          repoId,
        },
        {
          id: "e3",
          source: `commit:${repoId}:c1`,
          target: `file:${repoId}:src/billing/invoice.ts`,
          type: "CHANGES",
          repoId,
        },
        {
          id: "e4",
          source: `commit:${repoId}:c2`,
          target: `file:${repoId}:src/billing/invoice.ts`,
          type: "CHANGES",
          repoId,
        },
      ],
      stats: dummyStats,
    };

    const conc = deriveConcentration(graphData);
    assert.strictEqual(conc.length, 1);
    assert.strictEqual(conc[0].module, "billing");
    assert.strictEqual(conc[0].level, "high"); // 100% Bob -> high risk
    assert.strictEqual(conc[0].devs, 1);
    assert.ok(conc[0].insight.includes("Bob Jones accounts for 100% of module changes"));
  });

  test("6. Derivation: generates grounded recommendations", () => {
    const repoId = "devmind";
    const graphData: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${repoId}`,
        type: "Repository",
        name: "devmind",
        label: "devmind",
        repoId,
      },
      modules: [
        {
          id: `module:${repoId}:core`,
          type: "Module",
          name: "Core",
          label: "Core",
          repoId,
          metadata: { depsCount: 1 },
        },
      ],
      files: [
        {
          id: `file:${repoId}:src/core/app.ts`,
          type: "File",
          name: "app.ts",
          label: "app.ts",
          repoId,
          filePath: "src/core/app.ts",
          metadata: { moduleId: "core" },
        },
      ],
      classes: [
        {
          id: `class:${repoId}:src/core/app.ts:App`,
          type: "Class",
          name: "App",
          label: "App",
          repoId,
          filePath: "src/core/app.ts",
        },
      ],
      functions: [],
      methods: [],
      dependencies: [
        {
          id: `dep:${repoId}:express`,
          type: "Dependency",
          name: "express",
          label: "express",
          repoId,
        },
      ],
      commits: [
        { id: `commit:${repoId}:c1`, type: "Commit", name: "Init", label: "Init", repoId },
      ],
      contributors: [
        {
          id: `contrib:${repoId}:solo@example.com`,
          type: "Contributor",
          name: "Solo Dev",
          label: "Solo Dev",
          repoId,
        },
      ],
      edges: [
        {
          id: "e1",
          source: `commit:${repoId}:c1`,
          target: `contrib:${repoId}:solo@example.com`,
          type: "AUTHORED_BY",
          repoId,
        },
        {
          id: "e2",
          source: `commit:${repoId}:c1`,
          target: `file:${repoId}:src/core/app.ts`,
          type: "CHANGES",
          repoId,
        },
      ],
      stats: dummyStats,
    };

    const conc = deriveConcentration(graphData);
    const recs = deriveRecommendations(graphData, conc);

    assert.ok(recs.length >= 3, `Expected at least 3 recommendations, got ${recs.length}`);
    // Should have concentration recommendation
    const concRec = recs.find((r) => r.module === "core");
    assert.ok(concRec, "Expected recommendation for core module concentration");

    // Should have architecture recommendation
    const archRec = recs.find((r) => r.title.includes("classes"));
    assert.ok(archRec, "Expected architecture recommendation for classes");

    // Should have dependency recommendation
    const depRec = recs.find((r) => r.title.includes("dependencies"));
    assert.ok(depRec, "Expected dependency recommendation");
    assert.ok(depRec?.evidence.includes("express"));

    // Should have git history recommendation
    const gitRec = recs.find((r) => r.title.includes("commits"));
    assert.ok(gitRec, "Expected git history recommendation");
  });
});
