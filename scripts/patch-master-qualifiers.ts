import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Correct employment-relationship parentheticals on the active RESUME master:
 * INNWIL was a co-op (not Academic WIL); ITS HyFlex was contract part-time
 * (not a co-op).
 */
import { PrismaClient } from "@prisma/client";
import { parseResume, assembleResume, normalizeForTectonic } from "../lib/tailor/latex";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const prisma = new PrismaClient();
  try {
    const current = await prisma.masterTemplate.findFirst({ where: { kind: "RESUME", active: true } });
    if (!current) throw new Error("No active RESUME master");
    const parsed = parseResume(current.texContent);
    let changed = 0;
    for (const e of parsed.entries) {
      const before = e.title;
      if (/INNWIL/i.test(e.company) || /Academic WIL/i.test(e.title)) {
        e.title = e.title.replace(/\(Academic WIL\)/gi, "(Co-op)");
      }
      if (/hyflex|lab monitor/i.test(e.title)) {
        e.title = e.title.replace(/\(Co-op\)/gi, "(Contract, Part-time)");
        if (!/\(Contract,\s*Part-time\)/i.test(e.title)) {
          e.title = `${e.title.replace(/\s*\([^)]*\)\s*$/, "").trim()} (Contract, Part-time)`;
        }
      }
      if (e.title !== before) {
        changed++;
        console.log(`  ${before.replace(/\\&/g, "&")} → ${e.title.replace(/\\&/g, "&")}`);
      }
    }
    if (changed === 0) {
      console.log("qualifiers already correct — skip");
      return;
    }
    const tex = normalizeForTectonic(assembleResume(parsed, parsed.entries.map(() => ({}))));
    parseResume(tex);
    await prisma.$transaction([
      prisma.masterTemplate.updateMany({ where: { kind: "RESUME", active: true }, data: { active: false } }),
      prisma.masterTemplate.create({ data: { kind: "RESUME", texContent: tex, active: true } }),
    ]);
    const fixture = path.join(process.cwd(), "..", "Resume.tex");
    if (existsSync(fixture)) writeFileSync(fixture, tex, "utf8");
    console.log(`updated ${changed} title(s); ${parsed.entries.length} experience entries`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
