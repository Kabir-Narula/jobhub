import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Wipe all generated resume/cover materials and their caches so every document
 * regenerates under the current doctrine:
 *  - deletes every DocumentVersion row and its PDF in Supabase Storage
 *  - clears Job.companyResearch / researchedAt / jdAnalysis / jdAnalyzedAt
 *  - unlinks Application.resumeVersionId / coverVersionId (rows kept — "Applied" state preserved)
 *
 * Deliberately KEPT: Applications (status, notes, dates, researchNotes),
 * Job.contacts (Hunter.io quota is scarce), masters, sources, settings, poll runs.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { deletePdf } from "../lib/supabase";

async function main() {
  const prisma = new PrismaClient();
  try {
    const docs = await prisma.documentVersion.findMany({
      select: { id: true, kind: true, pdfStoragePath: true },
    });
    console.log(`documents to delete: ${docs.length}`);

    const unlinked = await prisma.application.updateMany({
      data: { resumeVersionId: null, coverVersionId: null },
    });
    console.log(`applications unlinked (kept): ${unlinked.count}`);

    let pdfsDeleted = 0;
    let pdfsFailed = 0;
    for (const d of docs) {
      if (!d.pdfStoragePath) continue;
      try {
        await deletePdf(d.pdfStoragePath);
        pdfsDeleted++;
      } catch {
        pdfsFailed++;
      }
    }
    console.log(`storage PDFs deleted: ${pdfsDeleted}, failed (continued): ${pdfsFailed}`);

    const deletedDocs = await prisma.documentVersion.deleteMany({});
    console.log(`document rows deleted: ${deletedDocs.count}`);

    const cleared = await prisma.job.updateMany({
      data: { companyResearch: Prisma.DbNull, researchedAt: null, jdAnalysis: Prisma.DbNull, jdAnalyzedAt: null },
    });
    console.log(`jobs with research/analysis caches cleared: ${cleared.count}`);

    const apps = await prisma.application.count();
    const jobs = await prisma.job.count();
    console.log(`\nkept: ${apps} applications, ${jobs} jobs`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
