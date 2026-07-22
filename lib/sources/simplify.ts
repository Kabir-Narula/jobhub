import * as cheerio from "cheerio";
import { fetchText, stripHtml } from "./http";
import type { NormalizedJob, SourceAdapter } from "./types";

const FEEDS: { name: string; url: string }[] = [
  {
    name: "simplify:newgrad",
    url: "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md",
  },
];

/** "16d" | "3mo" | "1w" -> approximate date */
function ageToDate(age: string): Date | null {
  const m = age.trim().match(/^(\d+)\s*(d|w|mo|yr)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const days = unit === "d" ? n : unit === "w" ? n * 7 : unit === "mo" ? n * 30 : n * 365;
  return new Date(Date.now() - days * 86400000);
}

/**
 * Simplify community job lists (GitHub, updated daily, MIT-licensed).
 * Rows are HTML tables inside markdown; closed postings are marked 🔒.
 * Descriptions aren't provided by the list — apply links go to the ATS.
 */
export function simplifyAdapter(feed: (typeof FEEDS)[number]): SourceAdapter {
  return {
    name: feed.name,
    async fetch(): Promise<NormalizedJob[]> {
      const md = await fetchText(feed.url, {}, 30000);
      const $ = cheerio.load(md);
      const jobs: NormalizedJob[] = [];
      let lastCompany = "";

      $("tr").each((_, tr) => {
        const cells = $(tr).find("td");
        if (cells.length < 4) return;

        // company cell: either a name/link or "↳" (same company as previous row)
        const companyCell = $(cells[0]).text().replace(/🔥/g, "").trim();
        const company = companyCell === "↳" || companyCell === "" ? lastCompany : companyCell;
        if (!company) return;
        lastCompany = company;

        const title = $(cells[1]).text().trim();
        // location cell may contain a <details> block with multiple locations;
        // preserve separators so "Remote in USA</br>Remote in Canada" doesn't
        // concatenate into an unmatchable blob.
        const locHtml = $(cells[2]).html() ?? "";
        const locationText = stripHtml(locHtml.replace(/<\/br>|<br\s*\/?>/gi, " | "))
          .split(/\n+|\s*\|\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ");

        // apply cell: first <a href> is the direct ATS link; 🔒 means closed
        const applyCell = $(cells[3]);
        if (applyCell.text().includes("🔒")) return;
        const applyUrl = applyCell.find("a").first().attr("href");
        if (!applyUrl || !title) return;

        jobs.push({
          title,
          company,
          locationRaw: locationText,
          remote: /remote/i.test(locationText) ? true : null,
          description: "",
          source: feed.name,
          sourceId: applyUrl.split("?")[0],
          sourceUrl: applyUrl,
          applyUrl,
          postedAt: cells.length > 4 ? ageToDate($(cells[4]).text()) : null,
        });
      });

      return jobs;
    },
  };
}

export function simplifyAdapters(): SourceAdapter[] {
  return FEEDS.map(simplifyAdapter);
}
