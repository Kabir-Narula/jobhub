import { prisma } from "@/lib/db";
import { TrackerClient, type AppWithJob, type Analytics } from "@/components/tracker/tracker-client";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const applications = await prisma.application.findMany({
    include: {
      job: true,
      resumeVersion: { select: { id: true, version: true, kind: true } },
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

  const analytics: Analytics = { total, responseRate, avgDaysToResponse, weeks };

  return <TrackerClient applications={applications as AppWithJob[]} analytics={analytics} />;
}
