import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  if (body.name !== undefined) data.name = String(body.name);
  const source = await prisma.companySource.update({ where: { id }, data });
  return NextResponse.json({ source });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.companySource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
