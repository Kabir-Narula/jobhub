import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Rename the master skills labels to the canonical set the tailoring engine
 * assumes ("Languages" / "Infra & Tools" / "Frameworks" / "Cloud & Data" —
 * see skills-extra.ts and JD_TECH_HOME in metric-guidance.ts):
 * "ML & Infra" becomes "Infra & Tools" and Machine Learning moves under
 * "Cloud & Data". Without this, JD_TECH_HOME skills homing silently no-ops
 * because the target line does not exist. Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import { parseSkillsSection, normalizeForTectonic } from "../lib/tailor/latex";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const prisma = new PrismaClient();
  try {
    const current = await prisma.masterTemplate.findFirst({ where: { kind: "RESUME", active: true } });
    if (!current) throw new Error("No active RESUME master");
    let tex = current.texContent;
    if (!/\\textbf\{ML \\& Infra\}/.test(tex)) {
      console.log("skills labels already canonical — skip");
      return;
    }

    const mlLine = /\\textbf\{ML \\& Infra\}\{:([^}]*)\}/.exec(tex);
    if (!mlLine) throw new Error("ML & Infra line found but not parseable");
    const items = mlLine[1]
      .replace(/\\\\\s*$/, "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !/^Machine Learning$/i.test(s));
    tex = tex.replace(mlLine[0], `\\textbf{Infra \\& Tools}{: ${items.join(", ")} \\\\}`);

    const cloudLine = /\\textbf\{Cloud \\& Data\}\{:([^}]*)\}/.exec(tex);
    if (!cloudLine) throw new Error("Cloud & Data line not found");
    if (!/Machine Learning/i.test(cloudLine[1])) {
      tex = tex.replace(cloudLine[0], cloudLine[0].replace("{:", "{: Machine Learning,"));
    }

    tex = normalizeForTectonic(tex);
    const section = parseSkillsSection(tex);
    const labels = section.lines.map((l) => l.label);
    if (!labels.includes("Infra \\& Tools") || labels.some((l) => /ML \\& Infra/.test(l))) {
      throw new Error(`label rename failed validation: ${labels.join(" | ")}`);
    }
    if (!section.lines.find((l) => l.label === "Cloud \\& Data")?.items.some((i) => /Machine Learning/i.test(i))) {
      throw new Error("Machine Learning did not land under Cloud & Data");
    }

    await prisma.$transaction([
      prisma.masterTemplate.updateMany({ where: { kind: "RESUME", active: true }, data: { active: false } }),
      prisma.masterTemplate.create({ data: { kind: "RESUME", texContent: tex, active: true } }),
    ]);
    const fixture = path.join(process.cwd(), "..", "Resume.tex");
    if (existsSync(fixture)) writeFileSync(fixture, tex, "utf8");
    console.log(`renamed skills labels: ${labels.map((l) => l.replace(/\\&/g, "&")).join(" | ")}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
