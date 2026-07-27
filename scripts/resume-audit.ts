import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const KEEP_TITLE_RE =
  /\b(itil|help ?desk|desktop support|technical support|support engineer|technical consultant|technical analyst|it support|it analyst|it consultant|field (service|support)|systems? admin|lab monitor|implementation (engineer|consultant|specialist)|solutions? (analyst|engineer|consultant)|technical account|professional services|devops|sre|site reliability|infrastructure|platform engineer|cloud (engineer|ops)|network engineer)\b/i;
const KEEP_DESC_RE = /\b(itil|incident management|help ?desk|desktop support)\b/i;

const clean = (s: string) =>
  s.replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, " ").replace(/[{}$]/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Split a section body into entries on \resumeSubheading; return bullets per entry. */
function entriesOf(sectionBody: string): { header: string; bullets: string[] }[] {
  const parts = sectionBody.split(/\\resumeSubheading/).slice(1);
  return parts.map((part) => {
    const bullets = [...part.matchAll(/\\resumeItem\{([\s\S]*?)\}\s*(?:\n|$)/g)]
      .map((m) => clean(m[1]))
      .filter((b) => b.length > 15);
    const header = clean(part.slice(0, 120)).split("  ")[0].slice(0, 60);
    return { header, bullets };
  });
}

async function main() {
  const docs = await p.documentVersion.findMany({
    where: { kind: "RESUME" },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true, createdAt: true, pageCount: true, matchScore: true, texContent: true,
      job: { select: { title: true, company: true, description: true } },
    },
  });

  for (const d of docs) {
    const supportRelevant = KEEP_TITLE_RE.test(d.job.title) || KEEP_DESC_RE.test(d.job.description.slice(0, 3000));
    const tex = d.texContent;

    const expBody = tex.split(/\\section\{Experience\}/i)[1]?.split(/\\section\{Projects\}/i)[0] ?? "";
    const projBody = tex.split(/\\section\{Projects\}/i)[1]?.split(/\\section\{/i)[0] ?? "";

    const expEntries = entriesOf(expBody);
    const projEntries = [...projBody.matchAll(/\\resumeProjectHeading([\s\S]*?)(?=\\resumeProjectHeading|$)/g)].map((m) => ({
      header: clean(m[1].slice(0, 100)).slice(0, 50),
      bullets: [...m[1].matchAll(/\\resumeItem\{([\s\S]*?)\}\s*(?:\n|$)/g)].map((x) => clean(x[1])).filter((b) => b.length > 15),
    }));

    const allWc = expEntries.flatMap((e) => e.bullets.map(words));
    const inBand = allWc.filter((w) => w >= 14 && w <= 30).length;

    console.log(`\n${d.createdAt.toISOString().slice(0, 16)}  ${d.job.title.slice(0, 42)} @ ${d.job.company}`);
    console.log(`  hyflex=${supportRelevant ? "KEPT" : "DROPPED"} entries=${expEntries.length} pages=${d.pageCount} ats=${d.matchScore ?? "?"}  expBullets=${allWc.length} in-14-30w-band=${inBand}/${allWc.length}`);
    for (const e of expEntries) {
      const wc = e.bullets.map(words);
      const flag = wc.some((w) => w > 30 || w < 14) ? "  <-- OFF-BAND" : "";
      console.log(`    [${wc.join(",")}]${flag}  ${e.header}`);
    }
    console.log(`  projects: ${projEntries.map((pr) => `${pr.header.split(" ")[0]}(${pr.bullets.map(words).join(",")}w)`).join("  |  ")}`);
  }
}

main().finally(() => p.$disconnect());
