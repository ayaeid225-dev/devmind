import assert from "node:assert";
import { test, describe } from "node:test";
import { detectLanguage } from "../lib/server/ingestion/detector";
import { globalParserRegistry, analyzeSourceCode } from "../lib/server/ingestion/parser";
import { DartParser } from "../lib/server/ingestion/parsers/dart";

describe("Task 2 — Universal File Understanding Test Suite", () => {

  describe("1. Flutter / Dart Language & Parser Support", () => {
    test("Detects Dart extension (.dart) correctly", () => {
      const lang = detectLanguage("lib/main.dart");
      assert.strictEqual(lang.id, "dart");
      assert.strictEqual(lang.name, "Dart");
      assert.strictEqual(lang.isSupportedForParsing, true);
    });

    test("Selects DartParser for .dart files", () => {
      const lang = detectLanguage("lib/screens/home.dart");
      const parser = globalParserRegistry.getParser(lang);
      assert.ok(parser instanceof DartParser);
      assert.strictEqual(parser.languageId, "dart");
    });

    test("Parses Flutter/Dart application code into Common Code Model", () => {
      const flutterCode = `
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'src/services/api_service.dart';

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(home: HomeScreen());
  }
}

class HomeScreen extends StatefulWidget {
  @override
  _HomeScreenState createState() => _HomeScreenState();
}

void main() {
  runApp(MyApp());
}
`;

      const result = analyzeSourceCode("lib/main.dart", flutterCode);
      assert.strictEqual(result.languageInfo.id, "dart");
      assert.strictEqual(result.parsedFileResult.parsingStatus, "PARSED");
      assert.ok(result.imports.includes("package:flutter/material.dart"));
      assert.ok(result.imports.includes("package:http/http.dart"));
      assert.ok(result.imports.includes("src/services/api_service.dart"));
      assert.strictEqual(result.parsedFileResult.classes.length, 2);
      assert.strictEqual(result.parsedFileResult.classes[0].name, "MyApp");
      assert.strictEqual(result.parsedFileResult.classes[1].name, "HomeScreen");
      assert.ok(result.parsedFileResult.functions.some((f) => f.name === "main"));
    });
  });

  describe("2. Multi-Language Repository Ingestion Simulation", () => {
    test("Ingests repository files across TypeScript, Python, Dart, Go, C#, Rust, and Custom extensions", () => {
      const repoFiles = [
        { path: "src/app.ts", content: "import express from 'express'; export const app = express();" },
        { path: "backend/main.py", content: "import os\ndef main(): pass" },
        { path: "mobile/lib/main.dart", content: "import 'package:flutter/material.dart'; class App {} void main() {}" },
        { path: "services/server.go", content: "package main\nfunc main() {}" },
        { path: "native/engine.rs", content: "fn main() {}" },
        { path: "api/Controller.cs", content: "namespace Api { public class Controller {} }" },
        { path: "config/settings.custom", content: "KEY=VALUE" },
      ];

      const processedResults = repoFiles.map((f) => analyzeSourceCode(f.path, f.content));

      assert.strictEqual(processedResults.length, 7);

      // TypeScript
      assert.strictEqual(processedResults[0].languageInfo.id, "typescript");
      assert.strictEqual(processedResults[0].parsedFileResult.parsingStatus, "PARSED");

      // Python
      assert.strictEqual(processedResults[1].languageInfo.id, "python");
      assert.strictEqual(processedResults[1].parsedFileResult.parsingStatus, "PARSED");

      // Dart
      assert.strictEqual(processedResults[2].languageInfo.id, "dart");
      assert.strictEqual(processedResults[2].parsedFileResult.parsingStatus, "PARSED");

      // Go (Deeply parsed via GoParser)
      assert.strictEqual(processedResults[3].languageInfo.id, "go");
      assert.strictEqual(processedResults[3].parsedFileResult.parsingStatus, "PARSED");

      // Rust (Ingested safely as UNSUPPORTED)
      assert.strictEqual(processedResults[4].languageInfo.id, "rust");
      assert.strictEqual(processedResults[4].parsedFileResult.parsingStatus, "UNSUPPORTED");

      // C# (Ingested safely as UNSUPPORTED)
      assert.strictEqual(processedResults[5].languageInfo.id, "csharp");
      assert.strictEqual(processedResults[5].parsedFileResult.parsingStatus, "UNSUPPORTED");

      // Custom file (Ingested safely as UNSUPPORTED)
      assert.strictEqual(processedResults[6].languageInfo.id, "unknown");
      assert.strictEqual(processedResults[6].parsedFileResult.parsingStatus, "UNSUPPORTED");
    });
  });

  describe("3. Parsing Failure Recovery & Repository Continuation", () => {
    test("Gracefully marks corrupted/failing file as FAILED without stopping repository ingestion", () => {
      // Mock parser that throws an unexpected error on a specific file
      const originalParser = globalParserRegistry.getParser(detectLanguage("buggy.ts"));

      // Call analyzeSourceCode on normal file
      const goodResult = analyzeSourceCode("src/good.ts", "export const x = 1;");
      assert.strictEqual(goodResult.parsedFileResult.parsingStatus, "PARSED");
      assert.strictEqual(goodResult.parsingError, undefined);

      // Simulate a throwing parser scenario
      const mockThrowingParser = {
        languageId: "typescript",
        canParse: () => true,
        parse: () => {
          throw new Error("Syntax error: Unexpected token at offset 42");
        },
      };

      globalParserRegistry.register(mockThrowingParser);

      const failedResult = analyzeSourceCode("src/corrupted.ts", "export const = ;");
      assert.strictEqual(failedResult.parsedFileResult.parsingStatus, "FAILED");
      assert.strictEqual(failedResult.parsingError, "Syntax error: Unexpected token at offset 42");

      // Restore original parser
      globalParserRegistry.register(originalParser);

      // Verify repository processing continues for subsequent files
      const nextResult = analyzeSourceCode("src/after_failure.ts", "export const y = 2;");
      assert.strictEqual(nextResult.parsedFileResult.parsingStatus, "PARSED");
    });
  });

});
