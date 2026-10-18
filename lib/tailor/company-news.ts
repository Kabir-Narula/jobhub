export interface NewsItem {
  title: string;
  source: string | null;
  date: string | null;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** Recent headlines (last ~90 days) from Google News RSS. Best-effort; returns [] on any failure. */
export async function fetchCompanyNews(company: string, max = 6): Promise<NewsItem[]> {
  const q = encodeURIComponent(`"${company}" when:90d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-CA&gl=CA&ceid=CA:en`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 job-hub" } });
    clearTimeout(t);
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const needle = company.toLowerCase().split(/\s+/)[0];
    const out: NewsItem[] = [];
    for (const item of items) {
      const rawTitle = decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      const source = decode(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "") || null;
      const pub = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
      const title = source ? rawTitle.replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "") : rawTitle;
      if (!title || !title.toLowerCase().includes(needle)) continue;
      if (
        /stock|shares|price target|downgrade|upgrade|lawsuit|layoff|class action|dividend|earnings|profit|revenue|quarter|\bq[1-4]\b|issuer bid|buyback|beats|misses|estimates|news of the day|undervalued|options chain|analysts?\b|\((tsx|nyse|nasdaq)?:?\s?[A-Z]{1,5}\)|welcome bonus|interest rate|capital notes|debentures|yahoo finance/i.test(
          title
        )
      ) {
        continue;
      }
      const date = pub ? new Date(pub) : null;
      out.push({ title, source, date: date && !isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null });
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}
