import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findCompanyContacts, type ContactResult } from "@/lib/contacts/hunter";

export const maxDuration = 120;

interface StoredContacts {
  domain: string;
  contacts: ContactResult[];
  searchedAt: string;
}

function slugify(company: string): string {
  return company
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|limited|co|company|technologies|technology|labs|group)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Ordered domain candidates for a company. Domain guessing is unreliable for
 * acronym companies ("Bank of Montreal" -> bmo.com, never bankofmontreal.com
 * in Hunter's index) and an unverified research homepage can be wrong, so
 * EVERY step just contributes candidates and the caller's Hunter-oracle loop
 * picks the first that returns real contacts.
 */
async function domainCandidates(company: string, research: unknown): Promise<string[]> {
  const out: string[] = [];
  const push = (host: string | null | undefined) => {
    const h = (host ?? "").toLowerCase().replace(/^www\./, "");
    if (h && !out.includes(h)) out.push(h);
  };

  // 1) research homepage (high confidence but unverified — candidate, not answer)
  const homepage = (research as { homepageUsed?: string | null } | null)?.homepageUsed;
  if (homepage) {
    try {
      push(new URL(homepage).hostname);
    } catch {
      // fall through
    }
  }

  // 2) Clearbit autocomplete (free, keyless). Hits must pass a similarity
  //    check — a weak query ("of montreal" -> ofmontreal.net) must not win.
  const cleanName = company
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|limited|company|technologies|technology|labs|group)\b\.?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const slug = slugify(company);
  const initials = (company.match(/\b[A-Za-z]/g) ?? []).join("").toLowerCase();
  const similar = (domain: string): boolean => {
    const bare = domain.split(".")[0];
    // short bare domains (jm.com for "J&M Group" = Jardine Matheson!) are only
    // acceptable as the company's exact initials; otherwise require a real
    // token overlap with the company name
    if (bare.length < 4) return bare === initials;
    return slug.includes(bare) || bare.includes(slug) || [...new Set([...slug.matchAll(/[a-z]{4,}/g)].map((m) => m[0]))].some((t) => bare.includes(t));
  };
  for (const q of [...new Set([company, cleanName].filter(Boolean))]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const suggestions = (await res.json()) as { domain?: string }[];
        for (const s of suggestions.slice(0, 3)) if (s.domain && similar(s.domain)) push(s.domain);
      }
    } catch {
      // next query variant
    }
    if (out.length) break;
  }

  // 3) Wikidata official-website lookup — the acronym resolver: maps legal
  //    names to brand domains ("Bank of Montreal" -> bmo.com). Free, keyless;
  //    a real User-Agent is required or the API answers with an HTML error.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const ua = { "User-Agent": "jobhub/1.0 (contact-finder; https://github.com/Kabir-Narula/jobhub)" };
    const search = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(company)}&language=en&format=json&limit=1`,
      { signal: ctrl.signal, headers: ua }
    );
    const found = (await search.json()) as { search?: { id?: string }[] };
    const qid = found.search?.[0]?.id;
    if (qid) {
      const ent = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json`,
        { signal: ctrl.signal, headers: ua }
      );
      const data = (await ent.json()) as { entities?: Record<string, { claims?: { P856?: { mainsnak?: { datavalue?: { value?: string } } }[] } }> };
      const site = data.entities?.[qid]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
      if (site) push(new URL(site).hostname);
    }
    clearTimeout(t);
  } catch {
    // no wikidata candidate
  }

  // 4) slug TLD probes, redirect-aware (parked-host filtered)
  if (slug) {
    const PARKED = /sedoparking|parkingcrew|godaddy|namecheap|hugedomains|afternic|dan\.com/i;
    for (const tld of ["com", "ca", "io", "ai", "co"]) {
      const host = `${slug}.${tld}`;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`https://${host}`, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
        clearTimeout(t);
        if (res.ok || res.status === 403 || res.status === 405) {
          const finalHost = new URL(res.url).hostname;
          push(PARKED.test(finalHost) ? host : finalHost);
          break;
        }
      } catch {
        // try next TLD
      }
    }
  }
  return out.slice(0, 4);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = String(body?.jobId ?? "");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  if (!process.env.HUNTER_API_KEY) {
    return NextResponse.json(
      { error: "Contact search needs a Hunter.io API key (free, 25 searches/month). Add HUNTER_API_KEY to .env.local and restart." },
      { status: 412 }
    );
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  const storedContacts = (job.contacts as unknown as StoredContacts | null);
  if (storedContacts && storedContacts.contacts.length > 0 && !body?.force) {
    return NextResponse.json({ ...storedContacts, cached: true });
  }

  // Company-level cache: reuse contacts found for a sibling job (saves Hunter quota).
  // Empty/failed results are NEVER cached — a bad day at Hunter must not be permanent.
  const sibling = await prisma.job.findFirst({
    where: { company: job.company, contacts: { not: { equals: null } }, id: { not: job.id } },
    orderBy: { contactsAt: "desc" },
  });
  if (sibling?.contacts && !body?.force) {
    const stored = sibling.contacts as unknown as StoredContacts;
    if (stored.contacts.length > 0) {
      await prisma.job.update({ where: { id: job.id }, data: { contacts: stored as never, contactsAt: new Date() } });
      return NextResponse.json({ ...stored, cached: true });
    }
  }

  const candidates = await domainCandidates(job.company, job.companyResearch);
  if (!candidates.length) {
    return NextResponse.json({ error: `Couldn't determine ${job.company}'s email domain` }, { status: 422 });
  }

  // Self-validating oracle: the first candidate that yields real contacts wins
  // (guessing acronym domains is unreliable; Hunter's index is the arbiter).
  let lastError: string | null = null;
  for (const domain of candidates) {
    try {
      const contacts = await findCompanyContacts(domain, 3);
      if (contacts.length === 0) continue;
      const stored: StoredContacts = { domain, contacts, searchedAt: new Date().toISOString() };
      await prisma.job.update({ where: { id: job.id }, data: { contacts: stored as never, contactsAt: new Date() } });
      return NextResponse.json({ ...stored, cached: false });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return NextResponse.json(
    { error: lastError ?? `No contacts found at ${job.company} (tried ${candidates.join(", ")})` },
    { status: 422 }
  );
}
