import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Full before/after walkthrough of one real posting through the real
 * /api/tailor/generate route (dev server must be running).
 *
 * Usage: npx tsx scripts/test-walkthrough.ts <jobId> [--reuse]
 *   --reuse  re-render the last saved version instead of calling the route
 *            (free: no LLM call, no Tectonic run)
 */
import { PrismaClient } from "@prisma/client";
import { parseResume, parseSkillsSection } from "../lib/tailor/latex";
import { detectLens } from "../lib/tailor/lens";
import { softSkillsFor } from "../lib/tailor/soft-skills";
import { claimableJdTerms, missingTerms } from "../lib/tailor/match";
import { auditExperienceBullets, auditProjectBullets, bannedNumberShapes, highSeverityCount } from "../lib/tailor/bullet-quality";

const p = new PrismaClient();
const hr = (t: string) => console.log(`\n${"=".repeat(78)}\n${t}\n${"=".repeat(78)}`);
const wc = (s: string) => s.trim().split(/\s+/).length;

async function main() {
  const jobId = process.argv[2];
  if (!jobId) throw new Error("usage: npx tsx scripts/test-walkthrough.ts <jobId>");

  const job = await p.job.findUniqueOrThrow({ where: { id: jobId } });
  const master = await p.masterTemplate.findFirstOrThrow({ where: { kind: "RESUME", active: true } });

  hr("THE POSTING");
  console.log(`${job.title}\n${job.company} — ${job.locationRaw || job.city || "?"}\nJD length: ${job.description.length} chars`);

  hr("WHAT THE PIPELINE DECIDES BEFORE CALLING THE MODEL");
  const lens = detectLens(job.title, job.description);
  console.log(`lens: ${lens?.id ?? "(none — no dominant theme)"}`);
  if (lens) {
    console.log(`  foreground: ${lens.foreground.join(", ")}`);
    console.log(`  suppress  : ${lens.suppress.join(", ")}`);
  }
  const companyTokens = job.company.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const kws = claimableJdTerms(job.description, 25, companyTokens);
  console.log(`target keywords (${kws.length}): ${kws.join(", ")}`);
  console.log(`soft skills matched: ${softSkillsFor(job.description).join(", ") || "(none)"}`);

  let json: {
    resume: { id: string; version: number; pageCount: number; matchScore: number | null; fillPct?: number; missingKeywords?: string[] };
    cover: { id: string; version: number; pageCount: number };
    chosenProjects?: string[];
    droppedEntries?: string[];
    appliedTitleChanges?: { from: string; to: string; company: string }[];
    warnings?: string[];
  };

  if (process.argv.includes("--reuse")) {
    hr("RE-RENDERING THE LAST SAVED VERSION (no route call, no cost)");
    const [r, c] = await Promise.all([
      p.documentVersion.findFirstOrThrow({ where: { jobId, kind: "RESUME" }, orderBy: { createdAt: "desc" } }),
      p.documentVersion.findFirstOrThrow({ where: { jobId, kind: "COVER" }, orderBy: { createdAt: "desc" } }),
    ]);
    json = {
      resume: { id: r.id, version: r.version, pageCount: r.pageCount, matchScore: r.matchScore },
      cover: { id: c.id, version: c.version, pageCount: c.pageCount },
      appliedTitleChanges: r.titleChangeNote
        ? [{ from: r.titleChangeNote, to: "", company: "(from stored titleChangeNote)" }]
        : [],
    };
  } else {
    hr("RUNNING THE REAL ROUTE (/api/tailor/generate, force: true)");
    const { createSessionToken, SESSION_COOKIE } = await import("../lib/auth");
    const cookie = `${SESSION_COOKIE}=${createSessionToken()}`;
    const t0 = Date.now();
    const res = await fetch("http://localhost:3000/api/tailor/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ jobId, force: true }),
    });
    json = await res.json();
    if (!res.ok) throw new Error(`route ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
    console.log(`took ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log(`resume: v${json.resume.version}  pages=${json.resume.pageCount}  ATS=${json.resume.matchScore}%  fill=${json.resume.fillPct}%`);
  console.log(`cover : v${json.cover.version}  pages=${json.cover.pageCount}`);
  console.log(`projects chosen: ${(json.chosenProjects ?? []).join(", ")}`);
  console.log(`entries dropped: ${(json.droppedEntries ?? []).join("; ") || "(none)"}`);
  if (json.appliedTitleChanges?.length) {
    for (const t of json.appliedTitleChanges) console.log(`title reworded: "${t.from}" -> "${t.to}"`);
  } else {
    console.log("title reworded: (none)");
  }
  if (json.warnings?.length) console.log(`WARNINGS: ${json.warnings.join(" | ")}`);

  const saved = await p.documentVersion.findUniqueOrThrow({ where: { id: json.resume.id } });
  const before = parseResume(master.texContent);
  const after = parseResume(saved.texContent);

  hr("EXPERIENCE — MASTER vs TAILORED");
  for (const a of after.entries) {
    const b = before.entries.find((e) => e.company === a.company);
    console.log(`\n### ${a.company}`);
    console.log(`    title: ${b?.title === a.title ? `${a.title}  (unchanged)` : `${b?.title}  ->  ${a.title}`}`);
    console.log(`\n    MASTER:`);
    for (const x of b?.bullets ?? []) console.log(`      - [${wc(x)}w] ${x}`);
    console.log(`\n    TAILORED:`);
    for (const x of a.bullets) console.log(`      + [${wc(x)}w] ${x}`);
  }
  const dropped = before.entries.filter((b) => !after.entries.some((a) => a.company === b.company));
  for (const d of dropped) console.log(`\n### ${d.company} — REMOVED for this posting`);

  hr("BULLET DOCTRINE AUDIT (deterministic, same check the route runs)");
  const projectAuditInput: { id: string; bullets: string[] }[] = [];
  const projBlockForAudit = saved.texContent.slice(saved.texContent.indexOf("\\section{Projects}"));
  for (const m of projBlockForAudit.matchAll(/\\resumeProjectHeading\s*\{\\textbf\{([^}]*)\}[\s\S]*?\\emph\{([^}]*)\}\}\{([^}]*)\}([\s\S]*?)\\resumeItemListEnd/g)) {
    const bullets = [...m[4].matchAll(/\\resumeItem\{([\s\S]*?)\}\s*(?:\r?\n|$)/g)].map((b) => b[1].trim());
    projectAuditInput.push({ id: m[1], bullets });
  }
  const audit = [
    ...auditExperienceBullets(
      after.entries.map((e) => ({ company: e.company, bullets: e.bullets })),
      { expandedCount: Math.min(2, after.entries.length - 1) }
    ),
    ...auditProjectBullets(projectAuditInput),
  ];
  const banned = bannedNumberShapes(after.entries.flatMap((e) => e.bullets));
  console.log(`high-severity issues: ${highSeverityCount(audit)}`);
  console.log(`indefensible number shapes: ${banned.join(", ") || "(none)"}`);
  for (const i of audit) console.log(`  [${i.severity}] ${i.company.slice(0, 28)}: ${i.message}`);
  if (audit.length === 0) console.log("  (clean)");

  hr("SKILLS — MASTER vs TAILORED");
  const sb = parseSkillsSection(master.texContent);
  const sa = parseSkillsSection(saved.texContent);
  for (const line of sa.lines) {
    const orig = sb.lines.find((l) => l.label === line.label);
    console.log(`\n${line.label}`);
    console.log(`  master  : ${(orig?.items ?? []).join(", ") || "(new line)"}`);
    console.log(`  tailored: ${line.items.join(", ")}`);
  }

  hr("PROJECTS + ACHIEVEMENTS AS THEY APPEAR IN THE PDF");
  const projBlock = saved.texContent.slice(saved.texContent.indexOf("\\section{Projects}"));
  for (const m of projBlock.matchAll(/\\resumeProjectHeading\s*\{\\textbf\{([^}]*)\}[\s\S]*?\\emph\{([^}]*)\}\}\{([^}]*)\}([\s\S]*?)\\resumeItemListEnd/g)) {
    console.log(`\n### ${m[1]}  (${m[2]}, ${m[3]})`);
    for (const b of m[4].matchAll(/\\resumeItem\{([\s\S]*?)\}\s*(?:\r?\n|$)/g)) console.log(`      + [${wc(b[1])}w] ${b[1]}`);
  }
  const ach = saved.texContent.slice(saved.texContent.indexOf("\\section{Achievements}"));
  if (ach.startsWith("\\section{Achievements}")) {
    console.log(`\n### Achievements (deterministic, never LLM-reworded)`);
    for (const b of ach.matchAll(/\\resumeItem\{([\s\S]*?)\}\s*(?:\r?\n|$)/g)) console.log(`      + ${b[1]}`);
  }

  hr("COVER LETTER");
  const cover = await p.documentVersion.findUniqueOrThrow({ where: { id: json.cover.id } });
  for (const m of cover.texContent.matchAll(/\\noindent ([^\\]+?)(?:\s*\\\\)?\s*(?:\r?\n|$)/g)) {
    const t = m[1].trim();
    if (t.length > 40) console.log(`\n[${wc(t)}w] ${t}`);
  }

  hr("ATS VERDICT");
  console.log(`score: ${json.resume.matchScore}%   pages: ${json.resume.pageCount}   fill: ${json.resume.fillPct}%`);
  console.log(`still missing: ${missingTerms(job.description, saved.texContent, 12, job.company).join(", ") || "(nothing claimable)"}`);
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
