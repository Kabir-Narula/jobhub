import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Delete every stored resume, cover, PDF, and company-research cache for the
 * three postings that were generated under the old SWE doctrine, so a page
 * refresh shows a blank tailor and the next click runs the current pipeline.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { deletePdf } from "../lib/supabase";

const MATCHERS: { label: string; where: Record<string, unknown> }[] = [
  {
    label: "McKinsey Business Analyst",
    where: {
      OR: [
        { sourceUrl: { contains: "businessanalyst-15136", mode: "insensitive" } },
        { applyUrl: { contains: "businessanalyst-15136", mode: "insensitive" } },
        {
          AND: [
            { company: { contains: "McKinsey", mode: "insensitive" } },
            { title: { contains: "Business Analyst", mode: "insensitive" } },
          ],
        },
      ],
    },
  },
  {
    label: "BCG Associate (Western Canadian Universities)",
    where: {
      OR: [
        { sourceUrl: { contains: "/job/57855", mode: "insensitive" } },
        { applyUrl: { contains: "/job/57855", mode: "insensitive" } },
        {
          AND: [
            { OR: [{ company: { contains: "Boston Consulting", mode: "insensitive" } }, { company: { contains: "BCG", mode: "insensitive" } }] },
            { title: { contains: "Western Canadian", mode: "insensitive" } },
          ],
        },
      ],
    },
  },
  {
    label: "Lilly Insights Associate",
    where: {
      OR: [
        { sourceUrl: { contains: "R-108934", mode: "insensitive" } },
        { applyUrl: { contains: "R-108934", mode: "insensitive" } },
        {
          AND: [
            { company: { contains: "Lilly", mode: "insensitive" } },
            { title: { contains: "Insights", mode: "insensitive" } },
          ],
        },
      ],
    },
  },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const seen = new Set<string>();
    for (const m of MATCHERS) {
      const jobs = await prisma.job.findMany({
        where: m.where as never,
        include: { documents: true, applications: true },
      });
      const fresh = jobs.filter((j) => !seen.has(j.id));
      if (fresh.length === 0) {
        console.log(`${m.label}: no matching job row`);
        continue;
      }
      for (const job of fresh) {
        seen.add(job.id);
        console.log(`${m.label}: ${job.id}  ${job.title} @ ${job.company}  docs=${job.documents.length}`);
        await prisma.application.updateMany({
          where: { jobId: job.id },
          data: { resumeVersionId: null, coverVersionId: null, researchNotes: "" },
        });
        for (const d of job.documents) {
          if (d.pdfStoragePath) await deletePdf(d.pdfStoragePath).catch(() => undefined);
        }
        await prisma.documentVersion.deleteMany({ where: { jobId: job.id } });
        await prisma.job.update({
          where: { id: job.id },
          data: { companyResearch: Prisma.DbNull, researchedAt: null },
        });
        console.log(`  wiped documents + research cache`);
      }
    }
    console.log(`done. ${seen.size} job(s) cleaned.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
