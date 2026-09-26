/**
 * Structured read of the job posting — the pipeline's answer to "what kind of
 * job is this?" before any generation happens.
 *
 * Two layers, deterministic first:
 *  1. Section parse (no LLM, no cost): JDs are conventionally organized into
 *     Requirements/Qualifications vs Nice-to-have/Preferred vs boilerplate.
 *     Must-haves and nice-to-haves come from those sections; a headerless JD
 *     falls back to the top global claimable terms. This layer is fully unit
 *     tested (scripts/test-jd-analysis.ts).
 *  2. Semantic labels (cheap-tier LLM, one small call): domain, dominant work
 *     types, and the seniority the posting actually seeks. Failure degrades to
 *     the heuristic labels — analysis is an enhancement, never a blocker.
 *
 * The result is cached on the Job row (jdAnalysis / jdAnalyzedAt) and only
 * recomputed when the description changed (e.g. after hydration).
 */

import { prisma } from "@/lib/db";
import { claimableJdTerms, type JdAnalysis } from "./match";
import { model, openai, parseJson } from "./research";

// ---------- section parsing (deterministic) ----------

type SectionKind = "must" | "nice" | "body" | "ignored";

const HEADER_RULES: [RegExp, SectionKind][] = [
  [/nice[- ]?to[- ]?have|preferred (?:qualifications?|skills?|experience)|^bonus|(?:big )?plus|^assets?$|ideally (?:you|we)|an? (?:added|extra) (?:plus|bonus)/i, "nice"],
  [/(?:minimum|basic|required|key|core|must[- ]?have) (?:qualifications?|requirements?|skills?|experience)|^requirements|qualifications|what (?:you'?ll |we'?re )?(?:need|bring|look(?:ing)? for)|who (?:you are|we'?re looking for)|about you|your (?:background|profile)|skills? (?:&|and) experience|experience (?:&|and) skills|what we expect/i, "must"],
  [/benefits?|perks?|what we offer|why (?:join|us|work here)|about (?:us|the company|the team)|our (?:company|story|mission|culture)|compensation|pay (?:range|transparency)|salary|equal opportunit|eeo\b|diversity|accommodation|privacy|legal/i, "ignored"],
  [/responsibilities|what you'?ll (?:do|work on|be doing)|your (?:role|impact|day)|the (?:role|position|opportunity)|day[- ]?to[- ]?day|duties|how you'?ll (?:contribute|make an impact)|in this (?:role|position)/i, "body"],
];

/** A header line: short, no terminal period, optionally colon-ended or bolded. */
function classifyHeader(line: string): SectionKind | null {
  const t = line
    .trim()
    .replace(/^[-*•–—>]+\s*/, "") // markdown/plain-text bullet before the header text
    .replace(/\*+/g, "")
    .replace(/#+\s*/g, "")
    .replace(/:+\s*$/, "")
    .trim();
  if (t.length < 3 || t.length > 70) return null;
  if (/[.!?]$/.test(t)) return null; // headers don't end sentences
  if (/[,;]/.test(t)) return null; // a list of things is content, not a header
  if (t.split(/\s+/).length > 8) return null; // headers are labels, not sentences
  for (const [re, kind] of HEADER_RULES) {
    if (re.test(t)) return kind;
  }
  return null;
}

export interface JdSections {
  must: string;
  nice: string;
  body: string;
  ignored: string;
  /** True when an explicit requirements/qualifications section was found. */
  hasExplicitMust: boolean;
}

export function splitJdSections(jd: string): JdSections {
  const chunks: Record<SectionKind, string[]> = { must: [], nice: [], body: [], ignored: [] };
  let kind: SectionKind = "body";
  let hasExplicitMust = false;
  for (const rawLine of jd.split(/\r?\n/)) {
    const header = classifyHeader(rawLine);
    if (header) {
      kind = header;
      if (header === "must") hasExplicitMust = true;
      continue;
    }
    chunks[kind].push(rawLine);
  }
  return {
    must: chunks.must.join("\n"),
    nice: chunks.nice.join("\n"),
    body: chunks.body.join("\n"),
    ignored: chunks.ignored.join("\n"),
    hasExplicitMust,
  };
}

// ---------- heuristic labels (deterministic) ----------

function heuristicSeniority(title: string, jd: string): JdAnalysis["seniority"] {
  if (/\b(senior|sr\.?|staff|principal|lead|manager|director|head of)\b/i.test(title)) return "senior";
  if (/\b(intern|co-?op|new grad|entry[- ]level|junior|jr\.?|associate|early career|graduate)\b/i.test(title)) return "junior";
  const years = [...jd.matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/gi)].map((m) => parseInt(m[1], 10));
  if (years.length) {
    const max = Math.max(...years);
    if (max >= 5) return "senior";
    if (max >= 3) return "mid";
    return "junior";
  }
  return null;
}

/**
 * Deterministic analysis. Must-haves come from the requirements section when
 * one exists; otherwise the top global claimable terms stand in (a headerless
 * JD still has a frequency-ranked core). Nice-to-haves only come from an
 * explicit preferred/bonus section — guessing them from prose is noise.
 */
export function heuristicAnalysis(jobDescription: string, jobTitle: string, company: string): JdAnalysis {
  const sections = splitJdSections(jobDescription);
  const companyTokens = company.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const target = sections.hasExplicitMust && sections.must.trim().length >= 80 ? sections.must : jobDescription;
  const mustHaves = claimableJdTerms(target, sections.hasExplicitMust ? 12 : 10, companyTokens, jobTitle);
  const niceToHaves = sections.nice.trim()
    ? claimableJdTerms(sections.nice, 8, companyTokens, jobTitle).filter((t) => !mustHaves.includes(t))
    : [];
  return {
    mustHaves,
    niceToHaves,
    domain: null,
    workTypes: [],
    seniority: heuristicSeniority(jobTitle, jobDescription),
    analyzedAt: new Date().toISOString(),
    source: "sections",
  };
}

// ---------- semantic labels (cheap-tier LLM, best effort) ----------

async function llmLabels(input: {
  title: string;
  company: string;
  description: string;
}): Promise<Pick<JdAnalysis, "domain" | "workTypes" | "seniority"> | null> {
  try {
    const res = await openai().chat.completions.create({
      model: model("cheap"),
      messages: [
        {
          role: "system",
          content:
            "You analyze job postings for a resume-tailoring pipeline. Output valid JSON only. Be conservative: when unsure, use null or an empty list rather than guessing.",
        },
        {
          role: "user",
          content: [
            `Job title: ${input.title}`,
            `Company: ${input.company}`,
            `Posting (excerpt):\n${input.description.slice(0, 6000)}`,
            "",
            `Return JSON with keys:`,
            `- "domain": the business domain whose vocabulary this posting speaks — one short lowercase string like "fintech", "healthtech", "e-commerce", "developer tools", "gaming", "telecom", "insurance", "logistics", "education", "advertising". null if unclear.`,
            `- "workTypes": up to 4 dominant KINDS of work this role does, as short lowercase phrases — e.g. "data pipelines", "REST services", "query optimization", "frontend UI", "CI/CD", "ML inference", "ETL", "stakeholder analysis", "reporting dashboards". Kinds of work, never product names.`,
            `- "seniority": the seniority this posting actually seeks: "junior" (0-2 years, new grad, entry), "mid" (3-4 years), or "senior" (5+ years, senior/staff/lead signals). Use the years-of-experience requirement over the title when they disagree.`,
          ].join("\n"),
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = parseJson(res.choices[0]?.message?.content ?? "{}");
    return {
      domain: typeof parsed.domain === "string" && parsed.domain.trim() ? parsed.domain.trim().toLowerCase() : null,
      workTypes: Array.isArray(parsed.workTypes) ? parsed.workTypes.map(String).slice(0, 4) : [],
      seniority: ["junior", "mid", "senior"].includes(parsed.seniority) ? parsed.seniority : null,
    };
  } catch {
    return null; // analysis is an enhancement, never a blocker
  }
}

/** Full analysis: deterministic must/nice + semantic labels when the LLM is reachable. */
export async function analyzeJobDescription(input: {
  title: string;
  company: string;
  description: string;
}): Promise<JdAnalysis> {
  const base = heuristicAnalysis(input.description, input.title, input.company);
  const labels = await llmLabels(input);
  if (!labels) return base;
  return {
    ...base,
    domain: labels.domain ?? base.domain,
    workTypes: labels.workTypes.length ? labels.workTypes : base.workTypes,
    seniority: labels.seniority ?? base.seniority,
    source: "sections+llm",
  };
}

// ---------- cache on the Job row ----------

/**
 * Cached analysis for a job. Recomputed only when stale — currently that means
 * the description was hydrated in this request (the only in-pipeline mutation
 * of a job's JD). A failed recompute keeps the cached value.
 */
export async function getJdAnalysis(
  job: { id: string; title: string; company: string; description: string; jdAnalysis?: unknown },
  opts: { stale?: boolean } = {}
): Promise<JdAnalysis> {
  if (job.jdAnalysis && !opts.stale) return job.jdAnalysis as JdAnalysis;
  try {
    const analysis = await analyzeJobDescription({
      title: job.title,
      company: job.company,
      description: job.description,
    });
    await prisma.job.update({
      where: { id: job.id },
      data: { jdAnalysis: analysis as never, jdAnalyzedAt: new Date() },
    });
    return analysis;
  } catch {
    if (job.jdAnalysis) return job.jdAnalysis as JdAnalysis;
    // Last resort: deterministic-only, unpersisted. Never block generation.
    return heuristicAnalysis(job.description, job.title, job.company);
  }
}
