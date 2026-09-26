/**
 * Hiring-screen fallbacks and posting flavor.
 * Run: npx tsx scripts/test-hiring-screen.ts
 */
import {
  detectPostingFlavor,
  ensureHiringScreen,
  hiringScreenFallback,
  JD_DEEP_ANALYSIS_PROTOCOL,
  detectEmployerArchetype,
  archetypeScreen,
  archetypeLensLine,
  mergeScreenLines,
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

// ---------- employer archetypes (all role families) ----------
check("RBC is bank-campus", detectEmployerArchetype("RBC", "Software Developer, Amplify 2027") === "bank-campus");
check("TD Securities is bank-campus", detectEmployerArchetype("TD Securities", "Software Engineer Intern") === "bank-campus");
check("Capital One is bank-campus", detectEmployerArchetype("Capital One", "Associate Data Scientist") === "bank-campus");
check("Wealthsimple is fintech-scaleup", detectEmployerArchetype("Wealthsimple", "Software Engineer") === "fintech-scaleup");
check("Toast is fintech-scaleup", detectEmployerArchetype("Toast", "Backend Software Engineer Co-op") === "fintech-scaleup");
check("TELUS GTLP is institutional-grad", detectEmployerArchetype("TELUS", "Graduate Technology Leadership Program") === "institutional-grad");
check("Bell is institutional-grad", detectEmployerArchetype("Bell", "Graduate Program - Software Development") === "institutional-grad");
check("Cornerstone is econ-consulting", detectEmployerArchetype("Cornerstone Research", "Analyst") === "econ-consulting");
check("Deloitte is big4", detectEmployerArchetype("Deloitte", "Business Analyst") === "big4");
check("McKinsey is mbb-tier2", detectEmployerArchetype("McKinsey & Company", "Business Analyst") === "mbb-tier2");
check("Kearney is mbb-tier2", detectEmployerArchetype("Kearney", "Business Analyst") === "mbb-tier2");
check("ZS is mbb-tier2", detectEmployerArchetype("ZS", "Decision Analytics Associate") === "mbb-tier2");
check("unknown company is none", detectEmployerArchetype("SomeStartup Inc", "Software Engineer") === "none");
check(
  "unknown company with rotational JD is institutional-grad",
  detectEmployerArchetype("SomeUtility", "Analyst", "Join our rotational program for new graduates. Rotations across teams.") ===
    "institutional-grad"
);

check(
  "bank screen demands STAR-able bullets + hackathon keywords",
  archetypeScreen("bank-campus").some((s) => /STAR/i.test(s)) &&
    archetypeScreen("bank-campus").some((s) => /hackathon/i.test(s))
);
check(
  "fintech screen demands proof-of-impact + GitHub",
  archetypeScreen("fintech-scaleup").some((s) => /proof-of-impact/i.test(s)) &&
    archetypeScreen("fintech-scaleup").some((s) => /github/i.test(s))
);
check(
  "institutional screen names written leadership requirement",
  archetypeScreen("institutional-grad").some((s) => /leadership/i.test(s))
);
check(
  "econ screen bans inventing Stata/R",
  archetypeScreen("econ-consulting").some((s) => /stata/i.test(s))
);
check("no archetype → no screen lines", archetypeScreen("none").length === 0);
check("bank lens line exists and mentions reliability", /reliability|data integrity/i.test(archetypeLensLine("bank-campus")));
check("no archetype → no lens line", archetypeLensLine("none") === "");

check(
  "mergeScreenLines dedupes case-insensitively and preserves order",
  JSON.stringify(mergeScreenLines(["Keep it real", "STAR stories"], ["star stories", "Workday keywords"])) ===
    JSON.stringify(["Keep it real", "STAR stories", "Workday keywords"])
);

console.log(failures === 0 ? "all hiring-screen checks passed" : `${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
