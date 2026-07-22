import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  normalizeForTectonic,
  parseResume,
  parseCover,
  assembleResume,
  assembleCover,
  parseProjectsSection,
  assembleProjectsSection,
  parseSkillsSection,
  assembleSkillsSection,
} from "../lib/tailor/latex";
import { researchCompany } from "../lib/tailor/research";
import { generateContent, findNewNumbers } from "../lib/tailor/generate";
import { compileLatex } from "../lib/tailor/compile";
import { matchScore } from "../lib/tailor/match";
import { pageFill } from "../lib/tailor/fill";
import { PROJECTS, projectById } from "../lib/tailor/projects";

const JOB = {
  title: "Software Developer - Infrastructure",
  company: "Geotab",
  locationRaw: "Oakville, Ontario - Canada; Toronto, Ontario - Canada",
  description: `Geotab is hiring a Software Developer on the Infrastructure team in the GTA (Oakville/Toronto, hybrid).
You will build and maintain the backend services that ingest and process billions of telematics data points per day.

Responsibilities:
- Design and implement scalable REST APIs and data pipelines in Python and Go
- Operate services on Kubernetes and Google Cloud, with strong CI/CD practices
- Work with PostgreSQL, Redis, Pub/Sub, and distributed systems at scale
- Collaborate across teams; write design docs and review code

Requirements:
- 0-2 years of software development experience (new grads welcome)
- Strong CS fundamentals; experience with Python, SQL, Linux, Docker, CI/CD
- Bonus: FastAPI, Redis/queues, PostgreSQL optimization, monitoring/observability`,
};

async function main() {
  const outDir = path.join(process.cwd(), "scripts", "output");
  mkdirSync(outDir, { recursive: true });

  const masterTex = normalizeForTectonic(readFileSync(path.join(process.cwd(), "..", "Resume.tex"), "utf8"));
  const coverMaster = normalizeForTectonic(readFileSync(path.join(process.cwd(), "..", "cover.tex"), "utf8"));

  const parsedResume = parseResume(masterTex);
  const skillsSection = parseSkillsSection(masterTex);

  console.log("1) research…");
  const research = await researchCompany({ company: JOB.company, jobTitle: JOB.title, jobDescription: JOB.description });
  console.log(`   ${research.summary.slice(0, 140)}`);

  console.log("2) generate (gpt-5.5)…");
  const generated = await generateContent({ entries: parsedResume.entries, skills: skillsSection, job: JOB, research });

  console.log(`   projects chosen: ${(generated.projects ?? []).map((p) => p.id).join(", ")}`);
  console.log(`   skills returned: ${(generated.skills ?? []).map((s) => `${s.label}(${s.items.length})`).join(", ")}`);
  for (const [i, g] of generated.experience.entries()) {
    console.log(`   [${g.company}] titleChanged=${g.titleChanged}, bullets ${g.bullets.length}/${parsedResume.entries[i].bullets.length}`);
  }

  const originalText =
    parsedResume.entries.flatMap((e) => e.bullets).join(" ") +
    " " + PROJECTS.flatMap((p) => p.bullets).join(" ") +
    " " + skillsSection.lines.flatMap((l) => l.items).join(" ");
  const newNums = findNewNumbers(originalText, [
    ...generated.experience.flatMap((e) => e.bullets),
    ...(generated.projects ?? []).flatMap((p) => p.bullets ?? []),
    ...generated.coverLetter.bodyParagraphs,
  ]);
  console.log(`   fabrication check: ${newNums.length ? "FLAG " + newNums.join(",") : "clean"}`);

  // assemble
  let tex = assembleResume(parsedResume, generated.experience.map((g, i) => ({
    title: g.titleChanged ? g.title : undefined,
    bullets: g.bullets.length ? g.bullets : parsedResume.entries[i].bullets,
  })));
  const projectEntries = (generated.projects ?? []).slice(0, 2).map((g) => {
    const p = projectById(g.id)!;
    return { name: p.name, githubUrl: p.githubUrl, techLine: p.techLine, year: p.year, bullets: g.bullets.slice(0, 2) };
  });
  tex = assembleProjectsSection(parseProjectsSection(tex), projectEntries);
  tex = assembleSkillsSection(parseSkillsSection(tex), generated.skills ?? null);

  const coverTex = assembleCover(parseCover(coverMaster), {
    addresseeCompany: generated.coverLetter.addresseeCompany,
    addresseeCity: generated.coverLetter.addresseeCity,
    role: generated.coverLetter.role,
    bodyParagraphs: generated.coverLetter.bodyParagraphs,
  });

  console.log("3) compile…");
  const r = await compileLatex(tex);
  const c = await compileLatex(coverTex);
  const masterCompiled = await compileLatex(masterTex);
  const fillMaster = await pageFill(masterCompiled.pdf);
  const fillNew = await pageFill(r.pdf);
  console.log(`   resume: ${r.pageCount} page | cover: ${c.pageCount} page | ATS: ${matchScore(JOB.description, tex)}%`);
  console.log(`   page fill: master ${(fillMaster * 100).toFixed(1)}% -> tailored ${(fillNew * 100).toFixed(1)}%`);

  // frozen-section assertions
  const edu = (s: string) => s.slice(s.indexOf("\\section{Education}"), s.indexOf("\\section{Experience}"));
  console.log(`   Education frozen: ${edu(masterTex) === edu(tex)}`);
  for (const e of parsedResume.entries) console.log(`   company frozen: ${tex.includes(`{${e.company}}`)} — ${e.company}`);

  writeFileSync(path.join(outDir, "v2-resume.tex"), tex);
  writeFileSync(path.join(outDir, "v2-cover.tex"), coverTex);
  writeFileSync(path.join(outDir, "v2-resume.pdf"), r.pdf);
  writeFileSync(path.join(outDir, "v2-cover.pdf"), c.pdf);
  console.log(`   written to ${outDir}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
