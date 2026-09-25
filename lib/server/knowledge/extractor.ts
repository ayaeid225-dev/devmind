import { ParsedFileResult, CommonClass, CommonFunction } from "../ingestion/common-model";
import { KnowledgeNode, KnowledgeEdge } from "./types";

export interface ExtractedFileSymbols {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  classes: KnowledgeNode[];
  functions: KnowledgeNode[];
  methods: KnowledgeNode[];
}

/**
 * Extracts Knowledge Nodes and Edges for classes, functions, and methods
 * from a FileRecord's parsed symbolsJson payload.
 */
export function extractSymbolsFromFile(
  repoId: string,
  filePath: string,
  symbolsJson: string | null | undefined,
  language: string = "UNKNOWN"
): ExtractedFileSymbols {
  const result: ExtractedFileSymbols = {
    nodes: [],
    edges: [],
    classes: [],
    functions: [],
    methods: [],
  };

  if (!symbolsJson) {
    return result;
  }

  let parsed: ParsedFileResult;
  try {
    parsed = typeof symbolsJson === "string" ? JSON.parse(symbolsJson) : symbolsJson;
  } catch {
    // Malformed JSON is handled safely without throwing
    return result;
  }

  const fileId = `file:${repoId}:${filePath}`;
  const seenNodeIds = new Set<string>();
  const seenEdgeIds = new Set<string>();

  function addNode(node: KnowledgeNode) {
    if (!seenNodeIds.has(node.id)) {
      seenNodeIds.add(node.id);
      result.nodes.push(node);
    }
  }

  function addEdge(edge: KnowledgeEdge) {
    if (!seenEdgeIds.has(edge.id)) {
      seenEdgeIds.add(edge.id);
      result.edges.push(edge);
    }
  }

  // 1. Extract Classes and their Methods
  if (Array.isArray(parsed.classes)) {
    for (const cls of parsed.classes) {
      if (!cls || !cls.name) continue;

      const classId = `class:${repoId}:${filePath}:${cls.name}`;
      const classNode: KnowledgeNode = {
        id: classId,
        type: "Class",
        name: cls.name,
        label: `class ${cls.name}`,
        repoId,
        filePath,
        startLine: cls.startLine,
        endLine: cls.endLine,
        language: cls.language || language,
        metadata: {
          baseClass: cls.baseClass || null,
          interfaces: cls.interfaces || [],
          decorators: cls.decorators || [],
          methodsCount: Array.isArray(cls.methods) ? cls.methods.length : 0,
        },
      };

      addNode(classNode);
      result.classes.push(classNode);

      // File --CONTAINS--> Class
      addEdge({
        id: `${fileId}->${classId}:CONTAINS`,
        source: fileId,
        target: classId,
        type: "CONTAINS",
        repoId,
      });

      // Extract class methods
      if (Array.isArray(cls.methods)) {
        for (const method of cls.methods) {
          if (!method || !method.name) continue;

          const methodId = `method:${repoId}:${filePath}:${cls.name}:${method.name}`;
          const methodNode: KnowledgeNode = {
            id: methodId,
            type: "Method",
            name: method.name,
            label: `${cls.name}.${method.name}()`,
            repoId,
            filePath,
            startLine: method.startLine,
            endLine: method.endLine,
            language: method.language || language,
            metadata: {
              className: cls.name,
              parameters: method.parameters || [],
              returnType: method.returnType || null,
              isAsync: Boolean(method.isAsync),
            },
          };

          addNode(methodNode);
          result.methods.push(methodNode);

          // Class --CONTAINS--> Method
          addEdge({
            id: `${classId}->${methodId}:CONTAINS`,
            source: classId,
            target: methodId,
            type: "CONTAINS",
            repoId,
          });
        }
      }
    }
  }

  // 2. Extract Top-Level Standalone Functions
  if (Array.isArray(parsed.functions)) {
    for (const fn of parsed.functions) {
      if (!fn || !fn.name) continue;

      // Avoid duplicating methods that were already extracted under classes
      if (fn.className) {
        continue;
      }

      const funcId = `func:${repoId}:${filePath}:${fn.name}`;
      const funcNode: KnowledgeNode = {
        id: funcId,
        type: "Function",
        name: fn.name,
        label: `${fn.name}()`,
        repoId,
        filePath,
        startLine: fn.startLine,
        endLine: fn.endLine,
        language: fn.language || language,
        metadata: {
          parameters: fn.parameters || [],
          returnType: fn.returnType || null,
          isAsync: Boolean(fn.isAsync),
        },
      };

      addNode(funcNode);
      result.functions.push(funcNode);

      // File --CONTAINS--> Function
      addEdge({
        id: `${fileId}->${funcId}:CONTAINS`,
        source: fileId,
        target: funcId,
        type: "CONTAINS",
        repoId,
      });
    }
  }

  return result;
}
