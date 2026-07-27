import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { companiesMatch } from "../lib/dedupe";

const p = new PrismaClient();

/** Independent duplicate check — 4 different angles, reports only. */
async function main() {
  const jobs = await p.job.findMany({
    where: { isActive: true },
    select: {
      id: true, title: true, company: true, source: true, sourceId: true,
      city: true, normTitle: true, normCompany: true, applyUrl: true, sourceUrl: true,
      _count: { select: { applications: true } },
    },
  });
  console.log(`active jobs: ${jobs.length}`);
  let problems = 0;

  // angle 1: same apply URL on 2+ active jobs with the SAME normalized title
  // (some ATS adapters reuse a generic careers-page URL for every posting —
  //  URL alone is only a dup signal when the role also matches)
  const byUrl = new Map<string, typeof jobs>();
  for (const j of jobs) {
    const u = j.applyUrl.split("?")[0].replace(/\/$/, "");
    if (!u) continue;
    const arr = byUrl.get(u) ?? [];
    arr.push(j);
    byUrl.set(u, arr);
  }
  for (const [u, arr] of byUrl) {
    if (arr.length < 2) continue;
    const byTitle = new Map<string, typeof jobs>();
    for (const j of arr) {
      const arr2 = byTitle.get(j.normTitle) ?? [];
      arr2.push(j);
      byTitle.set(j.normTitle, arr2);
    }
    for (const [, group] of byTitle) {
      if (group.length < 2) continue;
      problems++;
      console.log(`\n[URL DUP] ${u}`);
      for (const j of group) console.log(`  ${j.title} @ ${j.company} [${j.source}] city=${j.city} apps=${j._count.applications}`);
    }
  }

  // angle 2: same source+sourceId on 2+ active jobs
  const bySid = new Map<string, typeof jobs>();
  for (const j of jobs) {
    if (!j.sourceId) continue;
    const key = `${j.source}|${j.sourceId}`;
    const arr = bySid.get(key) ?? [];
    arr.push(j);
    bySid.set(key, arr);
  }
  for (const [key, arr] of bySid) {
    if (arr.length < 2) continue;
    problems++;
    console.log(`\n[SOURCE-ID DUP] ${key}`);
    for (const j of arr) console.log(`  ${j.title} @ ${j.company} city=${j.city} apps=${j._count.applications}`);
  }

  // angle 3: same city + normTitle, fuzzy company (the audit's own rule — must be zero)
  const byKey = new Map<string, typeof jobs>();
  for (const j of jobs) {
    if (!j.normTitle) continue;
    const key = `${j.city.toLowerCase()}|${j.normTitle}`;
    const arr = byKey.get(key) ?? [];
    arr.push(j);
    byKey.set(key, arr);
  }
  for (const [key, arr] of byKey) {
    if (arr.length < 2) continue;
    const seen: typeof jobs = [];
    for (const j of arr) {
      if (seen.some((s) => companiesMatch(s.company, j.company))) {
        problems++;
        console.log(`\n[FUZZY DUP] ${key}`);
        console.log(`  ${j.title} @ ${j.company} [${j.source}] apps=${j._count.applications}`);
        const other = seen.find((s) => companiesMatch(s.company, j.company))!;
        console.log(`  ${other.title} @ ${other.company} [${other.source}] apps=${other._count.applications}`);
      }
      seen.push(j);
    }
  }

  // angle 4: same normCompany+normTitle across DIFFERENT cities (report only — may be legit)
  const byCT = new Map<string, typeof jobs>();
  for (const j of jobs) {
    if (!j.normTitle || !j.normCompany) continue;
    const key = `${j.normCompany}|${j.normTitle}`;
    const arr = byCT.get(key) ?? [];
    arr.push(j);
    byCT.set(key, arr);
  }
  let crossCity = 0;
  for (const [, arr] of byCT) {
    const cities = new Set(arr.map((j) => j.city.toLowerCase()));
    if (arr.length > 1 && cities.size > 1) crossCity++;
  }
  console.log(`\ncross-city same-company-title groups (by design, not merged): ${crossCity}`);
  console.log(problems === 0 ? "\nNO DUPLICATES FOUND — all 4 angles clean" : `\n${problems} POTENTIAL DUPLICATE CLUSTERS FOUND`);
}

main().finally(() => p.$disconnect());
