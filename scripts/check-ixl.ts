import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

(async () => {
  const jobs = await p.job.findMany({
    where: { company: { contains: "IXL" } },
    select: {
      id: true, title: true, company: true, source: true, sourceId: true, city: true,
      normTitle: true, normCompany: true, isActive: true, mergedAt: true, mergedIntoId: true,
      firstSeenAt: true, lastSeenAt: true, postedAt: true, fingerprint: true, dismissedAt: true,
      applications: { select: { id: true, status: true, appliedAt: true } },
    },
    orderBy: { firstSeenAt: "desc" },
  });
  console.log(`IXL rows: ${jobs.length}\n`);
  for (const j of jobs) {
    console.log(`${j.isActive ? "ACTIVE " : j.mergedAt ? "MERGED " : "DEAD   "} [${j.source}:${j.sourceId.slice(-12)}] "${j.title}" @ ${j.city}`);
    console.log(`   fp=${j.fingerprint}`);
    console.log(`   norm="${j.normCompany}|${j.normTitle}" first=${j.firstSeenAt.toISOString().slice(0, 10)} last=${j.lastSeenAt.toISOString().slice(0, 10)} posted=${j.postedAt?.toISOString().slice(0, 10) ?? "-"}${j.mergedIntoId ? ` mergedInto=${j.mergedIntoId.slice(-6)}` : ""}${j.dismissedAt ? " DISMISSED" : ""}`);
    for (const a of j.applications) console.log(`   APP: ${a.status} applied=${a.appliedAt.toISOString().slice(0, 10)}`);
  }
  await p.$disconnect();
})();
