import { LanguageInfo } from "./detector";

export interface CommonFunction {
  name: string;
  file: string;
  className?: string;
  startLine?: number;
  endLine?: number;
  parameters?: string[];
  returnType?: string;
  isAsync?: boolean;
  language: string;
}

export interface CommonClass {
  name: string;
  file: string;
  baseClass?: string;
  interfaces?: string[];
  startLine?: number;
  endLine?: number;
  methods?: CommonFunction[];
  decorators?: string[];
  language: string;
}

export interface CommonImport {
  source: string;
  importedSymbols?: string[];
  importType?: string; // "default" | "named" | "namespace" | "package" | "relative"
  file: string;
  startLine?: number;
  endLine?: number;
}

export interface CommonExport {
  symbol: string;
  kind?: string; // function, class, type, variable, enum
  file: string;
  startLine?: number;
  endLine?: number;
}

export interface CommonTypeSymbol {
  name: string;
  kind: "interface" | "type" | "struct" | "enum" | "trait";
  file: string;
  startLine?: number;
  endLine?: number;
}

export interface CommonEnum {
  name: string;
  members?: string[];
  file: string;
  startLine?: number;
  endLine?: number;
}

export type ParsingStatus = "PARSED" | "UNSUPPORTED" | "FAILED";

export interface ParsedFileResult {
  path: string;
  language: LanguageInfo;
  parsingStatus: ParsingStatus;
  lineCount: number;
  imports: CommonImport[];
  exports: CommonExport[];
  functions: CommonFunction[];
  classes: CommonClass[];
  types: CommonTypeSymbol[];
  enums?: CommonEnum[];
  functionsCount: number;
}
