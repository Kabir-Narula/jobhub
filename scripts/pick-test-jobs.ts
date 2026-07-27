import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const SUPPORT = /\b(itil|help ?desk|desktop support|technical support|support engineer|technical consultant|technical analyst|it support|it analyst|it consultant|field (service|support)|systems? admin|implementation (engineer|consultant|specialist)|solutions? (analyst|engineer|consultant)|technical account|professional services|devops|sre|site reliability|infrastructure|platform engineer|cloud (engineer|ops)|network engineer)\b/i;

async function main() {
  const jobs = await p.job.findMany({
    where: { isActive: true, mergedAt: null, seniority: { in: ["NEW_GRAD", "MID"] } },
    select: { id: true, title: true, company: true, description: true },
    orderBy: { firstSeenAt: "desc" },
    take: 400,
  });
  const withDesc = jobs.filter((j) => j.description.length > 2500);
  const sup = withDesc.find((j) => SUPPORT.test(j.title));
  const ai = withDesc.find((j) => /ai|machine learning|ml|llm/i.test(j.title) && !SUPPORT.test(j.title));
  const swe = withDesc.find((j) => /software (engineer|developer)/i.test(j.title) && !/ai|machine|data/i.test(j.title) && !SUPPORT.test(j.title));
  for (const [k, j] of [["SWE", swe], ["SUPPORT", sup], ["AI", ai]] as const) {
    if (j) console.log(`${k} ${j.id} | ${j.title.slice(0, 55)} @ ${j.company} | desc ${j.description.length}c`);
  }
}

main().finally(() => p.$disconnect());
