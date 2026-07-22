import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Record that the user opened the posting (marks it "viewed").
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.job.update({ where: { id }, data: { viewedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
