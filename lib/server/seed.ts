import "server-only";
import { db } from "./db";
import { hashPassword } from "./auth";
import {
  REPO,
  REPOS,
  BRANCHES,
  MODULES,
  FILE_LIST,
  FILES,
  DEVS,
  DOCS,
  ACTIVITY,
  DEPS_INTERNAL,
  DEPS_EXTERNAL,
} from "@/data/fixtures";
import { chunkFileContent } from "./rag/chunker";
import { getEmbeddingProvider } from "./rag/provider";

export async function seedDatabase() {
  console.log("Seeding DevMind database from fixtures...");

  // 1. Create Organization
  const org = await db.organization.upsert({
    where: { slug: "medialab" },
    update: {},
    create: {
      name: "medialab",
      slug: "medialab",
    },
  });

  const passwordHash = await hashPassword("password123");

  // 2. Create User
  const user = await db.user.upsert({
    where: { email: "anjali@medialab.dev" },
    update: { passwordHash },
    create: {
      email: "anjali@medialab.dev",
      name: "Anjali Rao",
      passwordHash,
      role: "Lead Architect",
      color: "#C8D62B",
    },
  });

  // Link User to Org
  await db.orgMember.upsert({
    where: {
      orgId_userId: {
        orgId: org.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      orgId: org.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  // 3. Create Project
  const project = await db.project.upsert({
    where: { slug: "clinic-management" },
    update: {},
    create: {
      orgId: org.id,
      name: "Clinic Management",
      slug: "clinic-management",
      description: "Comprehensive clinic and appointment management system",
    },
  });

  // 4. Create Repositories
  for (const r of REPOS) {
    const repoRecord = await db.repository.upsert({
      where: { id: r.name },
      update: {
        filesCount: r.files,
        modulesCount: r.modules,
        depsCount: r.deps,
        contributorsCount: r.contributors,
        defaultBranch: r.branch,
      },
      create: {
        id: r.name,
        projectId: project.id,
        name: r.name,
        owner: r.owner,
        defaultBranch: r.branch || "main",
        filesCount: r.files,
        modulesCount: r.modules,
        depsCount: r.deps,
        contributorsCount: r.contributors,
      },
    });

    // Create Branches
    const branches = r.name === REPO.name ? BRANCHES : (r.branches ?? [r.branch || "main"]);
    for (const b of branches) {
      await db.branch.upsert({
        where: {
          repoId_name: {
            repoId: repoRecord.id,
            name: b,
          },
        },
        update: {},
        create: {
          repoId: repoRecord.id,
          name: b,
          isDefault: b === r.branch,
        },
      });
    }

    // Populate Modules & Files for clinic-management
    if (r.name === REPO.name) {
      for (const m of MODULES) {
        await db.module.upsert({
          where: { id: m.id },
          update: {
            desc: m.desc,
            aiSummary: m.ai,
            filesCount: m.files,
            depsCount: (m.deps || []).length,
            dependentsCount: (m.dependents || []).length,
          },
          create: {
            id: m.id,
            repoId: repoRecord.id,
            name: m.name,
            type: m.type,
            desc: m.desc,
            aiSummary: m.ai,
            filesCount: m.files,
            depsCount: (m.deps || []).length,
            dependentsCount: (m.dependents || []).length,
          },
        });
      }

      const createdFileRecords = [];
      for (const f of FILE_LIST) {
        // Map to fixture code if available
        const fixtureEntry = Object.values(FILES).find((fx) => fx.path === f.path);
        const codeContent = fixtureEntry && fixtureEntry.code
          ? fixtureEntry.code.lines.join("\n")
          : `// File: ${f.path}\n// Module: ${f.module}\n// Description: Source code for ${f.path}\n`;

        const fr = await db.fileRecord.upsert({
          where: {
            repoId_path: {
              repoId: repoRecord.id,
              path: f.path,
            },
          },
          update: {
            size: f.size,
            updatedText: codeContent,
          },
          create: {
            repoId: repoRecord.id,
            moduleId: f.module,
            path: f.path,
            size: f.size,
            type: "code",
            updatedText: codeContent,
          },
        });
        createdFileRecords.push(fr);
      }

      // Index RAG chunks for clinic-management
      const provider = getEmbeddingProvider();
      let totalIndexedChunks = 0;

      for (const fileRecord of createdFileRecords) {
        const generatedChunks = chunkFileContent({
          repoId: repoRecord.id,
          fileId: fileRecord.id,
          moduleId: fileRecord.moduleId,
          path: fileRecord.path,
          content: fileRecord.updatedText || `// File content for ${fileRecord.path}`,
        });

        if (generatedChunks.length === 0) continue;

        const textsToEmbed = generatedChunks.map((c) => c.content);
        const embeddings = await provider.embedTexts(textsToEmbed);

        for (let i = 0; i < generatedChunks.length; i++) {
          const chunk = generatedChunks[i];
          const embeddingJson = JSON.stringify(embeddings[i]);

          await db.documentChunk.upsert({
            where: {
              repoId_path_chunkIndex: {
                repoId: repoRecord.id,
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
              repoId: repoRecord.id,
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

      await db.repository.update({
        where: { id: repoRecord.id },
        data: {
          embeddingStatus: "COMPLETED",
          indexedChunksCount: totalIndexedChunks,
          embeddingCompletedAt: new Date(),
        },
      });

      for (const d of DEVS) {
        await db.developerRecord.upsert({
          where: { id: d.id },
          update: {
            role: d.role,
            coverage: d.coverage,
            blurb: d.blurb,
            recentContribution: d.recent,
          },
          create: {
            id: d.id,
            repoId: repoRecord.id,
            name: d.name,
            role: d.role,
            color: d.color,
            coverage: d.coverage,
            blurb: d.blurb,
            recentContribution: d.recent,
          },
        });
      }

      for (const doc of DOCS) {
        await db.documentRecord.upsert({
          where: { id: doc.id },
          update: {
            title: doc.title,
            summary: doc.summary,
            status: doc.status,
            coverage: doc.coverage,
          },
          create: {
            id: doc.id,
            repoId: repoRecord.id,
            category: doc.category,
            title: doc.title,
            summary: doc.summary,
            author: doc.author,
            status: doc.status,
            coverage: doc.coverage,
            contentJson: JSON.stringify(doc.sections),
          },
        });
      }

      for (const act of ACTIVITY) {
        await db.activityRecord.create({
          data: {
            repoId: repoRecord.id,
            text: act.text,
            byUser: act.by,
            category: act.cat,
            icon: act.icon,
            timestampText: act.when,
          },
        });
      }

      for (const dep of DEPS_INTERNAL) {
        await db.dependencyRecord.create({
          data: {
            repoId: repoRecord.id,
            kind: "internal",
            fromModule: dep.from,
            toModule: dep.to,
          },
        });
      }

      for (const dep of DEPS_EXTERNAL) {
        await db.dependencyRecord.create({
          data: {
            repoId: repoRecord.id,
            kind: "external",
            name: dep.name,
            version: dep.ver,
            purpose: dep.purpose,
            status: dep.status,
          },
        });
      }
    }
  }

  console.log("DevMind database seeded and indexed successfully!");
}
