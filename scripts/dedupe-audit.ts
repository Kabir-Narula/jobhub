import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { sweepDuplicates } from "../lib/dedupe-sweep";

const DRY = process.argv.includes("--dry");

sweepDuplicates({ dry: DRY, log: (m) => console.log(m) })
  .then((s) => {
    console.log(
      `\n${DRY ? "[DRY RUN] " : ""}done: ${s.mergedGroups} dup groups, ${s.deactivated} jobs deactivated, ` +
      `${s.appsMoved} applications moved, ${s.docsMoved} documents moved, ${s.appsCollapsed} duplicate applications collapsed`
    );
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
