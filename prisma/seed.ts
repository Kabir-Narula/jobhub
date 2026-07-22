import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, AtsType, DocKind } from "@prisma/client";
import { normalizeForTectonic } from "../lib/tailor/latex";

const prisma = new PrismaClient();

// Board tokens verified live against each ATS API during setup.
const COMPANIES: { name: string; atsType: AtsType; boardToken: string }[] = [
  // Greenhouse
  { name: "StackAdapt", atsType: "GREENHOUSE", boardToken: "stackadapt" },
  { name: "Thinkific", atsType: "GREENHOUSE", boardToken: "thinkific" },
  { name: "Tulip", atsType: "GREENHOUSE", boardToken: "tulip" },
  { name: "Ritual", atsType: "GREENHOUSE", boardToken: "ritual" },
  { name: "Geotab", atsType: "GREENHOUSE", boardToken: "geotab" },
  { name: "Tucows", atsType: "GREENHOUSE", boardToken: "tucows" },
  // Lever
  { name: "D2L", atsType: "LEVER", boardToken: "d2l" },
  { name: "BenchSci", atsType: "LEVER", boardToken: "benchsci" },
  { name: "Wave", atsType: "LEVER", boardToken: "waveapps" },
  { name: "Achievers", atsType: "LEVER", boardToken: "achievers" },
  // Ashby
  { name: "Cohere", atsType: "ASHBY", boardToken: "cohere" },
  { name: "Ramp", atsType: "ASHBY", boardToken: "ramp" },
  { name: "Vercel", atsType: "ASHBY", boardToken: "vercel" },
  { name: "Notion", atsType: "ASHBY", boardToken: "notion" },
  { name: "OpenAI", atsType: "ASHBY", boardToken: "openai" },
  { name: "KOHO", atsType: "ASHBY", boardToken: "koho" },
  { name: "1Password", atsType: "ASHBY", boardToken: "1password" },
  { name: "Wealthsimple", atsType: "ASHBY", boardToken: "wealthsimple" },
  // Greenhouse (additional)
  { name: "Tenstorrent", atsType: "GREENHOUSE", boardToken: "tenstorrent" },
  { name: "AlayaCare", atsType: "GREENHOUSE", boardToken: "alayacare" },
  { name: "Take-Two", atsType: "GREENHOUSE", boardToken: "taketwo" },
  // Lever (additional)
  { name: "Magnet Forensics", atsType: "LEVER", boardToken: "magnetforensics" },
  { name: "Sitetracker", atsType: "LEVER", boardToken: "sitetracker" },
  // Workday (boardToken = host/tenant/site)
  { name: "TD", atsType: "WORKDAY", boardToken: "td.wd3/td/TD_Bank_Careers" },
  { name: "BMO", atsType: "WORKDAY", boardToken: "bmo.wd3/bmo/External" },
  { name: "Salesforce", atsType: "WORKDAY", boardToken: "salesforce.wd12/salesforce/External_Career_Site" },
  { name: "SOTI", atsType: "WORKDAY", boardToken: "soti.wd3/soti/Careers" },
  { name: "Interac", atsType: "WORKDAY", boardToken: "interac.wd3/interac/Interac" },
  { name: "General Motors", atsType: "WORKDAY", boardToken: "generalmotors.wd5/generalmotors/Careers_GM" },
  // SmartRecruiters
  { name: "Wattpad", atsType: "SMARTRECRUITERS", boardToken: "Wattpad" },
  { name: "Visier", atsType: "SMARTRECRUITERS", boardToken: "Visier" },
  { name: "Nulogy", atsType: "SMARTRECRUITERS", boardToken: "Nulogy" },
  { name: "Klick", atsType: "SMARTRECRUITERS", boardToken: "Klick" },
  { name: "Docebo", atsType: "SMARTRECRUITERS", boardToken: "Docebo" },
  { name: "Shopify", atsType: "SMARTRECRUITERS", boardToken: "Shopify" },
  { name: "Symcor", atsType: "SMARTRECRUITERS", boardToken: "Symcor" },
];

function readMaster(filename: string): string {
  // Masters live one level up from job-hub/ (the Jobs_Helper folder).
  const p = path.join(process.cwd(), "..", filename);
  return normalizeForTectonic(readFileSync(p, "utf8"));
}

async function main() {
  for (const c of COMPANIES) {
    await prisma.companySource.upsert({
      where: { atsType_boardToken: { atsType: c.atsType, boardToken: c.boardToken } },
      create: c,
      update: { name: c.name },
    });
  }
  console.log(`company sources: ${COMPANIES.length}`);

  for (const [kind, file] of [
    ["RESUME", "Resume.tex"],
    ["COVER", "cover.tex"],
  ] as [DocKind, string][]) {
    const tex = readMaster(file);
    const existing = await prisma.masterTemplate.findFirst({ where: { kind, active: true } });
    if (existing) {
      await prisma.masterTemplate.update({ where: { id: existing.id }, data: { texContent: tex } });
    } else {
      await prisma.masterTemplate.create({ data: { kind, texContent: tex } });
    }
    console.log(`master ${kind}: ${tex.length} chars from ${file}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
