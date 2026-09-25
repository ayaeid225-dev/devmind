import { LanguageInfo } from "../detector";
import { ParsedFileResult, CommonImport, CommonFunction, CommonClass } from "../common-model";
import { LanguageParser, ParseInput } from "./types";

export class PythonParser implements LanguageParser {
  readonly languageId = "python";

  canParse(language: LanguageInfo): boolean {
    return language.id === "python";
  }

  parse(input: ParseInput): ParsedFileResult {
    const lines = input.content ? input.content.split("\n") : [];
    const lineCount = lines.length;

    const imports: CommonImport[] = [];
    const functions: CommonFunction[] = [];
    const classes: CommonClass[] = [];

    let currentClass: { name: string; baseClass?: string; startLine: number; methods: CommonFunction[]; decorators: string[] } | null = null;
    let currentClassIndent = 0;
    let pendingDecorators: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) continue;

      const indent = line.search(/\S/);

      // Collect decorators
      if (trimmed.startsWith("@")) {
        pendingDecorators.push(trimmed);
        continue;
      }

      // Check if we exited current class body
      if (currentClass && indent <= currentClassIndent && !trimmed.startsWith("def") && !trimmed.startsWith("class")) {
        classes.push({
          name: currentClass.name,
          file: input.path,
          baseClass: currentClass.baseClass,
          startLine: currentClass.startLine,
          endLine: Math.max(currentClass.startLine, lineNum - 1),
          methods: currentClass.methods,
          decorators: currentClass.decorators.length > 0 ? currentClass.decorators : undefined,
          language: input.language.name,
        });
        currentClass = null;
      }

      // 1. Imports
      const fromImportMatch = trimmed.match(/^from\s+([a-zA-Z0-9_.]+)\s+import\s+(.+)$/);
      if (fromImportMatch) {
        const source = fromImportMatch[1];
        const symbols = fromImportMatch[2].split(",").map((s) => s.trim().split(" ")[0]);
        if (!imports.some((imp) => imp.source === source)) {
          imports.push({
            source,
            importedSymbols: symbols,
            importType: "from",
            file: input.path,
            startLine: lineNum,
            endLine: lineNum,
          });
        }
        pendingDecorators = [];
        continue;
      }

      const importMatch = trimmed.match(/^import\s+([a-zA-Z0-9_.]+)/);
      if (importMatch) {
        const source = importMatch[1];
        if (!imports.some((imp) => imp.source === source)) {
          imports.push({
            source,
            importType: "direct",
            file: input.path,
            startLine: lineNum,
            endLine: lineNum,
          });
        }
        pendingDecorators = [];
        continue;
      }

      // 2. Class Definitions
      const classMatch = trimmed.match(/^class\s+([a-zA-Z0-9_]+)(?:\(([^)]+)\))?:/);
      if (classMatch) {
        if (currentClass) {
          classes.push({
            name: currentClass.name,
            file: input.path,
            baseClass: currentClass.baseClass,
            startLine: currentClass.startLine,
            endLine: lineNum - 1,
            methods: currentClass.methods,
            decorators: currentClass.decorators.length > 0 ? currentClass.decorators : undefined,
            language: input.language.name,
          });
        }

        const className = classMatch[1];
        const baseClass = classMatch[2] ? classMatch[2].trim() : undefined;
        currentClass = {
          name: className,
          baseClass,
          startLine: lineNum,
          methods: [],
          decorators: [...pendingDecorators],
        };
        currentClassIndent = indent;
        pendingDecorators = [];
        continue;
      }

      // 3. Function & Method Definitions
      const funcMatch = trimmed.match(/^(async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
      if (funcMatch) {
        const isAsync = Boolean(funcMatch[1]);
        const funcName = funcMatch[2];
        const rawParams = funcMatch[3];
        const returnType = funcMatch[4] ? funcMatch[4].trim() : undefined;
        const parameters = rawParams ? rawParams.split(",").map((p) => p.trim()).filter(Boolean) : [];

        // Estimate end line of function body
        let endLine = lineNum;
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (!nextLine.trim() || nextLine.trim().startsWith("#")) continue;
          const nextIndent = nextLine.search(/\S/);
          if (nextIndent <= indent) break;
          endLine = j + 1;
        }

        const funcObj: CommonFunction = {
          name: funcName,
          file: input.path,
          startLine: lineNum,
          endLine,
          parameters,
          returnType,
          isAsync,
          language: input.language.name,
        };

        if (currentClass && indent > currentClassIndent) {
          funcObj.className = currentClass.name;
          currentClass.methods.push(funcObj);
        } else {
          functions.push(funcObj);
        }
        pendingDecorators = [];
      }
    }

    if (currentClass) {
      classes.push({
        name: currentClass.name,
        file: input.path,
        baseClass: currentClass.baseClass,
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
