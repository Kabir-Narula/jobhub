import { fetchJson, stripHtml } from "./http";
import type { NormalizedJob, SourceAdapter } from "./types";

interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  url: string;
  publication_date?: string;
  description?: string;
  salary?: string;
}

const ELIGIBLE_RE = /canada|worldwide|anywhere|north america|americas|global/i;

/** Remote-only board. Keeps roles a Toronto-based candidate is eligible for. */
export function remotiveAdapter(): SourceAdapter {
  const name = "remotive";
  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const data = await fetchJson<{ jobs: RemotiveJob[] }>(
        "https://remotive.com/api/remote-jobs?limit=300"
      );
      return (data.jobs ?? [])
        .filter((j) => ELIGIBLE_RE.test(j.candidate_required_location ?? "worldwide"))
        .map((j) => ({
          title: j.title ?? "",
          company: j.company_name ?? "",
          locationRaw: j.candidate_required_location || "Remote",
          remote: true,
          description: stripHtml(j.description ?? ""),
          source: name,
          sourceId: String(j.id),
          sourceUrl: j.url,
          applyUrl: j.url,
          postedAt: j.publication_date ? new Date(j.publication_date) : null,
        }));
    },
  };
}
