import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// The most recent job the user opened in a new tab but hasn't yet confirmed
// or dismissed the "did you apply?" prompt for. Checked when the tab refocuses.
export async function GET() {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const job = await prisma.job.findFirst({
    where: {
      viewedAt: { gte: since },
      applyPromptDismissedAt: null,
      applications: { none: {} },
    },
    orderBy: { viewedAt: "desc" },
    select: { id: true, title: true, company: true, applyUrl: true, viewedAt: true },
  });
  return NextResponse.json({ job });
}
