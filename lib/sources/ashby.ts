import { fetchJson, stripHtml } from "./http";
import type { NormalizedJob, SourceAdapter } from "./types";

interface AshbyJob {
  id: string;
  title: string;
  location?: string | { name?: string };
  locationName?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  jobUrl: string;
  publishedAt?: string;
}

export function ashbyAdapter(token: string, companyName: string): SourceAdapter {
  const name = `ashby:${token}`;
  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const data = await fetchJson<{ jobs: AshbyJob[] }>(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`
      );
      return (data.jobs ?? []).map((j) => {
        const loc =
          j.locationName ??
          (typeof j.location === "string" ? j.location : j.location?.name ?? "");
        return {
          title: j.title ?? "",
          company: companyName,
          locationRaw: loc,
          remote: null,
          description: j.descriptionPlain ?? stripHtml(j.descriptionHtml ?? ""),
          source: name,
          sourceId: j.id,
          sourceUrl: j.jobUrl,
          applyUrl: j.jobUrl,
          postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
        };
      });
    },
  };
}
