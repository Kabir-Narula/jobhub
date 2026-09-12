/**
 * Deterministic checks for the dedupe fingerprint. No LLM, no database, no cost.
 * Run: npx tsx scripts/test-dedupe.ts
 */
import { normCompany, normTitle, companiesMatch, jobFingerprint } from "../lib/dedupe";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const fp = (company: string, title = "Software Developer", city = "Toronto") =>
  jobFingerprint({ company, title, city, locationRaw: `${city}, ON` });

console.log("1) generic company names must not normalize to nothing");
// Stripping every descriptor left "", so all of these shared one fingerprint
// and unrelated postings silently deduped into a single job.
for (const c of ["Global Solutions Inc", "Canadian Technology Services", "Digital Systems Group", "Capital Global Holdings"]) {
  check(`"${c}" keeps an identity`, normCompany(c) !== "", `-> ${JSON.stringify(normCompany(c))}`);
}

console.log("\n2) unrelated generic-named companies do not collide");
const pairs: [string, string][] = [
  ["Global Solutions Inc", "Canadian Technology Services"],
  ["Digital Systems Group", "Capital Global Holdings"],
];
for (const [a, b] of pairs) {
  check(`"${a}" vs "${b}"`, fp(a) !== fp(b), `${fp(a)} vs ${fp(b)}`);
}

console.log("\n3) intended merges still merge");
check("TD Bank == TD Securities", fp("TD Bank") === fp("TD Securities"), normCompany("TD Bank"));
check("Wealthsimple Inc. == Wealthsimple", fp("Wealthsimple Inc.") === fp("Wealthsimple"));
check("companiesMatch TD vs TD Bank", companiesMatch("TD", "TD Bank"));
check("companiesMatch rejects unrelated", !companiesMatch("Shopify", "Wealthsimple"));

console.log("\n4) title normalization strips level fluff only");
check('"Junior Software Developer" == "Software Developer"', normTitle("Junior Software Developer") === normTitle("Software Developer"));
check('"Backend Developer" != "Frontend Developer"', normTitle("Backend Developer") !== normTitle("Frontend Developer"));

console.log(failures === 0 ? "\nall dedupe checks passed" : `\n${failures} check(s) FAILED`);
if (failures > 0) process.exit(1);
