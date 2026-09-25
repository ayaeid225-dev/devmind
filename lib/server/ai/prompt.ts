import "server-only";
import type { EvidenceResultItem } from "../rag/search";

export interface GenerateAnswerInput {
  question: string;
  evidence: EvidenceResultItem[];
  repoId?: string;
  repoName?: string;
  intent?: string;
  dependencies?: Array<{
    sourceFile?: string | null;
    targetFile?: string | null;
    fromModule?: string | null;
    toModule?: string | null;
    kind: string;
    dependencyType?: string;
  }>;
  modules?: Array<{
    id?: string;
    name: string;
    desc?: string | null;
    type: string;
    filesCount: number;
    depsCount?: number;
    dependentsCount?: number;
  }>;
  commits?: Array<{
    sha: string;
    shortSha: string;
    message: string;
    authorName: string;
    authorEmail?: string;
    committedAt: Date | string;
    changeType?: string;
    filePath?: string;
  }>;
  docs?: Array<{
    title: string;
    category: string;
    summary: string;
  }>;
  impactAnalysis?: {
    directlyAffected: string[];
    potentiallyAffected: string[];
    affectedModules: string[];
    affectedRoutes: string[];
    affectedComponents: string[];
    reason?: string;
    validation?: string[];
  };
  evidenceState?: "VERIFIED" | "PARTIAL" | "NOT_FOUND";
}

export function buildSystemPrompt(): string {
  return `You are DevMind, an expert repository-grounded engineering intelligence assistant.
Your goal is to answer technical questions about software codebases based ONLY on verified repository data.

CORE RULES:
1. Answer the user's question using the provided repository evidence (code chunks, dependencies, modules, git history).
2. Every technical claim, file reference, function name, or line number MUST be grounded in the provided repository context.
3. NEVER invent files, folders, functions, classes, API routes, database tables, Git commits, authors, or line numbers.
4. If the provided repository data is insufficient or cannot verify a project-specific claim, explicitly state:
   "I couldn't verify this from the indexed repository data."
5. For impact questions ("What happens if I delete/change X?"):
   - Identify direct imports and inbound callers.
   - List affected modules, routes, components, and tests.
   - Use nuanced language: "Directly affected", "Potentially affected", "No dependency found in indexed data".
   - Never claim something will definitely break unless the repository evidence supports that conclusion.
6. For location questions ("Where is X?"):
   - Cite the exact file path and line numbers from the evidence.
7. For architecture questions:
   - Describe the real module topology, layers, and entry points of the repository.
8. For general programming questions:
   - Explain the general concept, then reference repository implementation if provided.
9. Format your response cleanly using these Markdown sections when relevant:
   ### Answer
   ### How it works
   ### Impact (only when question asks about changes/deletions/dependencies)
   ### Evidence
   ### Confidence`;
}

export function buildUserPrompt(
  inputOrQuestion: string | GenerateAnswerInput,
  maybeEvidence?: EvidenceResultItem[]
): string {
  let input: GenerateAnswerInput;

  if (typeof inputOrQuestion === "string") {
    input = {
      question: inputOrQuestion,
      evidence: maybeEvidence || [],
    };
  } else {
    input = inputOrQuestion;
  }

  const {
    question,
    evidence,
    repoId,
    repoName,
    intent,
    dependencies,
    modules,
    commits,
    docs,
    impactAnalysis,
  } = input;

  const sections: string[] = [];

  sections.push(`USER QUESTION: ${question}`);
  if (intent) {
    sections.push(`DETECTED INTENT: ${intent}`);
  }
  if (repoName || repoId) {
    sections.push(`REPOSITORY CONTEXT: ${repoName || repoId}`);
  }

  // 1. Code Evidence Chunks
  if (evidence && evidence.length > 0) {
    const formattedChunks = evidence
      .map(
        (item, idx) =>
          `--- EVIDENCE ITEM #${idx + 1} ---
File: ${item.path}
Lines: ${item.startLine}-${item.endLine}
Language: ${item.language}
Relevance Score: ${item.score}
Code Content:
\`\`\`${(item.language || "").toLowerCase()}
${item.content}
\`\`\``
      )
      .join("\n\n");
    sections.push(`REPOSITORY CODE CHUNKS:\n${formattedChunks}`);
  } else {
    sections.push(`REPOSITORY CODE CHUNKS: None found matching this query.`);
  }

  // 2. Dependencies
  if (dependencies && dependencies.length > 0) {
    const depLines = dependencies
      .slice(0, 15)
      .map((d) => {
        if (d.kind === "internal") {
          return `• Internal: ${d.sourceFile || "unknown"} imports ${d.targetFile || d.toModule || "unknown"} (type: ${d.dependencyType || "import"})`;
        }
        return `• External: ${d.sourceFile || "project"} depends on ${d.targetFile || d.toModule || "package"}`;
      })
      .join("\n");
    sections.push(`DEPENDENCY RELATIONSHIPS:\n${depLines}`);
  }

  // 3. Impact Analysis
  if (impactAnalysis) {
    const impactLines = [
      `Directly affected files: ${impactAnalysis.directlyAffected.length > 0 ? impactAnalysis.directlyAffected.join(", ") : "None found in indexed data"}`,
      `Potentially affected files/modules: ${impactAnalysis.potentiallyAffected.length > 0 ? impactAnalysis.potentiallyAffected.join(", ") : "None"}`,
      `Affected modules: ${impactAnalysis.affectedModules.length > 0 ? impactAnalysis.affectedModules.join(", ") : "None"}`,
      `Affected routes/endpoints: ${impactAnalysis.affectedRoutes.length > 0 ? impactAnalysis.affectedRoutes.join(", ") : "None"}`,
      `Affected components: ${impactAnalysis.affectedComponents.length > 0 ? impactAnalysis.affectedComponents.join(", ") : "None"}`,
      impactAnalysis.reason ? `Reason: ${impactAnalysis.reason}` : "",
      impactAnalysis.validation && impactAnalysis.validation.length > 0
        ? `Recommended validation: ${impactAnalysis.validation.join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    sections.push(`IMPACT TRACE:\n${impactLines}`);
  }

  // 4. Modules / Architecture
  if (modules && modules.length > 0) {
    const modLines = modules
      .map(
        (m) =>
          `• Module "${m.name}" (${m.type}): ${m.desc || "No description"} (${m.filesCount} files, ${m.depsCount ?? 0} deps, ${m.dependentsCount ?? 0} dependents)`
      )
      .join("\n");
    sections.push(`INDEXED ARCHITECTURE MODULES:\n${modLines}`);
  }

  // 5. Git Commit History
  if (commits && commits.length > 0) {
    const commitLines = commits
      .slice(0, 10)
      .map(
        (c) =>
          `• [${c.shortSha}] ${new Date(c.committedAt).toISOString().split("T")[0]} by ${c.authorName}: ${c.message}${c.changeType ? ` (${c.changeType})` : ""}`
      )
      .join("\n");
    sections.push(`INDEXED GIT COMMIT HISTORY:\n${commitLines}`);
  }

  // 6. Documentation
  if (docs && docs.length > 0) {
    const docLines = docs
      .map((d) => `• [${d.category}] ${d.title}: ${d.summary}`)
      .join("\n");
    sections.push(`INDEXED REPOSITORY DOCUMENTATION:\n${docLines}`);
  }

  sections.push(
    `INSTRUCTIONS:
1. Synthesize a professional, repository-grounded engineering answer using the evidence above.
2. Structure your response with Markdown headings:
   ### Answer
   ### How it works
   ### Impact (include only if question is about changes, deletions, or dependency impacts)
   ### Evidence
   ### Confidence
3. Include precise file and line references for all cited evidence.
4. If no relevant evidence was found for a project-specific query, state:
   "I couldn't verify this from the indexed repository data."`
  );

  return sections.join("\n\n");
}
