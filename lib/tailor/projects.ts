/**
 * The candidate's project library — grounded in the actual GitHub repos
 * (read and distilled, no invented scope). The tailoring engine picks the
 * best 2 or 3 per job (see projectSlots) and may reword bullets for emphasis,
 * but every fact here is source material from the repos themselves.
 */

import type { ProjectEntry } from "./latex";

export interface ProjectProfile {
  id: string;
  name: string;
  githubUrl: string;
  /** The \emph{...} tech line under the project name (same role as in the master). */
  techLine: string;
  /** Consulting/analyst heading — analysis artifact, not React/Next.js/Express. */
  businessTechLine?: string;
  year: string;
  /** Grounded bullets (plain text, no LaTeX). 2-3 per project. */
  bullets: string[];
  /** Relevance signals for matching against a JD. */
  keywords: string[];
  /** One-line what-it-is, given to the LLM as context. */
  summary: string;
  /** Analyst/consulting/HR one-liner — tracker/dashboard, never "AI writes a resume". */
  businessSummary?: string;
  /** Analyst/consulting bullets. Same facts, no SWE product names in bullet 1. */
  businessBullets?: string[];
}

export const PROJECTS: ProjectProfile[] = [
  {
    id: "vertexflow",
    name: "VertexFlow",
    githubUrl: "https://github.com/Kabir-Narula/Vertex_flow",
    techLine: "Distributed Workers, Docker, Linux Compute",
    year: "2025",
    summary:
      "Spatial version control for 3D teams: upload GLB assets, inspect them in a browser Three.js viewer, anchor review pins on mesh surfaces, track versions.",
    bullets: [
      "Engineered a 4-service Turborepo platform (Next.js web, Fastify + tRPC API, Python FastAPI worker, Drizzle/Postgres package) with a Dockerized Blender bpy worker on Linux, isolating CPU-heavy mesh processing from the API request path.",
      "Implemented Redis-backed BullMQ worker queues with a synchronous fallback and direct-to-Cloudflare-R2 uploads with signed URLs, enabling independent worker scaling for CPU-heavy jobs.",
      "Built an in-browser Three.js/React-Three-Fiber viewer with shading modes and spatial review pins persisted per asset version.",
    ],
    keywords: ["distributed", "worker", "docker", "linux", "python", "fastapi", "redis", "bullmq", "turborepo", "three.js", "3d", "fastify", "trpc", "monorepo", "ci", "scaling", "queue", "infrastructure"],
  },
  {
    id: "bettermind",
    name: "BetterMind",
    githubUrl: "https://github.com/Kabir-Narula/BetterMind",
    techLine: "Machine Learning Inference, PostgreSQL",
    year: "2025",
    summary:
      "Mental wellness platform: daily journaling and mood tracking with OpenAI-powered sentiment scoring, pattern detection, and a context-aware AI companion.",
    bullets: [
      "Built Machine Learning inference pipelines via OpenAI APIs — sentiment scoring and pattern detection with confidence scores + JSONB evidence — for downstream serving.",
      "Designed a 13-table Prisma/PostgreSQL schema with composite UNIQUE constraints, persisting ML outputs as durable contracts for reliable inference workflows.",
      "Shipped a Next.js 14 product with JWT auth, weekly insight synthesis, and a context-aware AI chat companion.",
    ],
    keywords: ["machine learning", "ml", "ai", "openai", "llm", "inference", "nlp", "sentiment", "postgres", "prisma", "next.js", "jwt", "data", "analytics"],
  },
  {
    id: "axom",
    name: "Axom",
    githubUrl: "https://github.com/Kabir-Narula/Axom",
    techLine: "Adaptive Learning, Knowledge Graphs, SM-2",
    year: "2026",
    summary:
      "Exam-prep learning platform: turns uploaded slides/notes into a concept knowledge graph, ranks likely exam topics, runs adaptive practice, schedules spaced repetition.",
    bullets: [
      "Built document-intelligence pipelines (PDF/txt/md) that extract concepts into a knowledge graph and generate flashcards and multi-format tests, with a heuristic engine that works without any LLM key and an optional OpenAI path for deeper reasoning.",
      "Implemented an SM-2 spaced-repetition scheduler and adaptive practice engine with per-concept mastery tracking, plus analytics across MCQ, cloze, code, and case-based question types.",
      "Hardened a Next.js 16 + Prisma backend with httpOnly sessions, CSRF protection, bcrypt, rate limiting, and ownership-scoped queries.",
    ],
    keywords: ["machine learning", "ai", "llm", "openai", "education", "learning", "knowledge graph", "adaptive", "next.js", "react", "typescript", "prisma", "security", "full-stack", "algorithms"],
  },
  {
    id: "treminy",
    name: "Treminy",
    githubUrl: "https://github.com/Kabir-Narula/Treminy",
    techLine: "Realtime Collaboration, Stripe, Supabase",
    year: "2024",
    summary:
      "Notion-style collaborative workspace: realtime cursors and co-editing, rich text documents, workspaces and folders, subscription billing.",
    bullets: [
      "Built a realtime collaboration layer (socket-based) with live cursors, text selection presence, and conflict-safe collaborative rich-text editing across workspaces.",
      "Implemented Stripe subscription billing and Supabase auth with row-level security, backed by a Drizzle ORM/Postgres data model for workspaces, folders, documents, and trash recovery.",
    ],
    keywords: ["realtime", "websocket", "collaboration", "stripe", "payments", "supabase", "drizzle", "next.js", "react", "typescript", "full-stack", "saas", "product"],
  },
  {
    id: "expense_manager",
    name: "Expense Manager",
    githubUrl: "https://github.com/Kabir-Narula/Expense_manager",
    techLine: "Team Project, React, Express",
    businessTechLine: "Team Project, Dashboards, Monthly Trends",
    year: "2024",
    summary:
      "Team-built budgeting app (4 developers; front-end role): categorized expense/income tracking, multi-account and shared-account support, dashboard analytics.",
    businessSummary:
      "Shared budgeting app for a 4-person team: categorized income and expenses, multi-account tracking, and a dashboard of month-over-month trends.",
    bullets: [
      "Built the React front end for a team budgeting app: categorized expense/income entry, multi-account and shared-account flows, and a dashboard with pie/bar chart analytics and month-over-month trends.",
      "Collaborated in a 4-developer Agile team with a written definition-of-done and working agreement, shipping against a Node/Express backend.",
    ],
    businessBullets: [
      "Month-over-month charts showed which categories were drifting so the group could correct the shared accounts before month end.",
    ],
    keywords: ["react", "javascript", "express", "node", "charts", "dashboard", "team", "agile", "front-end", "finance", "budgeting"],
  },
  {
    id: "jobhub",
    name: "JobHub",
    githubUrl: "https://github.com/Kabir-Narula/jobhub",
    techLine: "Next.js 16, Prisma/PostgreSQL, LLM Pipeline",
    businessTechLine: "Application Tracker, PostgreSQL",
    year: "2026",
    summary:
      "Full-stack job-search platform: aggregates postings from 40+ ATS/aggregator sources on a schedule, tracks applications end-to-end, and generates tailored LaTeX resume PDFs per job.",
    businessSummary:
      "Application tracker that pulls job postings, records every application, and flags follow-ups so a search stays current.",
    bullets: [
      "Built a Next.js 16 + TypeScript aggregation engine polling 40+ job sources (Greenhouse, Lever, Ashby, Workday JSON APIs plus aggregator feeds) on a schedule, with multi-layer fuzzy dedupe (fingerprint, source-ID, normalized title + company matching) keeping the board duplicate-free.",
      "Designed a resume-tailoring pipeline: LLM-generated content inside a frozen LaTeX template, server-side Tectonic compilation, closed-loop page-fill measurement, and keyword-coverage scoring, with every PDF versioned and diffed per application.",
      "Implemented an application tracker with a Page Visibility did-you-apply loop, a kanban status pipeline, Prisma/PostgreSQL persistence, and Supabase Storage for generated documents.",
    ],
    businessBullets: [
      "PostgreSQL stores every status change; a page-visibility check asks whether you applied, so the board stays reviewable.",
      "The same posting from two boards is dropped before it is listed, so a follow-up is not opened twice.",
    ],
    keywords: ["next.js", "typescript", "react", "prisma", "postgresql", "sql", "supabase", "llm", "openai", "ai", "pipeline", "rest", "api", "full-stack", "vercel", "cron", "tailwind", "pdf", "automation"],
  },
  {
    id: "windows_booster",
    name: "Windows Booster",
    githubUrl: "https://github.com/Kabir-Narula/windows-booster",
    techLine: "Python, Content Analysis, Systems Tooling",
    year: "2026",
    summary:
      "Safe, reversible drive cleanup and organization for Windows: content-aware analysis (magic bytes, EXIF, PDF text, code-project detection) feeding a scan-plan-apply-undo pipeline with a desktop GUI and CLI.",
    bullets: [
      "Built a content-aware file-analysis engine in Python: magic-byte true-type sniffing, EXIF/PDF/audio metadata extraction, and keyword-weighted topic classification routing files into topic-aware destinations, with tiered duplicate detection (size, 64 KiB head-hash, then full SHA-256) and policy-ranked keeper selection.",
      "Designed a fully reversible operations model: every mutation journaled to JSONL and undoable newest-first, deletion confined to a double-confirmed quarantine purge, protected system paths and project code never touched, re-runs idempotent.",
      "Shipped both a Rich terminal CLI with live scan dashboards and a customtkinter desktop GUI driving the same scan-plan-apply-undo pipeline, validated by a 30-assertion sandbox smoke test.",
    ],
    keywords: ["python", "windows", "systems", "cli", "gui", "tkinter", "automation", "hashing", "pipeline", "tooling", "desktop", "testing", "exif", "pdf"],
  },
];

/** Short brief for the LLM: which projects fit this job best, and why. */
export function projectBriefs(business = false): string {
  return PROJECTS.map((p) => {
    const tech = business && p.businessTechLine ? p.businessTechLine : p.techLine;
    const what = business && p.businessSummary ? p.businessSummary : p.summary;
    const facts = business && p.businessBullets?.length ? p.businessBullets : p.bullets;
    let rule = "";
    if (business && p.id === "jobhub") {
      rule =
        "\n  BUSINESS PAGE RULE: never mention tailored resumes, LaTeX, LLM, or generating a resume. Sell the tracker, status data, and follow-up loop.";
    }
    if (business && (p.id === "windows_booster" || p.id === "vertexflow")) {
      rule =
        "\n  BUSINESS PAGE RULE: do not pick this project. Prefer Expense Manager and JobHub.";
    }
    return (
      `- id "${p.id}" — ${p.name} (${tech}), repo ${p.githubUrl}\n` +
      `  what it is (source for bullet 1 — rewrite, do not paste): ${what}\n` +
      `  keywords: ${p.keywords.join(", ")}\n` +
      `  implementation facts (source for bullet 2 — pick the ones that match THIS posting):\n` +
      facts.map((b) => `    * ${b}`).join("\n") +
      rule
    );
  }).join("\n");
}

export function projectById(id: string): ProjectProfile | undefined {
  return PROJECTS.find((p) => p.id === id);
}

/**
 * How many projects belong on this resume.
 *
 * Four SWE experience entries already fill one page, so a third project
 * overflows and the ladder then deletes it after paying for it.
 * Three entries (the common case: ITS dropped) leave a gap a third project
 * fills better than a fourth experience bullet. Shorten always drops back to 2
 * — the third project is fill, not load-bearing.
 *
 * Analyst/consulting first drafts stay at 2 so campus-ops experience is the
 * extra story (and so the LLM is not paid to write a project the ladder
 * often deletes). If the 1-page PDF is still sparse, pack.ts adds a third
 * library project with no extra model call.
 */
export function projectSlots(
  entryCount: number,
  opts: { shorten?: boolean; business?: boolean } = {}
): number {
  if (opts.shorten) return 2;
  // Analyst/consulting: campus-ops experience is the extra story — drop a project.
  if (opts.business) return 2;
  return entryCount >= 4 ? 2 : 3;
}

const CLUSTER: Record<string, string> = {
  vertexflow: "infra",
  bettermind: "ml",
  axom: "ml",
  treminy: "product",
  expense_manager: "frontend",
  jobhub: "platform",
  windows_booster: "systems",
};

function projectScore(jobText: string, p: ProjectProfile, business = false): number {
  const hay = jobText.toLowerCase();
  let n = p.keywords.reduce((acc, k) => acc + (hay.includes(k.toLowerCase()) ? 1 : 0), 0);
  if (business) {
    if (p.id === "expense_manager") n += 8;
    if (p.id === "jobhub") n += 6;
    if (p.id === "treminy") n += 2;
    // Cleanup/infra repos read as SWE flex on bank/HR/consulting pages.
    if (p.id === "vertexflow" || p.id === "windows_booster") n -= 25;
    if (p.id === "bettermind" || p.id === "axom") n -= 4;
  }
  return n;
}

/**
 * Rank library projects for a posting, then pick `take` that cover DIFFERENT
 * stacks. Two LLM apps (BetterMind + Axom) both score high on an AI posting;
 * the second slot should be the strongest project from another cluster so the
 * resume answers more of the JD instead of repeating inference twice.
 */
export function rankProjects(
  jobText: string,
  take: number,
  exclude: string[] = [],
  opts: { business?: boolean } = {}
): ProjectProfile[] {
  const blocked = new Set(exclude);
  const scored = PROJECTS
    .filter((p) => !blocked.has(p.id))
    .map((p) => ({ p, score: projectScore(jobText, p, opts.business) }))
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));

  const picked: ProjectProfile[] = [];
  const usedCluster = () => new Set(picked.map((q) => CLUSTER[q.id]));
  const tooSimilar = (candidate: ProjectProfile) => usedCluster().has(CLUSTER[candidate.id]);

  for (const { p } of scored) {
    if (picked.length >= take) break;
    if (tooSimilar(p)) continue;
    picked.push(p);
  }
  for (const { p } of scored) {
    if (picked.length >= take) break;
    if (!picked.some((q) => q.id === p.id)) picked.push(p);
  }
  return picked;
}

function ensurePeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

const BULLET_STOP = new Set([
  "a", "an", "the", "and", "or", "to", "of", "for", "so", "that", "with", "from", "each", "every", "in", "on", "at", "into", "its", "it",
]);

function contentTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !BULLET_STOP.has(w))
  );
}

/** Two bullets that tell the same fact. Catches the JobHub tracker/tracker pair. */
export function bulletsTooAlike(a: string, b: string): boolean {
  const A = contentTokens(a);
  const B = contentTokens(b);
  if (A.size < 4 || B.size < 4) return false;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return shared / Math.min(A.size, B.size) >= 0.55;
}

/** Recruiter backlash line — never ship this on bank / HR / consulting pages. */
const BUSINESS_RESUME_SPAM =
  /tailored resume|latex resume|generates? (?:a )?tailored|llm[- ]generated|tectonic/i;

function implementationLine(summary: string, lib: string[]): string {
  const distinct = lib.filter((b) => b.trim() && !bulletsTooAlike(summary, b));
  return ensurePeriod(distinct[0] || lib[lib.length - 1] || "");
}

function projectPair(profile: ProjectProfile, generated?: string[], business = false): string[] {
  let fromModel = (generated ?? []).map((b) => b.trim()).filter(Boolean).slice(0, 2);
  if (business) fromModel = fromModel.filter((b) => !BUSINESS_RESUME_SPAM.test(b));
  const summary = business && profile.businessSummary ? profile.businessSummary : profile.summary;
  const lib = business && profile.businessBullets?.length ? profile.businessBullets : profile.bullets;
  const first = fromModel[0] || summary;
  let second = fromModel[1] || "";
  if (!second || bulletsTooAlike(first, second)) second = implementationLine(first, lib);
  return [ensurePeriod(first), second].filter(Boolean).slice(0, 2);
}

function toEntry(profile: ProjectProfile, generated?: string[], business = false): ProjectEntry {
  return {
    name: profile.name,
    githubUrl: profile.githubUrl,
    techLine: business && profile.businessTechLine ? profile.businessTechLine : profile.techLine,
    year: profile.year,
    bullets: projectPair(profile, generated, business),
  };
}

/**
 * Pick N projects. Business pages: library ranking wins the IDs (so Windows
 * Booster cannot beat Expense Manager because the model liked Python). SWE
 * pages: model order first, ranked library fills gaps.
 */
export function resolveProjects(
  gen: { id?: string; bullets?: string[] }[] | null | undefined,
  count: number,
  jobText: string,
  business = false
): { entries: ProjectEntry[]; chosen: string[] } {
  const bulletsById = new Map<string, string[]>();
  for (const g of gen ?? []) {
    const profile = projectById(String(g?.id ?? ""));
    if (!profile) continue;
    bulletsById.set(profile.id, Array.isArray(g.bullets) ? g.bullets.map(String) : []);
  }

  const ranked = rankProjects(jobText, Math.max(count, 2), [], { business });

  if (business) {
    const picked = ranked.slice(0, count);
    if (picked.length === 0) {
      return { entries: [], chosen: [] };
    }
    return {
      entries: picked.map((p) => toEntry(p, bulletsById.get(p.id), true)),
      chosen: picked.map((p) => p.id),
    };
  }

  const unique: { entry: ProjectEntry; id: string }[] = [];
  for (const g of gen ?? []) {
    const profile = projectById(String(g?.id ?? ""));
    if (!profile || unique.some((u) => u.id === profile.id)) continue;
    unique.push({ entry: toEntry(profile, bulletsById.get(profile.id), false), id: profile.id });
  }
  for (const p of ranked) {
    if (unique.length >= count) break;
    if (!unique.some((u) => u.id === p.id)) unique.push({ entry: toEntry(p, undefined, false), id: p.id });
  }
  const picked = unique.slice(0, count);
  if (picked.length > 0) {
    return { entries: picked.map((u) => u.entry), chosen: picked.map((u) => u.id) };
  }
  const fallback = ranked.slice(0, Math.max(count, 2));
  return {
    entries: fallback.map((p) => toEntry(p, undefined, false)),
    chosen: fallback.map((p) => p.id),
  };
}
