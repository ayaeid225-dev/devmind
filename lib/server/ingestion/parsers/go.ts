import { LanguageInfo } from "../detector";
import { ParsedFileResult, CommonImport, CommonFunction, CommonClass, CommonTypeSymbol } from "../common-model";
import { LanguageParser, ParseInput } from "./types";

export class GoParser implements LanguageParser {
  readonly languageId = "go";

  canParse(language: LanguageInfo): boolean {
    return language.id === "go";
  }

  parse(input: ParseInput): ParsedFileResult {
    const lines = input.content ? input.content.split("\n") : [];
    const lineCount = lines.length;

    const imports: CommonImport[] = [];
    const functions: CommonFunction[] = [];
    const classes: CommonClass[] = [];
    const types: CommonTypeSymbol[] = [];

    const structMap = new Map<string, CommonClass>();
    let inImportBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("//")) continue;

      // 1. Imports
      if (trimmed === "import (" || trimmed.startsWith("import (")) {
        inImportBlock = true;
        continue;
      }
      if (inImportBlock) {
        if (trimmed === ")") {
          inImportBlock = false;
          continue;
        }
        const blockImportMatch = trimmed.match(/(?:[a-zA-Z0-9_.]+\s+)?["']([^"']+)["']/);
        if (blockImportMatch) {
          const source = blockImportMatch[1];
          if (!imports.some((imp) => imp.source === source)) {
            imports.push({
              source,
              importType: "package",
              file: input.path,
              startLine: lineNum,
              endLine: lineNum,
            });
          }
        }
        continue;
      }

      const importSingle = trimmed.match(/^import\s+["']([^"']+)["']/);
      if (importSingle) {
        const source = importSingle[1];
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

      // 2. Structs & Interfaces
      const structMatch = trimmed.match(/^type\s+([a-zA-Z0-9_]+)\s+struct\s*\{/);
      if (structMatch) {
        const structName = structMatch[1];
        const structClass: CommonClass = {
          name: structName,
          file: input.path,
          startLine: lineNum,
          endLine: lineNum,
          methods: [],
          language: input.language.name,
        };
        classes.push(structClass);
        structMap.set(structName, structClass);
        types.push({
          name: structName,
          kind: "struct",
          file: input.path,
          startLine: lineNum,
          endLine: lineNum,
        });
        continue;
      }

      const interfaceMatch = trimmed.match(/^type\s+([a-zA-Z0-9_]+)\s+interface\s*\{/);
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

      // 3. Go Functions & Receiver Methods
      // Receiver Method: func (u *User) GetName(param type) string {
      const receiverMatch = trimmed.match(/^func\s+\(\s*([a-zA-Z0-9_]+)\s+\*?([a-zA-Z0-9_]+)\s*\)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(.*)\{/);
      if (receiverMatch) {
        const receiverType = receiverMatch[2];
        const methodName = receiverMatch[3];
        const rawParams = receiverMatch[4];
        const returnType = receiverMatch[5] ? receiverMatch[5].trim() : undefined;
        const parameters = rawParams ? rawParams.split(",").map((p) => p.trim()).filter(Boolean) : [];

        const methodObj: CommonFunction = {
          name: methodName,
          className: receiverType,
          file: input.path,
          startLine: lineNum,
          endLine: lineNum,
          parameters,
          returnType,
          language: input.language.name,
        };

        const targetStruct = structMap.get(receiverType);
        if (targetStruct) {
          targetStruct.methods = targetStruct.methods || [];
          targetStruct.methods.push(methodObj);
        } else {
          functions.push(methodObj);
        }
        continue;
      }

      // Standalone Function: func Calculate(a int) int {
      const funcMatch = trimmed.match(/^func\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(.*)\{/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const rawParams = funcMatch[2];
        const returnType = funcMatch[3] ? funcMatch[3].trim() : undefined;
        const parameters = rawParams ? rawParams.split(",").map((p) => p.trim()).filter(Boolean) : [];

        functions.push({
          name: funcName,
          file: input.path,
          startLine: lineNum,
          endLine: lineNum,
          parameters,
          returnType,
          language: input.language.name,
        });
      }
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
