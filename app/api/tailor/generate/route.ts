import { NextResponse } from "next/server";
import { createTwoFilesPatch } from "diff";
import { prisma } from "@/lib/db";
import {
  parseResume,
  parseCover,
  assembleResume,
  assembleCover,
  parseProjectsSection,
  assembleProjectsSection,
  parseSkillsSection,
  assembleSkillsSection,
  insertAchievements,
  type ResumeUpdate,
  type ProjectEntry,
} from "@/lib/tailor/latex";
import { ACHIEVEMENTS } from "@/lib/tailor/achievements";
import { generateContent, findNewNumbers, type GeneratedContent } from "@/lib/tailor/generate";
import { researchCompany, type CompanyResearch } from "@/lib/tailor/research";
import { compileLatex } from "@/lib/tailor/compile";
import { matchScore, missingTerms } from "@/lib/tailor/match";
import { pageFill } from "@/lib/tailor/fill";
import { PROJECTS, projectById } from "@/lib/tailor/projects";
import { ensureBucket, uploadPdf } from "@/lib/supabase";

export const maxDuration = 300;

const RESUME_PAGE_LIMIT = 1;
const COVER_PAGE_LIMIT = 1; // master cover template is single-page
const FILL_TARGET = 0.9; // below this, run one auto-expand pass (no empty bottom)

async function getResearch(jobId: string, deep = false): Promise<CompanyResearch | null> {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  if (job.companyResearch && !deep) return job.companyResearch as unknown as CompanyResearch;
  try {
    const research = await researchCompany({
      company: job.company,
      jobTitle: job.title,
      jobDescription: job.description,
      deep,
    });
    await prisma.job.update({
      where: { id: job.id },
      data: { companyResearch: research as never, researchedAt: new Date() },
    });
    return research;
  } catch {
    return null; // research is an enhancement, not a blocker
  }
}

async function nextVersion(jobId: string, kind: "RESUME" | "COVER"): Promise<number> {
  const agg = await prisma.documentVersion.aggregate({ where: { jobId, kind }, _max: { version: true } });
  return (agg._max.version ?? 0) + 1;
}

/** Pick + validate the 2 projects from LLM output; fall back to the master's two. */
function resolveProjects(gen: GeneratedContent["projects"]): { entries: ProjectEntry[]; chosen: string[] } {
  const valid = (gen ?? [])
    .map((g) => {
      const profile = projectById(String(g?.id ?? ""));
      if (!profile) return null;
      const bullets = (Array.isArray(g.bullets) ? g.bullets : [])
        .map((b) => String(b).trim())
        .filter(Boolean)
        .slice(0, profile.bullets.length);
      return {
        entry: {
          name: profile.name,
          githubUrl: profile.githubUrl,
          techLine: profile.techLine,
          year: profile.year,
          bullets: bullets.length >= 2 ? bullets : profile.bullets.slice(0, 2),
        },
        id: profile.id,
      };
    })
    .filter((x): x is { entry: ProjectEntry; id: string } => x !== null);

  const unique = [...new Map(valid.map((v) => [v.id, v])).values()].slice(0, 2);
  if (unique.length === 2) {
    return { entries: unique.map((u) => u.entry), chosen: unique.map((u) => u.id) };
  }
  // fallback: the master's original two
  const fallback = [PROJECTS.find((p) => p.id === "vertexflow")!, PROJECTS.find((p) => p.id === "bettermind")!];
  return {
    entries: fallback.map((p) => ({
      name: p.name,
      githubUrl: p.githubUrl,
      techLine: p.techLine,
      year: p.year,
      bullets: p.bullets.slice(0, 2),
    })),
    chosen: fallback.map((p) => p.id),
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = String(body?.jobId ?? "");
  // Title optimization is ON by default (user granted standing permission);
  // pass allowTitleChanges: false to force original titles.
  const allowTitleChanges = body?.allowTitleChanges !== false;
  const deepResearch = Boolean(body?.deepResearch);
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  // Jobs without a stored JD (Simplify rows, LinkedIn cards) get hydrated
  // on demand — without it the tailor and ATS score have nothing to work from.
  if (job.description.trim().length < 200) {
    const { hydrateJobDescription } = await import("@/lib/sources/hydrate");
    const hydrated = await hydrateJobDescription(job).catch(() => "");
    if (hydrated) {
      job.description = hydrated;
      await prisma.job.update({ where: { id: job.id }, data: { description: hydrated } });
    }
  }

  const [resumeMaster, coverMaster] = await Promise.all([
    prisma.masterTemplate.findFirst({ where: { kind: "RESUME", active: true } }),
    prisma.masterTemplate.findFirst({ where: { kind: "COVER", active: true } }),
  ]);
  if (!resumeMaster || !coverMaster) {
    return NextResponse.json({ error: "Master templates missing — run npm run db:seed" }, { status: 412 });
  }

  const masterTex = resumeMaster.texContent;
  const parsedResume = parseResume(masterTex);
  const skillsSection = parseSkillsSection(masterTex);
  const research = await getResearch(job.id, deepResearch);

  const jobInput = { title: job.title, company: job.company, locationRaw: job.locationRaw, description: job.description };

  let generated: GeneratedContent = await generateContent({
    entries: parsedResume.entries,
    skills: skillsSection,
    job: jobInput,
    research,
  });

  // --- fabrication tripwire over everything the LLM touched ---
  const originalText =
    parsedResume.entries.flatMap((e) => e.bullets).join(" ") +
    " " +
    PROJECTS.flatMap((p) => p.bullets).join(" ") +
    " " +
    skillsSection.lines.flatMap((l) => l.items).join(" ");
  const generatedText = () => [
    ...generated.experience.flatMap((e) => e.bullets),
    ...(generated.projects ?? []).flatMap((p) => p.bullets ?? []),
    ...generated.coverLetter.bodyParagraphs,
  ];

  const warnings: string[] = [];
  let newNumbers = findNewNumbers(originalText, generatedText());
  if (newNumbers.length > 0) {
    generated = await generateContent({ entries: parsedResume.entries, skills: skillsSection, job: jobInput, research, shorten: false });
    newNumbers = findNewNumbers(originalText, generatedText());
    if (newNumbers.length > 0) {
      warnings.push(`Review carefully: these numbers are NOT in your source material: ${newNumbers.join(", ")}`);
    }
  }

  // --- title changes require explicit confirmation ---
  const pendingTitleChanges = generated.experience
    .map((g, i) => ({
      company: g.company,
      from: parsedResume.entries[i].title,
      to: g.title,
      changed: g.titleChanged && g.title !== parsedResume.entries[i].title,
    }))
    .filter((t) => t.changed);

  // --- assemble the full document: experience -> projects -> skills -> achievements ---
  interface Clamps {
    compactSkills?: number; // max items per skills line (0 = no clamp)
    maxExpBullets?: number; // max bullets per experience entry (default 4)
    maxProjBullets?: number; // max bullets per project (0 = no clamp)
  }
  function buildTex(gen: GeneratedContent, clamps: Clamps = {}): string {
    const updates: ResumeUpdate[] = gen.experience.map((g, i) => ({
      title: allowTitleChanges && g.titleChanged ? g.title : undefined,
      bullets: g.bullets.length ? g.bullets : parsedResume.entries[i].bullets,
    }));
    let tex = assembleResume(parsedResume, updates, clamps.maxExpBullets ?? 4);
    const { entries: projectEntries } = resolveProjects(gen.projects);
    tex = assembleProjectsSection(parseProjectsSection(tex), projectEntries, clamps.maxProjBullets ?? 0);
    tex = assembleSkillsSection(parseSkillsSection(tex), gen.skills ?? null, clamps.compactSkills ?? 0);
    tex = insertAchievements(tex, ACHIEVEMENTS);
    return tex;
  }

  let resumeTex = buildTex(generated);
  let resumeResult = await compileLatex(resumeTex);

  // Escalating compression ladder: LLM shorten → +skills clamp → +hard clamps.
  const LADDER: { shorten: boolean; clamps: { compactSkills?: number; maxExpBullets?: number; maxProjBullets?: number } }[] = [
    { shorten: true, clamps: {} },
    { shorten: true, clamps: { compactSkills: 5 } },
    { shorten: true, clamps: { compactSkills: 4, maxExpBullets: 3, maxProjBullets: 2 } },
  ];
  for (let attempt = 0; attempt < LADDER.length && resumeResult.pageCount > RESUME_PAGE_LIMIT; attempt++) {
    const step = LADDER[attempt];
    const shortened = await generateContent({ entries: parsedResume.entries, skills: skillsSection, job: jobInput, research, shorten: step.shorten });
    resumeTex = buildTex(shortened, step.clamps);
    resumeResult = await compileLatex(resumeTex);
    if (resumeResult.pageCount <= RESUME_PAGE_LIMIT) {
      generated = shortened;
      break;
    }
  }
  if (resumeResult.pageCount > RESUME_PAGE_LIMIT) {
    return NextResponse.json(
      { error: `Resume came out to ${resumeResult.pageCount} pages even after ${LADDER.length} compression passes — not saving. Try again.` },
      { status: 422 }
    );
  }

  // --- ATS optimization loop: score, weave claimable missing terms, re-score ---
  let score = matchScore(job.description, resumeTex, job.company);
  if (score !== null && score < 70) {
    const missing = missingTerms(job.description, resumeTex, 25, job.company);
    if (missing.length > 0) {
      const boosted = await generateContent({ entries: parsedResume.entries, skills: skillsSection, job: jobInput, research, boost: { missingTerms: missing } });
      const boostedTex = buildTex(boosted);
      const boostedResult = await compileLatex(boostedTex);
      if (boostedResult.pageCount === 1) {
        const boostedScore = matchScore(job.description, boostedTex, job.company);
        if (boostedScore !== null && (score === null || boostedScore > score)) {
          resumeTex = boostedTex;
          resumeResult = boostedResult;
          generated = boosted;
          score = boostedScore;
        }
      }
    }
  }

  // --- closed-loop page fill: measure actual text coverage, expand if sparse ---
  let fillPct = Math.round((await pageFill(resumeResult.pdf)) * 100);
  if (fillPct < FILL_TARGET * 100 && resumeResult.pageCount === 1) {
    const expanded = await generateContent({ entries: parsedResume.entries, skills: skillsSection, job: jobInput, research, expand: true });
    const expandedTex = buildTex(expanded);
    const expandedResult = await compileLatex(expandedTex);
    if (expandedResult.pageCount === 1) {
      const expandedFill = Math.round((await pageFill(expandedResult.pdf)) * 100);
      if (expandedFill > fillPct) {
        resumeTex = expandedTex;
        resumeResult = expandedResult;
        generated = expanded;
        fillPct = expandedFill;
      }
    }
  }

  const { chosen: chosenProjects } = resolveProjects(generated.projects);

  // --- cover letter ---
  const parsedCover = parseCover(coverMaster.texContent);
  const coverUpdate = {
    addresseeCompany: generated.coverLetter.addresseeCompany || job.company,
    addresseeCity: generated.coverLetter.addresseeCity || job.locationRaw || "Toronto, ON",
    role: generated.coverLetter.role || job.title,
    bodyParagraphs: generated.coverLetter.bodyParagraphs,
  };
  let coverTex = assembleCover(parsedCover, coverUpdate);
  let coverResult = await compileLatex(coverTex);
  if (coverResult.pageCount > COVER_PAGE_LIMIT) {
    if (coverUpdate.bodyParagraphs.length > 3) {
      coverTex = assembleCover(parsedCover, { ...coverUpdate, bodyParagraphs: coverUpdate.bodyParagraphs.slice(0, 3) });
      coverResult = await compileLatex(coverTex);
    }
    if (coverResult.pageCount > COVER_PAGE_LIMIT) {
      return NextResponse.json(
        { error: `Cover letter came out to ${coverResult.pageCount} pages — not saving. Shorten and retry.` },
        { status: 422 }
      );
    }
  }

  // --- diffs + score ---
  const resumeDiff = createTwoFilesPatch("master.tex", "tailored.tex", masterTex, resumeTex, "", "", { context: 2 });
  const coverDiff = createTwoFilesPatch("master.tex", "tailored.tex", coverMaster.texContent, coverTex, "", "", { context: 2 });
  const missing = missingTerms(job.description, resumeTex, 12, job.company);

  // --- persist + upload ---
  await ensureBucket();
  const [resumeVersion, coverVersion] = await Promise.all([nextVersion(job.id, "RESUME"), nextVersion(job.id, "COVER")]);
  const resumePath = `jobs/${job.id}/resume-v${resumeVersion}.pdf`;
  const coverPath = `jobs/${job.id}/cover-v${coverVersion}.pdf`;
  await Promise.all([uploadPdf(resumePath, resumeResult.pdf), uploadPdf(coverPath, coverResult.pdf)]);

  const application = await prisma.application.findFirst({ where: { jobId: job.id } });

  const titleNote =
    allowTitleChanges && pendingTitleChanges.length
      ? `Title changes applied with your confirmation: ${pendingTitleChanges.map((t) => `"${t.from}" → "${t.to}"`).join("; ")}`
      : "";

  const [resumeDoc, coverDoc] = await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        jobId: job.id,
        applicationId: application?.id ?? null,
        kind: "RESUME",
        version: resumeVersion,
        texContent: resumeTex,
        pdfStoragePath: resumePath,
        diffFromMaster: resumeDiff,
        pageCount: resumeResult.pageCount,
        matchScore: score,
        status: "DRAFT",
        titleChangeNote: titleNote,
      },
    }),
    prisma.documentVersion.create({
      data: {
        jobId: job.id,
        applicationId: application?.id ?? null,
        kind: "COVER",
        version: coverVersion,
        texContent: coverTex,
        pdfStoragePath: coverPath,
        diffFromMaster: coverDiff,
        pageCount: coverResult.pageCount,
        matchScore: null,
        status: "DRAFT",
      },
    }),
  ]);

  return NextResponse.json({
    resume: { id: resumeDoc.id, version: resumeVersion, pageCount: resumeResult.pageCount, matchScore: score, fillPct, missingKeywords: missing, diff: resumeDiff },
    cover: { id: coverDoc.id, version: coverVersion, pageCount: coverResult.pageCount, diff: coverDiff },
    warnings,
    appliedTitleChanges: allowTitleChanges ? pendingTitleChanges : [],
    pendingTitleChanges: allowTitleChanges ? [] : pendingTitleChanges,
    chosenProjects,
    research,
  });
}
