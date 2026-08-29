import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { markEmailBounced } from "@/lib/contacts/blocklist";

interface StoredContacts {
  domain: string;
  contacts: { email: string }[];
  searchedAt: string;
}

/**
 * Mark a contact email as bounced: remove it from every job at that company
 * so it never resurfaces (the company-level sibling cache would otherwise
 * keep serving the dead address). The remaining contacts stay.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = String(body?.jobId ?? "");
  const email = String(body?.email ?? "").toLowerCase().trim();
  if (!jobId || !email) return NextResponse.json({ error: "jobId and email required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { company: true } });
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  await markEmailBounced(email);
  const rows = await prisma.job.findMany({
    where: { company: job.company, contacts: { not: { equals: null } } },
    select: { id: true, contacts: true },
  });
  let removed = 0;
  for (const row of rows) {
    const stored = row.contacts as unknown as StoredContacts;
    if (!stored?.contacts?.length) continue;
    const remaining = stored.contacts.filter((c) => c.email.toLowerCase() !== email);
    if (remaining.length !== stored.contacts.length) {
      removed++;
      await prisma.job.update({
        where: { id: row.id },
        data: remaining.length
          ? { contacts: { ...stored, contacts: remaining } as never }
          : { contacts: null as never, contactsAt: null },
      });
    }
  }
  return NextResponse.json({ ok: true, removedFrom: removed });
}
