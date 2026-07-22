import { fetchJson, stripHtml } from "./http";
import type { NormalizedJob, SourceAdapter } from "./types";

interface RemoteOkJob {
  id?: string;
  position?: string;
  company?: string;
  location?: string;
  url?: string;
  date?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
}

/** Remote-only board. All listings are remote; keep Canada/worldwide-eligible ones. */
export function remoteOkAdapter(): SourceAdapter {
  const name = "remoteok";
  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const data = await fetchJson<RemoteOkJob[]>("https://remoteok.com/api");
      return (data ?? [])
        .filter((j) => j.id && j.position && j.url)
        .filter((j) => !/usa only|us only/i.test(j.location ?? ""))
        .map((j) => ({
          title: j.position ?? "",
          company: j.company ?? "",
          locationRaw: j.location || "Remote",
          remote: true,
          description: stripHtml(j.description ?? ""),
          source: name,
          sourceId: String(j.id),
          sourceUrl: j.url!,
          applyUrl: j.url!,
          postedAt: j.date ? new Date(j.date) : null,
          salaryMin: j.salary_min ?? null,
          salaryMax: j.salary_max ?? null,
          salaryCurrency: j.salary_min || j.salary_max ? "USD" : null,
        }));
    },
  };
}
