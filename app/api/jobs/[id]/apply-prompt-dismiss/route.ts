import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// "No, I didn't apply" — never nag about this job again.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { count } = await prisma.job.updateMany({
    where: { id },
    data: { applyPromptDismissedAt: new Date() },
  });
  if (count === 0) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
