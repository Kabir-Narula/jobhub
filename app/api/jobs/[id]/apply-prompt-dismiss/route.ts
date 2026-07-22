import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// "No, I didn't apply" — never nag about this job again.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.job.update({ where: { id }, data: { applyPromptDismissedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
