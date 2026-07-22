import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeForTectonic } from "@/lib/tailor/latex";

// Replace the active master template for a kind. The old one stays in the DB
// (inactive) so previously generated diffs remain meaningful.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const kind = String(body?.kind ?? "");
  const texContent = String(body?.texContent ?? "");
  if (!["RESUME", "COVER"].includes(kind) || texContent.length < 200) {
    return NextResponse.json({ error: "kind (RESUME|COVER) and full texContent required" }, { status: 400 });
  }
  const normalized = normalizeForTectonic(texContent);
  await prisma.$transaction([
    prisma.masterTemplate.updateMany({ where: { kind: kind as never, active: true }, data: { active: false } }),
    prisma.masterTemplate.create({ data: { kind: kind as never, texContent: normalized, active: true } }),
  ]);
  return NextResponse.json({ ok: true });
}
