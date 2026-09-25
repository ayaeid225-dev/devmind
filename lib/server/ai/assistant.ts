import "server-only";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import {
  searchEvidence,
  verifyRepositoryAccess,
  isSensitiveFile,
  sanitizeSnippet,
  getSearchTerms,
  type EvidenceResultItem,
} from "../rag/search";
import { detectQuestionIntent, type QuestionIntent } from "./intent";
import { getLLMProvider, type AIAnswerResponse, type GenerateAnswerInput } from "./provider";

export interface AskAssistantOptions {
  repoId: string;
  question: string;
  userId?: string;
}

/**
 * Repository-Grounded AI Assistant Service.
 *
 * Coordinates:
 * 1. Strict repository access & authorization.
 * 2. Intent classification (EXPLANATION, LOCATION, DEPENDENCY, IMPACT, ARCHITECTURE, DOCS, GIT_HISTORY, GENERAL).
 * 3. Multi-source repository context retrieval (code chunks, dependencies, modules, git history, docs).
 * 4. Sensitive file protection and credential sanitization.
 * 5. Strict anti-hallucination guarantees and explicit NOT_FOUND states.
 * 6. Structured answer synthesis with traceable evidence citations.
 */
export async function askAssistant({
  repoId,
  question,
  userId,
}: AskAssistantOptions): Promise<AIAnswerResponse> {
  const currentUserId = userId || (await getCurrentUser())?.id;
  if (!currentUserId) {
    const err = new Error("Unauthenticated: Please sign in to use Ask DevMind");
    (err as any).statusCode = 401;
    throw err;
  }

  const cleanRepoId = (repoId || "").trim();
  const cleanQuestion = (question || "").trim();

  if (!cleanRepoId) {
    const err = new Error("Repository context (repoId) is required for AI Assistant");
    (err as any).statusCode = 400;
    throw err;
  }

  if (!cleanQuestion) {
    const err = new Error("Question parameter is required and cannot be empty");
    (err as any).statusCode = 400;
    throw err;
  }

  if (cleanQuestion.length > 1000) {
    const err = new Error("Question exceeds maximum length of 1000 characters");
    (err as any).statusCode = 400;
    throw err;
  }

  // 1. Verify Repository Access & Authorization
  const { authorized, notFound, forbidden, repo } = await verifyRepositoryAccess(
    cleanRepoId,
    currentUserId
  );

  if (notFound || !repo) {
    const err = new Error(`Repository "${cleanRepoId}" not found`);
    (err as any).statusCode = 404;
    throw err;
  }

  if (forbidden) {
    const err = new Error(`Unauthorized: You do not have access to repository "${cleanRepoId}"`);
    (err as any).statusCode = 403;
    throw err;
  }

  // 2. Check Repository Indexing State
  const [filesCount, chunksCount] = await Promise.all([
    db.fileRecord.count({ where: { repoId: repo.id } }),
    db.documentChunk.count({ where: { repoId: repo.id } }),
  ]);

  if (filesCount === 0 && chunksCount === 0) {
    return {
      answer: `### Answer\n\nThis repository (${repo.name}) has not been indexed yet. Please sync the repository before asking questions.\n\n### Evidence\n\nNo indexed repository evidence is available.\n\n### Confidence\n\nNot Found — Repository is unindexed.`,
      confidence: 0,
      confidenceLevel: "LOW",
      evidenceState: "NOT_FOUND",
      citations: [],
      relatedFiles: [],
      insufficientEvidence: true,
    };
  }

  // 3. Classify Question Intent
  const intent = detectQuestionIntent(cleanQuestion);

  // 4. Extract Entity References (files, modules, keywords)
  const fileExtensionRegex =
    /(?:[\w@.-]+\/)*[\w@.-]+\.(?:ts|tsx|js|jsx|dart|py|go|rs|json|prisma|yaml|yml|md|sql)/gi;
  const rawFileMatches = cleanQuestion.match(fileExtensionRegex) || [];
  const mentionedFileNames = rawFileMatches.map((f) => f.toLowerCase().trim());

  // Also check if any known file path matches words in the query
  const allKnownFiles = await db.fileRecord.findMany({
    where: { repoId: repo.id },
    select: { id: true, path: true, moduleId: true },
  });

  const safeKnownFiles = allKnownFiles.filter((f) => !isSensitiveFile(f.path));
  const matchedTargetFiles: string[] = [];

  const qLower = cleanQuestion.toLowerCase();
  const qTokens = qLower.split(/[\s,./\\_-]+/).filter((w) => w.length >= 3);

  for (const f of safeKnownFiles) {
    const fileName = (f.path.split("/").pop() || f.path).toLowerCase();
    const pathLower = f.path.toLowerCase();

    const matchesFileNameOrPath =
      mentionedFileNames.includes(fileName) ||
      mentionedFileNames.includes(pathLower) ||
      qTokens.some((qt) => {
        const terms = getSearchTerms(qt);
        return terms.some((t) => fileName.includes(t) || pathLower.includes(t));
      });

    if (matchesFileNameOrPath) {
      if (!matchedTargetFiles.includes(f.path)) {
        matchedTargetFiles.push(f.path);
      }
    }
  }

  // 5. Multi-Source Context Gathering

  // A. Code Chunks via Hybrid Semantic Search
  let evidence: EvidenceResultItem[] = [];
  try {
    evidence = await searchEvidence({
      repoId: repo.id,
      query: cleanQuestion,
      limit: 6,
      userId: currentUserId,
    });
  } catch {
    evidence = [];
  }

  // If specific files were identified, fetch top chunks for those files directly if missing
  if (matchedTargetFiles.length > 0) {
    const directChunks = await db.documentChunk.findMany({
      where: {
        repoId: repo.id,
        path: { in: matchedTargetFiles },
      },
      take: 6,
    });

    for (const chunk of directChunks) {
      if (
        !isSensitiveFile(chunk.path) &&
        !evidence.some((e) => e.path === chunk.path && e.startLine === chunk.startLine)
      ) {
        evidence.unshift({
          id: chunk.id,
          score: 0.95,
          repoId: chunk.repoId,
          fileId: chunk.fileId,
          path: chunk.path,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          language: chunk.language,
          content: sanitizeSnippet(chunk.content),
          moduleId: chunk.moduleId,
        });
      }
    }
  }

  // Filter sensitive files and sort
  evidence = evidence.filter((e) => !isSensitiveFile(e.path));
  evidence.sort((a, b) => b.score - a.score);
  evidence = evidence.slice(0, 6);

  // B. Dependency & Impact Analysis
  let dependencies: GenerateAnswerInput["dependencies"] = undefined;
  let impactAnalysis: GenerateAnswerInput["impactAnalysis"] = undefined;

  const isDepOrImpact =
    intent === "DEPENDENCY" ||
    intent === "IMPACT" ||
    /(depend|impact|break|affect|change|delete|import)/i.test(cleanQuestion);

  if (isDepOrImpact) {
    const targetFilter =
      matchedTargetFiles.length > 0
        ? matchedTargetFiles
        : evidence.slice(0, 2).map((e) => e.path);

    if (targetFilter.length > 0) {
      // Find Inbound Dependents (who imports this target)
      const inboundDeps = await db.dependencyRecord.findMany({
        where: {
          repoId: repo.id,
          OR: targetFilter.flatMap((tp) => [
            { targetFile: tp },
            { targetFile: { endsWith: tp } },
            { importSource: { contains: tp } },
          ]),
        },
      });

      // Find Outbound Dependencies (what this target imports)
      const outboundDeps = await db.dependencyRecord.findMany({
        where: {
          repoId: repo.id,
          OR: targetFilter.flatMap((tp) => [
            { sourceFile: tp },
            { sourceFile: { endsWith: tp } },
          ]),
        },
      });

      const directlyAffected = Array.from(
        new Set(
          inboundDeps
            .map((d) => d.sourceFile)
            .filter((f): f is string => typeof f === "string" && !isSensitiveFile(f))
        )
      );

      const affectedModules = Array.from(
        new Set(inboundDeps.map((d) => d.fromModule).filter(Boolean) as string[])
      );

      const affectedRoutes = directlyAffected.filter((f) =>
        /(api\/|routes\/|controllers\/|pages\/|app\/)/.test(f)
      );

      const affectedComponents = directlyAffected.filter((f) =>
        /(components\/|views\/|screens\/|widgets\/)/.test(f)
      );

      // Find 2nd-degree downstream dependents
      let potentiallyAffected: string[] = [];
      if (directlyAffected.length > 0) {
        const secondDegree = await db.dependencyRecord.findMany({
          where: {
            repoId: repo.id,
            targetFile: { in: directlyAffected },
          },
          select: { sourceFile: true },
          take: 8,
        });

        potentiallyAffected = Array.from(
          new Set(
            secondDegree
              .map((d) => d.sourceFile)
              .filter(
                (f): f is string =>
                  typeof f === "string" && !directlyAffected.includes(f) && !isSensitiveFile(f)
              )
          )
        );
      }

      dependencies = [...inboundDeps, ...outboundDeps].map((d) => ({
        sourceFile: d.sourceFile,
        targetFile: d.targetFile,
        fromModule: d.fromModule,
        toModule: d.toModule,
        kind: d.kind,
        dependencyType: d.dependencyType,
      }));

      impactAnalysis = {
        directlyAffected,
        potentiallyAffected,
        affectedModules,
        affectedRoutes,
        affectedComponents,
        reason:
          directlyAffected.length > 0
            ? `Indexed dependency records show ${directlyAffected.length} file(s) maintaining direct import dependencies on ${targetFilter.join(", ")}.`
            : `No inbound imports found for ${targetFilter.join(", ")} in indexed repository dependencies.`,
        validation: [
          `Run test suites covering: ${directlyAffected.slice(0, 3).join(", ") || "the target component"}`,
          `Verify TypeScript compilation and import statements for breaking references`,
        ],
      };
    }
  }

  // C. Architecture Modules Context
  let modules: GenerateAnswerInput["modules"] = undefined;
  if (intent === "ARCHITECTURE" || /(architecture|module|structure)/i.test(cleanQuestion)) {
    const rawModules = await db.module.findMany({
      where: { repoId: repo.id },
      orderBy: { filesCount: "desc" },
      take: 8,
    });
    modules = rawModules.map((m) => ({
      id: m.id,
      name: m.name,
      desc: m.desc,
      type: m.type,
      filesCount: m.filesCount,
      depsCount: m.depsCount,
      dependentsCount: m.dependentsCount,
    }));
  }

  // D. Git Commit History Context
  let commits: GenerateAnswerInput["commits"] = undefined;
  if (intent === "GIT_HISTORY" || /(commit|who changed|recent changes|git history)/i.test(cleanQuestion)) {
    const targetFilter =
      matchedTargetFiles.length > 0
        ? matchedTargetFiles
        : evidence.slice(0, 1).map((e) => e.path);

    if (targetFilter.length > 0) {
      const fileChanges = await db.commitFileChangeRecord.findMany({
        where: {
          repoId: repo.id,
          OR: targetFilter.flatMap((tp) => [
            { newPath: tp },
            { newPath: { contains: tp } },
            { oldPath: tp },
          ]),
        },
        include: { commit: true },
        orderBy: { commit: { committedAt: "desc" } },
        take: 8,
      });

      commits = fileChanges.map((fc) => ({
        sha: fc.commit.sha,
        shortSha: fc.commit.shortSha || fc.commit.sha.slice(0, 7),
        message: fc.commit.message,
        authorName: fc.commit.authorName,
        authorEmail: fc.commit.authorEmail,
        committedAt: fc.commit.committedAt,
        changeType: fc.changeType,
        filePath: fc.newPath,
      }));
    }

    if (!commits || commits.length === 0) {
      const rawCommits = await db.commitRecord.findMany({
        where: { repoId: repo.id },
        orderBy: { committedAt: "desc" },
        take: 8,
      });
      commits = rawCommits.map((c) => ({
        sha: c.sha,
        shortSha: c.shortSha || c.sha.slice(0, 7),
        message: c.message,
        authorName: c.authorName,
        authorEmail: c.authorEmail,
        committedAt: c.committedAt,
      }));
    }
  }

  // E. Documentation Context
  let docs: GenerateAnswerInput["docs"] = undefined;
  if (intent === "DOCS" || /(readme|docs|documentation|decision)/i.test(cleanQuestion)) {
    const rawDocs = await db.documentRecord.findMany({
      where: { repoId: repo.id },
      take: 5,
    });
    docs = rawDocs.map((d) => ({
      title: d.title,
      category: d.category,
      summary: d.summary,
    }));
  }

  // 6. Compute Evidence State & Confidence
  let evidenceState: "VERIFIED" | "PARTIAL" | "NOT_FOUND";
  const topScore = evidence[0]?.score || 0;

  if (intent === "GENERAL") {
    evidenceState = "PARTIAL";
  } else if (
    evidence.length === 0 &&
    matchedTargetFiles.length === 0 &&
    (!dependencies || dependencies.length === 0) &&
    (!commits || commits.length === 0) &&
    (!modules || modules.length === 0)
  ) {
    evidenceState = "NOT_FOUND";
  } else if (
    topScore >= 0.50 ||
    (matchedTargetFiles.length > 0 && evidence.length > 0) ||
    (dependencies && dependencies.length > 0) ||
    (modules && modules.length > 0) ||
    (commits && commits.length > 0)
  ) {
    evidenceState = "VERIFIED";
  } else if (topScore >= 0.35) {
    evidenceState = "PARTIAL";
  } else {
    evidenceState = "NOT_FOUND";
  }

  // 7. Invoke LLM Provider with Context
  const provider = getLLMProvider();
  const inputPayload: GenerateAnswerInput = {
    question: cleanQuestion,
    evidence,
    repoId: repo.id,
    repoName: repo.name,
    intent,
    dependencies,
    modules,
    commits,
    docs,
    impactAnalysis,
    evidenceState,
  };

  const aiResult = await provider.generateAnswer(inputPayload);

  // Guarantee evidenceState and confidence alignment
  aiResult.evidenceState = evidenceState;
  aiResult.insufficientEvidence = evidenceState === "NOT_FOUND";
  if (evidenceState === "NOT_FOUND") {
    aiResult.confidence = 0;
    aiResult.confidenceLevel = "LOW";
    aiResult.citations = [];
    aiResult.relatedFiles = [];
    if (!aiResult.answer.includes("I couldn't verify this from the indexed repository data")) {
      aiResult.answer = `### Answer\n\nI couldn't verify this from the indexed repository data. No matching files, functions, modules, or dependencies were found for this query in repository ${repo.name}.\n\n### Evidence\n\nNo matching indexed repository evidence was found.\n\n### Confidence\n\nNot Found — Insufficient repository evidence.`;
    }
  }

  return aiResult;
}
