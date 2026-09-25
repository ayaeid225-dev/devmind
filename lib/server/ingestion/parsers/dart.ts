import { LanguageInfo } from "../detector";
import { ParsedFileResult, CommonImport, CommonFunction, CommonClass } from "../common-model";
import { LanguageParser, ParseInput } from "./types";

export class DartParser implements LanguageParser {
  readonly languageId = "dart";

  canParse(language: LanguageInfo): boolean {
    return language.id === "dart";
  }

  parse(input: ParseInput): ParsedFileResult {
    const lines = input.content ? input.content.split("\n") : [];
    const lineCount = lines.length;

    const imports: CommonImport[] = [];
    const functions: CommonFunction[] = [];
    const classes: CommonClass[] = [];

    let currentClass: {
      name: string;
      baseClass?: string;
      interfaces?: string[];
      startLine: number;
      methods: CommonFunction[];
      decorators: string[];
    } | null = null;

    let inClassScope = false;
    let classBraceDepth = 0;
    let pendingDecorators: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("//")) continue;

      // 1. Imports
      const importMatch = trimmed.match(/^import\s+['"]([^'"]+)['"]/);
      if (importMatch && !inClassScope) {
        const source = importMatch[1];
        const importType = source.startsWith("package:") ? "package" : "relative";
        if (!imports.some((imp) => imp.source === source)) {
          imports.push({
            source,
            importType,
            file: input.path,
            startLine: lineNum,
            endLine: lineNum,
          });
        }
        pendingDecorators = [];
        continue;
      }

      // Collect annotations like @override or @deprecated
      if (trimmed.startsWith("@")) {
        pendingDecorators.push(trimmed.split(" ")[0]);
        continue;
      }

      // 2. Class definitions (handling extends, with, implements cleanly)
      if (trimmed.startsWith("class ") && !inClassScope) {
        const classNameMatch = trimmed.match(/^class\s+([a-zA-Z0-9_$]+)/);
        if (classNameMatch) {
          const className = classNameMatch[1];
          let baseClass: string | undefined;
          let interfaces: string[] | undefined;

          const extendsMatch = trimmed.match(/extends\s+([a-zA-Z0-9_$<>\s]+?)(?=\s+with|\s+implements|\s*\{|$)/);
          if (extendsMatch) {
            baseClass = extendsMatch[1].trim();
          }

          const implementsMatch = trimmed.match(/implements\s+([a-zA-Z0-9_$<>\s,]+?)(?=\s*\{|$)/);
          if (implementsMatch) {
            interfaces = implementsMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
          }

          const openBraces = (line.match(/\{/g) || []).length;
          const closeBraces = (line.match(/\}/g) || []).length;

          currentClass = {
            name: className,
            baseClass,
            interfaces,
            startLine: lineNum,
            methods: [],
            decorators: [...pendingDecorators],
          };
          inClassScope = true;
          classBraceDepth = openBraces - closeBraces;
          pendingDecorators = [];
          continue;
        }
      }

      // In class scope: track brace depth
      if (currentClass && inClassScope) {
        // 3. Method Declarations inside class
        const funcMatch = trimmed.match(/^(?:([a-zA-Z0-9_$<>]+)\s+)?([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*(?:async\s*)?(?:=>|\{)/);
        if (funcMatch) {
          const returnType = funcMatch[1];
          const funcName = funcMatch[2];
          const rawParams = funcMatch[3];
          const parameters = rawParams ? rawParams.split(",").map((p) => p.trim()).filter(Boolean) : [];

          if (funcName && !["if", "for", "while", "switch", "catch", "else", "return", "setState"].includes(funcName)) {
            currentClass.methods.push({
              name: funcName,
              className: currentClass.name,
              file: input.path,
              startLine: lineNum,
              endLine: lineNum,
              parameters,
              returnType,
              isAsync: line.includes("async"),
              language: input.language.name,
            });
            pendingDecorators = [];
          }
        }

        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        classBraceDepth += openBraces - closeBraces;

        if (classBraceDepth <= 0) {
          classes.push({
            name: currentClass.name,
            file: input.path,
            baseClass: currentClass.baseClass,
            interfaces: currentClass.interfaces,
            startLine: currentClass.startLine,
            endLine: lineNum,
            methods: currentClass.methods,
            decorators: currentClass.decorators.length > 0 ? currentClass.decorators : undefined,
            language: input.language.name,
          });
          currentClass = null;
          inClassScope = false;
          classBraceDepth = 0;
          pendingDecorators = [];
        }
        continue;
      }

      // 4. Standalone Function Declarations
      const funcMatch = trimmed.match(/^(?:([a-zA-Z0-9_$<>]+)\s+)?([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*(?:async\s*)?(?:=>|\{)/);
      if (funcMatch) {
        const returnType = funcMatch[1];
        const funcName = funcMatch[2];
        const rawParams = funcMatch[3];
        const parameters = rawParams ? rawParams.split(",").map((p) => p.trim()).filter(Boolean) : [];

        if (funcName && !["if", "for", "while", "switch", "catch", "else", "return"].includes(funcName)) {
          functions.push({
            name: funcName,
            file: input.path,
            startLine: lineNum,
            endLine: lineNum,
            parameters,
            returnType,
            isAsync: line.includes("async"),
            language: input.language.name,
          });
          pendingDecorators = [];
        }
      }
    }

    if (currentClass) {
      classes.push({
        name: currentClass.name,
        file: input.path,
        baseClass: currentClass.baseClass,
        interfaces: currentClass.interfaces,
        startLine: currentClass.startLine,
        endLine: lines.length,
        methods: currentClass.methods,
        decorators: currentClass.decorators.length > 0 ? currentClass.decorators : undefined,
        language: input.language.name,
      });
    }

    return {
      path: input.path,
      language: input.language,
      parsingStatus: "PARSED",
      lineCount,
      imports,
      exports: [],
      functions,
      classes,
      types: [],
      functionsCount: functions.length,
    };
  }
}
