import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { researchCompany } from "@/lib/tailor/research";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = String(body?.jobId ?? "");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  if (job.companyResearch && !body?.force) {
    return NextResponse.json({ research: job.companyResearch, cached: true });
  }

  // Hydrate first: researching a job with a thin/empty description produces
  // shallow research that would be cached and reused even after hydration.
  const { needsDescriptionFetch, isClosedShell } = await import("@/lib/jobs/embedded-posting");
  if (needsDescriptionFetch(job.description) && (job.applyUrl || job.sourceUrl)) {
    const { hydrateJobDescription } = await import("@/lib/sources/hydrate");
    const hydrated = await hydrateJobDescription(job).catch(() => "");
    const wasShell = isClosedShell(job.description);
    if (hydrated && (hydrated.length > job.description.trim().length || wasShell)) {
      job.description = hydrated;
      await prisma.job.update({
        where: { id: job.id },
        data: {
          description: hydrated,
          ...(wasShell ? { jdAnalysis: Prisma.DbNull, companyResearch: Prisma.DbNull } : {}),
        },
      });
    }
  }

  const research = await researchCompany({
    company: job.company,
    jobTitle: job.title,
    jobDescription: job.description,
    deep: true,
  });
  await prisma.job.update({
    where: { id: job.id },
    data: { companyResearch: research as never, researchedAt: new Date() },
  });
  return NextResponse.json({ research, cached: false });
}
