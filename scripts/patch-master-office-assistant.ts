import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Idempotently insert the Aug–Oct 2024 Student Office Assistant & Peer Mentor
 * role into the active RESUME master (Postgres). Not a Leadership section:
 * Excel trackers, Word docs, front-desk process, and advising are Experience
 * for analyst/consulting screens. SWE generations drop this entry automatically.
 */
import { PrismaClient } from "@prisma/client";
import { parseResume, assembleResume, normalizeForTectonic } from "../lib/tailor/latex";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const NEW = {
  company: "Seneca Polytechnic — Student Services",
  location: "Toronto, ON",
  title: "Student Office Assistant \\& Peer Mentor",
  dates: "08/2024 -- 10/2024",
  bullets: [
    "Built Excel trackers for open departmental requests after the paper log kept dropping follow-ups, so the desk stopped losing items.",
    "Standardized faculty notices in Word when students kept asking the same process questions, and the front desk reused the one-pager.",
    "Walked incoming students through onboarding and time-management in one-on-ones, then passed recurring concerns to campus staff so orientation notes got updated.",
  ],
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const current = await prisma.masterTemplate.findFirst({ where: { kind: "RESUME", active: true } });
    if (!current) throw new Error("No active RESUME master");
    const parsed = parseResume(current.texContent);
    if (parsed.entries.some((e) => /office assistant|peer mentor/i.test(e.title))) {
      console.log("office-assistant entry already present — skip");
      return;
    }
    const phc = parsed.entries.findIndex((e) => /project human city/i.test(e.company));
    const at = phc >= 0 ? phc + 1 : Math.max(parsed.entries.length - 1, 0);
    parsed.entries.splice(at, 0, NEW);
    const tex = normalizeForTectonic(assembleResume(parsed, parsed.entries.map(() => ({}))));
    parseResume(tex); // round-trip guard
    await prisma.$transaction([
      prisma.masterTemplate.updateMany({ where: { kind: "RESUME", active: true }, data: { active: false } }),
      prisma.masterTemplate.create({ data: { kind: "RESUME", texContent: tex, active: true } }),
    ]);
    const fixture = path.join(process.cwd(), "..", "Resume.tex");
    if (existsSync(fixture)) writeFileSync(fixture, tex, "utf8");
    console.log(`inserted at index ${at}: ${NEW.title.replace(/\\&/g, "&")} (${parsed.entries.length} experience entries)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
