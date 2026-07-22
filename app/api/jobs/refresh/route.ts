import { NextResponse } from "next/server";
import { runPoll } from "@/lib/poll";

export const maxDuration = 300;

// Manual "Refresh now" button. Session-protected by proxy.ts.
export async function POST() {
  const summary = await runPoll("manual");
  return NextResponse.json(summary);
}
