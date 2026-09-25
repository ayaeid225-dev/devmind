import { LanguageInfo } from "../detector";
import { ParsedFileResult } from "../common-model";
import { LanguageParser, ParseInput } from "./types";

export class UnsupportedLanguageParser implements LanguageParser {
  readonly languageId = "unsupported";

  canParse(_language: LanguageInfo): boolean {
    return true; // Handles any fallback language gracefully
  }

  parse(input: ParseInput): ParsedFileResult {
    const lines = input.content ? input.content.split("\n") : [];
    const lineCount = lines.length;

    return {
      path: input.path,
      language: input.language,
      parsingStatus: "UNSUPPORTED",
      lineCount,
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      types: [],
      functionsCount: 0,
    };
  }
}
