import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { runPoll } from "../lib/poll";

runPoll("cli")
  .then((s) => {
    console.log(`\nPoll finished: ${s.totalSeen} seen, ${s.newJobs} new, ${s.sourcesOk} sources ok, ${s.sourcesFailed} failed`);
    for (const r of s.results) {
      console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.source.padEnd(32)} ${String(r.count).padStart(4)} jobs  +${r.newCount} new  ${r.durationMs}ms${r.error ? `  (${r.error})` : ""}`);
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
