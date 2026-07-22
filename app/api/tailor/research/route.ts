import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { researchCompany } from "@/lib/tailor/research";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = String(body?.jobId ?? "");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  if (job.companyResearch && !body?.force) {
    return NextResponse.json({ research: job.companyResearch, cached: true });
  }

  const research = await researchCompany({
    company: job.company,
    jobTitle: job.title,
    jobDescription: job.description,
  });
  await prisma.job.update({
    where: { id: job.id },
    data: { companyResearch: research as never, researchedAt: new Date() },
  });
  return NextResponse.json({ research, cached: false });
}
