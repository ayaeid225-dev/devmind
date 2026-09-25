import "server-only";

export type QuestionIntent =
  | "EXPLANATION"
  | "LOCATION"
  | "DEPENDENCY"
  | "IMPACT"
  | "ARCHITECTURE"
  | "DOCS"
  | "GIT_HISTORY"
  | "GENERAL";

/**
 * Classifies a user question into one of the core engineering intents.
 */
export function detectQuestionIntent(rawQuestion: string): QuestionIntent {
  const q = (rawQuestion || "").trim().toLowerCase();

  // 1. General Concept Questions (Abstract programming questions without repository entities)
  const isGeneralConcept =
    /^(what\s+is|what\s+are|explain\s+the\s+concept\s+of|difference\s+between)\s+(dependency\s+injection|oauth|jwt|a\s+webhook|webhooks|rest\s+api|graphql|design\s+pattern|solid\s+principles?|polymorphism|recursion|async\s*\/?\s*await|closures?|promises?|memoization)\??$/i.test(
      q
    ) ||
    /^(can\s+you\s+explain\s+what\s+(is\s+)?(dependency\s+injection|oauth|jwt|a\s+webhook|polymorphism))\??$/i.test(
      q
    );

  if (isGeneralConcept) {
    return "GENERAL";
  }

  // 2. Impact Analysis
  if (
    /(what\s+(happens|breaks|will\s+break|could\s+break|would\s+break)|impact\s+of|if\s+i\s+(delete|remove|change|modify|rename|update|refactor)|what\s+(will|would|is)\s+be\s+affected|affected\s+by)/i.test(
      q
    )
  ) {
    return "IMPACT";
  }

  // 3. Dependency Analysis
  if (
    /(what\s+(depends\s+on|uses|imports|calls)|who\s+(imports|calls|uses)|which\s+(modules?|files?)\s+depend|dependencies\s+of|dependents\s+of|what\s+modules\s+does\s+.*\s+use)/i.test(
      q
    )
  ) {
    return "DEPENDENCY";
  }

  // 4. Git History & Commits
  if (
    /(who\s+(changed|modified|committed|wrote)|when\s+was\s+.*(introduced|added|created|committed)|why\s+was\s+.*(changed|modified)|(recent|latest)\s+(commits?|changes?)|commit\s+history|git\s+log|git\s+history)/i.test(
      q
    )
  ) {
    return "GIT_HISTORY";
  }

  // 5. File & Symbol Location
  if (
    /(where\s+(is|are|can\s+i\s+find)|which\s+files?\s+(handles?|defines?|contains?|implements?|stores?)|find\s+the\s+file|locate\s+the|path\s+to\s+the|where\s+is\s+this\s+api\s+called)/i.test(
      q
    )
  ) {
    return "LOCATION";
  }

  // 6. Architecture & System Structure
  if (
    /(project\s+architecture|system\s+architecture|how\s+is\s+the\s+project\s+structured|how\s+does\s+data\s+flow|how\s+are\s+modules\s+connected|overall\s+architecture|high-level\s+structure|system\s+design|architecture\s+of\s+this\s+project)/i.test(
      q
    )
  ) {
    return "ARCHITECTURE";
  }

  // 7. Documentation & Architectural Decisions
  if (
    /(documentation\s+about|is\s+there\s+documentation|what\s+does\s+the\s+readme\s+say|architectural\s+decisions?|api\s+docs?|technical\s+docs?|read\s+the\s+docs?)/i.test(
      q
    )
  ) {
    return "DOCS";
  }

  // 8. Default: Technical Explanation
  return "EXPLANATION";
}
