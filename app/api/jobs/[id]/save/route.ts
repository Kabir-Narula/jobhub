import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const saved = Boolean(body?.saved);
  const { count } = await prisma.job.updateMany({
    where: { id },
    data: { savedAt: saved ? new Date() : null },
  });
  if (count === 0) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
