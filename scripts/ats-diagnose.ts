import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { matchScore, missingTerms, jdTerms } from "../lib/tailor/match";

const p = new PrismaClient();

/** Diagnose why stored matchScores land low: print top-40 JD terms and coverage per doc. */
async function main() {
  const docs = await p.documentVersion.findMany({
    where: { kind: "RESUME", matchScore: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      createdAt: true, matchScore: true, texContent: true,
      job: { select: { title: true, company: true, description: true } },
    },
  });

  for (const d of docs) {
    const company = d.job.company.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const terms = jdTerms(d.job.description, 40, company);
    const score = matchScore(d.job.description, d.texContent, d.job.company);
    const missing = missingTerms(d.job.description, d.texContent, 40, d.job.company);
    const covered = terms.filter((t) => !missing.includes(t));

    console.log(`\n=== ${d.job.title.slice(0, 50)} @ ${d.job.company}  (stored=${d.matchScore}, recomputed=${score})`);
    console.log(`  JD desc length: ${d.job.description.length}c`);
    console.log(`  COVERED (${covered.length}): ${covered.join(", ")}`);
    console.log(`  MISSING (${missing.length}): ${missing.join(", ")}`);
  }
}

main().finally(() => p.$disconnect());
