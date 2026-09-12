import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPolling } from "@/lib/poll";

/**
 * A run with no finishedAt older than this is abandoned, not live: a hard crash
 * (or a serverless instance being torn down) never gets to stamp finishedAt, and
 * isPolling() only knows about the current process.
 */
const STALE_RUN_MS = 15 * 60 * 1000;

// Live poll progress: whether a poll is running + the latest PollRun
// (runPoll checkpoints results after every source).
export async function GET() {
  const lastRun = await prisma.pollRun.findFirst({ orderBy: { startedAt: "desc" } });
  const abandoned =
    lastRun !== null &&
    lastRun.finishedAt === null &&
    Date.now() - lastRun.startedAt.getTime() > STALE_RUN_MS;

  return NextResponse.json({
    polling: isPolling() && !abandoned,
    abandoned,
    lastRun: lastRun
      ? {
          startedAt: lastRun.startedAt.toISOString(),
          finishedAt: lastRun.finishedAt?.toISOString() ?? null,
          newJobs: lastRun.newJobs,
          totalSeen: lastRun.totalSeen,
          totalSources: lastRun.totalSources,
          ok: lastRun.ok,
          results: lastRun.results ?? [],
        }
      : null,
  });
}
