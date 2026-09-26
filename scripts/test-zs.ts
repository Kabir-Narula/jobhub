/**
 * ZS Strategy Insights & Planning + Decision Analytics associate doctrine.
 * Run: npx tsx scripts/test-zs.ts
 */
import { detectPostingFlavor, ensureHiringScreen, flavorDirective } from "../lib/tailor/hiring-screen";
import { detectRoleFamily } from "../lib/tailor/role-family";
import { claimableBusinessSkillItems } from "../lib/tailor/analyst-techniques";
import { finalizeBusinessTitle } from "../lib/tailor/generate";
import { auditExperienceBullets, highSeverityCount } from "../lib/tailor/bullet-quality";
import { jdSignalsAchievements } from "../lib/tailor/achievements";
import { softSkillsFor } from "../lib/tailor/soft-skills";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`ok    ${name}`);
  }
}

const SIP_JD = `
What you'll do
- Leverage problem solving skills and frameworks to develop solutions to client business problems
- Conduct market research and/or desk research to derive insights and inform client decision making
- Design custom analyses using tools like Excel, Access, Confirmit and ZS's proprietary software
- Synthesize and communicate results to clients and ZS teams
- Collaborate with client and ZS teams to implement solutions
- Take responsibility and ownership for assigned project deliverables
What you'll bring
- Completed degree with strong analytic and quantitative coursework
- Available to start full-time employment in 2026
- Proficiency in Microsoft Office Suite
- High motivation, good work ethic, maturity and personal initiative
- Effective oral and written communication skills
- Client-first mentality
- Intense work ethic
- Collaborative spirit and problem-solving approach
`;

const DA_JD = `
What You'll Do
- Develop and apply advanced statistical models that help clients understand dynamic business issues.
- Leverage analytic techniques to use data to guide client and ZS team decision-making.
- Design custom analyses in R, Tableau, SAS, Visual Basic and Excel to investigate and inform client needs.
- Synthesize and communicate results to clients and ZS teams through oral and written presentations.
- Develop client relationships and serve as key point of contact on aspects of projects.
What You'll Bring
- Bachelor's or master's with quantitative coursework such as operations research, applied mathematics, data science, statistics, econometrics or engineering
- Available to start full-time employment in 2026
- Knowledge of programming (e.g., Java/Python/R)
- Exposure to tools/platforms (e.g., Hadoop eco system and database systems)
- Demonstrated proficiency in a programming language or analytic tool such as R, SAS, Tableau, or VBA
- Client-first mentality
- Intense work ethic
`;

check(
  "ZS SIP title+company is consulting family",
  detectRoleFamily("Strategy Insights & Planning Associate", "ZS", SIP_JD) === "consulting"
);
check(
  "ZS DA title+company is consulting family",
  detectRoleFamily("Decision Analytics Associate", "ZS", DA_JD) === "consulting"
);
check(
  "SIP flavor is zs-sip not generic insights",
  detectPostingFlavor("Strategy Insights & Planning Associate", SIP_JD, "consulting") === "zs-sip"
);
check(
  "DA flavor is zs-da not insights (Tableau must not steal)",
  detectPostingFlavor("Decision Analytics Associate", DA_JD, "consulting") === "zs-da"
);
check("zs-sip directive bans Confirmit invent", /Confirmit/i.test(flavorDirective("zs-sip")));
check("zs-da directive bans Tableau invent", /Tableau/i.test(flavorDirective("zs-da")));

const sipScreen = ensureHiringScreen(
  ["Be collaborative", "Show initiative", "Communicate well"],
  "consulting",
  "Strategy Insights & Planning Associate",
  SIP_JD
);
check(
  "SIP hiring screen merges ZS fallbacks",
  sipScreen.some((s) => /desk|market research|Confirmit|EBI|Insights Analyst/i.test(s)),
  sipScreen.join(" | ")
);

const daScreen = ensureHiringScreen(
  ["Be collaborative", "Show initiative", "Communicate well"],
  "consulting",
  "Decision Analytics Associate",
  DA_JD
);
check(
  "DA hiring screen merges ZS fallbacks",
  daScreen.some((s) => /Tableau|Python|quantitative|EBI|Analytics Analyst/i.test(s)),
  daScreen.join(" | ")
);

const sipSkills = claimableBusinessSkillItems(SIP_JD, "consulting");
check(
  "SIP skills include Excel + Market/Desk Research, not Confirmit",
  sipSkills.some((s) => /excel/i.test(s)) &&
    sipSkills.some((s) => /market research|desk research/i.test(s)) &&
    !sipSkills.some((s) => /confirmit/i.test(s)),
  sipSkills.join(", ")
);

const daSkills = claimableBusinessSkillItems(DA_JD, "consulting");
check(
  "DA skills include Python + Excel + Statistical Analysis, not Tableau as claimed product skill from invent list path",
  daSkills.some((s) => /python/i.test(s)) && daSkills.some((s) => /excel/i.test(s)),
  daSkills.join(", ")
);

check(
  "SIP non-bridge title → Insights Analyst",
  finalizeBusinessTitle("Software Engineer (Co-op)", "Software Engineer (Co-op)", false, "zs-sip") ===
    "Insights Analyst (Co-op)"
);
check(
  "DA non-bridge title → Analytics Analyst",
  finalizeBusinessTitle("Software Engineer (Co-op)", "Software Engineer (Co-op)", false, "zs-da") ===
    "Analytics Analyst (Co-op)"
);

check("ZS JD keeps Achievements", jdSignalsAchievements(SIP_JD) && jdSignalsAchievements(DA_JD));
check(
  "ZS soft skills pick Client Focus / Communication",
  softSkillsFor(SIP_JD, "consulting").some((s) => /client|communication/i.test(s))
);

const badSip = auditExperienceBullets(
  [
    {
      company: "INNWIL",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Built Python REST services that separated extraction work from client requests across concurrent jobs.",
        "Diagnosed release regressions through test results and review gates for technical partners.",
        "Tracked sprint decisions with teammates across 2 delivery cycles before shipping updates.",
      ],
    },
    {
      company: "PHC",
      title: "Business Analyst (Co-op)",
      bullets: [
        "Integrated third-party REST APIs by mapping external records into stable internal contracts.",
        "Added TypeScript client flows with authentication so failed requests surfaced actionable messages.",
        "Traced release-cycle connectivity defects across clients before community-facing updates shipped.",
      ],
    },
  ],
  { family: "consulting", expandedCount: 2, jobTitle: "Strategy Insights & Planning Associate", jobDescription: SIP_JD }
);
check(
  "SWE-shaped page fails ZS SIP audit",
  highSeverityCount(badSip) > 0,
  badSip
    .filter((i) => i.severity === "high")
    .map((i) => i.message)
    .slice(0, 2)
    .join(" || ")
);

const goodSip = auditExperienceBullets(
  [
    {
      company: "INNWIL",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Compared 3 incomplete data sources, then built a Python refresh so partners could trust weekly insight inputs.",
        "Synthesized mismatched platform metrics into a short recommendation the project lead used in sprint planning.",
        "Walked technical and non-technical partners through tradeoffs before agreeing on the next analysis path.",
      ],
    },
    {
      company: "PHC",
      title: "Insights Analyst (Co-op)",
      bullets: [
        "Ran desk research across client workflows, turning recurring gaps into a shared requirements brief.",
        "Built an Excel tracker that surfaced open follow-ups so owners stopped losing items between meetings.",
        "Presented synthesized findings to campus partners, prompting orientation notes to update before the next intake.",
      ],
    },
  ],
  { family: "consulting", expandedCount: 2, jobTitle: "Strategy Insights & Planning Associate", jobDescription: SIP_JD }
);
check(
  "research/insight page passes ZS SIP framing gate",
  !goodSip.some((i) => i.severity === "high" && /ZS Strategy Insights|desk\/market/i.test(i.message)),
  goodSip
    .filter((i) => i.severity === "high")
    .map((i) => i.message)
    .join(" || ")
);

console.log(failures === 0 ? "\nall ZS checks passed" : `\n${failures} check(s) FAILED`);
if (failures > 0) process.exit(1);
