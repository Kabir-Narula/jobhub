import OpenAI from "openai";
import { stripHtml } from "@/lib/sources/http";
import { ensureHiringScreen } from "./hiring-screen";

export interface CompanyResearch {
  mission: string;
  product: string;
  stack: string[];
  news: string[];
  summary: string;
  /** ONE specific, current, verifiable fact about the company (a metric, product detail, or recent move) — the cover-letter hook anchor. */
  hookFact?: string;
  /** Register of the company's public voice, for tone matching. */
  tone?: "casual" | "formal";
  homepageUsed: string | null;
  /** Condensed Reddit digest: real candidate experiences at this company + role-family resume advice. */
  redditIntel?: string;
  /**
   * Distilled hiring-screen rules for THIS role from Reddit + JD — what HR /
   * recruiters actually score. First-class input to resume generation.
   */
  hiringScreen?: string[];
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

export function model(tier: "quality" | "cheap" = "quality"): string {
  if (tier === "cheap") return process.env.OPENAI_MODEL_MINI || process.env.OPENAI_MODEL || "gpt-5.4-mini";
  return process.env.OPENAI_MODEL || "gpt-5.5";
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

export function slugify(company: string): string {
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

const ATS_HOST_RE =
  /(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday\.com|smartrecruiters\.com|workable\.com|icims\.com|taleo\.net|bamboohr\.com|jazzhr\.com|jobvite\.com|linkedin\.com|indeed\.com|glassdoor\.|simplyhired\.|ziprecruiter\.|simplify\.jobs)/i;

const KNOWN_COMPANY_DOMAINS: Record<string, string> = {
  td: "https://www.td.com",
  tdbank: "https://www.td.com",
  tdsecurities: "https://www.tdsecurities.com",
  rbc: "https://www.rbc.com",
  royalbankofcanada: "https://www.rbc.com",
  bmo: "https://www.bmo.com",
  bankofmontreal: "https://www.bmo.com",
  cibc: "https://www.cibc.com",
  scotiabank: "https://www.scotiabank.com",
  bankofnovascotia: "https://www.scotiabank.com",
  nationalbank: "https://www.nbc.ca",
  nationalbankofcanada: "https://www.nbc.ca",
  bcg: "https://www.bcg.com",
  bostonconsulting: "https://www.bcg.com",
  bain: "https://www.bain.com",
  mckinsey: "https://www.mckinsey.com",
  deloitte: "https://www.deloitte.com",
  pwc: "https://www.pwc.com",
  ey: "https://www.ey.com",
  kpmg: "https://www.kpmg.com",
  accenture: "https://www.accenture.com",
  zs: "https://www.zs.com",
  zsassociates: "https://www.zs.com",
  ibm: "https://www.ibm.com",
  cgi: "https://www.cgi.com",
  aircanada: "https://www.aircanada.com",
  wealthsimple: "https://www.wealthsimple.com",
  shopify: "https://www.shopify.com",
  cppinvestments: "https://www.cppinvestments.com",
  indigobooksmusic: "https://www.indigo.ca",
  indigo: "https://www.indigo.ca",
};

function rootDomainFromPostingUrl(postingUrl?: string): string | null {
  if (!postingUrl) return null;
  try {
    const u = new URL(postingUrl);
    if (!/^https?:$/.test(u.protocol) || ATS_HOST_RE.test(u.hostname)) return null;
    const host = u.hostname.replace(/^(?:careers|jobs|apply|talent|work|recruiting)\./i, "");
    const parts = host.split(".");
    const root = parts.length >= 2 ? parts.slice(-2).join(".") : host;
    return `https://www.${root.replace(/^www\./i, "")}`;
  } catch {
    return null;
  }
}

/** Best-effort homepage fetch: posting domain / known company domains, then .com/.ca/.io/.ai. */
async function fetchHomepageText(company: string, postingUrl?: string): Promise<{ url: string; text: string } | null> {
  const slug = slugify(company);
  const candidates: string[] = [];
  const fromUrl = rootDomainFromPostingUrl(postingUrl);
  if (fromUrl) candidates.push(fromUrl);
  if (slug && KNOWN_COMPANY_DOMAINS[slug]) candidates.push(KNOWN_COMPANY_DOMAINS[slug]);
  if (slug) {
    for (const tld of ["com", "ca", "io", "ai"]) {
      candidates.push(`https://www.${slug}.${tld}`);
    }
  }
  for (const url of [...new Set(candidates)]) {
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
 * Real company research: homepage (+ deep about/careers/blog when deep),
 * PullPush Reddit intel, model knowledge, grounded by the JD.
 * Always called before resume generate (`requireResearch`); cached on Job.
 */
export async function researchCompany(input: {
  company: string;
  jobTitle: string;
  jobDescription: string;
  postingUrl?: string;
  deep?: boolean;
}): Promise<CompanyResearch> {
  const { fetchRedditIntel, fetchRoleResumeIntel } = await import("./reddit");
  const { detectRoleFamily } = await import("./role-family");
  const family = detectRoleFamily(input.jobTitle, input.company, input.jobDescription);
  const [homepage, redditIntel] = await Promise.all([
    fetchHomepageText(input.company, input.postingUrl),
    Promise.all([fetchRoleResumeIntel(family), fetchRedditIntel(input.company, { family })]).then(([resume, company]) =>
      [resume, company].filter(Boolean).join("\n\n")
    ),
  ]);
  const deepPages = input.deep && homepage ? await fetchDeepPages(homepage.url) : "";

  const prompt = [
    `Research the company "${input.company}" for a job application to the role "${input.jobTitle}".`,
    homepage ? `\nCompany homepage content (${homepage.url}):\n${homepage.text}` : "\nNo homepage content could be fetched; rely on your knowledge.",
    deepPages ? `\nAdditional pages from their site (about/careers/blog):\n${deepPages}` : "",
    redditIntel ? `\nReal candidate experiences on Reddit about this company (hiring, interviews, what worked):\n${redditIntel}` : "",
    `\nJob description (excerpt):\n${input.jobDescription.slice(0, 8000)}`,
    `\nReturn JSON with keys:`,
    `- "mission": one sentence on what the company does / why it exists`,
    `- "product": one sentence on the main product(s) and who uses them`,
    `- "stack": array of up to 8 tools this team actually uses. Infer from the JD and reliable sources only — do not dump Pivot Tables / INDEX/MATCH / Power Query onto every consulting team. For BA/insights, never invent engineering frameworks. Tableau/Alteryx/Qualtrics/SPSS/Nielsen only if the JD or a reliable source names them.`,
    `- "news": array of up to 4 recent/relevant facts (funding, launches, scale, culture) — only things you are confident about`,
    `- "hookFact": ONE specific, current, verifiable fact about the company that a candidate could open a cover letter with — a real metric, a concrete product detail, or a recent move. Prefer something found in the provided site content over general knowledge. Empty string if nothing solid exists.`,
    `- "tone": "casual" if their public voice is startup/engineering-blog informal, "formal" if it's corporate/enterprise formal`,
    `- "hiringScreen": array of 4-8 short strings. Distill STRICTLY from the Reddit digest + this JD what recruiters/HR for THIS role screen for. Cover: mandatory vs preferred asks, core responsibilities, domain expectations, differentiating signals vs low-value wording, and what evidence (outcomes, collaboration, problem-solving) wins a first screen. Prefer concrete Reddit guidance when present. If Reddit is empty, still fill from the JD analysis — never return an empty array for analyst/consulting roles.`,
    `- "summary": ${input.deep ? "5-6 sentences of deep insight a candidate could use to sound genuinely informed in a cover letter or interview: what the company is betting on, what this team's hiring bar values, and which candidate strengths would resonate" : "3-4 sentences a candidate could use to sound informed in a cover letter or interview"}`,
    `Be factual. If unsure about a fact, omit it rather than guess.`,
  ].join("\n");

  const res = await openai().chat.completions.create({
    model: model("quality"),
    messages: [
      {
        role: "system",
        content:
          "You are a meticulous company and hiring-screen researcher. Deeply analyze the JD for what the employer cares about (mandatory vs preferred, core responsibilities, domain expectations, differentiating signals) — not word frequency. Distill Reddit + JD into actionable resume guidance. Output valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = parseJson(res.choices[0]?.message?.content ?? "{}");
  const hiringFromModel = Array.isArray(parsed.hiringScreen)
    ? parsed.hiringScreen.map(String).map((s: string) => s.trim()).filter(Boolean).slice(0, 8)
    : [];
  const hiringScreen = ensureHiringScreen(hiringFromModel, family, input.jobTitle, input.jobDescription);
  return {
    mission: String(parsed.mission ?? ""),
    product: String(parsed.product ?? ""),
    stack: Array.isArray(parsed.stack) ? parsed.stack.map(String).slice(0, 8) : [],
    news: Array.isArray(parsed.news) ? parsed.news.map(String).slice(0, 4) : [],
    summary: String(parsed.summary ?? ""),
    hookFact: typeof parsed.hookFact === "string" && parsed.hookFact.trim() ? parsed.hookFact.trim() : undefined,
    tone: parsed.tone === "formal" ? "formal" : "casual",
    homepageUsed: homepage?.url ?? null,
    redditIntel: redditIntel || undefined,
    hiringScreen: hiringScreen.length ? hiringScreen : undefined,
    generatedAt: new Date().toISOString(),
  };
}
