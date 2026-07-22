import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { extractCity, bucketFor } from "../lib/geo";
import { classifyCategory } from "../lib/classify";

const INTERN_RE = /\b(intern(ship)?s?|co-?op|summer student|work term|placement (student|year))\b/i;

const p = new PrismaClient();

async function main() {
  const jobs = await p.job.findMany({ select: { id: true, title: true, locationRaw: true, workMode: true, bucket: true, category: true, isActive: true } });
  let deactivated = 0;
  let rebucketed = 0;
  let recategorized = 0;
  let interns = 0;

  for (const j of jobs) {
    const city = extractCity(j.locationRaw);
    const bucket = bucketFor(city, j.workMode, j.locationRaw);
    const category = classifyCategory(j.title);
    const isIntern = INTERN_RE.test(j.title);

    const data: Record<string, unknown> = { city, category };
    if (bucket === null || isIntern) {
      data.isActive = false;
      if (isIntern) interns++;
      else deactivated++;
    }
    if (bucket !== j.bucket) rebucketed++;
    if (category !== j.category) recategorized++;
    await p.job.update({ where: { id: j.id }, data: { ...data, bucket: bucket ?? j.bucket } });
  }
  console.log(`done. deactivated (wrong bucket): ${deactivated}, interns removed: ${interns}, rebucketed: ${rebucketed}, recategorized: ${recategorized}`);
}

main().finally(() => p.$disconnect());
