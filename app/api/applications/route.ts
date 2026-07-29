import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  // One application per job — a ReturnPrompt save racing an "m" keypress
  // (or a double-click) must update, not duplicate.
  const existing = await prisma.application.findFirst({ where: { jobId: String(body.jobId) } });
  if (existing) {
    const app = await prisma.application.update({
      where: { id: existing.id },
      data: {
        notes: String(body.notes ?? existing.notes),
        resumeVersionId: body.resumeVersionId || existing.resumeVersionId,
        coverVersionId: body.coverVersionId || existing.coverVersionId,
      },
    });
    return NextResponse.json({ application: app, merged: true });
  }

  const app = await prisma.application.create({
    data: {
      jobId: String(body.jobId),
      notes: String(body.notes ?? ""),
      resumeVersionId: body.resumeVersionId || null,
      coverVersionId: body.coverVersionId || null,
    },
  });
  return NextResponse.json({ application: app });
}

export async function GET() {
  const applications = await prisma.application.findMany({
    include: { job: true, resumeVersion: true, coverVersion: true },
    orderBy: { appliedAt: "desc" },
  });
  return NextResponse.json({ applications });
}
