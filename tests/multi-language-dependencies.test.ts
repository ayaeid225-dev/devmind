import assert from "node:assert";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";

// Mock server-only for node:test runner outside Next.js compiler
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...args: any[]) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, [id, ...args]);
};

describe("Multi-Language Dependency Manifest Ingestion Test Suite", async () => {
  const {
    isDependencyManifest,
    parseManifestDependencies,
    parsePackageJsonDependencies,
    parseRequirementsTxtDependencies,
    parsePyprojectTomlDependencies,
    parsePipfileDependencies,
    parsePubspecYamlDependencies,
    parseGoModDependencies,
    parsePomXmlDependencies,
    parseGradleDependencies,
    parseCargoTomlDependencies,
    resolveInternalModuleEdges,
  } = await import("../lib/server/ingestion/dependencies");

  describe("1. Manifest File Recognition", () => {
    test("Identifies standard manifests across all supported ecosystems", () => {
      // Node / JS / TS
      assert.strictEqual(isDependencyManifest("package.json"), true);
      assert.strictEqual(isDependencyManifest("apps/web/package.json"), true);

      // Python
      assert.strictEqual(isDependencyManifest("requirements.txt"), true);
      assert.strictEqual(isDependencyManifest("requirements-dev.txt"), true);
      assert.strictEqual(isDependencyManifest("api/requirements.txt"), true);
      assert.strictEqual(isDependencyManifest("pyproject.toml"), true);
      assert.strictEqual(isDependencyManifest("backend/Pipfile"), true);

      // Dart / Flutter
      assert.strictEqual(isDependencyManifest("pubspec.yaml"), true);
      assert.strictEqual(isDependencyManifest("pubspec.yml"), true);
      assert.strictEqual(isDependencyManifest("mobile/pubspec.yaml"), true);

      // Go
      assert.strictEqual(isDependencyManifest("go.mod"), true);
      assert.strictEqual(isDependencyManifest("services/auth/go.mod"), true);

      // Java / Kotlin
      assert.strictEqual(isDependencyManifest("pom.xml"), true);
      assert.strictEqual(isDependencyManifest("backend/pom.xml"), true);
      assert.strictEqual(isDependencyManifest("build.gradle"), true);
      assert.strictEqual(isDependencyManifest("build.gradle.kts"), true);

      // Rust
      assert.strictEqual(isDependencyManifest("Cargo.toml"), true);
    });

    test("Rejects non-manifest and regular source files", () => {
      assert.strictEqual(isDependencyManifest("main.py"), false);
      assert.strictEqual(isDependencyManifest("user-service.ts"), false);
      assert.strictEqual(isDependencyManifest("settings.json"), false);
      assert.strictEqual(isDependencyManifest("styles.css"), false);
      assert.strictEqual(isDependencyManifest("README.md"), false);
    });
  });

  describe("2. Python Dependency Extraction", () => {
    test("Extracts dependencies from requirements.txt fixture", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/python/requirements.txt");
      const content = fs.readFileSync(filePath, "utf-8");

      const deps = parseRequirementsTxtDependencies(content);
      assert.ok(deps.length >= 8, `Expected at least 8 deps, got ${deps.length}`);

      const fastapi = deps.find((d) => d.name === "fastapi");
      assert.ok(fastapi, "fastapi not found");
      assert.strictEqual(fastapi.version, ">=0.100.0");
      assert.strictEqual(fastapi.kind, "external");

      const pydantic = deps.find((d) => d.name === "pydantic");
      assert.ok(pydantic, "pydantic not found");
      assert.strictEqual(pydantic.version, "==2.0.0");

      const sqlalchemy = deps.find((d) => d.name === "SQLAlchemy");
      assert.ok(sqlalchemy, "SQLAlchemy not found");
      assert.strictEqual(sqlalchemy.version, ">=2.0.0");

      const uvicorn = deps.find((d) => d.name === "uvicorn");
      assert.ok(uvicorn, "uvicorn not found");
      assert.strictEqual(uvicorn.version, ">=0.22.0");

      // Verify comments and environment markers
      const commented = deps.find((d) => d.name?.includes("#"));
      assert.strictEqual(commented, undefined, "Comments should be stripped");

      const pywin32 = deps.find((d) => d.name === "pywin32");
      assert.ok(pywin32, "pywin32 should be parsed after stripping environment marker");
      assert.strictEqual(pywin32.version, ">=305");
    });

    test("Extracts PEP 621 and Poetry dependencies from pyproject.toml fixture", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/python/pyproject.toml");
      const content = fs.readFileSync(filePath, "utf-8");

      const deps = parsePyprojectTomlDependencies(content);
      assert.ok(deps.length >= 5, `Expected at least 5 deps, got ${deps.length}`);

      const fastapi = deps.find((d) => d.name === "fastapi");
      assert.ok(fastapi, "fastapi not found");
      assert.strictEqual(fastapi.version, ">=0.100.0");

      const celery = deps.find((d) => d.name === "celery");
      assert.ok(celery, "celery not found");
      assert.strictEqual(celery.version, "^5.3.1");

      const pytest = deps.find((d) => d.name === "pytest");
      assert.ok(pytest, "pytest not found");
      assert.strictEqual(pytest.purpose, "Development dependency");
    });

    test("Extracts packages from Pipfile content", () => {
      const content = `
        [[source]]
        url = "https://pypi.org/simple"
        verify_ssl = true
        name = "pypi"

        [packages]
        django = ">=4.2"
        requests = "*"

        [dev-packages]
        pytest = { version = ">=7.0", extras = ["mock"] }
        black = "==23.7.0"
      `;

      const deps = parsePipfileDependencies(content);
      assert.strictEqual(deps.length, 4);

      const django = deps.find((d) => d.name === "django");
      assert.ok(django);
      assert.strictEqual(django.version, ">=4.2");
      assert.strictEqual(django.purpose, "Production dependency");

      const black = deps.find((d) => d.name === "black");
      assert.ok(black);
      assert.strictEqual(black.purpose, "Development dependency");
    });
  });

  describe("3. Dart / Flutter Dependency Extraction", () => {
    test("Extracts dependencies and dev_dependencies from pubspec.yaml fixture", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/flutter_dart/pubspec.yaml");
      const content = fs.readFileSync(filePath, "utf-8");

      const deps = parsePubspecYamlDependencies(content);
      assert.ok(deps.length >= 6, `Expected at least 6 deps, got ${deps.length}`);

      const flutter = deps.find((d) => d.name === "flutter");
      assert.ok(flutter, "flutter SDK not found");

      const provider = deps.find((d) => d.name === "provider");
      assert.ok(provider, "provider not found");
      assert.strictEqual(provider.version, "^6.0.5");
      assert.strictEqual(provider.purpose, "Flutter/Dart dependency");

      const mockito = deps.find((d) => d.name === "mockito");
      assert.ok(mockito, "mockito not found");
      assert.strictEqual(mockito.version, "^5.4.2");
      assert.strictEqual(mockito.purpose, "Development dependency");
    });
  });

  describe("4. Go Dependency Extraction", () => {
    test("Extracts dependencies and direct/indirect tags from go.mod fixture", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/go/go.mod");
      const content = fs.readFileSync(filePath, "utf-8");

      const deps = parseGoModDependencies(content);
      assert.ok(deps.length >= 7, `Expected at least 7 deps, got ${deps.length}`);

      const gin = deps.find((d) => d.name === "github.com/gin-gonic/gin");
      assert.ok(gin, "gin not found");
      assert.strictEqual(gin.version, "v1.9.1");
      assert.strictEqual(gin.purpose, "Go dependency");

      const sonic = deps.find((d) => d.name === "github.com/bytedance/sonic");
      assert.ok(sonic, "sonic not found");
      assert.strictEqual(sonic.version, "v1.9.1");
      assert.strictEqual(sonic.purpose, "Go dependency (indirect)");
    });
  });

  describe("5. Java / Kotlin Dependency Extraction", () => {
    test("Extracts dependencies from Maven pom.xml fixture", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/java/pom.xml");
      const content = fs.readFileSync(filePath, "utf-8");

      const deps = parsePomXmlDependencies(content);
      assert.strictEqual(deps.length, 4);

      const web = deps.find((d) => d.name === "org.springframework.boot:spring-boot-starter-web");
      assert.ok(web, "spring-boot-starter-web not found");
      assert.strictEqual(web.version, "3.1.2");
      assert.strictEqual(web.purpose, "Java Maven dependency");

      const testDep = deps.find((d) => d.name === "org.springframework.boot:spring-boot-starter-test");
      assert.ok(testDep, "spring-boot-starter-test not found");
      assert.strictEqual(testDep.purpose, "Test dependency");
    });

    test("Extracts dependencies from Gradle build.gradle fixture", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/java/build.gradle");
      const content = fs.readFileSync(filePath, "utf-8");

      const deps = parseGradleDependencies(content);
      assert.strictEqual(deps.length, 4);

      const web = deps.find((d) => d.name === "org.springframework.boot:spring-boot-starter-web");
      assert.ok(web, "spring-boot-starter-web not found");
      assert.strictEqual(web.version, "3.1.2");
      assert.strictEqual(web.purpose, "Gradle dependency");

      const junit = deps.find((d) => d.name === "org.junit.jupiter:junit-jupiter");
      assert.ok(junit, "junit-jupiter not found");
      assert.strictEqual(junit.purpose, "Test dependency");
    });
  });

  describe("6. Rust Dependency Extraction", () => {
    test("Extracts dependencies from Cargo.toml content", () => {
      const content = `
        [package]
        name = "rust-service"
        version = "0.1.0"

        [dependencies]
        tokio = { version = "1.28", features = ["full"] }
        serde = "1.0"
        axum = "0.6"

        [dev-dependencies]
        criterion = "0.5"
      `;

      const deps = parseCargoTomlDependencies(content);
      assert.strictEqual(deps.length, 4);

      const tokio = deps.find((d) => d.name === "tokio");
      assert.ok(tokio);
      assert.strictEqual(tokio.version, "1.28");
      assert.strictEqual(tokio.purpose, "Rust Cargo dependency");

      const criterion = deps.find((d) => d.name === "criterion");
      assert.ok(criterion);
      assert.strictEqual(criterion.purpose, "Development dependency");
    });
  });

  describe("7. Universal Dispatcher & Fault Tolerance", () => {
    test("Routes to correct extractor based on relative path", () => {
      const reqDeps = parseManifestDependencies(
        "subproject/requirements.txt",
        "requests>=2.28.0\npytest==7.4.0"
      );
      assert.strictEqual(reqDeps.length, 2);

      const pubDeps = parseManifestDependencies(
        "mobile/pubspec.yaml",
        "dependencies:\n  flutter:\n    sdk: flutter\n  http: ^1.0.0"
      );
      assert.strictEqual(pubDeps.length, 2);
    });

    test("Gracefully handles corrupted or unparseable manifests without throwing", () => {
      assert.doesNotThrow(() => {
        const res1 = parseManifestDependencies("package.json", "{ broken json invalid ... ");
        assert.deepStrictEqual(res1, []);
      });

      assert.doesNotThrow(() => {
        const res2 = parseManifestDependencies("pom.xml", "<broken><unclosed>");
        assert.deepStrictEqual(res2, []);
      });

      assert.doesNotThrow(() => {
        const res3 = parseManifestDependencies("unknown.file", "some text");
        assert.deepStrictEqual(res3, []);
      });
    });
  });
});
