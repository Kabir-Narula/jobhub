import { prisma } from "@/lib/db";
import { buildSources } from "@/lib/sources";
import type { SourceResult } from "@/lib/sources/types";
import { decodeEntities } from "@/lib/sources/http";
import { parseLocation } from "@/lib/geo";
import { classifyCategory, classifySeniority } from "@/lib/classify";
import { jobFingerprint, normTitle, normCompany, companiesMatch } from "@/lib/dedupe";
import { sweepDuplicates } from "@/lib/dedupe-sweep";

export interface PollSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  newJobs: number;
  totalSeen: number;
  dupesMerged: number;
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
  await prisma.pollRun.update({ where: { id: run.id }, data: { totalSources: sources.length } }).catch(() => {});

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
      const seenSids = new Set<string>();
      for (const job of jobs) {
        try {
          const title = decodeEntities(job.title).trim();
          const company = decodeEntities(job.company).trim();
          const locationRaw = decodeEntities(job.locationRaw);
          if (!title || !company) continue;
          if (INTERN_RE.test(title)) continue;
          // same posting ID twice in one batch (retitled card) -> keep first
          if (job.sourceId) {
            if (seenSids.has(job.sourceId)) continue;
            seenSids.add(job.sourceId);
          }
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
            normTitle: normTitle(title),
            normCompany: normCompany(company),
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
            // an Invalid Date from any adapter poisons the whole createMany
            // batch — sanitize here so one bad adapter value can't sink a source
            postedAt: job.postedAt instanceof Date && !isNaN(job.postedAt.getTime()) ? job.postedAt : null,
          });
        } catch {
          // a single malformed record never aborts the source
        }
      }

      // 1b) in-batch fuzzy collapse: same city + normalized title, fuzzy company
      // (fingerprint equality misses "TD" vs "TD Bank" arriving in one batch)
      {
        const groups = new Map<string, Array<{ fp: string; row: Record<string, unknown> }>>();
        for (const [fp, row] of prepared) {
          const key = `${(row.city as string).toLowerCase()}|${row.normTitle as string}`;
          const arr = groups.get(key) ?? [];
          arr.push({ fp, row });
          groups.set(key, arr);
        }
        const dropFps = new Set<string>();
        for (const arr of groups.values()) {
          if (arr.length < 2) continue;
          const kept: typeof arr = [];
          for (const item of arr) {
            const dup = kept.find((k) => companiesMatch(k.row.company as string, item.row.company as string));
            if (!dup) {
              kept.push(item);
              continue;
            }
            // same job twice in one batch — keep the richer description
            if ((item.row.description as string).length > (dup.row.description as string).length) {
              dropFps.add(dup.fp);
              kept.splice(kept.indexOf(dup), 1);
              kept.push(item);
            } else {
              dropFps.add(item.fp);
            }
          }
        }
        for (const fp of dropFps) prepared.delete(fp);
      }

      // 2) batched writes: 1 existence check + createMany + updateMany
      try {
        const fps = [...prepared.keys()];
        const existing = fps.length
          ? await prisma.job.findMany({
              where: { fingerprint: { in: fps } },
              select: { id: true, fingerprint: true, postedAt: true, mergedIntoId: true },
            })
          : [];
        const existingSet = new Set(existing.map((e) => e.fingerprint));

        let toCreate = fps.filter((f) => !existingSet.has(f)).map((f) => prepared.get(f)!);

        // 2a) same-posting dedupe: (source, sourceId) already exists under a
        // different fingerprint (retitled repost) -> touch, never recreate.
        if (toCreate.length) {
          const sids = toCreate.map((r) => r.sourceId as string).filter(Boolean);
          if (sids.length) {
            const existingSids = await prisma.job.findMany({
              where: { source: s.name, sourceId: { in: sids } },
              select: { id: true, sourceId: true, mergedIntoId: true },
            });
            if (existingSids.length) {
              const bySid = new Map(existingSids.map((e) => [e.sourceId, e]));
              const touchIds = new Set<string>();
              toCreate = toCreate.filter((row) => {
                const hit = bySid.get(row.sourceId as string);
                if (hit) {
                  // a merged loser's touch forwards to its winner
                  touchIds.add(hit.mergedIntoId ?? hit.id);
                  return false;
                }
                return true;
              });
              await prisma.job.updateMany({
                where: { id: { in: [...touchIds] } },
                data: { lastSeenAt: new Date(), isActive: true },
              });
            }
          }
        }

        // 2b) second-chance dedupe against DB: same city + normalized title with a
        // fuzzily-matching company already exists -> treat as seen, don't create a dupe.
        if (toCreate.length) {
          const cities = [...new Set(toCreate.map((r) => r.city as string))];
          const titles = [...new Set(toCreate.map((r) => r.normTitle as string))];
          const candidates = await prisma.job.findMany({
            where: { city: { in: cities }, normTitle: { in: titles } },
            select: { id: true, company: true, city: true, normTitle: true, mergedIntoId: true },
          });
          const byKey = new Map<string, typeof candidates>();
          for (const c of candidates) {
            const key = `${c.city.toLowerCase()}|${c.normTitle}`;
            const arr = byKey.get(key) ?? [];
            arr.push(c);
            byKey.set(key, arr);
          }
          const touchIds = new Set<string>();
          const still: typeof toCreate = [];
          for (const row of toCreate) {
            const cands = byKey.get(`${(row.city as string).toLowerCase()}|${row.normTitle as string}`) ?? [];
            const hit = cands.find((c) => companiesMatch(row.company as string, c.company));
            if (hit) touchIds.add(hit.mergedIntoId ?? hit.id);
            else still.push(row);
          }
          toCreate = still;
          if (touchIds.size) {
            await prisma.job.updateMany({
              where: { id: { in: [...touchIds] } },
              data: { lastSeenAt: new Date(), isActive: true },
            });
          }
        }

        // skipDuplicates: concurrent sources can insert the same fingerprint in
        // the same cycle (linkedin + workday:td cross-post) — without this, one
        // conflict fails the WHOLE 200-row batch and the source never inserts
        // (this is why no workday:* rows ever landed in the DB).
        let created = 0;
        for (let i = 0; i < toCreate.length; i += 200) {
          const r = await prisma.job.createMany({ data: toCreate.slice(i, i + 200) as never, skipDuplicates: true });
          created += r.count;
        }
        sourceNew = created;

        // touch rows whose fingerprint reappeared — merged losers forward to their winner
        const touchIds = new Set(existing.map((e) => e.mergedIntoId ?? e.id));
        if (touchIds.size) {
          await prisma.job.updateMany({
            where: { id: { in: [...touchIds] } },
            data: { lastSeenAt: new Date(), isActive: true },
          });
        }

        const missingPosted = existing.filter((e) => e.postedAt === null && !e.mergedIntoId);
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

  // Cross-source race catch-all: two sources can insert the same job in the
  // same cycle (neither saw the other's row). Sweep merges whatever slipped
  // through before the UI ever shows it.
  const sweep = await sweepDuplicates({}).catch(() => null);
  const dupesMerged = sweep?.deactivated ?? 0;

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
    dupesMerged,
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
