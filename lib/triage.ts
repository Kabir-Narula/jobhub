import type { Job } from "@prisma/client";

/**
 * Triage score: what deserves your attention first.
 * Bucket fit, profile fit (category + level), and freshness — so a
 * new-grad SWE role in Toronto posted today outranks a 3-week-old
 * remote "OTHER" listing every time.
 */
export function triageScore(job: Job, now = Date.now()): number {
  let score = 0;

  // location fit
  score += job.bucket === "TORONTO" ? 40 : job.bucket === "GTA_COMMUTE" ? 25 : 10;

  // profile/category fit
  score +=
    job.category === "SWE"
      ? 20
      : job.category === "DATA_ML"
        ? 18
        : job.category === "INFRA"
          ? 14
          : job.category === "CONSULTING_TECH"
            ? 12
            : 4;

  // level fit (new-grad focus)
  score += job.seniority === "NEW_GRAD" ? 10 : job.seniority === "MID" ? 5 : 0;

  // freshness (posted date preferred, discovery as fallback)
  const when = (job.postedAt ?? job.firstSeenAt).getTime();
  const ageH = (now - when) / 3600000;
  score += ageH <= 24 ? 15 : ageH <= 72 ? 10 : ageH <= 168 ? 5 : 0;

  // newly discovered boost
  if (now - job.firstSeenAt.getTime() < 48 * 3600000) score += 8;

  // has salary info is mildly useful for triage
  if (job.salaryMin || job.salaryMax) score += 2;

  return score;
}

export function byTriage(a: Job, b: Job, now = Date.now()): number {
  const d = triageScore(b, now) - triageScore(a, now);
  if (d !== 0) return d;
  const pa = (a.postedAt ?? a.firstSeenAt).getTime();
  const pb = (b.postedAt ?? b.firstSeenAt).getTime();
  return pb - pa;
}
