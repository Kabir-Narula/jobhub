import OpenAI from "openai";
import { stripHtml } from "@/lib/sources/http";

export interface CompanyResearch {
  mission: string;
  product: string;
  stack: string[];
  news: string[];
  summary: string;
  homepageUsed: string | null;
  /** Condensed Reddit digest: real candidate experiences at this company. */
  redditIntel?: string;
  generatedAt: string;
}

let client: OpenAI | null = null;
export function openai(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // OpenAI-compatible endpoint: api.openai.com or Kimi (api.kimi.com/coding).
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return client;
}

export function model(): string {
  return process.env.OPENAI_MODEL || "gpt-4o";
}

/** Tolerant JSON extraction: handles raw JSON and ```json fenced replies. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJson(content: string): any {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

function slugify(company: string): string {
  return company
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|limited|co|company|technologies|technology|labs|group)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Best-effort fetch of one page; returns plain text or null. */
async function fetchPageText(url: string, maxChars = 3000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 job-hub" } });
    clearTimeout(t);
    if (!res.ok) return null;
    const text = stripHtml(await res.text()).slice(0, maxChars);
    return text.length > 150 ? text : null;
  } catch {
    return null;
  }
}

/** Best-effort homepage fetch: try .com / .ca / .io derived from the company name. */
async function fetchHomepageText(company: string): Promise<{ url: string; text: string } | null> {
  const slug = slugify(company);
  if (!slug) return null;
  for (const tld of ["com", "ca", "io", "ai"]) {
    const url = `https://www.${slug}.${tld}`;
    const text = await fetchPageText(url);
    if (text) return { url, text };
  }
  return null;
}

/** Deep research: homepage + about/careers/blog pages when reachable. */
async function fetchDeepPages(homepageUrl: string): Promise<string> {
  const u = new URL(homepageUrl);
  const base = `${u.protocol}//${u.hostname}`;
  const chunks: string[] = [];
  for (const path of ["/about", "/company", "/careers", "/blog", "/engineering"]) {
    const text = await fetchPageText(base + path, 2000);
    if (text) chunks.push(`--- ${path} ---\n${text}`);
    if (chunks.length >= 3) break;
  }
  return chunks.join("\n\n").slice(0, 5000);
}

/**
 * Real company research: homepage content (when reachable) + the model's own
 * knowledge, grounded by the actual job description. Cached on the Job row.
 */
export async function researchCompany(input: {
  company: string;
  jobTitle: string;
  jobDescription: string;
  deep?: boolean;
}): Promise<CompanyResearch> {
  const { fetchRedditIntel } = await import("./reddit");
  const [homepage, redditIntel] = await Promise.all([
    fetchHomepageText(input.company),
    fetchRedditIntel(input.company),
  ]);
  const deepPages = input.deep && homepage ? await fetchDeepPages(homepage.url) : "";

  const prompt = [
    `Research the company "${input.company}" for a job application to the role "${input.jobTitle}".`,
    homepage ? `\nCompany homepage content (${homepage.url}):\n${homepage.text}` : "\nNo homepage content could be fetched; rely on your knowledge.",
    deepPages ? `\nAdditional pages from their site (about/careers/blog):\n${deepPages}` : "",
    redditIntel ? `\nReal candidate experiences on Reddit about this company (hiring, interviews, what worked):\n${redditIntel}` : "",
    `\nJob description (excerpt):\n${input.jobDescription.slice(0, 4000)}`,
    `\nReturn JSON with keys:`,
    `- "mission": one sentence on what the company does / why it exists`,
    `- "product": one sentence on the main product(s) and who uses them`,
    `- "stack": array of up to 8 technologies the company is known to use (from the JD and your knowledge)`,
    `- "news": array of up to 4 recent/relevant facts (funding, launches, scale, engineering culture) — only things you are confident about`,
    `- "summary": ${input.deep ? "5-6 sentences of deep insight a candidate could use to sound genuinely informed in a cover letter or interview: what the company is betting on, what their engineering culture values, and exactly which candidate strengths would resonate with this team" : "3-4 sentences a candidate could use to sound informed in a cover letter or interview"}`,
    `Be factual. If unsure about a fact, omit it rather than guess.`,
  ].join("\n");

  const res = await openai().chat.completions.create({
    model: model(),
    messages: [
      { role: "system", content: "You are a meticulous company researcher. Output valid JSON only." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = parseJson(res.choices[0]?.message?.content ?? "{}");
  return {
    mission: String(parsed.mission ?? ""),
    product: String(parsed.product ?? ""),
    stack: Array.isArray(parsed.stack) ? parsed.stack.map(String).slice(0, 8) : [],
    news: Array.isArray(parsed.news) ? parsed.news.map(String).slice(0, 4) : [],
    summary: String(parsed.summary ?? ""),
    homepageUsed: homepage?.url ?? null,
    redditIntel: redditIntel || undefined,
    generatedAt: new Date().toISOString(),
  };
}
