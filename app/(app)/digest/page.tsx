import { prisma } from "@/lib/db";
import { DigestClient } from "@/components/digest/digest-client";

export const dynamic = "force-dynamic";

export default async function DigestPage() {
  const setting = await prisma.setting.findUnique({ where: { key: "lastDigestView" } });
  const since = setting ? new Date(setting.value) : new Date(Date.now() - 7 * 86400000);

  const [newJobs, lastRun, appCount] = await Promise.all([
    prisma.job.findMany({
      where: {
        firstSeenAt: { gt: since },
        isActive: true,
        dismissedAt: null,
        seniority: { not: "SENIOR" },
      },
      orderBy: [{ bucket: "asc" }, { firstSeenAt: "desc" }],
      take: 150,
    }),
    prisma.pollRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.application.count(),
  ]);

  return (
    <DigestClient
      jobs={newJobs}
      since={since.toISOString()}
      lastRunAt={lastRun?.startedAt.toISOString() ?? null}
      appCount={appCount}
    />
  );
}
