import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  generateOnboardingPath,
  detectRecommendedStartingPoint,
  inferArchitecturalCategory,
  calculateModuleImportance,
  buildFileToModuleMap,
  isLikelyEntryFile,
  type OnboardingPath,
  type OnboardingStep,
} from "../lib/onboarding-helper";
import type {
  RepositoryKnowledgeView,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphStats,
} from "../lib/server/knowledge/types";

describe("DevMind Milestone 5 — Onboarding & Dynamic Learning Path", () => {
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
  // TEST FIXTURES: Generic Multi-Tier Repository (Repo Alpha)
  // --------------------------------------------------------------------------
  const repoAlphaId = "repo-alpha";

  const repoAlphaGraph: RepositoryKnowledgeView = {
    repoNode: {
      id: `repo:${repoAlphaId}`,
      type: "Repository",
      name: "ProjectAlpha",
      label: "ProjectAlpha Core",
      repoId: repoAlphaId,
      metadata: { owner: "acme-corp" },
    },
    modules: [
      {
        id: `module:${repoAlphaId}:gateway`,
        type: "Module",
        name: "ApiGateway",
        label: "Module ApiGateway (api)",
        repoId: repoAlphaId,
        metadata: { type: "api", desc: "Routes external HTTP requests" },
      },
      {
        id: `module:${repoAlphaId}:core`,
        type: "Module",
        name: "ApplicationCore",
        label: "Module ApplicationCore (core)",
        repoId: repoAlphaId,
        metadata: { type: "core", desc: "Business workflows and orchestration" },
      },
      {
        id: `module:${repoAlphaId}:billing`,
        type: "Module",
        name: "BillingDomain",
        label: "Module BillingDomain (core)",
        repoId: repoAlphaId,
        metadata: { type: "core", desc: "Subscription and billing domain logic" },
      },
      {
        id: `module:${repoAlphaId}:db`,
        type: "Module",
        name: "DataPersistence",
        label: "Module DataPersistence (db)",
        repoId: repoAlphaId,
        metadata: { type: "db", desc: "PostgreSQL models and migrations" },
      },
      {
        id: `module:${repoAlphaId}:stripe-ext`,
        type: "Module",
        name: "StripeAdapter",
        label: "Module StripeAdapter (ext)",
        repoId: repoAlphaId,
        metadata: { type: "ext", desc: "Third-party payment gateway integration" },
      },
      {
        id: `module:${repoAlphaId}:utils`,
        type: "Module",
        name: "CommonUtils",
        label: "Module CommonUtils (core)",
        repoId: repoAlphaId,
        metadata: { type: "core", desc: "Shared string and date helpers" },
      },
    ],
    files: [
      // Gateway files
      {
        id: `file:${repoAlphaId}:src/gateway/index.ts`,
        type: "File",
        name: "index.ts",
        label: "src/gateway/index.ts",
        filePath: "src/gateway/index.ts",
        language: "TypeScript",
        repoId: repoAlphaId,
        metadata: { moduleId: "gateway" },
      },
      {
        id: `file:${repoAlphaId}:src/gateway/router.ts`,
        type: "File",
        name: "router.ts",
        label: "src/gateway/router.ts",
        filePath: "src/gateway/router.ts",
        language: "TypeScript",
        repoId: repoAlphaId,
        metadata: { moduleId: "gateway" },
      },
      // Core files
      {
        id: `file:${repoAlphaId}:src/core/workflow.ts`,
        type: "File",
        name: "workflow.ts",
        label: "src/core/workflow.ts",
        filePath: "src/core/workflow.ts",
        language: "TypeScript",
        repoId: repoAlphaId,
        metadata: { moduleId: "core" },
      },
      // Billing files
      {
        id: `file:${repoAlphaId}:src/billing/invoice.ts`,
        type: "File",
        name: "invoice.ts",
        label: "src/billing/invoice.ts",
        filePath: "src/billing/invoice.ts",
        language: "TypeScript",
        repoId: repoAlphaId,
        metadata: { moduleId: "billing" },
      },
      // DB files
      {
        id: `file:${repoAlphaId}:src/db/client.ts`,
        type: "File",
        name: "client.ts",
        label: "src/db/client.ts",
        filePath: "src/db/client.ts",
        language: "TypeScript",
        repoId: repoAlphaId,
        metadata: { moduleId: "db" },
      },
      {
        id: `file:${repoAlphaId}:src/db/schema.ts`,
        type: "File",
        name: "schema.ts",
        label: "src/db/schema.ts",
        filePath: "src/db/schema.ts",
        language: "TypeScript",
        repoId: repoAlphaId,
        metadata: { moduleId: "db" },
      },
      // Stripe ext files
      {
        id: `file:${repoAlphaId}:src/ext/stripe.ts`,
        type: "File",
        name: "stripe.ts",
        label: "src/ext/stripe.ts",
        filePath: "src/ext/stripe.ts",
        language: "TypeScript",
        repoId: repoAlphaId,
        metadata: { moduleId: "stripe-ext" },
      },
      // Utils
      {
        id: `file:${repoAlphaId}:src/utils/format.ts`,
        type: "File",
        name: "format.ts",
        label: "src/utils/format.ts",
        filePath: "src/utils/format.ts",
        language: "TypeScript",
        repoId: repoAlphaId,
        metadata: { moduleId: "utils" },
      },
    ],
    classes: [
      {
        id: `cls:${repoAlphaId}:InvoiceService`,
        type: "Class",
        name: "InvoiceService",
        label: "class InvoiceService",
        repoId: repoAlphaId,
        filePath: "src/billing/invoice.ts",
        startLine: 12,
        endLine: 85,
      },
      {
        id: `cls:${repoAlphaId}:DatabaseClient`,
        type: "Class",
        name: "DatabaseClient",
        label: "class DatabaseClient",
        repoId: repoAlphaId,
        filePath: "src/db/client.ts",
        startLine: 5,
        endLine: 40,
      },
    ],
    functions: [
      {
        id: `fn:${repoAlphaId}:createRouter`,
        type: "Function",
        name: "createRouter",
        label: "function createRouter",
        repoId: repoAlphaId,
        filePath: "src/gateway/router.ts",
        startLine: 8,
        endLine: 24,
      },
      {
        id: `fn:${repoAlphaId}:calculateTax`,
        type: "Function",
        name: "calculateTax",
        label: "function calculateTax",
        repoId: repoAlphaId,
        filePath: "src/billing/invoice.ts",
        startLine: 90,
        endLine: 105,
      },
    ],
    methods: [],
    dependencies: [
      {
        id: `dep:${repoAlphaId}:express`,
        type: "Dependency",
        name: "express",
        label: "express@^4.18.2",
        repoId: repoAlphaId,
        metadata: { version: "4.18.2" },
      },
      {
        id: `dep:${repoAlphaId}:pg`,
        type: "Dependency",
        name: "pg",
        label: "pg@^8.11.0",
        repoId: repoAlphaId,
        metadata: { version: "8.11.0" },
      },
      {
        id: `dep:${repoAlphaId}:stripe`,
        type: "Dependency",
        name: "stripe",
        label: "stripe@^12.0.0",
        repoId: repoAlphaId,
        metadata: { version: "12.0.0" },
      },
    ],
    commits: [],
    contributors: [],
    edges: [
      // Containment edges: modules -> files
      {
        id: "e-m-gw-1",
        source: `module:${repoAlphaId}:gateway`,
        target: `file:${repoAlphaId}:src/gateway/index.ts`,
        type: "CONTAINS",
        repoId: repoAlphaId,
      },
      {
        id: "e-m-gw-2",
        source: `module:${repoAlphaId}:gateway`,
        target: `file:${repoAlphaId}:src/gateway/router.ts`,
        type: "CONTAINS",
        repoId: repoAlphaId,
      },
      {
        id: "e-m-core-1",
        source: `module:${repoAlphaId}:core`,
        target: `file:${repoAlphaId}:src/core/workflow.ts`,
        type: "CONTAINS",
        repoId: repoAlphaId,
      },
      {
        id: "e-m-bill-1",
        source: `module:${repoAlphaId}:billing`,
        target: `file:${repoAlphaId}:src/billing/invoice.ts`,
        type: "CONTAINS",
        repoId: repoAlphaId,
      },
      {
        id: "e-m-db-1",
        source: `module:${repoAlphaId}:db`,
        target: `file:${repoAlphaId}:src/db/client.ts`,
        type: "CONTAINS",
        repoId: repoAlphaId,
      },
      {
        id: "e-m-db-2",
        source: `module:${repoAlphaId}:db`,
        target: `file:${repoAlphaId}:src/db/schema.ts`,
        type: "CONTAINS",
        repoId: repoAlphaId,
      },
      {
        id: "e-m-str-1",
        source: `module:${repoAlphaId}:stripe-ext`,
        target: `file:${repoAlphaId}:src/ext/stripe.ts`,
        type: "CONTAINS",
        repoId: repoAlphaId,
      },
      {
        id: "e-m-ut-1",
        source: `module:${repoAlphaId}:utils`,
        target: `file:${repoAlphaId}:src/utils/format.ts`,
        type: "CONTAINS",
        repoId: repoAlphaId,
      },

      // Code relationships (IMPORTS)
      // Gateway -> Core
      {
        id: "e-imp-1",
        source: `file:${repoAlphaId}:src/gateway/router.ts`,
        target: `file:${repoAlphaId}:src/core/workflow.ts`,
        type: "IMPORTS",
        repoId: repoAlphaId,
      },
      // Core -> Billing
      {
        id: "e-imp-2",
        source: `file:${repoAlphaId}:src/core/workflow.ts`,
        target: `file:${repoAlphaId}:src/billing/invoice.ts`,
        type: "IMPORTS",
        repoId: repoAlphaId,
      },
      // Core -> DB
      {
        id: "e-imp-3",
        source: `file:${repoAlphaId}:src/core/workflow.ts`,
        target: `file:${repoAlphaId}:src/db/client.ts`,
        type: "IMPORTS",
        repoId: repoAlphaId,
      },
      // Billing -> DB
      {
        id: "e-imp-4",
        source: `file:${repoAlphaId}:src/billing/invoice.ts`,
        target: `file:${repoAlphaId}:src/db/client.ts`,
        type: "IMPORTS",
        repoId: repoAlphaId,
      },
      // Billing -> Stripe
      {
        id: "e-imp-5",
        source: `file:${repoAlphaId}:src/billing/invoice.ts`,
        target: `file:${repoAlphaId}:src/ext/stripe.ts`,
        type: "IMPORTS",
        repoId: repoAlphaId,
      },
      // Core -> Utils
      {
        id: "e-imp-6",
        source: `file:${repoAlphaId}:src/core/workflow.ts`,
        target: `file:${repoAlphaId}:src/utils/format.ts`,
        type: "IMPORTS",
        repoId: repoAlphaId,
      },

      // External Dependencies (DEPENDS_ON)
      {
        id: "e-dep-1",
        source: `file:${repoAlphaId}:src/gateway/index.ts`,
        target: `dep:${repoAlphaId}:express`,
        type: "DEPENDS_ON",
        repoId: repoAlphaId,
      },
      {
        id: "e-dep-2",
        source: `file:${repoAlphaId}:src/db/client.ts`,
        target: `dep:${repoAlphaId}:pg`,
        type: "DEPENDS_ON",
        repoId: repoAlphaId,
      },
      {
        id: "e-dep-3",
        source: `file:${repoAlphaId}:src/ext/stripe.ts`,
        target: `dep:${repoAlphaId}:stripe`,
        type: "DEPENDS_ON",
        repoId: repoAlphaId,
      },
    ],
    stats: dummyStats,
  };

  // --------------------------------------------------------------------------
  // TESTS
  // --------------------------------------------------------------------------

  test("1. Source Audit: onboarding helper does not import mock fixtures", () => {
    const helperPath = path.resolve(__dirname, "../lib/onboarding-helper.ts");
    const content = fs.readFileSync(helperPath, "utf-8");
    assert.strictEqual(
      content.includes("@/data/fixtures"),
      false,
      "onboarding-helper.ts must NOT import hardcoded fixtures"
    );
    assert.strictEqual(
      content.includes("clinic-management"),
      false,
      "onboarding-helper.ts must NOT reference hardcoded clinic-management"
    );
  });

  test("2. Detects entry point files accurately", () => {
    assert.ok(isLikelyEntryFile("src/index.ts"));
    assert.ok(isLikelyEntryFile("lib/main.dart"));
    assert.ok(isLikelyEntryFile("main.go"));
    assert.ok(isLikelyEntryFile("app.py"));
    assert.ok(isLikelyEntryFile("server.js"));
    assert.ok(isLikelyEntryFile("app/page.tsx"));
    assert.strictEqual(isLikelyEntryFile("src/utils/string.ts"), false);
    assert.strictEqual(isLikelyEntryFile("src/models/user.ts"), false);
  });

  test("3. Recommended Starting Point is detected dynamically as ApiGateway", () => {
    const pathAlpha = generateOnboardingPath(repoAlphaGraph);
    assert.ok(pathAlpha.startingPoint, "Starting point must exist");
    assert.strictEqual(pathAlpha.startingPoint.title, "ApiGateway");
    assert.strictEqual(pathAlpha.startingPoint.isStartingPoint, true);
    assert.strictEqual(pathAlpha.startingPoint.stepNumber, 1);
    assert.ok(
      pathAlpha.startingPoint.whyItMatters.includes("Recommended Starting Point"),
      "Why it matters should highlight starting point context"
    );
  });

  test("4. Flutter repository with lib/main.dart detects main module as starting point", () => {
    const flutterRepoId = "repo-flutter";
    const flutterGraph: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${flutterRepoId}`,
        type: "Repository",
        name: "FlutterApp",
        label: "FlutterApp",
        repoId: flutterRepoId,
      },
      modules: [
        {
          id: `module:${flutterRepoId}:app`,
          type: "Module",
          name: "MainApp",
          label: "Module MainApp",
          repoId: flutterRepoId,
          metadata: { type: "core" },
        },
        {
          id: `module:${flutterRepoId}:home`,
          type: "Module",
          name: "HomeFeature",
          label: "Module HomeFeature",
          repoId: flutterRepoId,
          metadata: { type: "core" },
        },
      ],
      files: [
        {
          id: `file:${flutterRepoId}:lib/main.dart`,
          type: "File",
          name: "main.dart",
          label: "lib/main.dart",
          filePath: "lib/main.dart",
          language: "Dart",
          repoId: flutterRepoId,
          metadata: { moduleId: "app" },
        },
        {
          id: `file:${flutterRepoId}:lib/features/home.dart`,
          type: "File",
          name: "home.dart",
          label: "lib/features/home.dart",
          filePath: "lib/features/home.dart",
          language: "Dart",
          repoId: flutterRepoId,
          metadata: { moduleId: "home" },
        },
      ],
      classes: [],
      functions: [],
      methods: [],
      dependencies: [],
      commits: [],
      contributors: [],
      edges: [
        {
          id: "ef-1",
          source: `module:${flutterRepoId}:app`,
          target: `file:${flutterRepoId}:lib/main.dart`,
          type: "CONTAINS",
          repoId: flutterRepoId,
        },
        {
          id: "ef-2",
          source: `module:${flutterRepoId}:home`,
          target: `file:${flutterRepoId}:lib/features/home.dart`,
          type: "CONTAINS",
          repoId: flutterRepoId,
        },
      ],
      stats: dummyStats,
    };

    const pathFlutter = generateOnboardingPath(flutterGraph);
    assert.strictEqual(pathFlutter.startingPoint?.title, "MainApp");
    assert.strictEqual(pathFlutter.startingPoint?.isStartingPoint, true);
  });

  test("5. Dependency-aware curriculum ordering", () => {
    const pathAlpha = generateOnboardingPath(repoAlphaGraph);
    const stepTitles = pathAlpha.steps.map((s) => s.title);

    // Step 1 must be ApiGateway
    assert.strictEqual(stepTitles[0], "ApiGateway");

    // Core layer comes before or alongside domain/persistence
    const gatewayIdx = stepTitles.indexOf("ApiGateway");
    const coreIdx = stepTitles.indexOf("ApplicationCore");
    const dbIdx = stepTitles.indexOf("DataPersistence");
    const utilsIdx = stepTitles.indexOf("CommonUtils");

    assert.ok(gatewayIdx < coreIdx, "Gateway (entry) must precede Core");
    assert.ok(coreIdx < dbIdx, "Core orchestration should precede Data persistence");
    assert.ok(dbIdx < utilsIdx, "Core domain/data modules should precede general utilities");
  });

  test("6. Important Modules are identified and scored non-alphabetically", () => {
    const pathAlpha = generateOnboardingPath(repoAlphaGraph);
    assert.strictEqual(pathAlpha.steps.length, 6);

    const scores = pathAlpha.steps.map((s) => s.importanceScore);
    // Scores should be non-zero and computed from topological weight
    for (const score of scores) {
      assert.ok(score > 0, "Importance score must be positive");
    }

    // ApiGateway has starting point weight
    const gatewayStep = pathAlpha.steps.find((s) => s.title === "ApiGateway");
    assert.ok(gatewayStep, "Gateway step must exist");
    assert.ok(gatewayStep.importanceScore >= 20, "Starting point + API score must be high");
  });

  test("7. Architecture Context derives real dependencies and dependents", () => {
    const pathAlpha = generateOnboardingPath(repoAlphaGraph);

    // ApiGateway depends on ApplicationCore and external express
    const gateway = pathAlpha.steps.find((s) => s.title === "ApiGateway")!;
    assert.ok(gateway.dependencies.some((d) => d.name === "ApplicationCore"));
    assert.ok(gateway.dependencies.some((d) => d.name === "express"));

    // ApplicationCore is depended on by ApiGateway
    const core = pathAlpha.steps.find((s) => s.title === "ApplicationCore")!;
    assert.ok(core.dependents.some((d) => d.name === "ApiGateway"));

    // DataPersistence is depended on by ApplicationCore and BillingDomain
    const dbStep = pathAlpha.steps.find((s) => s.title === "DataPersistence")!;
    assert.ok(dbStep.dependents.some((d) => d.name === "ApplicationCore"));
    assert.ok(dbStep.dependents.some((d) => d.name === "BillingDomain"));
    assert.ok(dbStep.dependencies.some((d) => d.name === "pg"));
  });

  test("8. Code Navigation locations link to real files, classes, and functions", () => {
    const pathAlpha = generateOnboardingPath(repoAlphaGraph);

    // Billing step has real file, class, and function
    const billing = pathAlpha.steps.find((s) => s.title === "BillingDomain")!;
    assert.ok(billing.files.length > 0, "Must have files");
    assert.strictEqual(billing.files[0].name, "invoice.ts");
    assert.strictEqual(billing.files[0].href, `/app/files?repoId=${repoAlphaId}&search=invoice.ts`);

    assert.ok(billing.classes.length > 0, "Must have InvoiceService class");
    assert.strictEqual(billing.classes[0].name, "InvoiceService");
    assert.strictEqual(
      billing.classes[0].href,
      `/app/knowledge?repoId=${repoAlphaId}&tab=symbols&search=InvoiceService`
    );

    assert.ok(billing.functions.length > 0, "Must have calculateTax function");
    assert.strictEqual(billing.functions[0].name, "calculateTax");
  });

  test("9. Repository Agnostic: completely distinct repos produce distinct curricula", () => {
    const repoBetaId = "repo-beta";
    const repoBetaGraph: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${repoBetaId}`,
        type: "Repository",
        name: "RepoBeta",
        label: "RepoBeta",
        repoId: repoBetaId,
      },
      modules: [
        {
          id: `module:${repoBetaId}:cli`,
          type: "Module",
          name: "CommandLineTool",
          label: "CommandLineTool",
          repoId: repoBetaId,
          metadata: { type: "core" },
        },
        {
          id: `module:${repoBetaId}:parser`,
          type: "Module",
          name: "SyntaxParser",
          label: "SyntaxParser",
          repoId: repoBetaId,
          metadata: { type: "core" },
        },
      ],
      files: [
        {
          id: `file:${repoBetaId}:src/cli.ts`,
          type: "File",
          name: "cli.ts",
          label: "src/cli.ts",
          filePath: "src/cli.ts",
          language: "TypeScript",
          repoId: repoBetaId,
          metadata: { moduleId: "cli" },
        },
        {
          id: `file:${repoBetaId}:src/parser.ts`,
          type: "File",
          name: "parser.ts",
          label: "src/parser.ts",
          filePath: "src/parser.ts",
          language: "TypeScript",
          repoId: repoBetaId,
          metadata: { moduleId: "parser" },
        },
      ],
      classes: [],
      functions: [],
      methods: [],
      dependencies: [],
      commits: [],
      contributors: [],
      edges: [
        {
          id: "eb-1",
          source: `module:${repoBetaId}:cli`,
          target: `file:${repoBetaId}:src/cli.ts`,
          type: "CONTAINS",
          repoId: repoBetaId,
        },
        {
          id: "eb-2",
          source: `module:${repoBetaId}:parser`,
          target: `file:${repoBetaId}:src/parser.ts`,
          type: "CONTAINS",
          repoId: repoBetaId,
        },
        {
          id: "eb-imp-1",
          source: `file:${repoBetaId}:src/cli.ts`,
          target: `file:${repoBetaId}:src/parser.ts`,
          type: "IMPORTS",
          repoId: repoBetaId,
        },
      ],
      stats: dummyStats,
    };

    const pathAlpha = generateOnboardingPath(repoAlphaGraph);
    const pathBeta = generateOnboardingPath(repoBetaGraph);

    // Curricula must be completely distinct
    assert.strictEqual(pathAlpha.repoName, "ProjectAlpha");
    assert.strictEqual(pathBeta.repoName, "RepoBeta");
    assert.strictEqual(pathAlpha.startingPoint?.title, "ApiGateway");
    assert.strictEqual(pathBeta.startingPoint?.title, "CommandLineTool");

    // Zero leakage between repos
    assert.strictEqual(pathAlpha.steps.some((s) => s.title === "CommandLineTool"), false);
    assert.strictEqual(pathBeta.steps.some((s) => s.title === "ApiGateway"), false);
  });

  test("10. Flat repository with no modules generates steps from top files", () => {
    const flatRepoId = "repo-flat";
    const flatGraph: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${flatRepoId}`,
        type: "Repository",
        name: "FlatRepo",
        label: "FlatRepo",
        repoId: flatRepoId,
      },
      modules: [], // Zero modules
      files: [
        {
          id: `file:${flatRepoId}:main.py`,
          type: "File",
          name: "main.py",
          label: "main.py",
          filePath: "main.py",
          language: "Python",
          repoId: flatRepoId,
        },
        {
          id: `file:${flatRepoId}:utils.py`,
          type: "File",
          name: "utils.py",
          label: "utils.py",
          filePath: "utils.py",
          language: "Python",
          repoId: flatRepoId,
        },
      ],
      classes: [],
      functions: [],
      methods: [],
      dependencies: [],
      commits: [],
      contributors: [],
      edges: [],
      stats: dummyStats,
    };

    const pathFlat = generateOnboardingPath(flatGraph);
    assert.strictEqual(pathFlat.isEmpty, false);
    assert.strictEqual(pathFlat.steps.length, 2);
    assert.strictEqual(pathFlat.startingPoint?.title, "main.py");
    assert.strictEqual(pathFlat.summary.architectureType, "Monolithic / Direct File Structure");
  });

  test("11. Empty repository returns safe empty curriculum", () => {
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

    const pathEmpty = generateOnboardingPath(emptyGraph);
    assert.strictEqual(pathEmpty.isEmpty, true);
    assert.strictEqual(pathEmpty.steps.length, 0);
    assert.strictEqual(pathEmpty.startingPoint, null);
    assert.ok(pathEmpty.emptyReason);
  });

  test("12. Large repository caps curriculum at maxSteps for focused senior onboarding", () => {
    const hugeRepoId = "repo-huge";
    const modules: KnowledgeNode[] = [];
    const files: KnowledgeNode[] = [];

    for (let i = 1; i <= 25; i++) {
      modules.push({
        id: `module:${hugeRepoId}:mod_${i}`,
        type: "Module",
        name: `Subsystem_${i}`,
        label: `Subsystem_${i}`,
        repoId: hugeRepoId,
        metadata: { type: i === 1 ? "api" : "core" },
      });
      files.push({
        id: `file:${hugeRepoId}:src/mod_${i}/index.ts`,
        type: "File",
        name: "index.ts",
        label: `src/mod_${i}/index.ts`,
        filePath: `src/mod_${i}/index.ts`,
        repoId: hugeRepoId,
        metadata: { moduleId: `mod_${i}` },
      });
    }

    const hugeGraph: RepositoryKnowledgeView = {
      repoNode: {
        id: `repo:${hugeRepoId}`,
        type: "Repository",
        name: "HugeRepo",
        label: "HugeRepo",
        repoId: hugeRepoId,
      },
      modules,
      files,
      classes: [],
      functions: [],
      methods: [],
      dependencies: [],
      commits: [],
      contributors: [],
      edges: [],
      stats: dummyStats,
    };

    const pathHuge = generateOnboardingPath(hugeGraph, { maxSteps: 8 });
    assert.strictEqual(pathHuge.steps.length, 8, "Must cap at 8 steps");
    assert.ok(pathHuge.startingPoint, "Starting point must be selected");
  });
});
