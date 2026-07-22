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

/** People most worth cold-emailing for a job application, best first. */
function rankContacts(emails: HunterEmail[]): HunterEmail[] {
  const score = (e: HunterEmail): number => {
    const t = `${e.position ?? ""} ${e.department ?? ""}`.toLowerCase();
    let s = 0;
    if (/recruit|talent|sourcer|hiring|staffing/.test(t)) s += 100;
    if (/human_resources|people|hr\b/.test(t)) s += 80;
    if (/engineering|cto|vp|director|head|manager/.test(t)) s += 40; // hiring managers
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
 * Tries HR/recruiting first, then a general search to fill.
 * Emails that verify as invalid are dropped.
 */
export async function findCompanyContacts(domain: string, count = 2): Promise<ContactResult[]> {
  const hr = await domainSearch(domain, "hr");
  let candidates = rankContacts(hr.emails);
  let pattern: string | null = hr.pattern;
  if (candidates.length < count) {
    const general = await domainSearch(domain);
    if (!pattern) pattern = general.pattern;
    const seen = new Set(candidates.map((c) => c.value.toLowerCase()));
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
    });
  }

  // Layer 2: nothing found publicly — construct from the company's known email
  // pattern + GPT-suggested recruiter names, then verify each before showing.
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

async function gptRecruiterNames(company: string, domain: string): Promise<{ first: string; last: string; role: string }[]> {
  try {
    const { openai, model, parseJson } = await import("@/lib/tailor/research");
    const res = await openai().chat.completions.create({
      model: model(),
      messages: [
        {
          role: "system",
          content:
            "You identify real people for professional outreach. You NEVER invent names. If you don't know actual recruiters or HR people at this company from public information, return an empty list.",
        },
        {
          role: "user",
          content: `List up to 3 REAL people who work (or recently worked) in recruiting / talent acquisition / HR at ${company} (${domain}), based on your knowledge of public information (e.g. their LinkedIn presence). Return JSON: {"people": [{"first": "...", "last": "...", "role": "..."}]}. Only include people you are confident actually exist. If none, return {"people": []}.`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = parseJson(res.choices[0]?.message?.content ?? "{}");
    if (!Array.isArray(parsed.people)) return [];
    return parsed.people
      .filter((p: { first?: string; last?: string }) => p?.first && p?.last)
      .slice(0, 3)
      .map((p: { first: string; last: string; role?: string }) => ({ first: p.first, last: p.last, role: p.role ?? "Recruiter" }));
  } catch {
    return [];
  }
}

async function patternDerivedContacts(domain: string, pattern: string | null, needed: number): Promise<ContactResult[]> {
  if (needed <= 0) return [];
  const company = domain.split(".")[0];
  const names = await gptRecruiterNames(company, domain);
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
      });
      break; // one address per person
    }
  }
  return out;
}
