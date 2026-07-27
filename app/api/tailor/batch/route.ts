import { NextResponse } from "next/server";

export const maxDuration = 30;

interface BatchState {
  id: string;
  total: number;
  done: number;
  current: string;
  results: { jobId: string; ok: boolean; error?: string }[];
  startedAt: number;
  finishedAt: number | null;
}

let currentBatch: BatchState | null = null;

/** Fire-and-forget batch tailoring: generates resume+cover for each job sequentially. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobIds = Array.isArray(body?.jobIds) ? body.jobIds.map(String).filter(Boolean) : [];
  if (jobIds.length === 0) return NextResponse.json({ error: "jobIds[] required" }, { status: 400 });
  if (currentBatch && !currentBatch.finishedAt) {
    return NextResponse.json({ error: "a batch is already running", batchId: currentBatch.id }, { status: 409 });
  }

  const cookie = request.headers.get("cookie") ?? "";
  const origin = new URL(request.url).origin;

  currentBatch = {
    id: `b${Date.now().toString(36)}`,
    total: jobIds.length,
    done: 0,
    current: "",
    results: [],
    startedAt: Date.now(),
    finishedAt: null,
  };
  const batch = currentBatch;

  void (async () => {
    for (const jobId of jobIds) {
      if (currentBatch !== batch) return; // superseded
      batch.current = jobId;
      try {
        const res = await fetch(`${origin}/api/tailor/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie },
          body: JSON.stringify({ jobId }),
        });
        batch.results.push({ jobId, ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` });
      } catch (e) {
        batch.results.push({ jobId, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      batch.done++;
    }
    batch.current = "";
    batch.finishedAt = Date.now();
  })();

  return NextResponse.json({ ok: true, batchId: batch.id, total: batch.total });
}

/** Live batch progress for the UI. */
export async function GET() {
  return NextResponse.json({ batch: currentBatch });
}
