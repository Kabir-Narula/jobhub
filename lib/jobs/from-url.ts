import { fetchJson, fetchText, stripHtml } from "@/lib/sources/http";
import { prisma } from "@/lib/db";

/**
 * Add-from-URL: turn a posting link into structured job fields WITHOUT an LLM.
 * Ladder: known-board JSON API (exact) → JSON-LD JobPosting → meta/heuristic.
 * The LLM extractor in the route is the last resort and may be unavailable.
 */

export interface ParsedJobUrl {
  title: string;
  company: string;
  locationRaw: string;
  description: string;
  applyUrl: string;
  postedAt: Date | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) job-hub/1.0" };

function slugToName(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Real company name from the seeded board registry when we know the board. */
async function boardCompany(atsType: "GREENHOUSE" | "LEVER" | "ASHBY" | "SMARTRECRUITERS" | "WORKDAY", boardToken: string): Promise<string | null> {
  const row = await prisma.companySource.findUnique({ where: { atsType_boardToken: { atsType, boardToken } } }).catch(() => null);
  return row?.name ?? null;
}

function withLocation(loc: string, workplace?: string | null): string {
  if (!workplace || new RegExp(workplace, "i").test(loc)) return loc;
  const pretty = workplace.charAt(0).toUpperCase() + workplace.slice(1).toLowerCase();
  return `${loc} (${pretty})`;
}

// ---------- known-board JSON APIs ----------

async function fromGreenhouse(u: URL): Promise<ParsedJobUrl | null> {
  const m = u.hostname.match(/^(boards|job-boards)\.greenhouse\.io$/) && u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  if (!m) return null;
  const [, board, id] = u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/)!;
  const j = await fetchJson<{ title?: string; location?: { name?: string }; content?: string }>(
    `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`
  );
  if (!j.title) return null;
  return {
    title: j.title,
    company: (await boardCompany("GREENHOUSE", board)) ?? slugToName(board),
    locationRaw: j.location?.name ?? "",
    description: stripHtml(j.content ?? ""),
    applyUrl: u.origin + u.pathname,
    postedAt: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
  };
}

async function fromLever(u: URL): Promise<ParsedJobUrl | null> {
  if (u.hostname !== "jobs.lever.co") return null;
  const m = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!m) return null;
  const [, board, id] = m;
  const j = await fetchJson<{
    text?: string;
    descriptionPlain?: string;
    categories?: { location?: string; commitment?: string };
    workplaceType?: string;
  }>(`https://api.lever.co/v0/postings/${board}/${id}`);
  if (!j.text) return null;
  return {
    title: j.text,
    company: (await boardCompany("LEVER", board)) ?? slugToName(board),
    locationRaw: withLocation(j.categories?.location ?? "", j.workplaceType),
    description: j.descriptionPlain ?? "",
    applyUrl: u.origin + u.pathname,
    postedAt: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
  };
}

async function fromAshby(u: URL): Promise<ParsedJobUrl | null> {
  if (u.hostname !== "jobs.ashbyhq.com") return null;
  const m = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!m) return null;
  const [, board, id] = m;
  const j = await fetchJson<{ title?: string; location?: string; descriptionHtml?: string }>(
    `https://api.ashbyhq.com/posting-api/job-board/${board}/jobs/${id}`
  );
  if (!j.title) return null;
  return {
    title: j.title,
    company: (await boardCompany("ASHBY", board)) ?? slugToName(board),
    locationRaw: j.location ?? "",
    description: stripHtml(j.descriptionHtml ?? ""),
    applyUrl: u.origin + u.pathname,
    postedAt: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
  };
}

async function fromSmartRecruiters(u: URL): Promise<ParsedJobUrl | null> {
  if (u.hostname !== "jobs.smartrecruiters.com") return null;
  const m = u.pathname.match(/^\/([^/]+)\/(\d+)/);
  if (!m) return null;
  const [, board, id] = m;
  const j = await fetchJson<{
    name?: string;
    company?: { name?: string };
    location?: { city?: string; region?: string; remote?: boolean };
    jobAd?: { sections?: { companyDescription?: { text?: string }; jobDescription?: { text?: string }; qualifications?: { text?: string } } };
  }>(`https://api.smartrecruiters.com/v1/companies/${board}/postings/${id}`);
  if (!j.name) return null;
  const s = j.jobAd?.sections;
  const loc = [j.location?.city, j.location?.region].filter(Boolean).join(", ");
  return {
    title: j.name,
    company: j.company?.name ?? (await boardCompany("SMARTRECRUITERS", board)) ?? slugToName(board),
    locationRaw: withLocation(loc, j.location?.remote ? "Remote" : null),
    description: [s?.companyDescription?.text, s?.jobDescription?.text, s?.qualifications?.text]
      .filter(Boolean)
      .map((t) => stripHtml(t!))
      .join("\n\n"),
    applyUrl: u.origin + u.pathname,
    postedAt: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
  };
}

async function fromWorkday(u: URL): Promise<ParsedJobUrl | null> {
  if (!u.hostname.endsWith(".myworkdayjobs.com")) return null;
  // path: /{site}/job/{place}/{slug} (optionally /en-US/{site}/job/...)
  const m = u.pathname.match(/^\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/]+)(\/job\/[^?]+)/);
  if (!m) return null;
  const [, site, externalPath] = m;
  const tenant = u.hostname.split(".")[0];
  const hostKey = u.hostname.replace(/\.myworkdayjobs\.com$/, "");
  const j = await fetchJson<{
    jobPostingInfo?: { title?: string; jobDescription?: string; location?: string; startDate?: string };
  }>(`https://${u.hostname}/wday/cxs/${tenant}/${site}${externalPath}`, { headers: UA });
  const info = j.jobPostingInfo;
  if (!info?.title) return null;
  return {
    title: info.title,
    company: (await boardCompany("WORKDAY", `${hostKey}/${tenant}/${site}`)) ?? slugToName(tenant),
    locationRaw: info.location ?? "",
    description: stripHtml(info.jobDescription ?? ""),
    applyUrl: u.origin + u.pathname,
    postedAt: info.startDate ? new Date(info.startDate) : null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
  };
}

async function fromLinkedIn(u: URL): Promise<ParsedJobUrl | null> {
  if (!/(^|\.)linkedin\.com$/.test(u.hostname)) return null;
  const id = u.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ?? u.searchParams.get("currentJobId") ?? "";
  if (!id) return null;
  const html = await fetchText(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`, { headers: UA }, 12000);
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim() ?? "";
  const title = pick(/top-card-layout__title[^>]*>([^<]+)/i) || pick(/<h1[^>]*>([^<]+)/i);
  const company = pick(/topcard__org-name-link[^>]*>([^<]+)/i) || pick(/topcard__flavor[^>]*>([^<]+)/i);
  const location = pick(/top-card-layout__second-subline[\s\S]*?topcard__flavor[^>]*>([^<]+)/i);
  const descHtml = html.match(/<div class="description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  if (!title || !company) return null;
  return {
    title,
    company,
    locationRaw: location,
    description: stripHtml(descHtml),
    applyUrl: `https://www.linkedin.com/jobs/view/${id}/`,
    postedAt: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
  };
}

// ---------- generic page fallbacks ----------

interface JsonLd {
  "@type"?: string;
  title?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } } | { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }[];
  jobLocationType?: string;
  description?: string;
  datePosted?: string;
  baseSalary?: { currency?: string; value?: { minValue?: number; maxValue?: number; value?: number } };
}

function fromJsonLd(html: string, applyUrl: string): ParsedJobUrl | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let data: JsonLd | JsonLd[];
    try {
      data = JSON.parse(b[1]);
    } catch {
      continue;
    }
    const items = Array.isArray(data) ? data : [data];
    const job = items.find((x) => x?.["@type"] === "JobPosting");
    if (!job?.title) continue;
    const org = job.hiringOrganization;
    const company = typeof org === "string" ? org : (org?.name ?? "");
    const locRaw = Array.isArray(job.jobLocation) ? job.jobLocation[0]?.address : job.jobLocation?.address;
    const loc = locRaw ? [locRaw.addressLocality, locRaw.addressRegion].filter(Boolean).join(", ") : "";
    const sal = job.baseSalary?.value;
    if (!company) continue;
    return {
      title: job.title,
      company,
      locationRaw: withLocation(loc, job.jobLocationType === "TELECOMMUTE" ? "Remote" : null),
      description: stripHtml(job.description ?? ""),
      applyUrl,
      postedAt: job.datePosted ? new Date(job.datePosted) : null,
      salaryMin: typeof sal?.minValue === "number" ? sal.minValue : (sal?.value ?? null),
      salaryMax: typeof sal?.maxValue === "number" ? sal.maxValue : null,
      salaryCurrency: job.baseSalary?.currency ?? null,
    };
  }
  return null;
}

function metaContent(html: string, key: string): string {
  return (
    html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, "i"))?.[1] ??
    ""
  ).trim();
}

/** Last-resort deterministic parse: og/meta tags + title convention + page text. */
function fromMetaHeuristics(html: string, u: URL): ParsedJobUrl | null {
  const title = metaContent(html, "og:title") || (html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "").trim();
  if (!title) return null;
  // company: og:site_name, else "<title> ... | Company" / "at Company" / "- Company" conventions
  let company = metaContent(html, "og:site_name");
  if (!company) {
    const titleTag = html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "";
    const suffix = titleTag.split(/\s[|–—-]\s|\sat\s/i).pop()?.trim() ?? "";
    company = suffix && suffix !== titleTag && !/job|career|detail|posting/i.test(suffix)
      ? suffix
      : slugToName(u.hostname.replace(/^(www|careers|jobs)\./, "").split(".")[0]);
  }
  const text = stripHtml(html);
  // cut nav chrome: start the description at the title's first occurrence
  const idx = text.indexOf(title);
  const description = (idx > 0 ? text.slice(idx) : text).slice(0, 12000);
  const locationRaw = metaContent(html, "description").replace(title, "").replace(/\s{2,}/g, " ").trim();
  return {
    title,
    company,
    locationRaw,
    description,
    applyUrl: u.origin + u.pathname,
    postedAt: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
  };
}

/**
 * Resolve a posting URL to structured fields. Throws nothing — returns an
 * error string the route can surface as a clean 422.
 */
export async function parseJobUrl(rawUrl: string): Promise<{ job?: ParsedJobUrl; error?: string }> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { error: "That doesn't look like a valid URL." };
  }
  if (!/^https?:$/.test(u.protocol)) return { error: "Only http(s) links are supported." };

  for (const handler of [fromGreenhouse, fromLever, fromAshby, fromSmartRecruiters, fromWorkday, fromLinkedIn]) {
    try {
      const job = await handler(u);
      if (job) return { job };
    } catch {
      // board guessed wrong or API down — keep falling through
    }
  }

  let html = "";
  try {
    html = await fetchText(rawUrl, { headers: UA }, 15000);
  } catch {
    return { error: "Couldn't fetch that link — paste the job details instead." };
  }

  const ld = fromJsonLd(html, u.origin + u.pathname);
  if (ld && ld.description.length > 200) return { job: ld };

  const heur = fromMetaHeuristics(html, u);
  if (heur && heur.description.length > 400) return { job: heur };

  return { error: "That page didn't yield a readable posting — paste the job details instead." };
}
