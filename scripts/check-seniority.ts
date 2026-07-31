import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const rows = await p.job.findMany({
    where: { title: { contains: "Associate Director" } },
    select: { id: true, title: true, company: true, seniority: true, category: true, source: true, isActive: true },
  });
  for (const j of rows) console.log(`${j.seniority}/${j.category} [${j.source}] "${j.title}" @ ${j.company} active=${j.isActive}`);
  // how many active rows have a senior title but NEW_GRAD seniority
  const bad = await p.job.count({
    where: { isActive: true, seniority: "NEW_GRAD", title: { regex: "(director|manager|principal|lead|head of|vice president|vp|chief|senior)", mode: "insensitive" } },
  });
  console.log(`\nactive NEW_GRAD rows with senior titles: ${bad}`);
  await p.$disconnect();
})();
