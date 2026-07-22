import { fetchJson } from "./http";
import type { NormalizedJob, SourceAdapter } from "./types";

interface LeverJob {
  id: string;
  text: string;
  categories?: { location?: string; commitment?: string; team?: string };
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  additionalPlain?: string;
}

export function leverAdapter(token: string, companyName: string): SourceAdapter {
  const name = `lever:${token}`;
  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const data = await fetchJson<LeverJob[]>(
        `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`
      );
      return (data ?? []).map((j) => ({
        title: j.text ?? "",
        company: companyName,
        locationRaw: j.categories?.location ?? "",
        remote: null,
        description: [j.descriptionPlain, j.additionalPlain].filter(Boolean).join("\n\n"),
        source: name,
        sourceId: j.id,
        sourceUrl: j.hostedUrl,
        applyUrl: j.applyUrl || j.hostedUrl,
        postedAt: j.createdAt ? new Date(j.createdAt) : null,
      }));
    },
  };
}
