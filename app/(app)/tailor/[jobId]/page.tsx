import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TailorClient } from "@/components/tailor/tailor-client";
import { jdTerms } from "@/lib/tailor/match";
import { bouncedEmailSet } from "@/lib/contacts/blocklist";

export const dynamic = "force-dynamic";

export default async function TailorPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      documents: { orderBy: [{ createdAt: "desc" }] },
      applications: { select: { id: true } },
    },
  });
  if (!job) notFound();

  const blocked = await bouncedEmailSet();
  const rawContacts = job.contacts as { domain?: string; contacts?: { email?: string; deliverability?: string }[]; searchedAt?: string } | null;
  const initialContacts = rawContacts
    ? {
        ...rawContacts,
        contacts: (rawContacts.contacts ?? []).filter((c) => {
          const email = String(c.email ?? "").toLowerCase();
          if (!email || blocked.has(email)) return false;
          if (c.deliverability === "unknown") return false;
          return true;
        }),
      }
    : null;

  // Workday ranks application FORM data above the uploaded PDF — surface the
  // exact values to paste. Only relevant for Workday-hosted postings.
  const isWorkday = /myworkdayjobs|workday/i.test(`${job.applyUrl} ${job.sourceUrl} ${job.source}`);
  const workdayTips = isWorkday
    ? {
        title: job.title,
        terms: jdTerms(
          job.description,
          8,
          job.company.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
        ),
      }
    : null;

  return (
    <TailorClient
      job={{
        id: job.id,
        title: job.title,
        company: job.company,
        locationRaw: job.locationRaw,
        applyUrl: job.applyUrl,
        description: job.description,
        bucket: job.bucket,
        workMode: job.workMode,
      }}
      workdayTips={workdayTips}
      initialDocuments={job.documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        version: d.version,
        status: d.status,
        pageCount: d.pageCount,
        matchScore: d.matchScore,
        createdAt: d.createdAt.toISOString(),
        titleChangeNote: d.titleChangeNote,
      }))}
      initialResearch={job.companyResearch as never}
      initialContacts={initialContacts as never}
      hasApplication={job.applications.length > 0}
    />
  );
}
