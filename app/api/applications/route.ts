import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

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
