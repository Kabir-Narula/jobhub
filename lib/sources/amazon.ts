import { fetchJson, stripHtml } from "./http";
import { parseLocation } from "@/lib/geo";
import type { NormalizedJob, SourceAdapter } from "./types";

interface AmazonJob {
  id: string;
  id_icims?: string;
  title: string;
  company_name?: string;
  city?: string;
  state?: string;
  country_code?: string;
  location?: string;
  description?: string;
  description_short?: string;
  job_path?: string;
  url_next_step?: string;
  posted_date?: string;
  is_intern?: boolean;
  university_job?: boolean;
}

const QUERIES = ["software engineer", "software development engineer", "data engineer", "machine learning engineer"];
const PAGE_SIZE = 50;
const MAX_PAGES = 2;

/** Amazon's own public jobs API (search.json). Location results are global, so filter strictly client-side. */
export function amazonAdapter(): SourceAdapter {
  const name = "amazon";
  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const byId = new Map<string, AmazonJob>();
      for (const q of QUERIES) {
        for (let page = 0; page < MAX_PAGES; page++) {
          const url =
            "https://www.amazon.jobs/en/search.json" +
            `?loc_query=${encodeURIComponent("Toronto, ON, CAN")}` +
            `&base_query=${encodeURIComponent(q)}` +
            `&count=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&result_limit=${PAGE_SIZE}`;
          const data = await fetchJson<{ jobs?: AmazonJob[] }>(url);
          for (const j of data.jobs ?? []) {
            if (j.id && !byId.has(j.id)) byId.set(j.id, j);
          }
        }
      }

      const jobs: NormalizedJob[] = [];
      for (const j of byId.values()) {
        if (j.is_intern) continue;
        const locationRaw = j.city ? [j.city, j.state, j.country_code].filter(Boolean).join(", ") : j.location ?? "";
        const { bucket } = parseLocation(locationRaw, null);
        if (!bucket) continue;
        jobs.push({
          title: j.title ?? "",
          company: j.company_name?.includes("Amazon") ? "Amazon" : j.company_name ?? "Amazon",
          locationRaw,
          remote: /virtual|remote/i.test(locationRaw) ? true : null,
          description: stripHtml(j.description ?? j.description_short ?? ""),
          source: name,
          sourceId: j.id_icims ?? j.id,
          sourceUrl: `https://www.amazon.jobs${j.job_path ?? ""}`,
          applyUrl: j.url_next_step ?? `https://www.amazon.jobs${j.job_path ?? ""}`,
          postedAt: j.posted_date ? new Date(j.posted_date) : null,
        });
      }
      return jobs;
    },
  };
}
