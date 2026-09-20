import { CONSULTING_RESUME_NORMS, ANALYST_RESUME_NORMS, PRODUCT_RESUME_NORMS, detectRoleFamily } from "./role-family";

/**
 * Lens detection: role family wins on title+company, then a frequency-scored
 * technology theme. A stray "analytics" in an Insights JD must not theme the
 * whole resume as data-engineering.
 */
export interface Lens {
  id: string;
  foreground: string[];
  suppress: string[];
}

/** Engineering stack that must never appear on a consulting/analyst skills line. */
export const BUSINESS_SKILL_SUPPRESS = [
  "Kotlin",
  "Blender",
  "FastAPI",
  "Next.js",
  "tRPC",
  "Three.js",
  "React",
  "Prisma",
  "Express",
  "Fastify",
  "OpenAI",
  "Machine Learning",
  "Node.js",
  "Stripe",
  "Clerk",
  "Zod",
  "Supabase",
  "Vercel",
  "TypeScript",
  "C++",
  "Java",
  "Query Optimization",
  "API Integration",
  "JWT",
  "WebSockets",
  "Prompt Engineering",
  "LLM",
  "Knowledge Graphs",
  "Spaced Repetition",
  "GLB",
  "Database Design",
];

const CONSULTING_LENS: Lens = {
  id: "consulting",
  foreground: [
    "Excel / spreadsheet analysis — name a Pivot Table, INDEX/MATCH, Power Query, or SQL join from jd_matched_techniques, not 'used Excel' and not a default VLOOKUP",
    "SQL or Python used to pull or clean a number",
    "stakeholder walkthroughs and recommendations",
    "PowerPoint as a decision deck (once), not a stamp",
    "diagnosis that changed a decision or removed a manual chase",
    "HyFlex: restore classroom and lab tech for professors, then document only if needed",
    "campus ops: office request tracker + mentoring, not a second documentation job",
  ],
  suppress: BUSINESS_SKILL_SUPPRESS,
};

const ANALYST_LENS: Lens = {
  id: "analyst",
  foreground: [
    "Excel techniques from the posting (Pivot Table, INDEX/MATCH, Power Query, SQL) — not 'used Excel' and not a default VLOOKUP",
    "SQL pulls / variance / cohorts",
    "one Word or PowerPoint artifact, not a stamp on every job",
    "synthesizing messy inputs for a stakeholder",
    "HyFlex classroom/lab troubleshooting for faculty",
    "campus ops mentoring and request tracking when it shows process + people",
  ],
  suppress: BUSINESS_SKILL_SUPPRESS,
};

const PRODUCT_LENS: Lens = {
  id: "product",
  foreground: ["user problem", "tradeoff", "stakeholder alignment", "Excel/Jira", "plain-language outcome"],
  suppress: ["Kotlin", "Blender", "FastAPI", "tRPC"],
};

interface LensDef extends Lens {
  patterns: RegExp[];
}

const LENSES: LensDef[] = [
  {
    id: "ai-ml",
    foreground: ["OpenAI API / LLM inference", "Python services", "ML pipelines", "prompt/RAG framing", "PostgreSQL"],
    suppress: ["Kotlin UI", "mobile screens", "Blender"],
    patterns: [/\b(machine learning|ml engineer|ai engineer|llm|rag\b|agentic|fine-?tun|prompt engineering|data scien|nlp|computer vision|openai)\b/gi],
  },
  {
    id: "jvm",
    foreground: ["Kotlin (JVM, Java interop)", "Java (coursework)", "typed API contracts", "PostgreSQL/SQL", "CI/CD", "code review practices", "HTTP service design"],
    suppress: ["mobile UI polish", "Blender", "3D"],
    patterns: [/\bjava\b(?!script)/gi, /\bjvm\b/gi, /\bkotlin\b/gi, /\bscala\b/gi, /\bspring\b/gi, /\bruby\b/gi],
  },
  {
    id: "ts-web",
    foreground: ["TypeScript/JavaScript", "React/Next.js", "Node services", "tRPC/Fastify APIs", "HTTP request handling"],
    suppress: ["Blender", "3D", "JVM framing"],
    patterns: [/\b(javascript|typescript|node\.?js|react|next\.?js|full[- ]?stack|front[- ]?end|web developer)\b/gi],
  },
  {
    id: "mobile",
    foreground: ["Kotlin Android", "mobile + web clients", "REST API integration", "auth/error handling"],
    suppress: ["worker queues", "infra"],
    patterns: [/\bandroid\b/gi, /\bswift\b/gi, /\bios\b/gi, /\bmobile\b/gi],
  },
  {
    id: "data",
    foreground: ["data pipelines", "PostgreSQL/SQL", "ETL-style processing", "analytics dashboards"],
    suppress: ["mobile UI", "Kotlin UI"],
    patterns: [/\b(data engineer|etl|spark|databricks|analytics engineer|power bi|data platform|data pipeline)\b/gi],
  },
  {
    id: "cloud-infra",
    foreground: ["Docker", "Linux", "CI/CD", "Redis/BullMQ workers", "GitHub Actions"],
    suppress: ["mobile UI"],
    patterns: [/\b(devops|sre|kubernetes|aws\b|gcp\b|cloud engineer|infrastructure|platform engineer|terraform)\b/gi],
  },
  {
    id: "python-backend",
    foreground: ["Python", "REST APIs", "PostgreSQL", "background jobs"],
    suppress: ["mobile UI"],
    patterns: [/\b(python|fastapi|django|flask|backend|api developer)\b/gi],
  },
];

function countHits(patterns: RegExp[], text: string): number {
  let n = 0;
  for (const re of patterns) {
    n += (text.match(re) ?? []).length;
  }
  return n;
}

export function detectLens(title: string, description: string, company = ""): Lens | null {
  const family = detectRoleFamily(title, company, description);
  if (family === "consulting") return CONSULTING_LENS;
  if (family === "analyst") return ANALYST_LENS;
  if (family === "product") return PRODUCT_LENS;

  const reqSection = `${title}\n${description.slice(0, 2500)}`;
  const rest = description.slice(2500, 9000);

  let best: { id: string; foreground: string[]; suppress: string[] } | null = null;
  let bestScore = 0;
  for (const l of LENSES) {
    const score = countHits(l.patterns, reqSection) * 2 + countHits(l.patterns, rest);
    if (score > bestScore) {
      bestScore = score;
      best = l;
    }
  }
  if (family === "data-ml") {
    const dataish = LENSES.filter((l) => l.id === "data" || l.id === "ai-ml");
    let dBest: LensDef | null = null;
    let dScore = 0;
    for (const l of dataish) {
      const score = countHits(l.patterns, reqSection) * 2 + countHits(l.patterns, rest);
      if (score > dScore) {
        dScore = score;
        dBest = l;
      }
    }
    if (dBest && dScore >= 2) return dBest;
  }
  if (!best || bestScore < 3) return null;
  return best;
}

export function lensInstruction(lens: Lens | null): string {
  if (!lens) return "";
  if (lens.id === "consulting") {
    return `CONSULTING ROLE FAMILY — this override beats every software-engineer rule in the system prompt. You are writing for a McKinsey/BCG/Bain recruiter, not a staff engineer. ${CONSULTING_RESUME_NORMS}

Foreground ONLY: ${lens.foreground.join("; ")}.
Do NOT mention these in experience or lead skills with them: ${lens.suppress.join(", ")}.
Skills MUST lead with Excel, Pivot Tables, Power Query, INDEX/MATCH, PowerPoint, SQL, Python, then posting-matched Dashboard Reporting / KPI Tracking / Market Research / Secondary Research. Always include a Professional line. Demote FastAPI/Next.js/Kotlin. Word is assumed — do not list it as a flex. Frameworks is Agile/Scrum plus research methods, never Git alone. In experience, name a TECHNIQUE from jd_matched_techniques — never default to VLOOKUP, never stamp Excel/Word on every bullet. Weave 3-5 posting WORK nouns (insights, KPI, dashboard, market, recommendation, workstream if the JD says it) across the resume, one per bullet, never on HyFlex, never inventing IQVIA/Tableau/Qualtrics.
Experience titles: software internships become Analyst / Business Analyst / Insights Analyst, keeping (Co-op)/(Freelance)/(Contract, Part-time). NEVER retitle Student Office Assistant, Peer Mentor, or HyFlex. Never Consultant. Never write Academic WIL.
Bullets: Context-Analysis-Result, exactly 3 per entry. A BCG/McKinsey partner must understand the business problem. BANNED as the story: payloads, authentication flows, execution plans, deployment checklists, API fields, Python processing logs, extraction workflows, mobile-and-web clients, backend defects. Those are software internals. Write variance / mismatch / recommendation / stakeholder instead.
HyFlex (ITS): you resolved classroom and lab failures for professors (audio, display, camera, login, peripherals) — in person and remotely across 30+ rooms. At most ONE later bullet documents a recurring issue after you fixed it. Never rewrite HyFlex as Excel/Word.
Office Assistant: one request tracker using INDEX/MATCH or another jd_matched_techniques lookup + advising. Never HyFlex equipment. Four experience entries max. Skills MUST be Excel, Pivot Tables, Power Query, INDEX/MATCH, PowerPoint, SQL, Python, Jira, Agile/Scrum, plus JD-matched extras — never Node, Stripe, Fastify, OpenAI, Supabase, Vercel, Git-as-the-whole-Frameworks-line.`;
  }
  if (lens.id === "analyst") {
    return `ANALYST / INSIGHTS ROLE FAMILY — beats every SWE rule. ${ANALYST_RESUME_NORMS}

Foreground ONLY: ${lens.foreground.join("; ")}.
Suppress in experience: ${lens.suppress.join(", ")}.
Skills lead: Excel, Pivot Tables, Power Query, INDEX/MATCH, PowerPoint, SQL, then posting-matched Dashboard Reporting / KPI Tracking / Market Research / Secondary Research. Always include a Professional line. Python only as analysis (pandas/SQL), never FastAPI. Word is assumed.
Keep Student Office Assistant & Peer Mentor and ITS HyFlex. HyFlex = restore classroom/lab tech for faculty, then optionally document. Office Assistant = request tracker from jd_matched_techniques + advising. Do not retitle them. Prefer those over a third project.
Software internships become analysis + stakeholder bullets, not endpoints. Skills MUST be Excel, Pivot Tables, PowerPoint, SQL, Python, Agile/Scrum, plus JD-matched Dashboard Reporting / KPI Tracking / Market Research — never Fastify, OpenAI, Node, Stripe. If the JD names Tableau/Qualtrics/Nielsen/IQVIA, map to a pivot, dashboard, or secondary-research synthesis — do not invent those products in skills or experience.`;
  }
  if (lens.id === "product") {
    return `PRODUCT ROLE FAMILY. ${PRODUCT_RESUME_NORMS} Foreground: ${lens.foreground.join("; ")}. Suppress: ${lens.suppress.join(", ")}.`;
  }
  return `DOMINANT LENS for this posting (${lens.id}): foreground ONLY these real aspects of the candidate: ${lens.foreground.join(", ")}. Do NOT mention these at all (they are real but irrelevant here): ${lens.suppress.join(", ")}. Product names (FastAPI, Django, Flask, Next.js) only if the posting names them; otherwise use portable terms (REST API, Python service, pipeline). The lens is a work theme, not a brand to repeat in every bullet.`;
}
