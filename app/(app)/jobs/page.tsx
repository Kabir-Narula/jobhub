import { prisma } from "@/lib/db";
import type { Prisma, LocationBucket, WorkMode, Seniority, RoleCategory } from "@prisma/client";
import { JobsClient } from "@/components/jobs/jobs-client";

export const dynamic = "force-dynamic";

const POSTED_WINDOWS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const bucket = one(sp.bucket);
  const workMode = one(sp.workMode);
  const seniority = one(sp.seniority);
  const category = one(sp.category);
  const posted = one(sp.posted);
  const source = one(sp.source);
  const savedOnly = one(sp.saved) === "1";
  const showDismissed = one(sp.dismissed) === "1";

  const where: Prisma.JobWhereInput = {
    isActive: true,
    dismissedAt: showDismissed ? { not: null } : null,
    ...(savedOnly ? { savedAt: { not: null } } : {}),
    ...(bucket ? { bucket: bucket as LocationBucket } : {}),
    ...(workMode ? { workMode: workMode as WorkMode } : {}),
    ...(category ? { category: category as RoleCategory } : {}),
    // Scope is new-grad + mid; senior roles hidden unless explicitly asked for.
    seniority: seniority ? (seniority as Seniority) : { not: "SENIOR" },
    ...(source ? { source } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(POSTED_WINDOWS[posted]
      ? {
          // "Found" window = when we discovered it (firstSeenAt). LinkedIn/ATS
          // posted dates are date-only or unreliable, so discovery time is the
          // only freshness signal that means "new since your last look".
          firstSeenAt: { gte: new Date(Date.now() - POSTED_WINDOWS[posted]) },
        }
      : {}),
  };

  const [jobs, lastRun, counts, appliedRows] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { firstSeenAt: "desc" }],
      take: 200,
    }),
    prisma.pollRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.job.groupBy({
      by: ["bucket"],
      where: { isActive: true, dismissedAt: null, seniority: { not: "SENIOR" } },
      _count: true,
    }),
    prisma.application.findMany({ select: { jobId: true } }),
  ]);

  return (
    <JobsClient
      jobs={jobs}
      lastRun={
        lastRun
          ? {
              startedAt: lastRun.startedAt.toISOString(),
              finishedAt: lastRun.finishedAt?.toISOString() ?? null,
              newJobs: lastRun.newJobs,
              ok: lastRun.ok,
              results: (lastRun.results as { source: string; ok: boolean; error?: string }[]) ?? [],
            }
          : null
      }
      bucketCounts={Object.fromEntries(counts.map((c) => [c.bucket, c._count]))}
      appliedJobIds={appliedRows.map((a) => a.jobId)}
      filters={{ q, bucket, workMode, seniority, category, posted, source, savedOnly, showDismissed }}
    />
  );
}
