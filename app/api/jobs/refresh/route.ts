import { NextResponse } from "next/server";
import { startPollInBackground } from "@/lib/poll";

export const maxDuration = 30;

// Manual "Refresh now": kicks off a background poll and returns immediately.
// The UI watches /api/jobs/poll-status for live progress.
export async function POST() {
  const started = startPollInBackground("manual");
  return NextResponse.json({ ok: true, started });
}
