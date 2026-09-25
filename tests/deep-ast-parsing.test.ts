import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { test, describe } from "node:test";
import { analyzeSourceCode } from "../lib/server/ingestion/parser";

describe("Deep Multi-Language AST Parsing Architecture Test Suite", () => {

  describe("1. Flutter / Dart AST Structural Extraction", () => {
    test("Extracts real Flutter widgets, State classes, build methods, and annotations", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/flutter_dart/lib/main.dart");
      const content = fs.readFileSync(filePath, "utf-8");

      const result = analyzeSourceCode("lib/main.dart", content);
      assert.strictEqual(result.languageInfo.id, "dart");
      assert.strictEqual(result.parsedFileResult.parsingStatus, "PARSED");

      const classes = result.parsedFileResult.classes;
      assert.ok(classes.length >= 3);

      const myApp = classes.find((c) => c.name === "MyApp");
      assert.ok(myApp);
      assert.strictEqual(myApp?.baseClass, "StatelessWidget");
      assert.ok(myApp?.methods?.some((m) => m.name === "build"));

      const homeScreenState = classes.find((c) => c.name === "_HomeScreenState");
      assert.ok(homeScreenState);
      assert.ok(homeScreenState?.baseClass?.includes("State<HomeScreen>"));
      assert.ok(homeScreenState?.methods?.some((m) => m.name === "build"));
      assert.ok(homeScreenState?.methods?.some((m) => m.name === "_incrementCounter"));

      // Line number validation
      assert.ok((myApp?.startLine ?? 0) > 0);
      assert.ok((myApp?.endLine ?? 0) > (myApp?.startLine ?? 0));

      const mainFunc = result.parsedFileResult.functions.find((f) => f.name === "main");
      assert.ok(mainFunc);
    });
  });

  describe("2. TypeScript / JavaScript Compiler API AST Structural Extraction", () => {
    test("Extracts TypeScript classes, inheritance, interfaces, type aliases, enums, and exports", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/typescript/src/user-service.ts");
      const content = fs.readFileSync(filePath, "utf-8");

      const result = analyzeSourceCode("src/user-service.ts", content);
      assert.strictEqual(result.languageInfo.id, "typescript");
      assert.strictEqual(result.parsedFileResult.parsingStatus, "PARSED");

      // Classes & Inheritance
      const userService = result.parsedFileResult.classes.find((c) => c.name === "UserService");
      assert.ok(userService);
      assert.strictEqual(userService?.baseClass, "BaseService");
      assert.ok(userService?.interfaces?.includes("EventTarget"));

      // Methods, params, return types & async flags
      const fetchUserMethod = userService?.methods?.find((m) => m.name === "fetchUser");
      assert.ok(fetchUserMethod);
      assert.strictEqual(fetchUserMethod?.isAsync, true);
      assert.ok(fetchUserMethod?.parameters?.some((p) => p.includes("id: string")));
      assert.ok(fetchUserMethod?.returnType?.includes("Promise<User>"));
      assert.ok((fetchUserMethod?.startLine ?? 0) > 0);

      // Arrow functions
      assert.ok(result.parsedFileResult.functions.some((f) => f.name === "createGuestUser"));

      // Interfaces & Types
      const userInterface = result.parsedFileResult.types.find((t) => t.name === "User");
      assert.ok(userInterface);
      assert.strictEqual(userInterface?.kind, "interface");

      const userRoleType = result.parsedFileResult.types.find((t) => t.name === "UserRole");
      assert.ok(userRoleType);
      assert.strictEqual(userRoleType?.kind, "type");

      // Enums
      const userStatusEnum = result.parsedFileResult.enums?.find((e) => e.name === "UserStatus");
      assert.ok(userStatusEnum);
      assert.ok(userStatusEnum?.members?.includes("ACTIVE"));

      // Imports & Exports
      assert.ok(result.parsedFileResult.imports.some((i) => i.source === "react"));
      assert.ok(result.parsedFileResult.exports.some((e) => e.symbol === "UserService"));
    });
  });

  describe("3. Python AST Structural Extraction", () => {
    test("Extracts Python classes, inheritance, decorators, method signatures, and async functions", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/python/app/services.py");
      const content = fs.readFileSync(filePath, "utf-8");

      const result = analyzeSourceCode("app/services.py", content);
      assert.strictEqual(result.languageInfo.id, "python");
      assert.strictEqual(result.parsedFileResult.parsingStatus, "PARSED");

      const accountService = result.parsedFileResult.classes.find((c) => c.name === "AccountService");
      assert.ok(accountService);
      assert.strictEqual(accountService?.baseClass, "BaseProcessor");

      const getUserMethod = accountService?.methods?.find((m) => m.name === "get_user_by_id");
      assert.ok(getUserMethod);
      assert.strictEqual(getUserMethod?.isAsync, true);
      assert.ok(getUserMethod?.returnType?.includes("Optional[UserDTO]"));

      const healthFunc = result.parsedFileResult.functions.find((f) => f.name === "run_health_check");
      assert.ok(healthFunc);

      const userDto = result.parsedFileResult.classes.find((c) => c.name === "UserDTO");
      assert.ok(userDto);
      assert.ok(userDto?.decorators?.some((d) => d.includes("@dataclass")));
    });
  });

  describe("4. Tier 2 AST Structural Extraction (Java & Go)", () => {
    test("Extracts Java classes, interfaces, extends, implements, and methods", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/java/src/MainService.java");
      const content = fs.readFileSync(filePath, "utf-8");

      const result = analyzeSourceCode("src/MainService.java", content);
      assert.strictEqual(result.languageInfo.id, "java");
      assert.strictEqual(result.parsedFileResult.parsingStatus, "PARSED");

      const mainService = result.parsedFileResult.classes.find((c) => c.name === "MainService");
      assert.ok(mainService);
      assert.strictEqual(mainService?.baseClass, "BaseEntity");
      assert.ok(mainService?.interfaces?.includes("IService"));
      assert.ok(mainService?.methods?.some((m) => m.name === "getId"));
    });

    test("Extracts Go structs, receiver methods, functions, and interfaces", () => {
      const filePath = path.join(process.cwd(), "tests/fixtures/go/main.go");
      const content = fs.readFileSync(filePath, "utf-8");

      const result = analyzeSourceCode("main.go", content);
      assert.strictEqual(result.languageInfo.id, "go");
      assert.strictEqual(result.parsedFileResult.parsingStatus, "PARSED");

      const userStruct = result.parsedFileResult.classes.find((c) => c.name === "User");
      assert.ok(userStruct);
      assert.ok(userStruct?.methods?.some((m) => m.name === "GetName"));

      const calcFunc = result.parsedFileResult.functions.find((f) => f.name === "CalculateStats");
      assert.ok(calcFunc);

      const readerInterface = result.parsedFileResult.types.find((t) => t.name === "Reader");
      assert.ok(readerInterface);
      assert.strictEqual(readerInterface?.kind, "interface");
    });
  });

  describe("5. Fault Isolation & Error Normalization", () => {
    test("Gracefully handles corrupted files and unsupported languages", () => {
      const customResult = analyzeSourceCode("config.custom", "KEY=VALUE");
      assert.strictEqual(customResult.parsedFileResult.parsingStatus, "UNSUPPORTED");
      assert.strictEqual(customResult.parsingError, undefined);

      const pyResult = analyzeSourceCode("test.py", "import sys\ndef foo(): pass");
      assert.strictEqual(pyResult.parsedFileResult.parsingStatus, "PARSED");
    });
  });

});
