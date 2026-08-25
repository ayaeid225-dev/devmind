import "server-only";
import { db } from "../db";
import { getCurrentUser } from "../auth";
import { getEmbeddingProvider } from "./provider";
import { chunkFileContent } from "./chunker";

export async function indexRepositoryEmbeddings(repoId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthenticated: User must be signed in to index embeddings");
  }

  const repo = await db.repository.findUnique({
    where: { id: repoId },
    include: {
      fileRecords: true,
    },
  });

  if (!repo) {
    throw new Error(`Repository "${repoId}" not found`);
  }

  const embeddingStartedAt = new Date();
  await db.repository.update({
    where: { id: repoId },
    data: {
      embeddingStatus: "INDEXING",
      embeddingError: null,
      embeddingStartedAt,
    },
  });

  try {
    const provider = getEmbeddingProvider();
    let totalIndexedChunks = 0;

    for (const fileRecord of repo.fileRecords) {
      // Chunk content
      const generatedChunks = chunkFileContent({
        repoId: repo.id,
        fileId: fileRecord.id,
        moduleId: fileRecord.moduleId,
        path: fileRecord.path,
        content: fileRecord.updatedText || `// File content for ${fileRecord.path}`,
      });

      if (generatedChunks.length === 0) continue;

      // Extract text content list for batch embedding
      const textsToEmbed = generatedChunks.map((c) => c.content);
      const embeddings = await provider.embedTexts(textsToEmbed);

      for (let i = 0; i < generatedChunks.length; i++) {
        const chunk = generatedChunks[i];
        const embeddingJson = JSON.stringify(embeddings[i]);

        await db.documentChunk.upsert({
          where: {
            repoId_path_chunkIndex: {
              repoId: repo.id,
              path: chunk.path,
              chunkIndex: chunk.chunkIndex,
            },
          },
          update: {
            content: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            contentHash: chunk.contentHash,
            embeddingJson,
          },
          create: {
            repoId: repo.id,
            fileId: chunk.fileId,
            moduleId: chunk.moduleId,
            path: chunk.path,
            language: chunk.language,
            content: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            chunkIndex: chunk.chunkIndex,
            contentHash: chunk.contentHash,
            embeddingJson,
          },
        });
        totalIndexedChunks++;
      }
    }

    const embeddingCompletedAt = new Date();
    await db.repository.update({
      where: { id: repoId },
      data: {
        embeddingStatus: "COMPLETED",
        indexedChunksCount: totalIndexedChunks,
        embeddingCompletedAt,
      },
    });

    return {
      success: true,
      repoId,
      indexedChunksCount: totalIndexedChunks,
      provider: provider.name,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Embedding indexing failed";
    console.error(`Embedding indexing failed for ${repoId}:`, error);

    await db.repository.update({
      where: { id: repoId },
      data: {
        embeddingStatus: "FAILED",
        embeddingError: errorMsg,
        embeddingCompletedAt: new Date(),
      },
    });

    throw error;
  }
}
