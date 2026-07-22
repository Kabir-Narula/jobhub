import { greenhouseAdapter } from "../lib/sources/greenhouse";
import { leverAdapter } from "../lib/sources/lever";
import { remotiveAdapter } from "../lib/sources/remotive";
import { parseLocation } from "../lib/geo";
import { classifyCategory, classifySeniority } from "../lib/classify";
import { jobFingerprint } from "../lib/dedupe";

async function main() {
  const adapters = [
    greenhouseAdapter("stackadapt", "StackAdapt"),
    leverAdapter("wealthsimple", "Wealthsimple"),
    remotiveAdapter(),
  ];

  let total = 0;
  let kept = 0;
  const fingerprints = new Set<string>();
  let dupes = 0;

  for (const a of adapters) {
    const jobs = await a.fetch();
    console.log(`\n=== ${a.name}: ${jobs.length} raw jobs ===`);
    total += jobs.length;
    let shown = 0;
    for (const j of jobs) {
      const { city, workMode, bucket } = parseLocation(j.locationRaw, j.remote, j.description);
      if (!bucket) continue;
      kept++;
      const fp = jobFingerprint({ company: j.company, title: j.title, city, locationRaw: j.locationRaw });
      if (fingerprints.has(fp)) dupes++;
      fingerprints.add(fp);
      if (shown < 6) {
        shown++;
        console.log(
          `  [${bucket.padEnd(11)}|${workMode.padEnd(7)}|${classifySeniority(j.title).padEnd(8)}|${classifyCategory(j.title).padEnd(15)}] ${j.title.slice(0, 55)} @ ${j.company} (${j.locationRaw.slice(0, 30)})`
        );
      }
    }
  }
  console.log(`\ntotal raw: ${total}, kept after location policy: ${kept}, unique: ${fingerprints.size}, dupes collapsed: ${dupes}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
