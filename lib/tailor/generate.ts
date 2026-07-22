import { model, openai, parseJson, type CompanyResearch } from "./research";
import type { ExperienceEntry, SkillsSection } from "./latex";
import { projectBriefs } from "./projects";
import { extraSkillsPool } from "./skills-extra";

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

THE AUTHENTICITY BALANCE (user-authorized expanded mode):
- For the TWO most relevant experience entries, you MAY embed the posting's required technologies and tools as work the candidate did — written plausibly, small in scope, and always embedded inside that entry's real context (e.g. a feature, an internal tool, an integration, a migration). If the posting asks Java, the candidate built a sensible internal service or tool in Java. If it asks React, the candidate shipped a real UI surface in React.
- Write stretched tech like real work, not like a keyword list: attach it to something concrete and mundane (a module, an endpoint, a migration, a dashboard) — small-scope claims survive interviews; grandiose ones don't.
- NEVER invent numbers, metrics, percentages, user counts, or scale — for ANY content. No "40,000+ users", no "99.9%", no "3x". Not anywhere. This rule is absolute.
- The THIRD entry (least relevant) stays 100% true to the source material — tech, scope, everything.
- Company names, employers, and education never change. Seniority never inflates.
- Stretched content should still prefer technologies that are plausible-adjacent to the candidate's world (coursework: Java, C/C++, HPC, OS, computer vision; real stack: Python, TypeScript, React, Node, SQL/PostgreSQL, ML inference, Docker, Linux) — but when the posting's core requirement is a specific tool, include it in one of the two expanded entries rather than leaving the resume silent.

VOCABULARY TRANSLATION (apply to every bullet): re-label the candidate's real work with the posting's exact domain terms wherever the underlying work genuinely matches. Worker queues and background jobs become "data pipelines" or "ETL-style batch processing" when the posting is data-flavored; ML inference services become "ML data pipelines"; a budgeting app with charts becomes "analytics dashboards for financial data visualization"; API integration becomes "building data services". Use the posting's nouns for the candidate's real verbs.

JOB TITLES — the 2-of-3 rule:
- For the TWO most relevant experience entries, you SHOULD reword the title toward the posting's family when it describes the same work: e.g. for a backend posting, "Software Engineer (Freelance)" becomes "Backend Software Developer (Freelance)"; for an ML posting, "... (Freelance)" becomes "Software Engineer, ML (Freelance)". Intern titles keep their intern marker.
- Keep ONE entry's title completely original — a resume where every title mirrors the posting looks machine-tailored and recruiters discount it.
- Hard rules still apply: never upgrade seniority (no Senior/Staff/Lead/Principal), never change the function family to something untrue (no "data scientist", no "consultant" unless the work was consulting).
- Set "titleChanged": true whenever you reword.

SKILLS SECTION: build 4 rich lines (5-7 items per line) from the provided master lines PLUS the additional verified pool — choose the items most relevant to this posting and order by relevance. Only items from the two provided lists — never invent. Keep the four line labels, adjusting only which items each line carries.

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
  /** ATS boost pass: weave these missing JD terms in where genuinely claimable. */
  boost?: { missingTerms: string[] };
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
        : input.boost
          ? `Same job, ATS-boost pass: the draft scored low on keyword coverage. Weave these missing job-description terms into the resume WHERE GENUINELY CLAIMABLE from the source material (never a tool the candidate hasn't used): ${input.boost.missingTerms.join(", ")}. Work them into bullets via the vocabulary-translation rules and into the skills lines. Do NOT keyword-stuff: max one JD term per bullet, vary sentence shapes so it reads human, never as a list of synonyms. Rewrite everything fresh (all other rules apply).`
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
    additional_verified_skills_pool: extraSkillsPool(),
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
