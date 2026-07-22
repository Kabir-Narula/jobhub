/**
 * Lens detection v2: frequency-scored instead of first-match-wins.
 * The dominant technology theme of a posting determines what the writer
 * foregrounds/suppresses. Stack lists in requirements sections dominate;
 * a single stray "mobile" mention must not theme a whole resume.
 */
export interface Lens {
  id: string;
  foreground: string[];
  suppress: string[];
}

interface LensDef extends Lens {
  patterns: RegExp[];
}

const LENSES: LensDef[] = [
  {
    id: "ai-ml",
    foreground: ["OpenAI API / LLM inference", "Python + FastAPI", "ML pipelines", "prompt/RAG framing", "PostgreSQL"],
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
    patterns: [/\b(data engineer|etl|spark|databricks|analytics|power bi|data platform|data pipeline)\b/gi],
  },
  {
    id: "cloud-infra",
    foreground: ["Docker", "Linux", "CI/CD", "Redis/BullMQ workers", "GitHub Actions"],
    suppress: ["mobile UI"],
    patterns: [/\b(devops|sre|kubernetes|aws\b|gcp\b|cloud engineer|infrastructure|platform engineer|terraform)\b/gi],
  },
  {
    id: "python-backend",
    foreground: ["Python", "FastAPI", "REST services", "PostgreSQL", "background jobs"],
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

export function detectLens(title: string, description: string): Lens | null {
  const reqSection = `${title}\n${description.slice(0, 2500)}`; // requirements dominate
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
  // Require a real signal, not a single stray mention.
  if (!best || bestScore < 3) return null;
  return best;
}

export function lensInstruction(lens: Lens | null): string {
  if (!lens) return "";
  return `DOMINANT LENS for this posting (${lens.id}): foreground ONLY these real aspects of the candidate: ${lens.foreground.join(", ")}. Do NOT mention these at all (they are real but irrelevant here): ${lens.suppress.join(", ")}. Every bullet and every skills line must pass through this lens.`;
}
