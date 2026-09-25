import { LanguageInfo } from "../detector";
import { ParsedFileResult, CommonImport, CommonFunction, CommonClass, CommonTypeSymbol } from "../common-model";
import { LanguageParser, ParseInput } from "./types";

export class JavaParser implements LanguageParser {
  readonly languageId = "java";

  canParse(language: LanguageInfo): boolean {
    return language.id === "java";
  }

  parse(input: ParseInput): ParsedFileResult {
    const lines = input.content ? input.content.split("\n") : [];
    const lineCount = lines.length;

    const imports: CommonImport[] = [];
    const functions: CommonFunction[] = [];
    const classes: CommonClass[] = [];
    const types: CommonTypeSymbol[] = [];

    let currentClass: {
      name: string;
      baseClass?: string;
      interfaces?: string[];
      startLine: number;
      methods: CommonFunction[];
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;

      // 1. Imports
      const importMatch = trimmed.match(/^import\s+([a-zA-Z0-9_.]+);/);
      if (importMatch) {
        const source = importMatch[1];
        if (!imports.some((imp) => imp.source === source)) {
          imports.push({
            source,
            importType: "package",
            file: input.path,
            startLine: lineNum,
            endLine: lineNum,
          });
        }
        continue;
      }

      // 2. Classes & Interfaces
      const classMatch = trimmed.match(/(?:public|protected|private|static|\s)*class\s+([a-zA-Z0-9_]+)(?:\s+extends\s+([a-zA-Z0-9_]+))?(?:\s+implements\s+([a-zA-Z0-9_,\s]+))?/);
      if (classMatch) {
        if (currentClass) {
          classes.push({
            name: currentClass.name,
            file: input.path,
            baseClass: currentClass.baseClass,
            interfaces: currentClass.interfaces,
            startLine: currentClass.startLine,
            endLine: lineNum - 1,
            methods: currentClass.methods,
            language: input.language.name,
          });
        }

        const className = classMatch[1];
        const baseClass = classMatch[2] ? classMatch[2].trim() : undefined;
        const rawInterfaces = classMatch[3] ? classMatch[3].trim() : undefined;
        const interfaces = rawInterfaces ? rawInterfaces.split(",").map((s) => s.trim()) : undefined;

        currentClass = {
          name: className,
          baseClass,
          interfaces,
          startLine: lineNum,
          methods: [],
        };
        continue;
      }

      const interfaceMatch = trimmed.match(/(?:public|protected|private|\s)*interface\s+([a-zA-Z0-9_]+)/);
      if (interfaceMatch) {
        types.push({
          name: interfaceMatch[1],
          kind: "interface",
          file: input.path,
          startLine: lineNum,
          endLine: lineNum,
        });
        continue;
      }

      // 3. Methods & Functions
      const methodMatch = trimmed.match(/(?:public|protected|private|static|final|synchronized|\s)+([a-zA-Z0-9_<>\[\]]+)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:throws\s+[a-zA-Z0-9_,\s]+)?\s*\{/);
      if (methodMatch) {
        const returnType = methodMatch[1];
        const methodName = methodMatch[2];
        const rawParams = methodMatch[3];
        const parameters = rawParams ? rawParams.split(",").map((p) => p.trim()).filter(Boolean) : [];

        const funcObj: CommonFunction = {
          name: methodName,
          file: input.path,
          startLine: lineNum,
          endLine: lineNum,
          parameters,
          returnType,
          language: input.language.name,
        };

        if (currentClass) {
          funcObj.className = currentClass.name;
          currentClass.methods.push(funcObj);
        } else {
          functions.push(funcObj);
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
      types,
      functionsCount: functions.length,
    };
  }
}
