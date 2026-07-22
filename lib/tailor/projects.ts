/**
 * The candidate's project library — grounded in the actual GitHub repos
 * (read and distilled, no invented scope). The tailoring engine picks the
 * best 2 per job and may reword bullets for emphasis, but every fact here
 * is source material from the repos themselves.
 */

export interface ProjectProfile {
  id: string;
  name: string;
  githubUrl: string;
  /** The \emph{...} tech line under the project name (same role as in the master). */
  techLine: string;
  year: string;
  /** Grounded bullets (plain text, no LaTeX). 2-3 per project. */
  bullets: string[];
  /** Relevance signals for matching against a JD. */
  keywords: string[];
  /** One-line what-it-is, given to the LLM as context. */
  summary: string;
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
    year: "2024",
    summary:
      "Team-built budgeting app (4 developers; front-end role): categorized expense/income tracking, multi-account and shared-account support, dashboard analytics.",
    bullets: [
      "Built the React front end for a team budgeting app: categorized expense/income entry, multi-account and shared-account flows, and a dashboard with pie/bar chart analytics and month-over-month trends.",
      "Collaborated in a 4-developer Agile team with a written definition-of-done and working agreement, shipping against a Node/Express backend.",
    ],
    keywords: ["react", "javascript", "express", "node", "charts", "dashboard", "team", "agile", "front-end", "finance", "budgeting"],
  },
];

/** Short brief for the LLM: which 2 projects fit this job best, and why. */
export function projectBriefs(): string {
  return PROJECTS.map(
    (p) => `- id "${p.id}" — ${p.name} (${p.techLine}): ${p.summary}\n  keywords: ${p.keywords.join(", ")}\n  real bullets you may reword:\n${p.bullets.map((b) => `    * ${b}`).join("\n")}`
  ).join("\n");
}

export function projectById(id: string): ProjectProfile | undefined {
  return PROJECTS.find((p) => p.id === id);
}
