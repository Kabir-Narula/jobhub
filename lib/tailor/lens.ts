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

const CONSULTING_LENS: Lens = {
  id: "consulting",
  foreground: [
    "Excel / spreadsheet analysis",
    "SQL or Python used to pull or clean a number",
    "stakeholder walkthroughs and recommendations",
    "PowerPoint / Word communication",
    "diagnosis that changed a decision or removed a manual chase",
    "campus ops: office trackers, mentoring, front-desk process",
  ],
  suppress: ["Kotlin", "Blender", "FastAPI", "Next.js", "tRPC", "Three.js"],
};

const ANALYST_LENS: Lens = {
  id: "analyst",
  foreground: [
    "Excel trackers and models",
    "SQL pulls / variance / cohorts",
    "Word/PowerPoint communication",
    "synthesizing messy inputs for a stakeholder",
    "campus ops and mentoring when it shows process + people",
  ],
  suppress: ["Kotlin", "Blender", "FastAPI", "Next.js", "tRPC", "Three.js", "Docker"],
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
Skills MUST lead with Excel, Word, PowerPoint, SQL, Python (analysis, not APIs). Demote FastAPI/Next.js/Kotlin.
Experience titles: 2 of the SOFTWARE entries may become Analyst / Business Analyst / Insights Analyst, keeping (Co-op)/(Freelance)/(Academic WIL). NEVER retitle Student Office Assistant, Peer Mentor, or HyFlex. Never Consultant.
Bullets: Context-Analysis-Result. Campus ops entries stay Excel/Word/mentoring/front-desk — not software. Drop a GitHub project if the page is tight. At most ONE software-implementation bullet on the whole page.`;
  }
  if (lens.id === "analyst") {
    return `ANALYST / INSIGHTS ROLE FAMILY — beats every SWE rule. ${ANALYST_RESUME_NORMS}

Foreground ONLY: ${lens.foreground.join("; ")}.
Suppress in experience: ${lens.suppress.join(", ")}.
Skills lead: Excel, Word, PowerPoint, SQL. Python only as analysis (pandas/SQL), never FastAPI.
Keep Student Office Assistant & Peer Mentor and ITS HyFlex. Write them as process, Excel trackers, documentation, advising. Do not retitle them. Prefer those over a third project.
Software internships become analysis + stakeholder bullets, not endpoints.`;
  }
  if (lens.id === "product") {
    return `PRODUCT ROLE FAMILY. ${PRODUCT_RESUME_NORMS} Foreground: ${lens.foreground.join("; ")}. Suppress: ${lens.suppress.join(", ")}.`;
  }
  return `DOMINANT LENS for this posting (${lens.id}): foreground ONLY these real aspects of the candidate: ${lens.foreground.join(", ")}. Do NOT mention these at all (they are real but irrelevant here): ${lens.suppress.join(", ")}. Product names (FastAPI, Django, Flask, Next.js) only if the posting names them; otherwise use portable terms (REST API, Python service, pipeline). The lens is a work theme, not a brand to repeat in every bullet.`;
}
