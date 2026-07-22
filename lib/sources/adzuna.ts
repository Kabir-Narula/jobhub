import { fetchJson, stripHtml } from "./http";
import type { NormalizedJob, SourceAdapter } from "./types";

interface AdzunaJob {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  redirect_url: string;
  created?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
}

const QUERIES = ["software developer", "software engineer new grad", "technical consultant", "solutions analyst"];

/**
 * Adzuna Canada endpoint. Enabled only when ADZUNA_APP_ID/ADZUNA_APP_KEY are set.
 * Free tier: https://developer.adzuna.com/
 */
export function adzunaAdapter(): SourceAdapter | null {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return null;
  const name = "adzuna";
  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const out: NormalizedJob[] = [];
      for (const what of QUERIES) {
        const url =
          `https://api.adzuna.com/v1/api/jobs/ca/search/1?app_id=${encodeURIComponent(appId)}` +
          `&app_key=${encodeURIComponent(appKey)}&results_per_page=50&content-type=application/json` +
          `&what=${encodeURIComponent(what)}&where=${encodeURIComponent("Toronto, ON")}`;
        const data = await fetchJson<{ results: AdzunaJob[] }>(url);
        for (const j of data.results ?? []) {
          out.push({
            title: stripHtml(j.title ?? ""),
            company: j.company?.display_name ?? "",
            locationRaw: j.location?.display_name ?? "",
            remote: null,
            description: stripHtml(j.description ?? ""),
            source: name,
            sourceId: String(j.id),
            sourceUrl: j.redirect_url,
            applyUrl: j.redirect_url,
            postedAt: j.created ? new Date(j.created) : null,
            salaryMin: j.salary_min ? Math.round(j.salary_min) : null,
            salaryMax: j.salary_max ? Math.round(j.salary_max) : null,
            salaryCurrency: j.salary_min || j.salary_max ? "CAD" : null,
          });
        }
      }
      return out;
    },
  };
}
