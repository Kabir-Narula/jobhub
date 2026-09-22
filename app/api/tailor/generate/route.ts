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
  pinBusinessSkills,
  insertAchievements,
  injectPdfMeta,
  ensureSkillsTerms,
  type ResumeUpdate,
  type ProjectEntry,
} from "@/lib/tailor/latex";
import { ACHIEVEMENTS } from "@/lib/tailor/achievements";
import { generateContent, findNewNumbers, type GeneratedContent } from "@/lib/tailor/generate";
import {
  auditExperienceBullets,
  auditProjectBullets,
  bannedNumberShapes,
  highSeverityCount,
  qualityFeedback,
} from "@/lib/tailor/bullet-quality";
import { researchCompany, type CompanyResearch } from "@/lib/tailor/research";
import { compileLatex } from "@/lib/tailor/compile";
import { matchScore, missingTerms, claimableJdTerms, isTechTerm, placementGaps } from "@/lib/tailor/match";
import { pageFill } from "@/lib/tailor/fill";
import { PROJECTS, projectById, projectSlots, rankProjects } from "@/lib/tailor/projects";
import { ensureBucket, uploadPdf } from "@/lib/supabase";
import { claimableBusinessSkillItems } from "@/lib/tailor/analyst-techniques";
import { metricGuidanceFor, jdTechHome, displayTech } from "@/lib/tailor/metric-guidance";

export const maxDuration = 300;

const RESUME_PAGE_LIMIT = 1;
const COVER_PAGE_LIMIT = 1; // master cover template is single-page
const FILL_TARGET = 0.9; // below this, run one auto-expand pass (no empty bottom)

async function getResearch(jobId: string, refresh = false): Promise<CompanyResearch | null> {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  if (job.companyResearch && !refresh) return job.companyResearch as unknown as CompanyResearch;
  try {
    const research = await researchCompany({
      company: job.company,
      jobTitle: job.title,
      jobDescription: job.description,
      deep: refresh,
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

function ensurePeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function projectPair(profile: { summary: string; bullets: string[] }, generated?: string[]): string[] {
  const fromModel = (generated ?? []).map((b) => b.trim()).filter(Boolean).slice(0, 2);
  if (fromModel.length >= 2) return fromModel;
  return [ensurePeriod(profile.summary), profile.bullets[0]].filter(Boolean).slice(0, 2);
}

function toEntry(profile: { name: string; githubUrl: string; techLine: string; businessTechLine?: string; year: string; summary: string; bullets: string[] }, generated?: string[], business = false): ProjectEntry {
  return {
    name: profile.name,
    githubUrl: profile.githubUrl,
    techLine: business && profile.businessTechLine ? profile.businessTechLine : profile.techLine,
    year: profile.year,
    bullets: projectPair(profile, generated),
  };
}

/** Pick + validate N projects from LLM output; fill gaps from ranked library. */
function resolveProjects(
  gen: GeneratedContent["projects"],
  count: number,
  jobText: string,
  business = false
): { entries: ProjectEntry[]; chosen: string[] } {
  const valid = (gen ?? [])
    .map((g) => {
      const profile = projectById(String(g?.id ?? ""));
      if (!profile) return null;
      return { entry: toEntry(profile, Array.isArray(g.bullets) ? g.bullets.map(String) : [], business), id: profile.id };
    })
    .filter((x): x is { entry: ProjectEntry; id: string } => x !== null);

  const unique = [...new Map(valid.map((v) => [v.id, v])).values()];
  if (unique.length < count) {
    for (const p of rankProjects(jobText, count, unique.map((u) => u.id), { business })) {
      if (unique.length >= count) break;
      unique.push({ entry: toEntry(p, undefined, business), id: p.id });
    }
  }
  const picked = unique.slice(0, count);
  if (picked.length > 0) {
    return { entries: picked.map((u) => u.entry), chosen: picked.map((u) => u.id) };
  }
  const fallback = rankProjects(jobText, Math.max(count, 2), [], { business }).slice(0, Math.max(count, 2));
  return {
    entries: fallback.map((p) => toEntry(p, undefined, business)),
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

  // Cost guard: a generation <24h old is reused instead of spending again.
  // Force a fresh run with { force: true } or deepResearch.
  if (!deepResearch && !body?.force) {
    const recent = await prisma.documentVersion.findFirst({
      where: { jobId, kind: "RESUME", createdAt: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      const recentCover = await prisma.documentVersion.findFirst({
        where: { jobId, kind: "COVER", createdAt: { gte: new Date(recent.createdAt.getTime() - 60000) } },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({
        reused: true,
        resume: { id: recent.id, version: recent.version, pageCount: recent.pageCount, matchScore: recent.matchScore, diff: recent.diffFromMaster },
        cover: recentCover ? { id: recentCover.id, version: recentCover.version, pageCount: recentCover.pageCount, diff: recentCover.diffFromMaster } : null,
        warnings: [],
        appliedTitleChanges: [],
        pendingTitleChanges: [],
        chosenProjects: [],
        research: job.companyResearch ?? null,
      });
    }
  }

  const warnings: string[] = [];
  const requestStart = Date.now();
  try {

  // Jobs without a stored JD (Simplify rows, LinkedIn cards) get hydrated
  // on demand — without it the tailor and ATS score have nothing to work from.
  if (job.description.trim().length < 200) {
    const { hydrateJobDescription } = await import("@/lib/sources/hydrate");
    const hydrated = await hydrateJobDescription(job).catch(() => "");
    if (hydrated) {
      job.description = hydrated;
      await prisma.job.update({ where: { id: job.id }, data: { description: hydrated } });
    } else {
      warnings.push("Job description couldn't be fetched (JS-rendered page) — tailored from the title only; ATS score unavailable.");
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
  const research = await getResearch(job.id, deepResearch || Boolean(body?.force));
  if (!research) {
    warnings.push("Company research failed — generated without company intel (no hook fact or tone match). Retry for a stronger cover letter.");
  }

  const jobInput = { title: job.title, company: job.company, locationRaw: job.locationRaw, description: job.description };
  const { detectLens, lensInstruction } = await import("@/lib/tailor/lens");
  const { softSkillsFor } = await import("@/lib/tailor/soft-skills");
  const { detectRoleFamily, isBusinessFamily, selectExperienceEntries, SKILL_SEEDS } = await import("@/lib/tailor/role-family");
  const family = detectRoleFamily(job.title, job.company, job.description);
  const business = isBusinessFamily(family);
  const lens = detectLens(job.title, job.description, job.company);
  const lensNote = lensInstruction(lens);
  const lensSuppress = lens?.suppress ?? [];
  const allowedByLens = (term: string) => {
    const k = term.toLowerCase();
    return !lensSuppress.some((s) => {
      const sk = s.toLowerCase();
      return Boolean(sk) && (k.includes(sk) || sk.includes(k));
    });
  };
  const softSkills = softSkillsFor(
    job.description,
    family === "consulting" || family === "analyst" || family === "product" ? family : undefined
  );

  // Campus-ops entries (ITS HyFlex, Student Office Assistant & Peer Mentor) stay
  // on consulting/analyst/product/infra resumes and drop on SWE so the page
  // can hold programming bullets + a third project.
  const entriesToUse = selectExperienceEntries(parsedResume.entries, family);
  const droppedEntries = parsedResume.entries
    .filter((e) => !entriesToUse.includes(e))
    .map((e) => `${e.title} at ${e.company}`);
  const parsedForJob = { ...parsedResume, entries: entriesToUse };
  const projectCount = projectSlots(parsedForJob.entries.length, { business });

  const companyTokens = job.company.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const targetKeywords = claimableJdTerms(job.description, 25, companyTokens, job.title);
  for (const t of SKILL_SEEDS[family] ?? []) {
    if (!targetKeywords.includes(t)) targetKeywords.unshift(t);
  }
  if (business) {
    for (const item of claimableBusinessSkillItems(job.description, family)) {
      const k = item.toLowerCase();
      if (!targetKeywords.includes(k)) targetKeywords.push(k);
    }
  }

  // Every pass shares this. Spelling the arguments out per call silently dropped
  // targetKeywords from all four refinement passes, so the resume that actually
  // shipped (usually the shortened one) was written with no ATS keyword targeting
  // while the prompt still demanded keyword coverage.
  const baseInput = {
    entries: parsedForJob.entries,
    skills: skillsSection,
    job: jobInput,
    research,
    lensNote,
    softSkills,
    targetKeywords,
    projectCount,
    metricGuidance: metricGuidanceFor(family),
    ...(family !== "swe" ? { roleFamily: family } : {}),
  };

  let generated: GeneratedContent = await generateContent(baseInput);

  // --- fabrication tripwire over everything the LLM touched ---
  const { verifiedNumbersText } = await import("@/lib/tailor/verified-numbers");
  const originalText =
    parsedResume.entries.flatMap((e) => e.bullets).join(" ") +
    " " +
    PROJECTS.flatMap((p) => p.bullets).join(" ") +
    " " +
    skillsSection.lines.flatMap((l) => l.items).join(" ") +
    " " +
    verifiedNumbersText() +
    " " +
    // company facts from research are legitimate in the cover-letter hook —
    // without this, "your 80,000 devices" false-trips as a fabricated number
    (research ? JSON.stringify(research) : "");
  const generatedText = () => [
    ...generated.experience.flatMap((e) => e.bullets),
    ...(generated.projects ?? []).flatMap((p) => p.bullets ?? []),
    ...generated.coverLetter.bodyParagraphs,
  ];

  // Expanded mode authorizes invented durations and counts, so a number simply
  // being absent from the source material no longer justifies a regeneration —
  // that retried on every legitimate outcome and then warned about it. Only
  // indefensible shapes (percentages, multipliers, scale, money, SLA) force a
  // retry; other new numbers are reported so they can be reviewed, since they
  // are what has to be defended in an interview.
  // Resume bullets only. The cover letter legitimately quotes company facts from
  // the research (TD's "$1,790 in value" package), and scoring those as
  // indefensible triggered a pointless regeneration and then warned about a
  // sentence that was correct.
  const resumeClaims = () => [
    ...generated.experience.flatMap((e) => e.bullets),
    ...(generated.projects ?? []).flatMap((p) => p.bullets ?? []),
  ];
  let banned = bannedNumberShapes(resumeClaims());
  if (banned.length > 0) {
    generated = await generateContent({ ...baseInput });
    banned = bannedNumberShapes(resumeClaims());
    if (banned.length > 0) {
      warnings.push(`Remove before sending — these cannot be defended in a screen: ${banned.join(", ")}`);
    }
  }
  const inventedNumbers = findNewNumbers(originalText, generatedText());
  if (inventedNumbers.length > 0) {
    warnings.push(`Invented figures you will need to defend in an interview: ${inventedNumbers.join(", ")}`);
  }

  // --- title changes require explicit confirmation ---
  // Computed from whichever generation actually ships. Reading `generated` here
  // instead reported the first draft's titles, which the ladder, boost, and
  // expand passes then replaced — so the note disagreed with the saved PDF.
  const titleChangesFor = (gen: GeneratedContent) =>
    gen.experience
      .map((g, i) => ({
        company: g.company,
        from: parsedForJob.entries[i].title,
        to: g.title,
        changed: g.titleChanged && g.title !== parsedForJob.entries[i].title,
      }))
      .filter((t) => t.changed);

  // --- assemble the full document: experience -> projects -> skills -> achievements ---
  interface Clamps {
    compactSkills?: number; // max items per skills line (0 = no clamp)
    maxExpBullets?: number; // max bullets per experience entry (default 4)
    maxProjBullets?: number; // max bullets per project (0 = no clamp)
    maxProjects?: number; // drop the last project(s) before touching experience
    achievements?: number; // max achievement items (0 = drop the section)
  }
  function buildTex(gen: GeneratedContent, clamps: Clamps = {}): string {
    const updates: ResumeUpdate[] = gen.experience.map((g, i) => ({
      title: allowTitleChanges && g.titleChanged ? g.title : undefined,
      bullets: g.bullets.length ? g.bullets : parsedForJob.entries[i].bullets,
    }));
    let tex = assembleResume(parsedForJob, updates, clamps.maxExpBullets ?? 4);
    const { entries: projectEntries } = resolveProjects(
      gen.projects,
      clamps.maxProjects ?? projectCount,
      job!.description,
      business
    );
    tex = assembleProjectsSection(parseProjectsSection(tex), projectEntries, clamps.maxProjBullets ?? 0);
    // Skills may include: master pool + verified extras + JD soft skills +
    // JD hard keywords that this generation actually used in bullets (consistency rule).
    const genText = (
      gen.experience.flatMap((e) => e.bullets).join(" ") +
      " " +
      (gen.projects ?? []).flatMap((p) => p.bullets ?? []).join(" ")
    ).toLowerCase();
    const hardAllowed = business
      ? claimableBusinessSkillItems(job!.description, family).filter(allowedByLens)
      : claimableJdTerms(job!.description, 40, companyTokens, job!.title)
          .filter(isTechTerm)
          .filter((t) => t.split(" ").every((w) => genText.includes(w)))
          .filter(allowedByLens);
    // JD technologies with a plausible-adjacency skills home are allowed into
    // the skills section even without a bullet backing them — the section is
    // the ATS keyword home; experience stays coherent (posting-adjacent rule).
    const jdTechForSkills = business
      ? []
      : claimableJdTerms(job!.description, 60, companyTokens, job!.title)
          .filter((t) => jdTechHome(t) !== undefined)
          .filter(allowedByLens)
          .map(displayTech);
    const allowedExtra = [...new Set([...softSkills, ...hardAllowed, ...jdTechForSkills])];
    tex = assembleSkillsSection(parseSkillsSection(tex), gen.skills ?? null, clamps.compactSkills ?? 0, lensSuppress, allowedExtra);
    if (business) {
      // Keep the model's ranking. Only strip SWE leaks and invented vendors.
      tex = pinBusinessSkills(tex, clamps.compactSkills ?? 0, {
        professional: softSkills,
      });
      tex = ensureSkillsTerms(
        tex,
        placementGaps(job!.description, tex, 6, job!.company).filter(allowedByLens),
        clamps.compactSkills || 7
      );
    } else {
      // Deterministic backfill: homed JD technologies that are still absent
      // from the skills block are placed by line affinity (cap 6, JD frequency
      // order). This is what actually moves coverage — the model may choose
      // fewer posting-adjacent skills than the ceiling allows.
      const jdBackfill = jdTechForSkills
        .filter((t) => !tex.toLowerCase().includes(t.toLowerCase()))
        .slice(0, 12);
      tex = ensureSkillsTerms(
        tex,
        [...new Set([...placementGaps(job!.description, tex, 6, job!.company).filter(allowedByLens).map(displayTech), ...jdBackfill])],
        // 8/line lets the backfill actually land — 7/line fills the Infra line
        // before the JD tooling terms get in (the reason coverage kept churning)
        Math.max(clamps.compactSkills || 0, 8)
      );
    }
    if (clamps.achievements !== 0) tex = insertAchievements(tex, ACHIEVEMENTS.slice(0, clamps.achievements ?? ACHIEVEMENTS.length));
    // ATS ranking layer: the exact-title signal lives in the most recent
    // entry's title (2-of-3 rewording rule, natural to a human reader) and in
    // the PDF metadata — NOT in a visible headline line (posting titles are
    // often junk like "Jr Game Developer Panda3D - Remote").
    tex = injectPdfMeta(tex, { title: `Kabir Narula — Resume — ${job!.title} @ ${job!.company}`, author: "Kabir Narula" });
    return tex;
  }

  let resumeTex = buildTex(generated);
  let resumeResult = await compileLatex(resumeTex);
  let shortenedGen: GeneratedContent | null = null;

  // Escalating compression ladder over ONE shortened generation: skills clamp
  // → bullet clamps → drop achievements (user: removable when space is tight)
  // → hardest clamps.
  const LADDER: {
    compactSkills?: number;
    maxExpBullets?: number;
    maxProjBullets?: number;
    maxProjects?: number;
    achievements?: number;
  }[] = business
    ? [
        {},
        { compactSkills: 7 },
        { compactSkills: 6, maxProjects: 2 },
        { compactSkills: 6, maxProjects: 2, maxProjBullets: 2, achievements: 0 },
        // Never drop consulting entries to 2 bullets — that is the McKinsey stub.
        // Never compact below PowerPoint/Excel — those are the ATS home.
        { compactSkills: 6, maxExpBullets: 3, maxProjects: 2, maxProjBullets: 2, achievements: 0 },
      ]
    : [
        {},
        { compactSkills: 5 },
        // Drop the fill project before touching experience — it was added because
        // there was room, and it is the first thing that should go when there isn't.
        { compactSkills: 4, maxProjects: 2 },
        { compactSkills: 4, maxExpBullets: 3, maxProjects: 2, maxProjBullets: 2 },
        { compactSkills: 4, maxExpBullets: 3, maxProjects: 2, maxProjBullets: 2, achievements: 0 },
        { compactSkills: 4, maxExpBullets: 2, maxProjects: 2, maxProjBullets: 2, achievements: 0 },
      ];
  // The clamp step that made the page fit. Later passes must rebuild with it:
  // rebuilding unclamped guarantees an overflow and the pass gets discarded.
  let activeClamps: Clamps = {};
  for (let attempt = 0; attempt < LADDER.length && resumeResult.pageCount > RESUME_PAGE_LIMIT; attempt++) {
    const clamps = LADDER[attempt];
    // One shorten call, reused across clamp steps — the task text is identical
    // for every step, so regenerating per clamp just burns tokens.
    if (!shortenedGen) {
      shortenedGen = await generateContent({ ...baseInput, shorten: true, projectCount: 2 });
    }
    resumeTex = buildTex(shortenedGen, clamps);
    resumeResult = await compileLatex(resumeTex);
    if (resumeResult.pageCount <= RESUME_PAGE_LIMIT) {
      generated = shortenedGen;
      activeClamps = clamps;
      break;
    }
  }
  const wasCompressed = shortenedGen !== null;
  if (resumeResult.pageCount > RESUME_PAGE_LIMIT) {
    return NextResponse.json(
      { error: `Resume came out to ${resumeResult.pageCount} pages even after ${LADDER.length} compression passes — not saving. Try again.` },
      { status: 422 }
    );
  }

  // --- ATS optimization loop: score, weave claimable missing terms, re-score ---
  let score = matchScore(job.description, resumeTex, job.company, job.title);
  if (score !== null && score < 70) {
    const missing = missingTerms(job.description, resumeTex, 25, job.company, job.title).filter(allowedByLens);
    if (missing.length > 0) {
      const boosted = await generateContent({
        ...baseInput,
        boost: { missingTerms: missing },
        ...(wasCompressed ? { shorten: true, projectCount: 2 } : {}),
      });
      const boostedTex = buildTex(boosted, activeClamps);
      const boostedResult = await compileLatex(boostedTex);
      if (boostedResult.pageCount === 1) {
        const boostedScore = matchScore(job.description, boostedTex, job.company, job.title);
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
  // Skip when the ladder already ran: asking for more content right after
  // compressing to fit is self-defeating, and the clamps would trim the extra
  // bullets straight back off. The sparseness there is the clamps, not the draft.
  if (fillPct < FILL_TARGET * 100 && resumeResult.pageCount === 1 && !wasCompressed) {
    const expanded = await generateContent({ ...baseInput, expand: true });
    const expandedTex = buildTex(expanded, activeClamps);
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

  // --- bullet doctrine gate, on the draft that actually ships ---
  // Deliberately last: the prompt alone drifts back to filler, keyword lists and
  // entries built from three identical greenfield bullets, and auditing the FIRST
  // draft measured content later passes then overwrote — the repair was spent on
  // a draft nobody would ever see. Same trap as the title note. One repair, only
  // for high-severity issues, and only if it survives the same page and ATS bars
  // as every other pass.
  const auditOpts = {
    // Consulting: every entry is CAR, including campus-ops. SWE: last software
    // entry stays the verbatim-true anchor.
    expandedCount: business ? parsedForJob.entries.length : Math.min(2, parsedForJob.entries.length - 1),
    ...(business ? { family: "consulting" as const } : {}),
  };
  const auditAll = (gen: typeof generated) => [
    ...auditExperienceBullets(gen.experience, auditOpts),
    ...auditProjectBullets(gen.projects ?? [], business ? { family: "consulting" } : {}),
  ];
  let bulletIssues = auditAll(generated);
  // A repair costs one quality-tier call plus a compile. Skipping it when the
  // request is already close to maxDuration is better than being killed after
  // the work is done but before anything is saved.
  const timeForRepair = Date.now() - requestStart < 200_000;
  if (highSeverityCount(bulletIssues) > 0 && timeForRepair) {
    const repaired = await generateContent({
      ...baseInput,
      qualityIssues: qualityFeedback(bulletIssues, business ? "consulting" : undefined),
      // Keep whichever length mode made the page fit, or the repair overflows and
      // gets discarded for a reason that has nothing to do with bullet quality.
      ...(wasCompressed ? { shorten: true, projectCount: 2 } : {}),
    });
    const repairedIssues = auditAll(repaired);
    if (
      highSeverityCount(repairedIssues) < highSeverityCount(bulletIssues) &&
      bannedNumberShapes([
        ...repaired.experience.flatMap((e) => e.bullets),
        ...(repaired.projects ?? []).flatMap((p) => p.bullets ?? []),
      ]).length === 0
    ) {
      const repairedTex = buildTex(repaired, activeClamps);
      const repairedResult = await compileLatex(repairedTex);
      const repairedScore = matchScore(job.description, repairedTex, job.company, job.title);
      // Better prose is not worth falling out of the keyword ranking, and it is
      // never worth a second page.
      if (
        repairedResult.pageCount <= RESUME_PAGE_LIMIT &&
        (score === null || repairedScore === null || repairedScore >= score)
      ) {
        resumeTex = repairedTex;
        resumeResult = repairedResult;
        generated = repaired;
        bulletIssues = repairedIssues;
        if (repairedScore !== null) score = repairedScore;
        fillPct = Math.round((await pageFill(repairedResult.pdf)) * 100);
      }
    }
  }
  if (highSeverityCount(bulletIssues) > 0) {
    warnings.push(
      `Bullet quality — fix before sending: ${bulletIssues
        .filter((i) => i.severity === "high")
        .slice(0, 3)
        .map((i) => i.message)
        .join(" | ")}`
    );
  }

  // Every pass that could replace `generated` has now run.
  const finalTitleChanges = titleChangesFor(generated);
  const shippedProjectCount = activeClamps.maxProjects ?? projectCount;
  const { chosen: chosenProjects } = resolveProjects(generated.projects, shippedProjectCount, job.description, business);

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
  const missing = missingTerms(job.description, resumeTex, 12, job.company, job.title);

  // --- persist + upload ---
  await ensureBucket();
  const [resumeVersion, coverVersion] = await Promise.all([nextVersion(job.id, "RESUME"), nextVersion(job.id, "COVER")]);
  const resumePath = `jobs/${job.id}/resume-v${resumeVersion}.pdf`;
  const coverPath = `jobs/${job.id}/cover-v${coverVersion}.pdf`;
  await Promise.all([uploadPdf(resumePath, resumeResult.pdf), uploadPdf(coverPath, coverResult.pdf)]);

  const application = await prisma.application.findFirst({ where: { jobId: job.id } });

  const titleNote =
    allowTitleChanges && finalTitleChanges.length
      ? `Title changes applied with your confirmation: ${finalTitleChanges.map((t) => `"${t.from}" → "${t.to}"`).join("; ")}`
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
    appliedTitleChanges: allowTitleChanges ? finalTitleChanges : [],
    pendingTitleChanges: allowTitleChanges ? [] : finalTitleChanges,
    chosenProjects,
    droppedEntries,
    research,
  });
  } catch (err) {
    console.error("[tailor/generate]", err);
    const raw = err instanceof Error ? err.message : "";
    const error = /Tectonic|Missing \\}/i.test(raw)
      ? "Resume failed to compile. Click generate again."
      : /omitted experience/i.test(raw)
        ? "The model skipped an experience entry. Click generate again."
        : "Generation failed. Click generate again.";
    return NextResponse.json({ error }, { status: 500 });
  }
}
