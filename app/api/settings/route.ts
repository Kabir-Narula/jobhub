import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const rows = await prisma.setting.findMany();
  return NextResponse.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const key = String(body?.key ?? "");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  const value = String(body?.value ?? "");
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  return NextResponse.json({ ok: true });
}
