import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decodeEntities } from "@/lib/sources/http";
import { parseLocation } from "@/lib/geo";
import { classifyCategory, classifySeniority } from "@/lib/classify";
import { jobFingerprint, normCompany, normTitle, companiesMatch } from "@/lib/dedupe";
import { parseJobUrl } from "@/lib/jobs/from-url";

export const maxDuration = 60;

/**
 * Manual intake: add a job the scrapers can't find — by posting URL (parsed
 * deterministically: board JSON APIs → JSON-LD → meta heuristics, no LLM) or
 * by pasted fields (title/company/description).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const url = String(body?.url ?? "").trim();
    let title = decodeEntities(String(body?.title ?? "")).trim();
    let company = decodeEntities(String(body?.company ?? "")).trim();
    let locationRaw = decodeEntities(String(body?.location ?? "")).trim();
    let description = String(body?.description ?? "").trim();
    let applyUrl = url;
    let postedAt: Date | null = null;
    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    let salaryCurrency: string | null = null;

    if (url) {
      const { job, error } = await parseJobUrl(url);
      if (!job) return NextResponse.json({ error: error ?? "Couldn't read that link — paste the job details instead." }, { status: 422 });
      title = job.title;
      company = job.company;
      locationRaw = job.locationRaw;
      description = job.description;
      applyUrl = job.applyUrl;
      postedAt = job.postedAt && !isNaN(job.postedAt.getTime()) ? job.postedAt : null;
      salaryMin = job.salaryMin;
      salaryMax = job.salaryMax;
      salaryCurrency = job.salaryCurrency;
    }

    if (!title || !company || !description) {
      return NextResponse.json({ error: "Title, company, and description are required." }, { status: 400 });
    }

    // Same normalization pipeline the scraper feed uses.
    const { city, workMode, bucket } = parseLocation(locationRaw, null, description);
    const fingerprint = jobFingerprint({ company, title, city, locationRaw });
    const nTitle = normTitle(title);
    const nCompany = normCompany(company);

    // Optimal dupe check, cheapest first:
    // 1) exact cross-source fingerprint (normalized company+title+city)
    // 2) same apply link (catches retitled reposts of the same posting)
    // 3) fuzzy: same normalized title + city via the [city, normTitle] index,
    //    then company similarity (handles "BMO" vs "BMO Financial Group")
    let existing: { id: string; title: string; company: string } | null = await prisma.job.findUnique({ where: { fingerprint } });
    let matchKind = "exact";
    if (!existing && applyUrl) {
      existing = await prisma.job.findFirst({ where: { applyUrl, isActive: true } });
      matchKind = "same link";
    }
    if (!existing) {
      const sameTitleCity = await prisma.job.findMany({
        where: { normTitle: nTitle, city, isActive: true, mergedAt: null },
        select: { id: true, title: true, company: true },
      });
      existing = sameTitleCity.find((c) => companiesMatch(c.company, company)) ?? null;
      matchKind = "similar posting";
    }
    if (existing) {
      return NextResponse.json({ job: { id: existing.id, title: existing.title, company: existing.company }, existing: true, match: matchKind });
    }

    const job = await prisma.job.create({
      data: {
        fingerprint,
        title,
        company,
        locationRaw,
        city,
        workMode,
        // manual adds are always wanted — never drop one for being out of coverage
        bucket: bucket ?? (workMode === "REMOTE" ? "REMOTE" : "TORONTO"),
        normTitle: nTitle,
        normCompany: nCompany,
        seniority: classifySeniority(title, description),
        category: classifyCategory(title),
        source: url ? "MANUAL_URL" : "MANUAL",
        sourceId: `manual:${fingerprint}`,
        sourceUrl: applyUrl || `manual:${fingerprint}`,
        applyUrl: applyUrl || "",
        description,
        salaryMin,
        salaryMax,
        salaryCurrency,
        postedAt,
      },
    });

    return NextResponse.json({ job: { id: job.id, title: job.title, company: job.company }, existing: false });
  } catch (e) {
    console.error("jobs/add failed:", e);
    return NextResponse.json({ error: "Something went wrong adding the job — paste the details instead." }, { status: 500 });
  }
}
