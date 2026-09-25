import { LanguageInfo } from "../detector";
import { ParsedFileResult } from "../common-model";

export interface ParseInput {
  path: string;
  content: string;
  language: LanguageInfo;
}

export interface LanguageParser {
  readonly languageId: string;
  canParse(language: LanguageInfo): boolean;
  parse(input: ParseInput): ParsedFileResult;
}

export class ParserRegistry {
  private parsers: Map<string, LanguageParser> = new Map();
  private fallbackParser: LanguageParser;

  constructor(fallbackParser: LanguageParser) {
    this.fallbackParser = fallbackParser;
  }

  register(parser: LanguageParser): void {
    this.parsers.set(parser.languageId.toLowerCase(), parser);
  }

  getParser(language: LanguageInfo): LanguageParser {
    const registered = this.parsers.get(language.id.toLowerCase());
    if (registered && registered.canParse(language)) {
      return registered;
    }
    for (const parser of this.parsers.values()) {
      if (parser.canParse(language)) {
        return parser;
      }
    }
    return this.fallbackParser;
  }
}
