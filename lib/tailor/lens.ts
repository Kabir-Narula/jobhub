/**
 * Deterministic lens detection: which technology theme dominates a posting,
 * so the writer gets an explicit foreground/suppress instruction instead of
 * a vague hint. Checked in priority order.
 */
export interface Lens {
  id: string;
  foreground: string[];
  suppress: string[];
}

const LENSES: { id: string; re: RegExp; foreground: string[]; suppress: string[] }[] = [
  {
    id: "ai-ml",
    re: /\b(machine learning|ml engineer|ai engineer|llm|rag\b|agentic|fine-?tun|prompt engineering|data scien|nlp|computer vision|openai)\b/i,
    foreground: ["OpenAI API / LLM inference", "Python + FastAPI", "ML pipelines", "prompt/RAG framing", "PostgreSQL"],
    suppress: ["Kotlin", "Android", "mobile"],
  },
  {
    id: "mobile",
    re: /\b(kotlin|android|swift|ios\b|mobile)\b/i,
    foreground: ["Kotlin Android", "mobile + web clients", "REST API integration", "auth/error handling"],
    suppress: ["worker queues", "infra"],
  },
  {
    id: "data",
    re: /\b(data engineer|etl|spark|databricks|analytics|power bi|data platform|data pipeline)\b/i,
    foreground: ["data pipelines", "PostgreSQL/SQL", "ETL-style processing", "analytics dashboards"],
    suppress: ["mobile", "Kotlin UI"],
  },
  {
    id: "cloud-infra",
    re: /\b(devops|sre|kubernetes|aws\b|gcp\b|cloud engineer|infrastructure|platform engineer|terraform)\b/i,
    foreground: ["Docker", "Linux", "CI/CD", "Redis/BullMQ workers", "GitHub Actions"],
    suppress: ["mobile UI"],
  },
  {
    id: "ts-web",
    re: /\b(typescript|node\.?js|react|next\.?js|full[- ]?stack|front[- ]?end|web developer)\b/i,
    foreground: ["TypeScript", "React/Next.js", "Node services", "tRPC/Fastify APIs"],
    suppress: ["Blender", "3D"],
  },
  {
    id: "python-backend",
    re: /\b(python|fastapi|django|flask|backend|api developer)\b/i,
    foreground: ["Python", "FastAPI", "REST services", "PostgreSQL", "background jobs"],
    suppress: ["mobile UI"],
  },
];

export function detectLens(title: string, description: string): Lens | null {
  const hay = `${title}\n${description.slice(0, 6000)}`;
  for (const l of LENSES) {
    if (l.re.test(hay)) return l;
  }
  return null;
}

export function lensInstruction(lens: Lens | null): string {
  if (!lens) return "";
  return `DOMINANT LENS for this posting (${lens.id}): foreground ONLY these real aspects of the candidate: ${lens.foreground.join(", ")}. Do NOT mention these at all (they are real but irrelevant here): ${lens.suppress.join(", ")}. Every bullet and every skills line must pass through this lens.`;
}
