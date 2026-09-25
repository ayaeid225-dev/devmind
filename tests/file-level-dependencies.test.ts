import assert from "node:assert";
import { describe, test } from "node:test";
import Module from "node:module";

// Mock server-only for node:test runner outside Next.js compiler
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, [id, ...args]);
};

describe("Milestone 1: File-Level Dependency Analysis Test Suite", async () => {
  const {
    buildRepoFileIndex,
    resolveFileDependency,
    generateDependencyKey,
    syncFileDependencies,
    handleDeletedFiles,
  } = await import("../lib/server/ingestion/resolver");

  const repoId = "test-repo";

  describe("1. TypeScript / JavaScript Resolution", () => {
    const filePaths = [
      "src/auth/AuthService.ts",
      "src/api/client.ts",
      "src/utils/request.ts",
      "src/components/Button/index.tsx",
      "src/components/Header.jsx",
      "src/types/index.d.ts",
      "tsconfig.json",
    ];

    const tsconfigContent = JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"],
          "@components/*": ["./src/components/*"],
        },
      },
    });

    const index = buildRepoFileIndex(filePaths, { tsconfigContent });

    test("Resolves relative import: ./client -> src/api/client.ts", () => {
      const imp = { source: "../api/client", file: "src/auth/AuthService.ts" };
      const res = resolveFileDependency("src/auth/AuthService.ts", imp, "typescript", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.kind, "internal");
      assert.strictEqual(res.targetFile, "src/api/client.ts");
      assert.strictEqual(res.sourceFile, "src/auth/AuthService.ts");
    });

    test("Resolves nested relative import: ../utils/request -> src/utils/request.ts", () => {
      const imp = { source: "../utils/request", file: "src/api/client.ts" };
      const res = resolveFileDependency("src/api/client.ts", imp, "typescript", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "src/utils/request.ts");
    });

    test("Resolves directory index: ./components/Button -> src/components/Button/index.tsx", () => {
      const imp = { source: "../components/Button", file: "src/api/client.ts" };
      const res = resolveFileDependency("src/api/client.ts", imp, "typescript", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "src/components/Button/index.tsx");
    });

    test("Resolves TypeScript path alias: @/utils/request -> src/utils/request.ts", () => {
      const imp = { source: "@/utils/request", file: "src/auth/AuthService.ts" };
      const res = resolveFileDependency("src/auth/AuthService.ts", imp, "typescript", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "src/utils/request.ts");
    });

    test("Resolves specific path alias: @components/Button -> src/components/Button/index.tsx", () => {
      const imp = { source: "@components/Button", file: "src/auth/AuthService.ts" };
      const res = resolveFileDependency("src/auth/AuthService.ts", imp, "typescript", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "src/components/Button/index.tsx");
    });

    test("Identifies Node.js built-ins as RESOLVED_EXTERNAL", () => {
      const imp = { source: "node:fs/promises", file: "src/api/client.ts" };
      const res = resolveFileDependency("src/api/client.ts", imp, "typescript", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_EXTERNAL");
      assert.strictEqual(res.kind, "external");
      assert.strictEqual(res.targetFile, null);
    });

    test("Identifies external npm package as RESOLVED_EXTERNAL", () => {
      const imp = { source: "@prisma/client", file: "src/api/client.ts" };
      const res = resolveFileDependency("src/api/client.ts", imp, "typescript", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_EXTERNAL");
      assert.strictEqual(res.kind, "external");
      assert.strictEqual(res.name, "@prisma/client");
    });

    test("Marks missing relative import as UNRESOLVED", () => {
      const imp = { source: "./missing-helper", file: "src/auth/AuthService.ts" };
      const res = resolveFileDependency("src/auth/AuthService.ts", imp, "typescript", index, repoId);

      assert.strictEqual(res.resolutionStatus, "UNRESOLVED");
      assert.strictEqual(res.targetFile, null);
      assert.strictEqual(res.importSource, "./missing-helper");
    });

    test("Prevents repository root escape: ../../../../etc/passwd -> UNRESOLVED", () => {
      const imp = { source: "../../../../../../etc/passwd", file: "src/auth/AuthService.ts" };
      const res = resolveFileDependency("src/auth/AuthService.ts", imp, "typescript", index, repoId);

      assert.strictEqual(res.resolutionStatus, "UNRESOLVED");
      assert.strictEqual(res.targetFile, null);
      assert.ok(res.error?.includes("escapes repository root"));
    });
  });

  describe("2. Python Resolution", () => {
    const filePaths = [
      "app/__init__.py",
      "app/services/__init__.py",
      "app/services/user.py",
      "app/services/auth.py",
      "app/utils.py",
      "tests/test_user.py",
    ];

    const index = buildRepoFileIndex(filePaths);

    test("Resolves sibling import: from .auth import check -> app/services/auth.py", () => {
      const imp = { source: ".auth", file: "app/services/user.py" };
      const res = resolveFileDependency("app/services/user.py", imp, "python", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "app/services/auth.py");
    });

    test("Resolves parent-directory relative import: from ..utils import helper -> app/utils.py", () => {
      const imp = { source: "..utils", file: "app/services/user.py" };
      const res = resolveFileDependency("app/services/user.py", imp, "python", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "app/utils.py");
    });

    test("Resolves absolute internal import: from app.services.user import UserService -> app/services/user.py", () => {
      const imp = { source: "app.services.user", file: "tests/test_user.py" };
      const res = resolveFileDependency("tests/test_user.py", imp, "python", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "app/services/user.py");
    });

    test("Resolves sibling module without leading dot: import auth -> app/services/auth.py", () => {
      const imp = { source: "auth", file: "app/services/user.py" };
      const res = resolveFileDependency("app/services/user.py", imp, "python", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "app/services/auth.py");
    });

    test("Identifies Python standard library: import sys -> RESOLVED_EXTERNAL", () => {
      const imp = { source: "sys", file: "app/services/user.py" };
      const res = resolveFileDependency("app/services/user.py", imp, "python", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_EXTERNAL");
      assert.strictEqual(res.name, "sys");
      assert.strictEqual(res.targetFile, null);
    });

    test("Identifies external packages: import requests -> RESOLVED_EXTERNAL", () => {
      const imp = { source: "requests", file: "app/services/user.py" };
      const res = resolveFileDependency("app/services/user.py", imp, "python", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_EXTERNAL");
      assert.strictEqual(res.name, "requests");
    });
  });

  describe("3. Dart / Flutter Resolution", () => {
    const filePaths = [
      "pubspec.yaml",
      "lib/main.dart",
      "lib/services/api.dart",
      "lib/models/user.dart",
      "lib/widgets/home.dart",
      "test/widget_test.dart",
    ];

    const pubspecContent = "name: my_app\nversion: 1.0.0\n";
    const index = buildRepoFileIndex(filePaths, { pubspecContent });

    test("Resolves relative import: ../services/api.dart -> lib/services/api.dart", () => {
      const imp = { source: "../services/api.dart", file: "lib/models/user.dart" };
      const res = resolveFileDependency("lib/models/user.dart", imp, "dart", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "lib/services/api.dart");
    });

    test("Resolves local package import: package:my_app/widgets/home.dart -> lib/widgets/home.dart", () => {
      const imp = { source: "package:my_app/widgets/home.dart", file: "lib/main.dart" };
      const res = resolveFileDependency("lib/main.dart", imp, "dart", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "lib/widgets/home.dart");
    });

    test("Identifies Flutter SDK imports: package:flutter/material.dart -> RESOLVED_EXTERNAL", () => {
      const imp = { source: "package:flutter/material.dart", file: "lib/main.dart" };
      const res = resolveFileDependency("lib/main.dart", imp, "dart", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_EXTERNAL");
      assert.strictEqual(res.targetFile, null);
    });

    test("Identifies external Dart pub packages: package:provider/provider.dart -> RESOLVED_EXTERNAL", () => {
      const imp = { source: "package:provider/provider.dart", file: "lib/main.dart" };
      const res = resolveFileDependency("lib/main.dart", imp, "dart", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_EXTERNAL");
      assert.strictEqual(res.name, "provider");
      assert.strictEqual(res.targetFile, null);
    });
  });

  describe("4. Java Resolution", () => {
    const filePaths = [
      "src/main/java/com/example/services/UserService.java",
      "src/main/java/com/example/models/User.java",
      "src/test/java/com/example/UserServiceTest.java",
    ];

    const index = buildRepoFileIndex(filePaths);

    test("Resolves local Java package import to repository file", () => {
      const imp = { source: "com.example.services.UserService", file: "src/test/java/com/example/UserServiceTest.java" };
      const res = resolveFileDependency("src/test/java/com/example/UserServiceTest.java", imp, "java", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "src/main/java/com/example/services/UserService.java");
    });

    test("Identifies Java standard library: java.util.List -> RESOLVED_EXTERNAL", () => {
      const imp = { source: "java.util.List", file: "src/main/java/com/example/services/UserService.java" };
      const res = resolveFileDependency("src/main/java/com/example/services/UserService.java", imp, "java", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_EXTERNAL");
      assert.strictEqual(res.targetFile, null);
    });
  });

  describe("5. Go Resolution", () => {
    const filePaths = [
      "go.mod",
      "main.go",
      "pkg/auth/auth.go",
      "pkg/auth/token.go",
    ];

    const goModContent = "module github.com/example/go-service\n\ngo 1.21\n";
    const index = buildRepoFileIndex(filePaths, { goModContent });

    test("Resolves local Go module import: github.com/example/go-service/pkg/auth -> pkg/auth/auth.go", () => {
      const imp = { source: "github.com/example/go-service/pkg/auth", file: "main.go" };
      const res = resolveFileDependency("main.go", imp, "go", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(res.targetFile, "pkg/auth/auth.go");
    });

    test("Identifies Go standard library: fmt, net/http -> RESOLVED_EXTERNAL", () => {
      const imp = { source: "net/http", file: "main.go" };
      const res = resolveFileDependency("main.go", imp, "go", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_EXTERNAL");
      assert.strictEqual(res.targetFile, null);
    });

    test("Identifies external Go module: github.com/gin-gonic/gin -> RESOLVED_EXTERNAL", () => {
      const imp = { source: "github.com/gin-gonic/gin", file: "main.go" };
      const res = resolveFileDependency("main.go", imp, "go", index, repoId);

      assert.strictEqual(res.resolutionStatus, "RESOLVED_EXTERNAL");
      assert.strictEqual(res.name, "github.com/gin-gonic/gin");
      assert.strictEqual(res.targetFile, null);
    });
  });

  describe("6. Re-Ingestion Consistency & State Synchronization", () => {
    // In-memory mock database to test sync idempotency, additions, removals, and file deletions
    const mockDbState: Map<string, any> = new Map();

    const mockPrisma = {
      dependencyRecord: {
        findMany: async (args: any) => {
          const results: any[] = [];
          for (const item of mockDbState.values()) {
            if (args.where?.repoId && item.repoId !== args.where.repoId) continue;
            if (args.where?.sourceFile && item.sourceFile !== args.where.sourceFile) continue;
            if (args.where?.dependencyType && item.dependencyType !== args.where.dependencyType) continue;
            results.push(item);
          }
          return results;
        },
        deleteMany: async (args: any) => {
          if (args.where?.id?.in) {
            for (const id of args.where.id.in) {
              mockDbState.delete(id);
            }
          }
          if (args.where?.repoId && args.where?.sourceFile) {
            for (const [id, item] of Array.from(mockDbState.entries())) {
              if (item.repoId === args.where.repoId && item.sourceFile === args.where.sourceFile) {
                mockDbState.delete(id);
              }
            }
          }
        },
        updateMany: async (args: any) => {
          for (const item of mockDbState.values()) {
            if (args.where?.repoId && item.repoId !== args.where.repoId) continue;
            if (args.where?.targetFile && item.targetFile === args.where.targetFile) {
              Object.assign(item, args.data);
            }
          }
        },
        upsert: async (args: any) => {
          const key = args.where.key;
          let existingId: string | null = null;
          for (const [id, item] of mockDbState.entries()) {
            if (item.key === key) {
              existingId = id;
              break;
            }
          }

          if (existingId) {
            const updated = { ...mockDbState.get(existingId), ...args.update };
            mockDbState.set(existingId, updated);
            return updated;
          } else {
            const id = `dep-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const created = { id, ...args.create };
            mockDbState.set(id, created);
            return created;
          }
        },
      },
      fileRecord: {
        findMany: async () => [
          { id: "f1", path: "src/auth/AuthService.ts" },
          { id: "f2", path: "src/api/client.ts" },
          { id: "f3", path: "src/obsolete.ts" },
        ],
        deleteMany: async () => {},
      },
    };

    test("Repeated ingestion of identical file imports produces zero duplicates", async () => {
      const dep1 = {
        sourceFile: "src/auth/AuthService.ts",
        targetFile: "src/api/client.ts",
        importSource: "./client",
        dependencyType: "import" as const,
        kind: "internal" as const,
        language: "typescript",
        resolutionStatus: "RESOLVED_INTERNAL" as const,
        key: generateDependencyKey(repoId, "src/auth/AuthService.ts", "./client", "import"),
      };

      // Ingest once
      await syncFileDependencies(mockPrisma, repoId, "src/auth/AuthService.ts", [dep1]);
      assert.strictEqual(mockDbState.size, 1);

      // Ingest second time
      await syncFileDependencies(mockPrisma, repoId, "src/auth/AuthService.ts", [dep1]);
      assert.strictEqual(mockDbState.size, 1, "Duplicate record must not be created");

      // Ingest third time
      await syncFileDependencies(mockPrisma, repoId, "src/auth/AuthService.ts", [dep1]);
      assert.strictEqual(mockDbState.size, 1, "Duplicate record must not be created");
    });

    test("Removes obsolete dependencies when file imports change", async () => {
      // Source file now imports "./newClient" instead of "./client"
      const dep2 = {
        sourceFile: "src/auth/AuthService.ts",
        targetFile: "src/api/newClient.ts",
        importSource: "./newClient",
        dependencyType: "import" as const,
        kind: "internal" as const,
        language: "typescript",
        resolutionStatus: "RESOLVED_INTERNAL" as const,
        key: generateDependencyKey(repoId, "src/auth/AuthService.ts", "./newClient", "import"),
      };

      await syncFileDependencies(mockPrisma, repoId, "src/auth/AuthService.ts", [dep2]);
      assert.strictEqual(mockDbState.size, 1);

      const saved = Array.from(mockDbState.values())[0];
      assert.strictEqual(saved.importSource, "./newClient");
      assert.strictEqual(saved.targetFile, "src/api/newClient.ts");
    });

    test("Invalidates dependencies when target file is deleted", async () => {
      // Add dependency A -> src/obsolete.ts
      const depObsolete = {
        sourceFile: "src/auth/AuthService.ts",
        targetFile: "src/obsolete.ts",
        importSource: "../obsolete",
        dependencyType: "import" as const,
        kind: "internal" as const,
        language: "typescript",
        resolutionStatus: "RESOLVED_INTERNAL" as const,
        key: generateDependencyKey(repoId, "src/auth/AuthService.ts", "../obsolete", "import"),
      };
      await syncFileDependencies(mockPrisma, repoId, "src/auth/AuthService.ts", [depObsolete]);

      // Now deletedFiles cleanup runs where src/obsolete.ts is NOT in current files
      const currentPaths = new Set(["src/auth/AuthService.ts", "src/api/client.ts"]);
      await handleDeletedFiles(mockPrisma, repoId, currentPaths);

      const items = Array.from(mockDbState.values());
      const invalidated = items.find((i) => i.importSource === "../obsolete");
      assert.ok(invalidated, "Dependency should exist in invalidated state");
      assert.strictEqual(invalidated.targetFile, null);
      assert.strictEqual(invalidated.resolutionStatus, "UNRESOLVED");
    });
  });

  describe("7. Real Repository Self-Validation", async () => {
    test("Resolves actual imports across real DevMind repository files", async () => {
      const fs = await import("node:fs");
      const pathModule = await import("node:path");

      // Verify that real DevMind source files can resolve their imports against real codebase
      const authContent = fs.readFileSync(pathModule.join(process.cwd(), "lib/server/auth.ts"), "utf-8");
      const { analyzeSourceCode } = await import("../lib/server/ingestion/parser");

      const analysis = analyzeSourceCode("lib/server/auth.ts", authContent);
      assert.ok(analysis.imports.length > 0, "Expected auth.ts to have imports");

      // Build real repo index of lib/server
      const realFiles = [
        "lib/server/auth.ts",
        "lib/server/db.ts",
        "lib/server/github.ts",
        "tsconfig.json",
      ];
      const realTsconfig = fs.readFileSync(pathModule.join(process.cwd(), "tsconfig.json"), "utf-8");
      const realIndex = buildRepoFileIndex(realFiles, { tsconfigContent: realTsconfig });

      // Find db import in auth.ts (e.g. "./db")
      const dbImport = analysis.parsedFileResult.imports.find((i) => i.source.includes("db"));
      assert.ok(dbImport, "auth.ts should import db");

      const resolved = resolveFileDependency("lib/server/auth.ts", dbImport, "typescript", realIndex, "devmind");
      assert.strictEqual(resolved.resolutionStatus, "RESOLVED_INTERNAL");
      assert.strictEqual(resolved.targetFile, "lib/server/db.ts");
    });
  });
});
