import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TailorClient } from "@/components/tailor/tailor-client";

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
      initialContacts={job.contacts as never}
      hasApplication={job.applications.length > 0}
    />
  );
}
