import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPolling } from "@/lib/poll";

// Live poll progress: whether a poll is running + the latest PollRun
// (runPoll checkpoints results after every source).
export async function GET() {
  const lastRun = await prisma.pollRun.findFirst({ orderBy: { startedAt: "desc" } });
  return NextResponse.json({
    polling: isPolling(),
    lastRun: lastRun
      ? {
          startedAt: lastRun.startedAt.toISOString(),
          finishedAt: lastRun.finishedAt?.toISOString() ?? null,
          newJobs: lastRun.newJobs,
          totalSeen: lastRun.totalSeen,
          ok: lastRun.ok,
          results: lastRun.results ?? [],
        }
      : null,
  });
}
