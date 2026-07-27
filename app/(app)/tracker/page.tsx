import { prisma } from "@/lib/db";
import { TrackerClient, type AppWithJob, type Analytics } from "@/components/tracker/tracker-client";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const applications = await prisma.application.findMany({
    include: {
      job: true,
      resumeVersion: { select: { id: true, version: true, kind: true, matchScore: true } },
      coverVersion: { select: { id: true, version: true, kind: true } },
    },
    orderBy: { appliedAt: "desc" },
  });

  // --- analytics ---
  const total = applications.length;
  const responded = applications.filter(
    (a) => a.responseAt || ["INTERVIEWING", "OFFER", "REJECTED"].includes(a.status)
  );
  const responseRate = total ? Math.round((responded.length / total) * 100) : 0;

  const withResponse = applications.filter((a) => a.responseAt);
  const avgDaysToResponse = withResponse.length
    ? Math.round(
        withResponse.reduce((sum, a) => sum + (a.responseAt!.getTime() - a.appliedAt.getTime()) / 86400000, 0) /
          withResponse.length
      )
    : null;

  // --- outcome analytics: what actually converts ---
  const isPositive = (a: (typeof applications)[number]) =>
    a.responseAt || ["INTERVIEWING", "OFFER"].includes(a.status);

  const atsBuckets = [
    { label: "ATS <40%", test: (s: number | null) => s !== null && s < 40 },
    { label: "ATS 40–60%", test: (s: number | null) => s !== null && s >= 40 && s <= 60 },
    { label: "ATS 60%+", test: (s: number | null) => s !== null && s > 60 },
  ].map((b) => {
    const inBucket = applications.filter((a) => b.test(a.resumeVersion?.matchScore ?? null));
    const positive = inBucket.filter(isPositive).length;
    return {
      label: b.label,
      total: inBucket.length,
      positive,
      rate: inBucket.length ? Math.round((positive / inBucket.length) * 100) : 0,
    };
  });

  const sourceMap = new Map<string, { total: number; positive: number }>();
  for (const a of applications) {
    const src = a.job.source.split(":")[0];
    const cur = sourceMap.get(src) ?? { total: 0, positive: 0 };
    cur.total++;
    if (isPositive(a)) cur.positive++;
    sourceMap.set(src, cur);
  }
  const bySource = [...sourceMap.entries()]
    .map(([label, v]) => ({ label, ...v, rate: v.total ? Math.round((v.positive / v.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // applications per week, last 8 weeks (Mon-start buckets)
  const weeks: { label: string; count: number }[] = [];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  for (let i = 7; i >= 0; i--) {
    const start = new Date(monday.getTime() - i * 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000);
    weeks.push({
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      count: applications.filter((a) => a.appliedAt >= start && a.appliedAt < end).length,
    });
  }

  const analytics: Analytics = { total, responseRate, avgDaysToResponse, weeks, atsBuckets, bySource };

  return <TrackerClient applications={applications as AppWithJob[]} analytics={analytics} />;
}
