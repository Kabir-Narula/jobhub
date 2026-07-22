import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const dismissed = body?.dismissed === undefined ? true : Boolean(body.dismissed);
  await prisma.job.update({
    where: { id },
    data: { dismissedAt: dismissed ? new Date() : null },
  });
  return NextResponse.json({ ok: true });
}
