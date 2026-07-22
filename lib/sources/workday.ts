import { fetchJson, stripHtml, mapLimit } from "./http";
import { parseLocation } from "@/lib/geo";
import type { NormalizedJob, SourceAdapter } from "./types";

const SEARCH_TERMS = ["software", "engineer", "developer", "data", "machine learning", "devops", "consultant", "analyst"];
const MAX_DETAILS = 30;
const PAGE_SIZE = 20; // Workday hard-caps limit at 20 (larger = HTTP 400)
const PAGES_PER_TERM = 2;

interface WdPosting {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}

/**
 * Workday public board API (POST /wday/cxs/{tenant}/{site}/jobs).
 * boardToken format: "{host}/{tenant}/{site}" e.g. "td.wd3/td/TD_Bank_Careers".
 * Big boards (TD, BMO, Salesforce = 1000+ jobs) are searched by keyword instead
 * of paginated fully; descriptions fetched only for jobs passing the geo filter.
 */
export function workdayAdapter(boardToken: string, companyName: string): SourceAdapter {
  const [host, tenant, site] = boardToken.split("/");
  const base = `https://${host}.myworkdayjobs.com`;
  const listUrl = `${base}/wday/cxs/${tenant}/${site}/jobs`;
  const name = `workday:${host.split(".")[0]}`;

  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const byPath = new Map<string, WdPosting>();

      for (const term of SEARCH_TERMS) {
        for (let page = 0; page < PAGES_PER_TERM; page++) {
          const data = await fetchJson<{ total: number; jobPostings: WdPosting[] }>(listUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appliedFacets: {}, limit: PAGE_SIZE, offset: page * PAGE_SIZE, searchText: term }),
          });
          for (const j of data.jobPostings ?? []) {
            if (!byPath.has(j.externalPath)) byPath.set(j.externalPath, j);
          }
        }
      }

      const all = [...byPath.values()];
      // Geo-filter BEFORE paying for detail calls.
      const geoOk = all.filter((j) => {
        const { bucket } = parseLocation(j.locationsText ?? "", null);
        return bucket !== null;
      });

      const withDetails = await mapLimit(geoOk.slice(0, MAX_DETAILS), 4, async (j): Promise<NormalizedJob> => {
        let description = "";
        try {
          const d = await fetchJson<{ jobPostingInfo?: { jobDescription?: string; jobReqId?: string } }>(
            `${base}/wday/cxs/${tenant}/${site}${j.externalPath}`
          );
          description = stripHtml(d.jobPostingInfo?.jobDescription ?? "");
        } catch {
          // listing without description is still useful
        }
        return {
          title: j.title ?? "",
          company: companyName,
          locationRaw: j.locationsText ?? "",
          remote: null,
          description,
          source: name,
          sourceId: j.externalPath,
          sourceUrl: `${base}/en-US/${site}${j.externalPath}`,
          applyUrl: `${base}/en-US/${site}${j.externalPath}`,
          postedAt: j.postedOn ? new Date(j.postedOn) : null,
        };
      });

      // Jobs beyond the detail cap still get listed (without description).
      const rest = geoOk.slice(MAX_DETAILS).map(
        (j): NormalizedJob => ({
          title: j.title ?? "",
          company: companyName,
          locationRaw: j.locationsText ?? "",
          remote: null,
          description: "",
          source: name,
          sourceId: j.externalPath,
          sourceUrl: `${base}/en-US/${site}${j.externalPath}`,
          applyUrl: `${base}/en-US/${site}${j.externalPath}`,
          postedAt: j.postedOn ? new Date(j.postedOn) : null,
        })
      );

      return [...withDetails, ...rest];
    },
  };
}
