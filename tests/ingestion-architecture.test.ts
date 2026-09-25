import assert from "node:assert";
import { test, describe } from "node:test";
import { detectLanguage, UNKNOWN_LANGUAGE_INFO } from "../lib/server/ingestion/detector";
import { globalParserRegistry, analyzeSourceCode } from "../lib/server/ingestion/parser";
import { TypeScriptParser } from "../lib/server/ingestion/parsers/typescript";
import { PythonParser } from "../lib/server/ingestion/parsers/python";
import { UnsupportedLanguageParser } from "../lib/server/ingestion/parsers/unsupported";

describe("Language-Agnostic Ingestion Architecture Tests", () => {

  describe("1. Language Detection", () => {
    test("Detects required programming languages correctly", () => {
      assert.strictEqual(detectLanguage("src/index.ts").id, "typescript");
      assert.strictEqual(detectLanguage("components/App.tsx").id, "typescript");
      assert.strictEqual(detectLanguage("server.js").id, "javascript");
      assert.strictEqual(detectLanguage("utils.mjs").id, "javascript");
      assert.strictEqual(detectLanguage("app/main.py").id, "python");
      assert.strictEqual(detectLanguage("Main.java").id, "java");
      assert.strictEqual(detectLanguage("core.c").id, "c");
      assert.strictEqual(detectLanguage("header.h").id, "c");
      assert.strictEqual(detectLanguage("engine.cpp").id, "cpp");
      assert.strictEqual(detectLanguage("Program.cs").id, "csharp");
      assert.strictEqual(detectLanguage("main.go").id, "go");
      assert.strictEqual(detectLanguage("lib.rs").id, "rust");
      assert.strictEqual(detectLanguage("index.php").id, "php");
      assert.strictEqual(detectLanguage("app.rb").id, "ruby");
      assert.strictEqual(detectLanguage("App.kt").id, "kotlin");
      assert.strictEqual(detectLanguage("ViewController.swift").id, "swift");
    });

    test("Detects markup, config, and documentation types", () => {
      assert.strictEqual(detectLanguage("package.json").id, "json");
      assert.strictEqual(detectLanguage("config.yaml").id, "yaml");
      assert.strictEqual(detectLanguage("README.md").id, "markdown");
      assert.strictEqual(detectLanguage("index.html").id, "html");
      assert.strictEqual(detectLanguage("styles.css").id, "css");
      assert.strictEqual(detectLanguage("schema.sql").id, "sql");
    });

    test("Handles unknown extensions gracefully", () => {
      const unknownResult = detectLanguage("file.xyz");
      assert.strictEqual(unknownResult.id, "unknown");
      assert.strictEqual(unknownResult.isSupportedForParsing, false);
      assert.strictEqual(unknownResult.category, "other");

      const noExtResult = detectLanguage("Dockerfile");
      assert.strictEqual(noExtResult.id, "unknown");
      assert.strictEqual(noExtResult.isSupportedForParsing, false);
    });
  });

  describe("2. Parser Selection & Registry", () => {
    test("Selects TypeScriptParser for TypeScript and JavaScript files", () => {
      const tsInfo = detectLanguage("index.ts");
      const tsParser = globalParserRegistry.getParser(tsInfo);
      assert.ok(tsParser instanceof TypeScriptParser);
      assert.strictEqual(tsParser.languageId, "typescript");

      const jsInfo = detectLanguage("app.js");
      const jsParser = globalParserRegistry.getParser(jsInfo);
      assert.ok(jsParser instanceof TypeScriptParser);
    });

    test("Selects PythonParser for Python files", () => {
      const pyInfo = detectLanguage("script.py");
      const pyParser = globalParserRegistry.getParser(pyInfo);
      assert.ok(pyParser instanceof PythonParser);
      assert.strictEqual(pyParser.languageId, "python");
    });

    test("Selects UnsupportedLanguageParser for unsupported languages", () => {
      const rustInfo = detectLanguage("lib.rs");
      const rustParser = globalParserRegistry.getParser(rustInfo);
      assert.ok(rustParser instanceof UnsupportedLanguageParser);
      assert.strictEqual(rustParser.languageId, "unsupported");

      const csInfo = detectLanguage("Program.cs");
      const csParser = globalParserRegistry.getParser(csInfo);
      assert.ok(csParser instanceof UnsupportedLanguageParser);
    });

    test("Selects UnsupportedLanguageParser for unknown extensions", () => {
      const customInfo = detectLanguage("data.custom");
      const customParser = globalParserRegistry.getParser(customInfo);
      assert.ok(customParser instanceof UnsupportedLanguageParser);
    });
  });

  describe("3. Common Code Model & Parsing Validation", () => {
    test("Parses TypeScript source code into Common Code Model", () => {
      const code = `
        import { useState } from 'react';
        import axios from 'axios';

        export interface UserProfile { id: string; }
        export class UserService {}
        export function getUser() {}
      `;

      const result = analyzeSourceCode("services/user.ts", code);
      assert.strictEqual(result.languageInfo.id, "typescript");
      assert.strictEqual(result.parsedFileResult.parsingStatus, "PARSED");
      assert.ok(result.imports.includes("react"));
      assert.ok(result.imports.includes("axios"));
      assert.ok(result.exports.includes("UserProfile"));
      assert.ok(result.exports.includes("UserService"));
      assert.ok(result.exports.includes("getUser"));
      assert.strictEqual(result.parsedFileResult.classes[0].name, "UserService");
      assert.strictEqual(result.parsedFileResult.functions[0].name, "getUser");
    });

    test("Parses Python source code into Common Code Model", () => {
      const code = `
from django.db import models
import os

class UserModel(models.Model):
    pass

def calculate_stats(user_id):
    return {}
`;

      const result = analyzeSourceCode("app/models.py", code);
      assert.strictEqual(result.languageInfo.id, "python");
      assert.strictEqual(result.parsedFileResult.parsingStatus, "PARSED");
      assert.ok(result.imports.includes("django.db"));
      assert.ok(result.imports.includes("os"));
      assert.strictEqual(result.parsedFileResult.classes[0].name, "UserModel");
      assert.strictEqual(result.parsedFileResult.functions[0].name, "calculate_stats");
    });

    test("Handles unsupported languages gracefully without crashing", () => {
      const rbCode = `
class User
  attr_accessor :name
end
`;
      const result = analyzeSourceCode("app.rb", rbCode);
      assert.strictEqual(result.languageInfo.id, "ruby");
      assert.strictEqual(result.parsedFileResult.parsingStatus, "UNSUPPORTED");
      assert.strictEqual(result.parsedFileResult.imports.length, 0);
      assert.strictEqual(result.parsedFileResult.functions.length, 0);
      assert.ok(result.lineCount > 0);
    });

    test("Handles unknown extensions gracefully without crashing", () => {
      const unknownCode = "SOME_CUSTOM_CONFIG_DATA=123\nANOTHER_LINE=456";
      const result = analyzeSourceCode("settings.custom", unknownCode);
      assert.strictEqual(result.languageInfo.id, "unknown");
      assert.strictEqual(result.parsedFileResult.parsingStatus, "UNSUPPORTED");
      assert.strictEqual(result.lineCount, 2);
    });
  });

});
