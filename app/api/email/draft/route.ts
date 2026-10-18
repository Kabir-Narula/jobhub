import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { draftOutreachEmail, draftFollowUpEmail, projectsFromResumeTex } from "@/lib/tailor/email";
import { researchCompany, type CompanyResearch } from "@/lib/tailor/research";
import { fetchCompanyNews } from "@/lib/tailor/company-news";
import type { ContactResult } from "@/lib/contacts/hunter";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = String(body?.jobId ?? "");
  const contactEmail = String(body?.contactEmail ?? "");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  let research = (job.companyResearch as unknown as CompanyResearch | null) ?? null;
  const [news, freshResearch] = await Promise.all([
    fetchCompanyNews(job.company),
    research
      ? Promise.resolve(null)
      : researchCompany({ company: job.company, jobTitle: job.title, jobDescription: job.description }).catch(() => null),
  ]);
  if (freshResearch) {
    research = freshResearch;
    await prisma.job.update({
      where: { id: job.id },
      data: { companyResearch: freshResearch as never, researchedAt: new Date() },
    });
  }
  const storedContacts = (job.contacts as unknown as { contacts?: ContactResult[] } | null)?.contacts ?? [];
  const contact = contactEmail
    ? storedContacts.find((c) => c.email.toLowerCase() === contactEmail.toLowerCase()) ?? null
    : (storedContacts[0] ?? null);

  const doc =
    (await prisma.documentVersion.findFirst({
      where: { jobId: job.id, kind: "RESUME", status: "FINAL" },
      orderBy: { version: "desc" },
    })) ??
    (await prisma.documentVersion.findFirst({
      where: { jobId: job.id, kind: "RESUME" },
      orderBy: { version: "desc" },
    }));

  const hasFinalDocs = Boolean(
    await prisma.documentVersion.findFirst({ where: { jobId: job.id, status: "FINAL" }, select: { id: true } })
  );

  const base = {
    job: { title: job.title, company: job.company, description: job.description },
    contact,
    research,
    projects: projectsFromResumeTex(doc?.texContent),
    hasFinalDocs,
    candidateName: "Kabir Narula",
    news: news.map((n) => ({ title: n.title, date: n.date })),
  };

  const followup = body?.mode === "followup" || body?.kind === "followup";
  if (followup) {
    const daysSinceApplied = Math.max(1, Number(body?.daysSinceApplied) || 7);
    const draft = await draftFollowUpEmail({ ...base, daysSinceApplied });
    return NextResponse.json({ draft, contact });
  }

  const draft = await draftOutreachEmail(base);
  return NextResponse.json({ draft, contact });
}
