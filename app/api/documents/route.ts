import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const documents = await prisma.documentVersion.findMany({
    where: jobId ? { jobId } : {},
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      kind: true,
      version: true,
      status: true,
      matchScore: true,
      pageCount: true,
      createdAt: true,
      jobId: true,
    },
  });
  return NextResponse.json({ documents });
}
