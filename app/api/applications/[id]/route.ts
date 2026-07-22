import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    data.status = body.status;
    // Stamp time-to-first-response on the first explicit outcome.
    if (["INTERVIEWING", "OFFER", "REJECTED"].includes(body.status)) {
      const cur = await prisma.application.findUnique({ where: { id }, select: { responseAt: true } });
      if (!cur?.responseAt) data.responseAt = new Date();
    }
  }
  if (body.notes !== undefined) data.notes = String(body.notes);
  if (body.researchNotes !== undefined) data.researchNotes = String(body.researchNotes);

  const application = await prisma.application.update({ where: { id }, data });
  return NextResponse.json({ application });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.application.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
