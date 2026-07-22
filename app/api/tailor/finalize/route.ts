import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Mark document versions FINAL and attach them to the job's application (if one exists).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = String(body?.jobId ?? "");
  const resumeId = String(body?.resumeId ?? "");
  const coverId = String(body?.coverId ?? "");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const ids = [resumeId, coverId].filter(Boolean);
  await prisma.documentVersion.updateMany({
    where: { id: { in: ids }, jobId },
    data: { status: "FINAL" },
  });

  const application = await prisma.application.findFirst({ where: { jobId } });
  if (application) {
    await prisma.application.update({
      where: { id: application.id },
      data: {
        ...(resumeId ? { resumeVersionId: resumeId } : {}),
        ...(coverId ? { coverVersionId: coverId } : {}),
      },
    });
    // also back-link documents to the application
    await prisma.documentVersion.updateMany({
      where: { id: { in: ids } },
      data: { applicationId: application.id },
    });
  }

  return NextResponse.json({ ok: true, linkedToApplication: Boolean(application) });
}
