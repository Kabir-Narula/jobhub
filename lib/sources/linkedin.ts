import * as cheerio from "cheerio";
import { fetchText, stripHtml, mapLimit } from "./http";
import type { NormalizedJob, SourceAdapter } from "./types";

const KEYWORDS = [
  "software engineer new grad",
  "junior software developer",
  "software developer",
  "backend developer",
  "full stack developer",
  "machine learning engineer",
  "data engineer",
  "devops engineer",
  "technical consultant",
  "solutions analyst",
  "IT consultant",
  "associate software engineer",
  "AI developer",
  "robotics software",
];
// Freshness pass: date-sorted, past-week window — guarantees every poll
// picks up the newest postings (recency searches above miss them).
const FRESH_KEYWORDS = ["software engineer", "software developer", "machine learning", "data engineer", "technical consultant"];
const LOCATION = "Toronto, Ontario, Canada";
const PAGES_PER_KEYWORD = 2; // 25 per page
const MAX_DETAILS_PER_RUN = 40;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * BEST-EFFORT adapter (per spec: optional, isolated, clearly labeled).
 * Uses LinkedIn's public guest job-board endpoints (no auth). LinkedIn
 * rate-limits aggressively — on a 429/999 the adapter throws, the poll
 * orchestrator isolates the failure, and every other source is unaffected.
 */
export function linkedinAdapter(): SourceAdapter {
  const name = "linkedin";
  return {
    name,
    async fetch(): Promise<NormalizedJob[]> {
      const seen = new Set<string>();
      const jobs: NormalizedJob[] = [];

      async function scrapePage(url: string) {
        const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
        if (res.status === 429 || res.status === 999) {
          throw new Error(`LinkedIn rate-limited (HTTP ${res.status}) — best-effort adapter backing off`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} from LinkedIn guest API`);
        const html = await res.text();
        const $ = cheerio.load(html);

        $(".job-search-card").each((_, el) => {
          const card = $(el);
          const urn = card.attr("data-entity-urn") ?? "";
          const id = urn.replace(/\D/g, "");
          if (!id || seen.has(id)) return;
          seen.add(id);

          const title = card.find(".base-search-card__title").first().text().trim();
          const company = card.find(".base-search-card__subtitle a").first().text().trim();
          const locationRaw = card.find(".job-search-card__location").first().text().trim();
          const href = card.find("a.base-card__full-link").first().attr("href") ?? "";
          const link = href.split("?")[0];
          const timeEl = card.find("time").first();
          const postedAt = timeEl.attr("datetime") ? new Date(timeEl.attr("datetime")!) : null;
          if (!title || !company || !link) return;

          jobs.push({
            title,
            company,
            locationRaw,
            remote: /remote/i.test(locationRaw) ? true : null,
            description: "", // filled below for a capped subset
            source: name,
            sourceId: id,
            sourceUrl: link,
            applyUrl: link,
            postedAt,
          });
        });
        await sleep(1200); // be polite
      }

      // Phase 1: relevance-ranked searches (breadth).
      for (const kw of KEYWORDS) {
        for (let page = 0; page < PAGES_PER_KEYWORD; page++) {
          await scrapePage(
            "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search" +
              `?keywords=${encodeURIComponent(kw)}&location=${encodeURIComponent(LOCATION)}&start=${page * 25}`
          );
        }
      }

      // Phase 2: date-sorted past-week searches (freshness — catches what relevance misses).
      for (const kw of FRESH_KEYWORDS) {
        for (let page = 0; page < 2; page++) {
          await scrapePage(
            "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search" +
              `?keywords=${encodeURIComponent(kw)}&location=${encodeURIComponent(LOCATION)}&f_TPR=r604800&sortBy=DD&start=${page * 25}`
          );
        }
      }

      // Fetch descriptions for the newest subset only — detail calls are the
      // most likely to trigger rate limits, so they're capped and optional.
      const newest = jobs
        .sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))
        .slice(0, MAX_DETAILS_PER_RUN);
      await mapLimit(newest, 2, async (job) => {
        try {
          await sleep(400);
          const html = await fetchText(
            `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${job.sourceId}`,
            { headers: { "User-Agent": UA, Accept: "text/html" } },
            12000
          );
          const $ = cheerio.load(html);
          const desc = $(".description__text").first();
          job.description = stripHtml(desc.html() ?? "");
        } catch {
          // description stays empty — the job listing itself is still useful
        }
      });

      return jobs;
    },
  };
}
