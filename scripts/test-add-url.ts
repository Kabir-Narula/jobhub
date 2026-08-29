import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Add-from-URL ladder coverage: for each board family, fetch a REAL posting
 * URL from its own API/listing, then verify parseJobUrl resolves it with no LLM.
 * Run: npx tsx scripts/test-add-url.ts
 */
async function main() {
  const { parseJobUrl } = await import("../lib/jobs/from-url");
  const { fetchJson } = await import("../lib/sources/http");
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();

  // find real posting URLs per board
  const targets: { kind: string; url: string }[] = [];
  try {
    const gh = await fetchJson<{ jobs: { id: number }[] }>("https://boards-api.greenhouse.io/v1/boards/stackadapt/jobs?content=false");
    targets.push({ kind: "greenhouse", url: `https://boards.greenhouse.io/stackadapt/jobs/${gh.jobs[0].id}` });
  } catch (e) { console.log("greenhouse seed fail", e); }
  try {
    const lv = await fetchJson<{ id: string }[]>("https://api.lever.co/v0/postings/d2l?limit=5");
    targets.push({ kind: "lever", url: `https://jobs.lever.co/d2l/${lv[0].id}` });
  } catch (e) { console.log("lever seed fail", e); }
  try {
    const wd = await fetchJson<{ jobPostings: { externalPath: string }[] }>("https://bmo.wd3.myworkdayjobs.com/wday/cxs/bmo/External/jobs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "developer" }),
    });
    targets.push({ kind: "workday", url: `https://bmo.wd3.myworkdayjobs.com/en-US/External${wd.jobPostings[0].externalPath}` });
  } catch (e) { console.log("workday seed fail", e); }
  try {
    const li = await p.job.findFirst({ where: { source: "linkedin", sourceId: { not: "" } }, select: { sourceId: true } });
    if (li) targets.push({ kind: "linkedin", url: `https://www.linkedin.com/jobs/view/${li.sourceId.replace(/\D/g, "")}/` });
  } catch (e) { console.log("linkedin seed fail", e); }
  targets.push({ kind: "successfactors/generic", url: "https://careers.capgemini.com/job/Mississauga-Gen-AI-Developer-ON/1428062433/" });

  let failed = 0;
  for (const t of targets) {
    const { job, error } = await parseJobUrl(t.url);
    if (!job) {
      console.log(`FAIL ${t.kind}: ${error}`);
      failed++;
      continue;
    }
    const ok = job.title.length > 2 && job.company.length > 1 && job.description.length > 200;
    console.log(`${ok ? "ok  " : "WEAK"} ${t.kind}: "${job.title.slice(0, 45)}" @ ${job.company} | ${job.locationRaw.slice(0, 30)} | desc ${job.description.length}c`);
    if (!ok) failed++;
  }
  await p.$disconnect();
  if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
  console.log("\nall good");
}

main().catch((e) => { console.error(e); process.exit(1); });
