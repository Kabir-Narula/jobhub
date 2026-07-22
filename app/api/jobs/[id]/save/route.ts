import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const saved = Boolean(body?.saved);
  await prisma.job.update({
    where: { id },
    data: { savedAt: saved ? new Date() : null },
  });
  return NextResponse.json({ ok: true });
}
