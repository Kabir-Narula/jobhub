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

const INTERN_RE = /\b(intern(ship)?s?|co-?op|summer student|work term|placement (student|year))\b/i;

/**
 * One poll cycle. Each source runs its own fetch->write chain concurrently
 * (no waiting for the slowest source before any writes land), failures are
 * isolated per source, and the PollRun checkpoints after every source so
 * the UI shows live progress.
 */
export async function runPoll(trigger: string): Promise<PollSummary> {
  const startedAt = new Date();
  const run = await prisma.pollRun.create({ data: { trigger } });
  const sources = await buildSources();

  const results: SourceResult[] = [];
  let newJobs = 0;
  let totalSeen = 0;

  const checkpoint = async () => {
    await prisma.pollRun
      .update({ where: { id: run.id }, data: { results: results as never, newJobs, totalSeen } })
      .catch(() => {});
  };

  async function processSource(s: (typeof sources)[number]): Promise<void> {
    const t0 = Date.now();
    let sourceNew = 0;
    let count = 0;
    let error: string | undefined;

    try {
      const jobs = await s.fetch();
      count = jobs.length;

      // 1) prepare rows (pure CPU)
      const prepared = new Map<string, Record<string, unknown>>();
      for (const job of jobs) {
        try {
          const title = decodeEntities(job.title).trim();
          const company = decodeEntities(job.company).trim();
          const locationRaw = decodeEntities(job.locationRaw);
          if (!title || !company) continue;
          if (INTERN_RE.test(title)) continue;
          const { city, workMode, bucket } = parseLocation(locationRaw, job.remote);
          if (!bucket) continue;
          const fingerprint = jobFingerprint({ company, title, city, locationRaw });
          if (prepared.has(fingerprint)) continue;
          prepared.set(fingerprint, {
            fingerprint,
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
          });
        } catch {
          // a single malformed record never aborts the source
        }
      }

      // 2) batched writes: 1 existence check + createMany + updateMany
      try {
        const fps = [...prepared.keys()];
        const existing = fps.length
          ? await prisma.job.findMany({
              where: { fingerprint: { in: fps } },
              select: { fingerprint: true, postedAt: true },
            })
          : [];
        const existingSet = new Set(existing.map((e) => e.fingerprint));

        const toCreate = fps.filter((f) => !existingSet.has(f)).map((f) => prepared.get(f)!);
        for (let i = 0; i < toCreate.length; i += 200) {
          await prisma.job.createMany({ data: toCreate.slice(i, i + 200) as never });
        }
        sourceNew = toCreate.length;

        const toTouch = fps.filter((f) => existingSet.has(f));
        if (toTouch.length) {
          await prisma.job.updateMany({
            where: { fingerprint: { in: toTouch } },
            data: { lastSeenAt: new Date(), isActive: true },
          });
        }

        const missingPosted = existing.filter((e) => e.postedAt === null);
        for (const e of missingPosted) {
          const row = prepared.get(e.fingerprint);
          if (row?.postedAt) {
            await prisma.job.update({
              where: { fingerprint: e.fingerprint },
              data: { postedAt: row.postedAt as Date },
            });
          }
        }
        totalSeen += fps.length;
      } catch {
        // a batch failure never aborts other sources
      }

      // Deactivate listings that disappeared — only for sources that succeeded.
      await prisma.job.updateMany({
        where: { source: s.name, isActive: true, lastSeenAt: { lt: startedAt } },
        data: { isActive: false },
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    // Surface per-company health on CompanySource rows (ATS sources only).
    const [atsType, token] = s.name.split(":");
    if (token) {
      await prisma.companySource
        .updateMany({
          where: { boardToken: token, atsType: atsType.toUpperCase() as never },
          data: { lastError: error ?? "" },
        })
        .catch(() => {});
    }

    results.push({
      source: s.name,
      ok: !error,
      count,
      newCount: sourceNew,
      error,
      durationMs: Date.now() - t0,
    });
    newJobs += sourceNew;
    await checkpoint();
  }

  await Promise.all(sources.map(processSource));

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

// ---------- fire-and-forget runner with a running-guard ----------

let running: Promise<PollSummary> | null = null;

/** Starts a poll in the background. Returns false if one is already running. */
export function startPollInBackground(trigger: string): boolean {
  if (running) return false;
  running = runPoll(trigger).finally(() => {
    running = null;
  });
  return true;
}

export function isPolling(): boolean {
  return running !== null;
}
