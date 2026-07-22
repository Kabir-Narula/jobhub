import { NextResponse } from "next/server";
import { runPoll } from "@/lib/poll";

export const maxDuration = 300;

// Vercel Cron sends Authorization: Bearer $CRON_SECRET automatically.
// Also usable by any external scheduler that knows the secret.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runPoll("cron");
  return NextResponse.json(summary);
}
