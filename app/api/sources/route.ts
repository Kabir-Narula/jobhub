import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AtsType } from "@prisma/client";

const ATS_TYPES: AtsType[] = ["GREENHOUSE", "LEVER", "ASHBY", "SMARTRECRUITERS", "WORKDAY"];

export async function GET() {
  const sources = await prisma.companySource.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ sources });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const atsType = String(body?.atsType ?? "").toUpperCase() as AtsType;
  const boardToken = String(body?.boardToken ?? "").trim();
  if (!name || !boardToken || !ATS_TYPES.includes(atsType)) {
    return NextResponse.json({ error: "name, atsType (GREENHOUSE|LEVER|ASHBY|SMARTRECRUITERS), boardToken required" }, { status: 400 });
  }
  const source = await prisma.companySource.create({ data: { name, atsType, boardToken } });
  return NextResponse.json({ source });
}
