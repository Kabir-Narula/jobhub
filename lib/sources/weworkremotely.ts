import * as cheerio from "cheerio";
import { fetchText, stripHtml } from "./http";
import type { NormalizedJob, SourceAdapter } from "./types";

const FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
];

const ELIGIBLE_RE = /anywhere|canada|north america|americas|worldwide/i;

/** Remote-only board (RSS). Region field decides Canada eligibility. */
export function weWorkRemotelyAdapter(): SourceAdapter {
  const name = "weworkremotely";
  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const out: NormalizedJob[] = [];
      for (const feed of FEEDS) {
        const xml = await fetchText(feed);
        const $ = cheerio.load(xml, { xmlMode: true });
        $("item").each((_, el) => {
          const item = $(el);
          const titleRaw = item.find("title").first().text().trim();
          const link = item.find("link").first().text().trim();
          const region = item.find("region").first().text().trim();
          if (region && !ELIGIBLE_RE.test(region)) return;
          // Titles look like "Company: Role"
          const m = titleRaw.match(/^([^:]+):\s*(.+)$/);
          const company = m ? m[1].trim() : "";
          const title = m ? m[2].trim() : titleRaw;
          out.push({
            title,
            company,
            locationRaw: region || "Remote",
            remote: true,
            description: stripHtml(item.find("description").first().text() ?? ""),
            source: name,
            sourceId: link,
            sourceUrl: link,
            applyUrl: link,
            postedAt: item.find("pubDate").first().text() ? new Date(item.find("pubDate").first().text()) : null,
          });
        });
      }
      return out;
    },
  };
}
