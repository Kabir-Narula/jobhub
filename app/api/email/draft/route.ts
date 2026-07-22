import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { draftOutreachEmail } from "@/lib/tailor/email";
import type { CompanyResearch } from "@/lib/tailor/research";
import type { ContactResult } from "@/lib/contacts/hunter";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = String(body?.jobId ?? "");
  const contactEmail = String(body?.contactEmail ?? "");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  const research = (job.companyResearch as unknown as CompanyResearch | null) ?? null;
  const storedContacts = (job.contacts as unknown as { contacts?: ContactResult[] } | null)?.contacts ?? [];
  const contact = contactEmail
    ? storedContacts.find((c) => c.email.toLowerCase() === contactEmail.toLowerCase()) ?? null
    : (storedContacts[0] ?? null);

  // Highlights from the most recent FINAL resume (fall back to latest draft).
  const doc =
    (await prisma.documentVersion.findFirst({
      where: { jobId: job.id, kind: "RESUME", status: "FINAL" },
      orderBy: { version: "desc" },
    })) ??
    (await prisma.documentVersion.findFirst({
      where: { jobId: job.id, kind: "RESUME" },
      orderBy: { version: "desc" },
    }));

  const bullets: string[] = [];
  if (doc) {
    const re = /\\resumeItem\{((?:[^{}]|\{[^{}]*\})*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc.texContent)) && bullets.length < 6) {
      bullets.push(m[1].replace(/\\([&%$#_{}])/g, "$1"));
    }
  }

  const hasFinalDocs = Boolean(
    await prisma.documentVersion.findFirst({ where: { jobId: job.id, status: "FINAL" }, select: { id: true } })
  );

  const draft = await draftOutreachEmail({
    job: { title: job.title, company: job.company, description: job.description },
    contact,
    research,
    resumeHighlights: bullets,
    hasFinalDocs,
    candidateName: "Kabir Narula",
  });

  return NextResponse.json({ draft, contact });
}
