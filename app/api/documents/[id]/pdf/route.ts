import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadPdf } from "@/lib/supabase";

const CANDIDATE_NAME = "Kabir_Narula";

function sanitize(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .slice(0, 60);
}

/** Recruiter-style filename: Kabir_Narula_Resume_Geotab_Software_Developer.pdf */
function fileName(doc: { kind: string; version: number; job: { company: string; title: string } }): string {
  const kind = doc.kind === "RESUME" ? "Resume" : "Cover_Letter";
  return `${CANDIDATE_NAME}_${kind}_${sanitize(doc.job.company)}_${sanitize(doc.job.title)}.pdf`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.documentVersion.findUnique({ where: { id }, include: { job: true } });
  if (!doc || !doc.pdfStoragePath) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const buf = await downloadPdf(doc.pdfStoragePath);

  const download = new URL(request.url).searchParams.get("download") === "1";
  const name = fileName(doc);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": download ? `attachment; filename="${name}"` : `inline; filename="${name}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
