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

/** Resolve the company's email domain: research homepage first, slug TLD probes second. */
async function resolveDomain(company: string, research: unknown): Promise<string | null> {
  const homepage = (research as { homepageUsed?: string | null } | null)?.homepageUsed;
  if (homepage) {
    try {
      const host = new URL(homepage).hostname.replace(/^www\./, "");
      if (host) return host;
    } catch {
      // fall through
    }
  }
  const slug = slugify(company);
  if (!slug) return null;
  for (const tld of ["com", "ca", "io", "ai", "co"]) {
    const host = `${slug}.${tld}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`https://${host}`, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
      clearTimeout(t);
      if (res.ok || res.status === 403 || res.status === 405) return host;
    } catch {
      // try next TLD
    }
  }
  return null;
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

  if (job.contacts && !body?.force) {
    return NextResponse.json({ ...(job.contacts as unknown as StoredContacts), cached: true });
  }

  // Company-level cache: reuse contacts found for a sibling job (saves Hunter quota).
  const sibling = await prisma.job.findFirst({
    where: { company: job.company, contacts: { not: { equals: null } }, id: { not: job.id } },
    orderBy: { contactsAt: "desc" },
  });
  if (sibling?.contacts && !body?.force) {
    const stored = sibling.contacts as unknown as StoredContacts;
    await prisma.job.update({ where: { id: job.id }, data: { contacts: stored as never, contactsAt: new Date() } });
    return NextResponse.json({ ...stored, cached: true });
  }

  const domain = await resolveDomain(job.company, job.companyResearch);
  if (!domain) {
    return NextResponse.json({ error: `Couldn't determine ${job.company}'s email domain` }, { status: 422 });
  }

  try {
    const contacts = await findCompanyContacts(domain, 2);
    const stored: StoredContacts = { domain, contacts, searchedAt: new Date().toISOString() };
    await prisma.job.update({ where: { id: job.id }, data: { contacts: stored as never, contactsAt: new Date() } });
    return NextResponse.json({ ...stored, cached: false });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "contact search failed" }, { status: 502 });
  }
}
