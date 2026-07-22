import { fetchJson, mapLimit, stripHtml } from "./http";
import type { NormalizedJob, SourceAdapter } from "./types";

interface SrListJob {
  id: string;
  name: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
  releasedDate?: string;
  ref?: string;
}

interface SrDetail {
  id: string;
  name: string;
  jobAd?: { sections?: { companyDescription?: string; jobDescription?: string; qualifications?: string; additionalInformation?: string } };
  applyUrl?: string;
  ref?: string;
}

const MAX_DETAILS = 40;

export function smartRecruitersAdapter(token: string, companyName: string): SourceAdapter {
  const name = `smartrecruiters:${token}`;
  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const base = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}`;
      const list = await fetchJson<{ content: SrListJob[] }>(`${base}/postings?limit=100`);
      const jobs = (list.content ?? [])
        .sort((a, b) => (b.releasedDate ?? "").localeCompare(a.releasedDate ?? ""))
        .slice(0, MAX_DETAILS);

      // Detail endpoint carries the description; fetch with bounded concurrency,
      // and degrade to list-only data if a detail call fails.
      return mapLimit(jobs, 6, async (j): Promise<NormalizedJob> => {
        let description = "";
        let applyUrl = `https://jobs.smartrecruiters.com/${token}/${j.id}`;
        try {
          const d = await fetchJson<SrDetail>(`${base}/postings/${j.id}`);
          const s = d.jobAd?.sections ?? {};
          description = stripHtml(
            [s.companyDescription, s.jobDescription, s.qualifications, s.additionalInformation]
              .filter(Boolean)
              .join("\n\n")
          );
          if (d.applyUrl) applyUrl = d.applyUrl;
        } catch {
          // keep list-only data
        }
        const loc = [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(", ");
        return {
          title: j.name ?? "",
          company: companyName,
          locationRaw: loc,
          remote: j.location?.remote ?? null,
          description,
          source: name,
          sourceId: j.id,
          sourceUrl: applyUrl,
          applyUrl,
          postedAt: j.releasedDate ? new Date(j.releasedDate) : null,
        };
      });
    },
  };
}
