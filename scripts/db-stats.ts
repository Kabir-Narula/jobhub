import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const byBucket = await p.job.groupBy({ by: ["bucket"], where: { isActive: true }, _count: true });
  console.log("active by bucket:", Object.fromEntries(byBucket.map((b) => [b.bucket, b._count])));
  const bySource = await p.job.groupBy({ by: ["source"], where: { isActive: true }, _count: true, orderBy: { _count: { source: "desc" } } });
  console.log("\nby source:");
  for (const s of bySource) console.log(`  ${s.source.padEnd(24)} ${s._count}`);

  console.log("\nToronto SWE new-grad/mid samples from new sources:");
  const samples = await p.job.findMany({
    where: { bucket: "TORONTO", category: "SWE", seniority: { in: ["NEW_GRAD", "MID"] }, source: { in: ["linkedin", "simplify:newgrad", "simplify:internships"] }, isActive: true },
    orderBy: { postedAt: "desc" },
    take: 12,
    select: { title: true, company: true, source: true, postedAt: true, description: true },
  });
  for (const s of samples) {
    console.log(`  [${s.source}] ${s.title} @ ${s.company} (${s.postedAt?.toDateString() ?? "?"}) ${s.description.length > 200 ? "+JD" : "-noJD"}`);
  }
  const usRemote = await p.job.count({ where: { isActive: true, locationRaw: { contains: "USA", mode: "insensitive" } } });
  console.log(`\nrows with 'USA' in location that still got in: ${usRemote}`);
}

main().finally(() => p.$disconnect());
