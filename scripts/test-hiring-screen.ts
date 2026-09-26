/**
 * Hiring-screen fallbacks and posting flavor.
 * Run: npx tsx scripts/test-hiring-screen.ts
 */
import {
  detectPostingFlavor,
  ensureHiringScreen,
  hiringScreenFallback,
  JD_DEEP_ANALYSIS_PROTOCOL,
} from "../lib/tailor/hiring-screen";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

check(
  "Autodesk title is competitive-intel flavor",
  detectPostingFlavor(
    "AI Market and Competitive Intelligence Analyst",
    "PitchBook competitive landscape source monitoring",
    "analyst"
  ) === "competitive-intel"
);

const ci = hiringScreenFallback(
  "analyst",
  "AI Market and Competitive Intelligence Analyst",
  "source monitoring competitive landscape"
);
check("CI fallback has source-monitoring guidance", ci.some((s) => /source monitor/i.test(s)), ci.join(" | "));
check("CI fallback mentions magnitudes", ci.some((s) => /magnitudes|TWO/i.test(s)), ci.join(" | "));

check(
  "empty model screen still gets CI fallbacks",
  ensureHiringScreen([], "analyst", "Competitive Intelligence Analyst", "competitive landscape").length >= 4
);

check(
  "silent BCG is silent-mbb",
  detectPostingFlavor("Associate", "Drive creativity intelligence lead persuade", "consulting") === "silent-mbb"
);

check(
  "tool-named consulting is not silent-mbb",
  detectPostingFlavor("Business Analyst", "Excel SQL PowerPoint required", "consulting") === "consulting-general"
);

check(
  "JD deep-analysis protocol covers mandatory vs preferred",
  /mandatory requirements vs preferred/i.test(JD_DEEP_ANALYSIS_PROTOCOL) &&
    /target-role relevance/i.test(JD_DEEP_ANALYSIS_PROTOCOL)
);

console.log(failures === 0 ? "all hiring-screen checks passed" : `${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
