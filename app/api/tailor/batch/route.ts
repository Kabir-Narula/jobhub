import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Each job runs a full generate pass (LLM + Tectonic), so give the runner the
// same ceiling as /api/tailor/generate rather than the old 30s.
export const maxDuration = 300;

/**
 * A batch whose row has not been touched for this long is treated as stalled.
 * On serverless the runner can be frozen the moment the response is returned,
 * so "no heartbeat" is the only honest signal that it stopped.
 */
const STALL_MS = 5 * 60 * 1000;

interface BatchResult {
  jobId: string;
  ok: boolean;
  error?: string;
}

/** Fire-and-forget batch tailoring: generates resume+cover for each job sequentially. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobIds = Array.isArray(body?.jobIds) ? body.jobIds.map(String).filter(Boolean) : [];
  if (jobIds.length === 0) return NextResponse.json({ error: "jobIds[] required" }, { status: 400 });

  const live = await prisma.tailorBatch.findFirst({
    where: { finishedAt: null, updatedAt: { gt: new Date(Date.now() - STALL_MS) } },
    orderBy: { startedAt: "desc" },
  });
  if (live) {
    return NextResponse.json({ error: "a batch is already running", batchId: live.id }, { status: 409 });
  }

  // Close out any earlier batch that stopped reporting, so it can never be
  // mistaken for the one we are about to start.
  await prisma.tailorBatch.updateMany({
    where: { finishedAt: null },
    data: { finishedAt: new Date() },
  });

  const cookie = request.headers.get("cookie") ?? "";
  const origin = new URL(request.url).origin;

  const batch = await prisma.tailorBatch.create({
    data: { jobIds, total: jobIds.length },
  });

  void (async () => {
    const results: BatchResult[] = [];
    for (const jobId of jobIds) {
      // Another batch superseded this one (it closed us out above).
      const stillOurs = await prisma.tailorBatch.findUnique({
        where: { id: batch.id },
        select: { finishedAt: true },
      });
      if (!stillOurs || stillOurs.finishedAt) return;

      await prisma.tailorBatch
        .update({ where: { id: batch.id }, data: { current: jobId } })
        .catch(() => {});

      try {
        const res = await fetch(`${origin}/api/tailor/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie },
          body: JSON.stringify({ jobId }),
        });
        results.push({ jobId, ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` });
      } catch (e) {
        results.push({ jobId, ok: false, error: e instanceof Error ? e.message : String(e) });
      }

      // Checkpoint after every job so the UI sees real progress and a killed
      // runner leaves an accurate partial record. Mirrors runPoll's checkpoint.
      await prisma.tailorBatch
        .update({
          where: { id: batch.id },
          data: { done: results.length, results: results as never },
        })
        .catch(() => {});
    }

    await prisma.tailorBatch
      .update({
        where: { id: batch.id },
        data: { current: "", done: results.length, results: results as never, finishedAt: new Date() },
      })
      .catch(() => {});
  })();

  return NextResponse.json({ ok: true, batchId: batch.id, total: jobIds.length });
}

/** Live batch progress for the UI. */
export async function GET() {
  const batch = await prisma.tailorBatch.findFirst({ orderBy: { startedAt: "desc" } });
  if (!batch) return NextResponse.json({ batch: null });

  const stalled = batch.finishedAt === null && Date.now() - batch.updatedAt.getTime() > STALL_MS;
  return NextResponse.json({
    batch: {
      id: batch.id,
      total: batch.total,
      done: batch.done,
      current: batch.current,
      results: batch.results ?? [],
      startedAt: batch.startedAt.toISOString(),
      finishedAt: batch.finishedAt?.toISOString() ?? null,
      stalled,
    },
  });
}
