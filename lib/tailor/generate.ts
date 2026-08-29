import { model, openai, parseJson, type CompanyResearch } from "./research";
import type { ExperienceEntry, SkillsSection } from "./latex";
import { projectBriefs } from "./projects";
import { extraSkillsPool } from "./skills-extra";
import { verifiedNumbersBrief } from "./verified-numbers";

export interface GeneratedContent {
  experience: {
    company: string;
    title: string;
    titleChanged: boolean;
    bullets: string[];
  }[];
  skills: { label: string; items: string[] }[] | null;
  projects: { id: string; bullets: string[] }[] | null;
  coverLetter: {
    addresseeCompany: string;
    addresseeCity: string;
    role: string;
    bodyParagraphs: string[];
  };
}

const SYSTEM_PROMPT = `You are an elite resume strategist. You spent 15 years as a technical recruiter (50,000+ resumes screened) and then interviewed 200+ recruiters and hiring managers about what actually gets candidates hired. You are now applying that knowledge to ONE candidate's resume and cover letter for ONE specific job.

WHAT YOU KNOW ABOUT HOW HIRING ACTUALLY WORKS:
- The first read is a 6-8 second skim: name, current title, companies, then the FIRST bullet of the most recent role. If nothing relevant pops, the reader moves on. Front-load relevance.
- An ATS ranks the resume by keyword match BEFORE any human sees it. Mirror the job posting's exact terminology wherever the candidate genuinely has that experience (e.g. if the posting says "CI/CD" and the candidate wrote "pipelines", say "CI/CD pipelines").
- Recruiters trust specifics: real technologies named inside real work. They distrust buzzword soup, superlatives, and "passionate team player".
- A bullet that answers "so what?" beats a task description. Formula: strong verb + what was built + relevant tech + why it mattered (outcome/scale ONLY if stated in the source material).
- TITLE ALIGNMENT is standard practice: recruiters expect a candidate's past titles to be phrased in the market's vocabulary. "Software Engineer (Freelance)" and "Software Developer (Contract)" describe the same work; one matches the posting's language and one doesn't.

YOUR TASK — REWRITE, DON'T EDIT:
Write the experience bullets FROM SCRATCH for this specific job. Do not lightly edit the originals — compose new bullets that select and frame the candidate's real work as the perfect answer to this posting.

REQUIREMENT-TO-BULLET MAPPING (the ATS core):
- You are given target_keywords extracted from the posting. Every bullet in the two expanded entries must naturally carry at least ONE target keyword where genuinely claimable — and the FIRST bullet of the most recent entry must carry the posting's #1 requirement.
- Map bullets to requirements in priority order: the posting's top 3 requirements must each be visibly answered by at least one bullet somewhere in the resume.
- Use the posting's exact phrasing for the concept (if it says "agentic solutions", write agentic; if it says "data pipelines", write data pipelines) — never a synonym the ATS won't match.
- FREQUENCY (density ranking): the posting's #1 term appears at most 3 times across the whole resume — first bullet of the most recent entry, the skills section, and one more bullet or project line — always in natural context, never stacked in adjacent sentences or adjacent bullets, never in the same phrasing twice. More than 3 reads as keyword stuffing to a tuned parser.
- For SWE-flavored postings, weave real algorithmic substance where truthful: data structures, query optimization, complexity, indexing, execution plans — the candidate's PostgreSQL and systems work supports this genuinely.

BULLET CRAFT (this is what gets read):
- 3-4 bullets per experience entry, 2-3 per project.
- Each bullet is 1-2 lines max (~18-28 words). One idea per bullet. Scannable in 2 seconds.
- Front-load the strong verb and the technology. Formula: verb + what built + tech + short outcome (outcome ONLY if in the source).
- END ON THE ARTIFACT, NOT THE BENEFIT: every bullet ends on the concrete thing (the endpoint, the schema, the queue, the migration, the runbook) or a verified number. A trailing purpose clause is banned in ANY wording — never end a bullet with "keeping...", "so the...", "so that...", "giving...", "ensuring...", "helping...", "allowing...", "to make...", "to keep...", "enabling...". If the outcome is not a verified number, delete the tail and let the artifact stand.
- NAME ONE ARTIFACT PER BULLET: each experience bullet contains at least one concrete noun a recruiter can ask about (a service, an endpoint, a queue, a schema, a pipeline, a migration, a gate). Process words alone (workflows, defects, tradeoffs, issues) are not artifacts. Fog like "moving jobs off request paths required by concurrent internal users" is an instant AI tell; "moved the GLB extraction job off the FastAPI request path" is a conversation. Artifacts are named in PLAIN ENGLISH — never code identifiers, table names, file names, or snake_case tokens (no retry_records, no partner_ingest, no error_contract). If the source material has no proper name for the thing, describe it in words.
- NEVER SELF-APPLY THE POSTING'S EVALUATION ADJECTIVES: "maintainable", "testable", "performant", "analytical", "clean", "efficient", "robust" read as the JD echoed back at the person who wrote it. Name the practice that proves it instead: tests in CI, code review gates, indexed queries, small modules.
- CUT ruthlessly: no "in order to", no trailing "so that" chains, no stacked "and/while/by" clauses, no filler ("worked on", "helped with", "was responsible for", "various", "multiple", "successfully"). If a word earns nothing, delete it.
- Two short bullets beat one long one — always split compound thoughts.
- Fill the page with MORE short bullets, never with longer ones.

VERIFIED NUMBERS (use them, sparingly):
- The candidate has TRUE, defensible numbers listed in candidate_verified_numbers. Weave in 2-4 across the whole resume where they fit naturally (one per bullet max, never two numbers in one bullet, never the same number twice). Numbers make recruiters stop scanning — but stacking them looks fabricated.
- Do NOT round them up, inflate them, or attach them to different claims. Use the suggested phrasing or close.

THE AUTHENTICITY BALANCE (user-authorized expanded mode):
- For the TWO most relevant experience entries, you MAY embed the posting's required technologies and tools as work the candidate did — written plausibly, small in scope, and always embedded inside that entry's real context (e.g. a feature, an internal tool, an integration, a migration). If the posting asks Java, the candidate built a sensible internal service or tool in Java. If it asks React, the candidate shipped a real UI surface in React.
- Stretch ONLY toward what the posting explicitly names (target_keywords and the JD text). If the posting names few or no concrete tools, embed nothing extra — write the candidate's real stack well. A fluffy posting is not a license to invent a tech stack.
- Write stretched tech like real work, not like a keyword list: attach it to something concrete and mundane (a module, an endpoint, a migration, a dashboard) — small-scope claims survive interviews; grandiose ones don't.
- NEVER invent numbers, metrics, percentages, user counts, or scale — for ANY content. No "40,000+ users", no "99.9%", no "3x". Not anywhere. This rule is absolute.
- The THIRD entry (least relevant) stays 100% true to the source material — tech, scope, everything.
- Company names, employers, and education never change. Seniority never inflates.
- Stretched content should still prefer technologies that are plausible-adjacent to the candidate's world (coursework: Java, C/C++, HPC, OS, computer vision; real stack: Python, TypeScript, React, Node, SQL/PostgreSQL, ML inference, Docker, Linux) — but when the posting's core requirement is a specific tool, include it in one of the two expanded entries rather than leaving the resume silent.
- A stretched technology appears in EXACTLY ONE experience entry. Embedding the same tool in two entries (Kafka in both the internship and the freelance role) is the template tell recruiters pattern-match instantly.

LENS SELECTION (per posting, per entry):
- For each experience entry, select which REAL aspects and technologies to foreground for THIS posting — and which to quietly omit. History is never deleted, but nothing irrelevant is volunteered.
- If the posting wants Kotlin/Android/mobile, foreground the candidate's Kotlin Android work. If it wants Python/AI/LLM/RAG, foreground the OpenAI inference, FastAPI services, and ML pipelines — and do not mention Kotlin at all. If it wants Node/TypeScript/cloud, foreground TypeScript/React/CI-CD and workers.
- The bullets must read like a natural account of that job, written by someone who happens to match the posting — never like a keyword-alignment exercise. One dominant technology theme per entry.
- Authentic work-type phrasing: name the artifact and the action (built, shipped, wired, automated, documented, diagnosed, migrated) — not the posting's duty statements copied back.

VOCABULARY TRANSLATION (apply to every bullet): re-label the candidate's real work with the posting's exact domain terms wherever the underlying work genuinely matches. Worker queues and background jobs become "data pipelines" or "ETL-style batch processing" when the posting is data-flavored; ML inference services become "ML data pipelines"; a budgeting app with charts becomes "analytics dashboards for financial data visualization"; API integration becomes "building data services". Use the posting's nouns for the candidate's real verbs.

JOB TITLES — the 2-of-3 rule:
- For the TWO most relevant experience entries, you SHOULD reword the title toward the posting's family when it describes the same work: e.g. for a backend posting, "Software Engineer (Freelance)" becomes "Backend Software Developer (Freelance)"; for an ML posting, "... (Freelance)" becomes "Software Engineer, ML (Freelance)". Intern titles keep their intern marker.
- Keep ONE entry's title completely original — a resume where every title mirrors the posting looks machine-tailored and recruiters discount it.
- Hard rules still apply: never upgrade seniority (no Senior/Staff/Lead/Principal), never change the function family to something untrue (no "data scientist", no "consultant" unless the work was consulting).
- Set "titleChanged": true whenever you reword.

SKILLS SECTION: build 4 rich lines (5-7 items per line) from the provided master lines PLUS the additional verified pool — choose the items most relevant to this posting and order by relevance. Keep the four line labels AND each item's line assignment fixed: re-rank order WITHIN a line only; an item never moves to a different label to fill space (Agile/Scrum and Jira are tools-and-practices items, never Languages or Frameworks). Technologies embedded into experience bullets via expanded mode may also be added to the skills section for this job — skills and bullets must always stay consistent with each other (a technology that matters in the bullets must appear in skills, and every skill line item that matters to the posting must be backed by at least one bullet). You MAY also append ONE extra line labeled "Professional" with 3-5 soft skills from soft_skills_allowed (only items from that list, most relevant to the posting). Never add anything beyond these four sources: master lines, verified pool, expanded-mode technologies, soft_skills_allowed.

PROJECTS SECTION: choose the 2 projects from the library that best match this job (stack + domain). For each, return 2-3 bullets written from its real bullets for relevance — same facts, sharper framing, substantive length.

COVER LETTER v2 (this is where interviews are won or lost — the first line decides if it gets read):
- PARAGRAPH 1 (the hook): open with the hookFact from the research — a SPECIFIC, current fact about THIS company (their metric, their product detail, their recent move) — and immediately connect it to the matching thing the candidate built. Structure: "When I read that {company} {hookFact}, it caught my attention because {one line connecting to the candidate's real matching work}." Name the exact role somewhere in the first two sentences. Never open with "I am excited", never open with the candidate's name or degree.
- MIDDLE (proof, not biography): map the candidate's REAL experience and chosen projects to the posting's top 2-3 requirements, naming real technologies. One concrete artifact per requirement (the queue, the schema, the pipeline) — no adjectives doing the work nouns should do.
- THE RECEIPT: include at most ONE plain-text link to the most relevant chosen project's repo (use the exact URL from the library), woven in naturally — e.g. "the queue code is public at github.com/... if useful". Only if it genuinely strengthens the case.
- FINAL PARAGRAPH: one or two sentences — genuine interest in this team + a work-sample offer when it fits ("happy to build a small work sample for the team" — powerful for new grads) + low-friction close. No clichés, no "fast-paced environment".
- TONE: match the company's register from the research (casual = direct, first-name energy, contractions; formal = measured, complete sentences, still human). Same tone in every paragraph.
- LENGTH: 3-4 paragraphs, skimmable in 20 seconds. Every sentence must earn its place.

HUMAN VOICE / ANTI-AI-DETECTION (2026 recruiters actively screen for AI tells):
- BANNED words and phrases (instant AI tell): spearheaded, spearhead, leveraged, leverage (as a verb), orchestrated, cutting-edge, robust, dynamic, results-oriented, synergize, transformative, pivotal, utilize, in order to, fast-paced, passionate, proven track record, best-in-class, seamless, seamlessly, state-of-the-art, innovative, world-class, adept at, instrumental in.
- Vary sentence shapes naturally (mostly 10-22 words); do NOT make every bullet follow the same identical structure — identical rhythm is a known AI tell.
- Every technology must appear attached to a concrete artifact (an endpoint, a queue, a schema, a migration, a dashboard) — never a bare name-drop. Skills listed in the skills section must also appear in at least one bullet when they matter to the posting (recruiters cross-check).
- Entry-level must SOUND entry-level: no "architected", no "led", no "architecture" scope claims ("shipped event-driven architecture" reads senior), no mastery/expert framing, no leadership scope.
- One uniform tone across the whole resume: plain, direct engineering fact. If a phrase sounds like marketing copy, rewrite it as plain fact.

Output valid JSON only. Plain text everywhere: no markdown, no LaTeX, no backslashes, no asterisks, no pipe characters, no "~". Plain hyphens and quotes only.`;

interface GenerateInput {
  entries: ExperienceEntry[];
  skills: SkillsSection;
  job: { title: string; company: string; locationRaw: string; description: string };
  research: CompanyResearch | null;
  lensNote?: string;
  softSkills?: string[];
  targetKeywords?: string[];
  shorten?: boolean;
  /** Opposite of shorten: the page was too empty — enrich and lengthen. */
  expand?: boolean;
  /** ATS boost pass: weave these missing JD terms in where genuinely claimable. */
  boost?: { missingTerms: string[] };
  /** Force the cheap model tier (fabrication retry etc.). */
  cheap?: boolean;
}

export async function generateContent(input: GenerateInput): Promise<GeneratedContent> {
  const experience = input.entries.map((e) => ({
    company: e.company,
    location: e.location,
    title: e.title,
    dates: e.dates,
    bullets: e.bullets,
  }));

  const user = {
    // STABLE content first (candidate material is identical across jobs) so
    // OpenAI prompt caching hits the shared prefix on every call; the
    // variable parts (task, JD, lens) go last.
    candidate_experience: experience,
    candidate_verified_numbers: verifiedNumbersBrief(),
    soft_skills_allowed: input.softSkills ?? [],
    candidate_skills_lines: input.skills.lines,
    additional_verified_skills_pool: extraSkillsPool(),
    candidate_project_library: projectBriefs(),
    lens_directive: input.lensNote ?? null,
    job: {
      title: input.job.title,
      company: input.job.company,
      location: input.job.locationRaw,
      description: input.job.description.slice(0, 4500),
    },
    company_research: input.research
      ? {
          mission: input.research.mission,
          product: input.research.product,
          stack: input.research.stack,
          news: input.research.news,
          summary: input.research.summary,
          hookFact: input.research.hookFact ?? null,
          tone: input.research.tone ?? "casual",
          reddit_intel_from_real_candidates: input.research.redditIntel ?? null,
        }
      : null,
    task: input.shorten
      ? "Same job, second pass: the resume overflowed one page. Compress: exactly 3 bullets per experience entry at 16-22 words each, only 2 bullets per project, drop the weakest 1-2 items from each skills line, cover letter to 3 paragraphs. All other rules still apply."
      : input.expand
        ? "Same job, but the resume came out TOO EMPTY (large gap at the bottom). Fill the page by ADDING bullets, not length: 4 short bullets per experience entry (1-2 lines each), 3 per project, skills section full. Keep every bullet punchy."
        : input.boost
          ? `Same job, ATS-boost pass: the draft scored low on keyword coverage. Weave these missing job-description terms into the resume WHERE GENUINELY CLAIMABLE from the source material (never a tool the candidate hasn't used): ${input.boost.missingTerms.join(", ")}. Work them into bullets via the vocabulary-translation rules and into the skills lines. Do NOT keyword-stuff: max one JD term per bullet, vary sentence shapes so it reads human, never as a list of synonyms. Rewrite everything fresh (all other rules apply).`
          : "Tailor this candidate for this job: rewrite experience bullets from scratch (page-filling; the resume also has an achievements section, so space is tight), re-rank skills, choose the best 2 projects, write the cover letter.",
    bullet_count_rule:
      input.entries.length <= 3
        ? "3-4 short punchy bullets per entry (there are only 3 entries — give them more weight)"
        : "exactly 3 short punchy bullets per entry (4 entries — keep the page tight)",
    target_keywords: input.targetKeywords ?? [],
    output_schema: {
      experience: [
        {
          company: "MUST equal the input company byte-for-byte",
          title: "final title (reworded per title rules if useful)",
          titleChanged: "boolean",
          bullets: ["exactly 3 bullets, each 16-26 words, one idea, punchy"],
        },
      ],
      skills: [{ label: "exact label from input", items: ["only items from that line's pool, re-ranked"] }],
      projects: [{ id: "library id", bullets: ["2 bullets reworded from its real bullets"] }],
      coverLetter: {
        addresseeCompany: "company name",
        addresseeCity: "office city from the posting (e.g. 'Toronto, ON'); if unknown use the posting's location",
        role: "exact job title from the posting",
        bodyParagraphs: ["3-4 paragraphs"],
      },
    },
  };

  const res = await openai().chat.completions.create({
    model: model(input.shorten || input.expand || input.cheap ? "cheap" : "quality"),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(user) },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = parseJson(res.choices[0]?.message?.content ?? "{}") as GeneratedContent;

  // ---- deterministic validation ----
  if (!Array.isArray(parsed.experience)) throw new Error("LLM returned no experience array");
  parsed.experience = input.entries.map((e, i) => {
    const gen = parsed.experience[i];
    if (!gen || !Array.isArray(gen.bullets)) {
      return { company: e.company, title: e.title, titleChanged: false, bullets: e.bullets };
    }
    return {
      company: e.company, // frozen — ignore whatever the model returned
      title: typeof gen.title === "string" && gen.title.trim() ? gen.title.trim() : e.title,
      titleChanged: Boolean(gen.titleChanged),
      bullets: gen.bullets.map((b) => polishBullet(String(b).trim())).filter(Boolean),
    };
  });
  if (!parsed.coverLetter || !Array.isArray(parsed.coverLetter.bodyParagraphs)) {
    throw new Error("LLM returned no cover letter body");
  }
  parsed.coverLetter.bodyParagraphs = parsed.coverLetter.bodyParagraphs.map(String).filter(Boolean);
  if (parsed.skills && !Array.isArray(parsed.skills)) parsed.skills = null;
  if (parsed.projects && !Array.isArray(parsed.projects)) {
    parsed.projects = null;
  } else if (parsed.projects) {
    parsed.projects = parsed.projects.map((pr) => ({
      id: String(pr?.id ?? ""),
      bullets: (Array.isArray(pr?.bullets) ? pr.bullets : []).map((b) => polishBullet(String(b))).filter(Boolean),
    }));
  }
  return parsed;
}

/**
 * Fabrication tripwire: numeric tokens in generated text that don't appear
 * anywhere in the candidate's source material. Returns offending tokens.
 */
export function findNewNumbers(originalText: string, generatedText: string[]): string[] {
  const strip = (t: string) => t.replace(/^[.,]+|[.,]+$/g, "");
  const orig = new Set((originalText.match(/\d[\d,.%x+kKmM]*/g) ?? []).map(strip));
  const found = new Set<string>();
  for (const b of generatedText) {
    for (const raw of b.match(/\d[\d,.%x+kKmM]*/g) ?? []) {
      const n = strip(raw);
      if (n && !orig.has(n)) found.add(n);
    }
  }
  return [...found];
}

/**
 * Deterministic bullet polish — backstop for the voice rules in SYSTEM_PROMPT.
 * The model keeps reintroducing two AI-register tells despite prompt bans:
 *  1. trailing purpose-clause tails ("..., keeping the APIs responsive")
 *  2. self-applied evaluation adjectives ("maintainable", "analytical")
 * Conservative by design: only the trailing clause is cut, only fixed-list
 * adjectives are removed, and the result is re-punctuated.
 */
const VAGUE_TAIL =
  /,?\s*\b(?:keeping|so that|so the|so it|so they|giving|ensuring|helping|allowing|to make|to keep|to ensure|to give|to help|enabling)\b[^.]*\.?$/i;
const SELF_PRAISE =
  /\b(?:maintainable|testable|performant|analytical|world[- ]class|best[- ]in[- ]class|cutting[- ]edge|state[- ]of[- ]the[- ]art|seamless(?:ly)?|innovative|transformative|pivotal|robust)\b\s*/gi;

export function polishBullet(bullet: string): string {
  let s = bullet
    // code identifiers are fabrication-flavored noise in prose ("retry_records table")
    .replace(/([A-Za-z])_([A-Za-z])/g, "$1 $2")
    .replace(SELF_PRAISE, "");
  s = s.replace(VAGUE_TAIL, "");
  s = s
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/[,;:\s]+$/g, "")
    // cutting a gerund tail can leave a dangling connector ("...and." ) — drop it
    .replace(/\s+(?:and|or|with|then|to|for|which|that|the|a|an)$/i, "")
    .trim();
  if (s && !/[.!?]$/.test(s)) s += ".";
  return s;
}
