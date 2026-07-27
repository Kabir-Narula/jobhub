import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { matchScore } from "../lib/tailor/match";

const p = new PrismaClient();

/** Recompute stored matchScores after the scorer fix (old ones were noise-dominated). */
async function main() {
  const docs = await p.documentVersion.findMany({
    where: { kind: "RESUME" },
    select: { id: true, matchScore: true, texContent: true, job: { select: { description: true, company: true, title: true } } },
  });
  let updated = 0;
  for (const d of docs) {
    const score = matchScore(d.job.description, d.texContent, d.job.company);
    if (score !== d.matchScore) {
      await p.documentVersion.update({ where: { id: d.id }, data: { matchScore: score } });
      console.log(`${String(d.matchScore ?? "—").padStart(4)} -> ${String(score ?? "—").padStart(3)}  ${d.job.title.slice(0, 50)}`);
      updated++;
    }
  }
  console.log(`\n${updated}/${docs.length} scores recomputed`);
}

main().finally(() => p.$disconnect());
