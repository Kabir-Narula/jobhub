import { prisma } from "@/lib/db";
import { buildSources } from "@/lib/sources";
import type { SourceResult } from "@/lib/sources/types";
import { decodeEntities } from "@/lib/sources/http";
import { parseLocation } from "@/lib/geo";
import { classifyCategory, classifySeniority } from "@/lib/classify";
import { jobFingerprint } from "@/lib/dedupe";

export interface PollSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  newJobs: number;
  totalSeen: number;
  sourcesOk: number;
  sourcesFailed: number;
  results: SourceResult[];
}

/**
 * One poll cycle: fetch every adapter (failures isolated per source),
 * classify + filter + dedupe + upsert, deactivate listings that vanished
 * (only for sources that succeeded), record a PollRun for observability.
 */
export async function runPoll(trigger: string): Promise<PollSummary> {
  const startedAt = new Date();
  const run = await prisma.pollRun.create({ data: { trigger } });
  const sources = await buildSources();

  const settled = await Promise.all(
    sources.map(async (s) => {
      const t0 = Date.now();
      try {
        const jobs = await s.fetch();
        return { name: s.name, ok: true as const, jobs, ms: Date.now() - t0 };
      } catch (err) {
        return {
          name: s.name,
          ok: false as const,
          jobs: [],
          ms: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  const results: SourceResult[] = [];
  let newJobs = 0;
  let totalSeen = 0;

  for (const res of settled) {
    let sourceNew = 0;

    if (res.ok) {
      for (const job of res.jobs) {
        try {
          const title = decodeEntities(job.title).trim();
          const company = decodeEntities(job.company).trim();
          const locationRaw = decodeEntities(job.locationRaw);
          if (!title || !company) continue;
          // Full-time only: skip internships/co-ops entirely.
          if (/\b(intern(ship)?s?|co-?op|summer student|work term|placement (student|year))\b/i.test(title)) continue;
          // Work mode from explicit signals only (location text + source remote flag) — no description sniffing.
          const { city, workMode, bucket } = parseLocation(locationRaw, job.remote);
          if (!bucket) continue; // fails the Toronto/GTA/remote policy
          const fingerprint = jobFingerprint({
            company,
            title,
            city,
            locationRaw,
          });
          const data = {
            title,
            company,
            locationRaw,
            city,
            workMode,
            bucket,
            seniority: classifySeniority(job.title, job.description),
            category: classifyCategory(job.title),
            source: job.source,
            sourceId: job.sourceId,
            sourceUrl: job.sourceUrl,
            applyUrl: job.applyUrl,
            description: job.description,
            salaryMin: job.salaryMin ?? null,
            salaryMax: job.salaryMax ?? null,
            salaryCurrency: job.salaryCurrency ?? null,
            postedAt: job.postedAt,
          };
          const existing = await prisma.job.findUnique({ where: { fingerprint }, select: { id: true, postedAt: true } });
          if (existing) {
            await prisma.job.update({
              where: { id: existing.id },
              data: { lastSeenAt: new Date(), isActive: true, postedAt: existing.postedAt ?? data.postedAt },
            });
          } else {
            await prisma.job.create({ data: { ...data, fingerprint } });
            sourceNew++;
          }
          totalSeen++;
        } catch {
          // a single malformed record never aborts the source
        }
      }
      // Deactivate listings that disappeared — only for sources that succeeded.
      await prisma.job.updateMany({
        where: { source: res.name, isActive: true, lastSeenAt: { lt: startedAt } },
        data: { isActive: false },
      });
    }

    // Surface per-company health on CompanySource rows (ATS sources only).
    const [atsType, token] = res.name.split(":");
    if (token) {
      await prisma.companySource
        .updateMany({
          where: { boardToken: token, atsType: atsType.toUpperCase() as never },
          data: { lastError: res.ok ? "" : res.error ?? "unknown error" },
        })
        .catch(() => {});
    }

    results.push({
      source: res.name,
      ok: res.ok,
      count: res.ok ? res.jobs.length : 0,
      newCount: sourceNew,
      error: res.ok ? undefined : res.error,
      durationMs: res.ms,
    });
    newJobs += sourceNew;
  }

  const finishedAt = new Date();
  await prisma.pollRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      results: results as never,
      newJobs,
      totalSeen,
      ok: results.some((r) => r.ok),
    },
  });

  return {
    runId: run.id,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    newJobs,
    totalSeen,
    sourcesOk: results.filter((r) => r.ok).length,
    sourcesFailed: results.filter((r) => !r.ok).length,
    results,
  };
}
