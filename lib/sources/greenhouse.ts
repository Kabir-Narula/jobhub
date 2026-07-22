import { fetchJson, stripHtml } from "./http";
import type { NormalizedJob, SourceAdapter } from "./types";

interface GhJob {
  id: number;
  title: string;
  location?: { name?: string };
  absolute_url: string;
  content?: string;
  updated_at?: string;
}

export function greenhouseAdapter(token: string, companyName: string): SourceAdapter {
  const name = `greenhouse:${token}`;
  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const data = await fetchJson<{ jobs: GhJob[] }>(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`
      );
      return (data.jobs ?? []).map((j) => ({
        title: j.title ?? "",
        company: companyName,
        locationRaw: j.location?.name ?? "",
        remote: null,
        description: stripHtml(j.content ?? ""),
        source: name,
        sourceId: String(j.id),
        sourceUrl: j.absolute_url,
        applyUrl: j.absolute_url,
        postedAt: j.updated_at ? new Date(j.updated_at) : null,
      }));
    },
  };
}
