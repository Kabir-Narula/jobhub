import { model, openai, type CompanyResearch } from "./research";
import type { ExperienceEntry, SkillsSection } from "./latex";
import { projectBriefs } from "./projects";

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

BULLET CRAFT (this is what gets read):
- 3-4 bullets per experience entry, 2-3 per project.
- Each bullet is 1-2 lines max (~18-28 words). One idea per bullet. Scannable in 2 seconds.
- Front-load the strong verb and the technology. Formula: verb + what built + tech + short outcome (outcome ONLY if in the source).
- CUT ruthlessly: no "in order to", no trailing "so that" chains, no stacked "and/while/by" clauses, no filler ("worked on", "helped with", "was responsible for", "various", "multiple", "successfully"). If a word earns nothing, delete it.
- Two short bullets beat one long one — always split compound thoughts.
- Fill the page with MORE short bullets, never with longer ones.

THE AUTHENTICITY BALANCE (the whole craft):
- Every claim must be TRUE to the source material: same employers, same kind of work, same real technologies, same scope. You are choosing the most relevant TRUE framing, not inventing a career.
- VOCABULARY TRANSLATION (do this aggressively, it is how real resume writers work): re-label the candidate's real work with the posting's exact domain terms wherever the underlying work genuinely matches. Worker queues and background jobs become "data pipelines" or "ETL-style batch processing" when the posting is data-flavored; ML inference services become "ML data pipelines"; a budgeting app with charts becomes "analytics dashboards for financial data visualization"; API integration becomes "building data services". Use the posting's nouns for the candidate's real verbs.
  Worked example for a Data & Analytics posting: "Redis-backed BullMQ worker queues with sync fallback" becomes "built resilient data pipelines processing heavy jobs asynchronously"; "pie charts and bar charts with month-over-month trends" becomes "built analytics dashboards visualizing spending trends"; "sentiment scoring and pattern detection with confidence scores" becomes "developed ML data pipelines producing scored analytics outputs". Apply this level of translation to EVERY bullet.
- The hard line: never claim a named technology, platform, or tool that is not in the source material (e.g. if the posting wants Spark/Azure/Databricks and the candidate never used them, those words must NOT appear). Claim the transferable concept in the posting's language, never the specific unearned tool.
- You MAY: select different real aspects of the work to highlight, reorder bullets by relevance, use the posting's exact vocabulary for things the candidate actually did, merge two small real things into one stronger bullet, and add real technical detail implied by the source (e.g. if the source says "FastAPI REST services", you may say "RESTful API endpoints in Python (FastAPI)").
- You may NOT: invent employers, products, users, teams, budgets, or any NUMBER not present in the source material. No percentages, no counts, no scale claims unless the source states them. When in doubt, go qualitative-but-specific over quantitative-but-fake.
- NEVER inflate seniority or ownership: an intern stays an intern, "worked on" never becomes "led" or "owned".

JOB TITLES — you may reword them to match the posting's family, under strict rules:
- Same seniority: never add Senior/Staff/Lead/Principal. A junior-level title stays junior-level.
- Same truthful function: software engineering stays software engineering; do not turn an engineer into a "data scientist" or "consultant".
- Prefer the posting's exact wording when it describes the same work (Developer vs Engineer, Backend/Full-Stack qualifier, Intern/Contract markers).
- Set "titleChanged": true whenever you reword.

SKILLS SECTION: re-rank for THIS job. Within each line, order items by relevance to the posting. You may ONLY use items from the provided pool — never add one. Keep all four line labels. Keep the section rich (it helps fill the page) but most-relevant-first.

PROJECTS SECTION: choose the 2 projects from the library that best match this job (stack + domain). For each, return 2-3 bullets written from its real bullets for relevance — same facts, sharper framing, substantive length.

COVER LETTER (3-4 substantive paragraphs, skimmable in 20 seconds):
- Paragraph 1: hook with ONE specific researched insight about this company (product, mission, recent move) + name the exact role + one-line mapping of the candidate to it. Never "I am excited to apply".
- Middle: map the candidate's REAL experience and chosen projects to the posting's top 2-3 requirements, naming real technologies. Write like a person who ships code, not a template.
- Final: one or two sentences — genuine interest in this team/product + low-friction close. No clichés, no "fast-paced environment".

Output valid JSON only. Plain text everywhere: no markdown, no LaTeX, no backslashes, no asterisks, no pipe characters, no "~". Plain hyphens and quotes only.`;

interface GenerateInput {
  entries: ExperienceEntry[];
  skills: SkillsSection;
  job: { title: string; company: string; locationRaw: string; description: string };
  research: CompanyResearch | null;
  shorten?: boolean;
  /** Opposite of shorten: the page was too empty — enrich and lengthen. */
  expand?: boolean;
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
    task: input.shorten
      ? "Same job, second pass: the resume overflowed one page. Compress: exactly 3 bullets per experience entry at 16-22 words each, only 2 bullets per project, drop the weakest 1-2 items from each skills line, cover letter to 3 paragraphs. All other rules still apply."
      : input.expand
        ? "Same job, but the resume came out TOO EMPTY (large gap at the bottom). Fill the page by ADDING bullets, not length: 4 short bullets per experience entry (1-2 lines each), 3 per project, skills section full. Keep every bullet punchy."
        : "Tailor this candidate for this job: rewrite experience bullets from scratch (exactly 3 short punchy bullets per entry — the resume also has an achievements section, so space is tight), re-rank skills, choose the best 2 projects, write the cover letter.",
    job: {
      title: input.job.title,
      company: input.job.company,
      location: input.job.locationRaw,
      description: input.job.description.slice(0, 6000),
    },
    company_research: input.research
      ? {
          mission: input.research.mission,
          product: input.research.product,
          stack: input.research.stack,
          news: input.research.news,
          summary: input.research.summary,
          reddit_intel_from_real_candidates: input.research.redditIntel ?? null,
        }
      : null,
    candidate_experience: experience,
    candidate_skills_lines: input.skills.lines,
    candidate_project_library: projectBriefs(),
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
    model: model(),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(user) },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as GeneratedContent;

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
      bullets: gen.bullets.map((b) => String(b).trim()).filter(Boolean),
    };
  });
  if (!parsed.coverLetter || !Array.isArray(parsed.coverLetter.bodyParagraphs)) {
    throw new Error("LLM returned no cover letter body");
  }
  parsed.coverLetter.bodyParagraphs = parsed.coverLetter.bodyParagraphs.map(String).filter(Boolean);
  if (parsed.skills && !Array.isArray(parsed.skills)) parsed.skills = null;
  if (parsed.projects && !Array.isArray(parsed.projects)) parsed.projects = null;
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
