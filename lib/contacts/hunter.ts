/**
 * Verified contact discovery via Hunter.io (free tier: 25 domain searches +
 * 50 verifications per month). Emails come from Hunter's public-web index
 * (with source URLs) and are deliverability-checked with their verifier —
 * no pattern-guessing, no LinkedIn scraping.
 */

export interface ContactResult {
  name: string;
  role: string;
  email: string;
  /** Hunter confidence 0-100 for the address itself. */
  confidence: number;
  /** Deliverability per Hunter email-verifier. */
  deliverability: "valid" | "accept_all" | "unknown";
  /** Public URLs where the address was found (evidence for the user). */
  sources: string[];
  /** True when the address was constructed from the company's known email pattern
   *  (not found publicly indexed) — always pair with the deliverability badge. */
  patternDerived?: boolean;
  /** Why this person is worth emailing (shown in the UI). */
  why?: string;
}

interface HunterEmail {
  value: string;
  type?: string;
  confidence: number;
  first_name?: string;
  last_name?: string;
  position?: string;
  department?: string;
  sources?: { uri: string }[];
}

function key(): string {
  const k = process.env.HUNTER_API_KEY;
  if (!k) throw new Error("HUNTER_API_KEY not set — add it to .env.local (free at hunter.io)");
  return k;
}

async function hunterGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `https://api.hunter.io/v2/${path}?${new URLSearchParams({ ...params, api_key: key() })}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 429) throw new Error("Hunter monthly quota exceeded — try again next month or upgrade");
    if (!res.ok) throw new Error(`Hunter HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function domainSearch(domain: string, department?: string): Promise<{ emails: HunterEmail[]; pattern: string | null }> {
  const params: Record<string, string> = { domain, limit: "10" };
  if (department) params.department = department;
  const data = await hunterGet<{ data?: { emails?: HunterEmail[]; pattern?: string } }>("domain-search", params);
  return { emails: data.data?.emails ?? [], pattern: data.data?.pattern ?? null };
}

const CAMPUS_RE = /university|campus|early[- ]career|new[- ]?grad|student program|emerging talent|graduate program/i;
const MANAGER_RE = /engineering manager|manager|director|head of|team lead|tech lead|\bvp\b|vice president|cto|founder|owner|principal/i;
const ENGINEER_RE = /software|engineer|developer|swe|programmer|architect/i;
const RECRUITER_RE = /recruit|talent|sourcer|hiring|staffing|human_resources|people ops|\bhr\b/i;

/** One-line reason this person is worth cold-emailing for a new-grad application. */
export function whyContact(e: HunterEmail): string {
  const t = `${e.position ?? ""} ${e.department ?? ""}`;
  if (CAMPUS_RE.test(t)) return "Campus recruiting — owns new-grad hiring, reads these";
  if (MANAGER_RE.test(t)) return "Likely hiring-manager track — can forward your resume internally";
  if (ENGINEER_RE.test(t)) return "Engineer on the team — referral path (referrals pay bonuses)";
  if (RECRUITER_RE.test(t)) return "Recruiter — right inbox, high volume";
  return "Relevant contact at the company";
}

/**
 * People most worth cold-emailing for a NEW-GRAD application, best first.
 * Philosophy (referral research): a hiring manager or team engineer who
 * forwards your resume beats a flooded recruiter inbox; campus recruiters
 * own the new-grad pipeline and actually read; generic HR is the fallback.
 */
function rankContacts(emails: HunterEmail[]): HunterEmail[] {
  const score = (e: HunterEmail): number => {
    const t = `${e.position ?? ""} ${e.department ?? ""}`;
    let s = 0;
    if (CAMPUS_RE.test(t)) s += 100; // owns new-grad hiring, reachable
    if (MANAGER_RE.test(t)) s += 90; // decision-maker / internal forward
    if (ENGINEER_RE.test(t)) s += 75; // referral path
    if (RECRUITER_RE.test(t)) s += 55; // right but flooded inbox
    s += (e.confidence ?? 0) / 2;
    if (e.type === "personal") s += 10;
    return s;
  };
  return [...emails].sort((a, b) => score(b) - score(a));
}

async function verify(email: string): Promise<ContactResult["deliverability"]> {
  try {
    const data = await hunterGet<{ data?: { status?: string; score?: number } }>("email-verifier", { email });
    const status = data.data?.status ?? "unknown";
    if (status === "valid") return "valid";
    if (status === "accept_all") return "accept_all";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Find up to `count` verified contacts at a company domain.
 * Searches engineering AND hr departments (niche strategy: hiring managers
 * and team engineers over flooded recruiters), then a general search to fill.
 * Emails that verify as invalid are dropped.
 */
export async function findCompanyContacts(domain: string, count = 2): Promise<ContactResult[]> {
  // Hunter's valid department filters: executive, it, finance, management,
  // sales, legal, support, hr, marketing, communication, education, design,
  // health, operations. "engineering" is NOT one (HTTP 400) — engineers live
  // under "it", hiring managers under "management".
  const [hr, it, mgmt] = await Promise.all([
    domainSearch(domain, "hr"),
    domainSearch(domain, "it"),
    domainSearch(domain, "management"),
  ]);
  let pattern: string | null = hr.pattern ?? it.pattern ?? mgmt.pattern;
  const seen = new Set<string>();
  let candidates = [...it.emails, ...mgmt.emails, ...hr.emails].filter((c) => {
    const k = c.value.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  candidates = rankContacts(candidates);

  if (candidates.length < count) {
    const general = await domainSearch(domain);
    if (!pattern) pattern = general.pattern;
    candidates = [...candidates, ...rankContacts(general.emails).filter((c) => !seen.has(c.value.toLowerCase()))];
  }

  const out: ContactResult[] = [];
  for (const c of candidates.slice(0, count + 1)) {
    if (out.length >= count) break;
    const deliverability = await verify(c.value);
    if (deliverability === "unknown" && c.confidence < 60) continue; // unverifiable + low confidence = skip
    out.push({
      name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown",
      role: c.position || c.department || "",
      email: c.value,
      confidence: c.confidence ?? 0,
      deliverability,
      sources: (c.sources ?? []).map((s) => s.uri).slice(0, 3),
      why: whyContact(c),
    });
  }

  // Layer 2: nothing found publicly — construct from the company's known email
  // pattern + GPT-suggested manager/peer names, then verify each before showing.
  if (out.length < count) {
    const derived = await patternDerivedContacts(domain, pattern, count - out.length);
    out.push(...derived);
  }
  return out;
}

// ---------- layer 2: pattern-derived + verified ----------

function normalizePart(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function patternEmails(first: string, last: string, pattern: string | null, domain: string): string[] {
  const f = normalizePart(first);
  const l = normalizePart(last);
  if (!f || !l) return [];
  const fi = f[0];
  const candidates: string[] = [];
  const p = (pattern ?? "").toLowerCase();
  if (p.includes("{first}.{last}")) candidates.push(`${f}.${l}@${domain}`);
  if (p.includes("{f}{last}")) candidates.push(`${fi}${l}@${domain}`);
  if (p.includes("{first}{last}")) candidates.push(`${f}${l}@${domain}`);
  if (p.includes("{first}") && !p.includes("last")) candidates.push(`${f}@${domain}`);
  // fallbacks, most common first
  for (const e of [`${f}.${l}@${domain}`, `${fi}${l}@${domain}`, `${f}${l}@${domain}`, `${f}@${domain}`]) {
    if (!candidates.includes(e)) candidates.push(e);
  }
  return candidates.slice(0, 3);
}

async function gptContactNames(company: string, domain: string): Promise<{ first: string; last: string; role: string }[]> {
  try {
    const { openai, model, parseJson } = await import("@/lib/tailor/research");
    const res = await openai().chat.completions.create({
      model: model("cheap"),
      messages: [
        {
          role: "system",
          content:
            "You identify real people for professional outreach. You NEVER invent names. If you don't know actual people at this company from public information, return an empty list.",
        },
        {
          role: "user",
          content: `List up to 3 REAL people who work (or recently worked) at ${company} (${domain}) in roles worth cold-emailing for a new-grad software application: engineering managers, team leads, senior engineers (referral path), or university/campus recruiters. Base this on your knowledge of public information (e.g. their LinkedIn presence). Return JSON: {"people": [{"first": "...", "last": "...", "role": "..."}]}. Only include people you are confident actually exist. If none, return {"people": []}.`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = parseJson(res.choices[0]?.message?.content ?? "{}");
    if (!Array.isArray(parsed.people)) return [];
    return parsed.people
      .filter((p: { first?: string; last?: string }) => p?.first && p?.last)
      .slice(0, 3)
      .map((p: { first: string; last: string; role?: string }) => ({ first: p.first, last: p.last, role: p.role ?? "Engineer" }));
  } catch {
    return [];
  }
}

async function patternDerivedContacts(domain: string, pattern: string | null, needed: number): Promise<ContactResult[]> {
  if (needed <= 0) return [];
  const company = domain.split(".")[0];
  const names = await gptContactNames(company, domain);
  const out: ContactResult[] = [];
  for (const person of names) {
    if (out.length >= needed) break;
    for (const email of patternEmails(person.first, person.last, pattern, domain)) {
      const deliverability = await verify(email);
      if (deliverability === "unknown") continue; // don't show unverifiable guesses
      out.push({
        name: `${person.first} ${person.last}`,
        role: person.role,
        email,
        confidence: deliverability === "valid" ? 80 : 50,
        deliverability,
        sources: [],
        patternDerived: true,
        why: /recruit|talent|hr|campus|university/i.test(person.role)
          ? "Recruiting contact — pattern-derived, verified"
          : "Manager/peer track — pattern-derived, verified; referral path",
      });
      break; // one address per person
    }
  }
  return out;
}
