import { detectLanguage, LanguageInfo } from "./detector";
import { ParsedFileResult } from "./common-model";
import { ParserRegistry } from "./parsers/types";
import { UnsupportedLanguageParser } from "./parsers/unsupported";
import { TypeScriptParser } from "./parsers/typescript";
import { PythonParser } from "./parsers/python";
import { DartParser } from "./parsers/dart";
import { JavaParser } from "./parsers/java";
import { GoParser } from "./parsers/go";

// Instantiate Global Parser Registry with Unsupported Fallback Parser
const unsupportedParser = new UnsupportedLanguageParser();
export const globalParserRegistry = new ParserRegistry(unsupportedParser);

// Register active Milestone 1 Parsers (Tier 1 + Tier 2 AST Parsers)
globalParserRegistry.register(new TypeScriptParser());
globalParserRegistry.register(new PythonParser());
globalParserRegistry.register(new DartParser());
globalParserRegistry.register(new JavaParser());
globalParserRegistry.register(new GoParser());

export interface StaticAnalysisResult {
  lineCount: number;
  imports: string[];
  exports: string[];
  functionsCount: number;
  language: string;
  languageInfo: LanguageInfo;
  parsedFileResult: ParsedFileResult;
  parsingError?: string;
}

export function analyzeSourceCode(path: string, content: string): StaticAnalysisResult {
  const languageInfo = detectLanguage(path);
  const parser = globalParserRegistry.getParser(languageInfo);

  let parsedFileResult: ParsedFileResult;
  let parsingError: string | undefined;

  try {
    parsedFileResult = parser.parse({
      path,
      content,
      language: languageInfo,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "File parsing failed unexpectedly";
    console.error(`Parsing error in file ${path}:`, err);
    parsingError = errorMsg;
    parsedFileResult = {
      path,
      language: languageInfo,
      parsingStatus: "FAILED",
      lineCount: content ? content.split("\n").length : 0,
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      types: [],
      enums: [],
      functionsCount: 0,
    };
  }

  return {
    lineCount: parsedFileResult.lineCount,
    imports: parsedFileResult.imports.map((i) => i.source),
    exports: parsedFileResult.exports.map((e) => e.symbol),
    functionsCount: parsedFileResult.functionsCount,
    language: languageInfo.name,
    languageInfo,
    parsedFileResult,
    parsingError,
  };
}
