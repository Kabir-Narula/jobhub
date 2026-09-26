import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { parseResume } from "../lib/tailor/latex";

async function main() {
  const prisma = new PrismaClient();
  try {
    const jobs = await prisma.job.findMany({
      where: { company: { contains: "autodesk", mode: "insensitive" } },
      orderBy: { firstSeenAt: "desc" },
      take: 4,
    });
    for (const j of jobs) {
      console.log(`\nJOB ${j.id} | ${j.title} @ ${j.company}`);
      console.log(`  apply: ${j.applyUrl}`);
      console.log(`  descLen: ${j.description.length} | researchedAt: ${j.researchedAt} | jdAnalyzedAt: ${j.jdAnalyzedAt}`);
      const docs = await prisma.documentVersion.findMany({
        where: { jobId: j.id },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, kind: true, version: true, createdAt: true, matchScore: true, pageCount: true, texContent: true },
      });
      for (const d of docs) {
        console.log(`  ${d.kind} v${d.version} created=${d.createdAt.toISOString()} score=${d.matchScore} pages=${d.pageCount}`);
      }
      const resume = docs.find((d) => d.kind === "RESUME");
      if (resume) {
        const parsed = parseResume(resume.texContent);
        for (const e of parsed.entries) {
          console.log(`    ## ${e.title.replace(/\&/g, "&")} @ ${e.company.replace(/\&/g, "&").slice(0, 40)}`);
          for (const b of e.bullets) console.log(`      - ${b.slice(0, 110)}`);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
