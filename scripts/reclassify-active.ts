import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { classifySeniority, classifyCategory } from "../lib/classify";

const p = new PrismaClient();

(async () => {
  // unit checks
  const cases: [string, string][] = [
    ["Associate Director, Data Sciences", "SENIOR"],
    ["Associate Director, Investment Platform (Contract)", "SENIOR"],
    ["Associate Software Engineer", "NEW_GRAD"],
    ["Junior Software engineer", "NEW_GRAD"],
    ["Software Engineer II", "MID"],
    ["Senior Associate", "SENIOR"],
    ["New Grad Software Engineer", "NEW_GRAD"],
    ["Vice President, Engineering", "SENIOR"],
  ];
  for (const [t, want] of cases) {
    const got = classifySeniority(t);
    console.log(`${got === want ? "PASS" : "FAIL"} "${t}" -> ${got} (want ${want})`);
  }
  console.log(`category "Associate Director, Data Sciences" -> ${classifyCategory("Associate Director, Data Sciences")}`);

  // reclassify all active rows
  const jobs = await p.job.findMany({
    where: { isActive: true },
    select: { id: true, title: true, description: true, seniority: true, category: true },
  });
  let senFixed = 0, catFixed = 0;
  for (const j of jobs) {
    const sen = classifySeniority(j.title, j.description);
    const cat = classifyCategory(j.title);
    const data: { seniority?: typeof sen; category?: typeof cat } = {};
    if (sen !== j.seniority) { data.seniority = sen; senFixed++; }
    if (cat !== j.category) { data.category = cat; catFixed++; }
    if (Object.keys(data).length) await p.job.update({ where: { id: j.id }, data });
  }
  console.log(`\nreclassified ${jobs.length} active rows: ${senFixed} seniority fixes, ${catFixed} category fixes`);
  await p.$disconnect();
})();
