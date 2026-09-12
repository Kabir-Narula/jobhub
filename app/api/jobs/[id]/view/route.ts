import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Record that the user opened the posting (marks it "viewed").
// A new Apply click is a new attempt: clear any previous prompt dismissal
// so the return-prompt may fire again for this attempt.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { count } = await prisma.job.updateMany({
    where: { id },
    data: { viewedAt: new Date(), applyPromptDismissedAt: null },
  });
  if (count === 0) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
