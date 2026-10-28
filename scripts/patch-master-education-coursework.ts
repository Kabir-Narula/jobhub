import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Keep Relevant Coursework OFF the SWE master (it overflowed to 2 pages).
 * Tailored resumes inject it at assemble time via insertCoursework().
 */
import { PrismaClient } from "@prisma/client";
import { normalizeForTectonic, stripCoursework } from "../lib/tailor/latex";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const prisma = new PrismaClient();
  try {
    const current = await prisma.masterTemplate.findFirst({ where: { kind: "RESUME", active: true } });
    if (!current) throw new Error("No active RESUME master");
    if (!/Relevant Coursework/.test(current.texContent)) {
      console.log("master has no coursework line — skip");
      return;
    }
    const tex = normalizeForTectonic(stripCoursework(current.texContent));
    if (/Relevant Coursework/.test(tex)) throw new Error("stripCoursework failed");
    await prisma.$transaction([
      prisma.masterTemplate.updateMany({ where: { kind: "RESUME", active: true }, data: { active: false } }),
      prisma.masterTemplate.create({ data: { kind: "RESUME", texContent: tex, active: true } }),
    ]);
    const fixture = path.join(process.cwd(), "..", "Resume.tex");
    if (existsSync(fixture)) writeFileSync(fixture, tex, "utf8");
    console.log("stripped coursework from master — tailored pages inject it");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
