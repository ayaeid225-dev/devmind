import ts from "typescript";
import { LanguageInfo } from "../detector";
import { ParsedFileResult, CommonImport, CommonExport, CommonFunction, CommonClass, CommonTypeSymbol, CommonEnum } from "../common-model";
import { LanguageParser, ParseInput } from "./types";

export class TypeScriptParser implements LanguageParser {
  readonly languageId = "typescript";

  canParse(language: LanguageInfo): boolean {
    return language.id === "typescript" || language.id === "javascript";
  }

  parse(input: ParseInput): ParsedFileResult {
    const content = input.content || "";
    const isJs = input.language.id === "javascript";

    const scriptKind = input.path.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : input.path.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : isJs
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;

    const sourceFile = ts.createSourceFile(input.path, content, ts.ScriptTarget.Latest, true, scriptKind);

    const imports: CommonImport[] = [];
    const exports: CommonExport[] = [];
    const functions: CommonFunction[] = [];
    const classes: CommonClass[] = [];
    const types: CommonTypeSymbol[] = [];
    const enums: CommonEnum[] = [];

    const getLineAndPos = (pos: number) => {
      const { line } = sourceFile.getLineAndCharacterOfPosition(pos);
      return line + 1; // 1-indexed line number
    };

    const visit = (node: ts.Node) => {
      // 1. Import Declarations
      if (ts.isImportDeclaration(node)) {
        const source = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, "");
        const importedSymbols: string[] = [];
        let importType = "relative";

        if (node.importClause) {
          if (node.importClause.name) {
            importedSymbols.push(node.importClause.name.getText(sourceFile));
            importType = "default";
          }
          if (node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              node.importClause.namedBindings.elements.forEach((el) => {
                importedSymbols.push(el.name.getText(sourceFile));
              });
              importType = "named";
            } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              importedSymbols.push(node.importClause.namedBindings.name.getText(sourceFile));
              importType = "namespace";
            }
          }
        }

        if (!imports.some((i) => i.source === source)) {
          imports.push({
            source,
            importedSymbols,
            importType,
            file: input.path,
            startLine: getLineAndPos(node.getStart(sourceFile)),
            endLine: getLineAndPos(node.getEnd()),
          });
        }
      }

      // 2. Class Declarations
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.getText(sourceFile);
        let baseClass: string | undefined;
        const interfaces: string[] = [];
        const methods: CommonFunction[] = [];

        if (node.heritageClauses) {
          for (const heritage of node.heritageClauses) {
            if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
              baseClass = heritage.types[0]?.expression.getText(sourceFile);
            } else if (heritage.token === ts.SyntaxKind.ImplementsKeyword) {
              heritage.types.forEach((t) => interfaces.push(t.expression.getText(sourceFile)));
            }
          }
        }

        node.members.forEach((member) => {
          if (ts.isMethodDeclaration(member) && member.name) {
            const methodName = member.name.getText(sourceFile);
            const isAsync = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
            const params = member.parameters.map((p) => p.getText(sourceFile));
            const returnType = member.type?.getText(sourceFile);

            methods.push({
              name: methodName,
              className,
              file: input.path,
              startLine: getLineAndPos(member.getStart(sourceFile)),
              endLine: getLineAndPos(member.getEnd()),
              parameters: params,
              returnType,
              isAsync: Boolean(isAsync),
              language: input.language.name,
            });
          }
        });

        if (!classes.some((c) => c.name === className)) {
          classes.push({
            name: className,
            file: input.path,
            baseClass,
            interfaces: interfaces.length > 0 ? interfaces : undefined,
            startLine: getLineAndPos(node.getStart(sourceFile)),
            endLine: getLineAndPos(node.getEnd()),
            methods,
            language: input.language.name,
          });
        }
      }

      // 3. Functions & Arrow Functions
      if (ts.isFunctionDeclaration(node) && node.name) {
        const funcName = node.name.getText(sourceFile);
        const isAsync = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
        const params = node.parameters.map((p) => p.getText(sourceFile));
        const returnType = node.type?.getText(sourceFile);

        if (!functions.some((f) => f.name === funcName)) {
          functions.push({
            name: funcName,
            file: input.path,
            startLine: getLineAndPos(node.getStart(sourceFile)),
            endLine: getLineAndPos(node.getEnd()),
            parameters: params,
            returnType,
            isAsync: Boolean(isAsync),
            language: input.language.name,
          });
        }
      }

      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((decl) => {
          if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
            const funcName = decl.name.getText(sourceFile);
            const funcExpr = decl.initializer;
            const isAsync = funcExpr.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
            const params = funcExpr.parameters.map((p) => p.getText(sourceFile));
            const returnType = funcExpr.type?.getText(sourceFile);

            if (!functions.some((f) => f.name === funcName)) {
              functions.push({
                name: funcName,
                file: input.path,
                startLine: getLineAndPos(node.getStart(sourceFile)),
                endLine: getLineAndPos(node.getEnd()),
                parameters: params,
                returnType,
                isAsync: Boolean(isAsync),
                language: input.language.name,
              });
            }
          }
        });
      }

      // 4. Interfaces & Types
      if (ts.isInterfaceDeclaration(node)) {
        const interfaceName = node.name.getText(sourceFile);
        if (!types.some((t) => t.name === interfaceName)) {
          types.push({
            name: interfaceName,
            kind: "interface",
            file: input.path,
            startLine: getLineAndPos(node.getStart(sourceFile)),
            endLine: getLineAndPos(node.getEnd()),
          });
        }
      }

      if (ts.isTypeAliasDeclaration(node)) {
        const typeName = node.name.getText(sourceFile);
        if (!types.some((t) => t.name === typeName)) {
          types.push({
            name: typeName,
            kind: "type",
            file: input.path,
            startLine: getLineAndPos(node.getStart(sourceFile)),
            endLine: getLineAndPos(node.getEnd()),
          });
        }
      }

      // 5. Enums
      if (ts.isEnumDeclaration(node)) {
        const enumName = node.name.getText(sourceFile);
        const members = node.members.map((m) => m.name.getText(sourceFile));
        if (!enums.some((e) => e.name === enumName)) {
          enums.push({
            name: enumName,
            members,
            file: input.path,
            startLine: getLineAndPos(node.getStart(sourceFile)),
            endLine: getLineAndPos(node.getEnd()),
          });
        }
      }

      // 6. Exports
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

      if (isExported) {
        let symbol = "";
        let kind = "symbol";
        if (ts.isFunctionDeclaration(node) && node.name) {
          symbol = node.name.getText(sourceFile);
          kind = "function";
        } else if (ts.isClassDeclaration(node) && node.name) {
          symbol = node.name.getText(sourceFile);
          kind = "class";
        } else if (ts.isInterfaceDeclaration(node)) {
          symbol = node.name.getText(sourceFile);
          kind = "interface";
        } else if (ts.isTypeAliasDeclaration(node)) {
          symbol = node.name.getText(sourceFile);
          kind = "type";
        } else if (ts.isEnumDeclaration(node)) {
          symbol = node.name.getText(sourceFile);
          kind = "enum";
        } else if (ts.isVariableStatement(node)) {
          node.declarationList.declarations.forEach((d) => {
            symbol = d.name.getText(sourceFile);
            kind = "variable";
          });
        }

        if (symbol && !exports.some((e) => e.symbol === symbol)) {
          exports.push({
            symbol,
            kind,
            file: input.path,
            startLine: getLineAndPos(node.getStart(sourceFile)),
            endLine: getLineAndPos(node.getEnd()),
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);

    const lineCount = sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line + 1;

    return {
      path: input.path,
      language: input.language,
      parsingStatus: "PARSED",
      lineCount,
      imports,
      exports,
      functions,
      classes,
      types,
      enums,
      functionsCount: functions.length,
    };
  }
}
