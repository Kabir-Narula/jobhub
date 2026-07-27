import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { normTitle, normCompany } from "../lib/dedupe";

const p = new PrismaClient();

async function main() {
  const jobs = await p.job.findMany({ select: { id: true, title: true, company: true } });
  console.log(`backfilling ${jobs.length} jobs...`);
  let updated = 0;
  for (const j of jobs) {
    const nt = normTitle(j.title);
    const nc = normCompany(j.company);
    await p.job.update({ where: { id: j.id }, data: { normTitle: nt, normCompany: nc } });
    updated++;
    if (updated % 500 === 0) console.log(`  ${updated}/${jobs.length}`);
  }
  console.log(`done: ${updated} rows backfilled`);
}

main().finally(() => p.$disconnect());
