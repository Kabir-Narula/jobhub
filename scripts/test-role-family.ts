/**
 * Role-family classifier, campus-ops keep/drop, analyst vs SWE lenses.
 * Run: npx tsx scripts/test-role-family.ts
 */
import {
  detectRoleFamily,
  isCampusOpsEntry,
  selectExperienceEntries,
  keepCampusOps,
  csBridgeEntryIndex,
  jdWantsProgramming,
} from "../lib/tailor/role-family";
import { detectLens } from "../lib/tailor/lens";
import { isTechTerm } from "../lib/tailor/match";
import { softSkillsFor } from "../lib/tailor/soft-skills";
import { projectSlots } from "../lib/tailor/projects";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`ok    ${name}`);
  }
}

check(
  "McKinsey Business Analyst is consulting",
  detectRoleFamily("Business Analyst", "McKinsey & Company", "") === "consulting"
);
check(
  "BCG Associate (campus) is consulting",
  detectRoleFamily("Associate, Western Canadian Universities, Canada", "Boston Consulting Group", "") === "consulting"
);
check(
  "Lilly Insights Associate is analyst, not data-engineering",
  detectRoleFamily("Insights Associate/Sr Associate/Manager", "Eli Lilly and Company", "analytics dashboards python spark") ===
    "analyst"
);
check(
  "Data Analyst is analyst",
  detectRoleFamily("Data Analyst", "Shopify", "Excel SQL Tableau") === "analyst"
);
check(
  "Autodesk Market and Competitive Intelligence Analyst is analyst, not SWE",
  detectRoleFamily("AI Market and Competitive Intelligence Analyst", "Autodesk", "PitchBook competitive landscape") ===
    "analyst"
);
check(
  "Data Engineer is data-ml",
  detectRoleFamily("Data Engineer", "Shopify", "Spark ETL") === "data-ml"
);
check(
  "analytics in an Insights JD does not become the data-engineering lens",
  detectLens(
    "Insights Associate",
    "analytics dashboards python spark etl databricks data pipeline analytics analytics",
    "Eli Lilly and Company"
  )?.id === "analyst"
);
check(
  "McKinsey BA lens is consulting",
  detectLens("Business Analyst", "problem solving client teams excel powerpoint", "McKinsey & Company")?.id === "consulting"
);
check(
  "consulting lens suppresses Node.js and Fastify",
  Boolean(
    detectLens("Business Analyst", "", "McKinsey & Company")?.suppress.some((s) => /node\.js/i.test(s)) &&
      detectLens("Business Analyst", "", "McKinsey & Company")?.suppress.some((s) => /fastify/i.test(s))
  )
);
check(
  "Software Engineer at McKinsey Digital stays SWE",
  detectRoleFamily("Software Engineer", "McKinsey & Company", "Java Python Kubernetes") === "swe"
);
check(
  "a FastAPI backend posting is SWE",
  detectRoleFamily("Backend Software Developer", "Stripe", "Python FastAPI PostgreSQL") === "swe"
);
check(
  "Associate Software Engineer is SWE, not consulting",
  detectRoleFamily("Associate Software Engineer", "Boston Consulting Group", "") === "swe"
);
check(
  "IBM HR Technology Developer Associate is consulting, not SWE",
  detectRoleFamily(
    "HR Technology Developer Associate / Consultant associé développeur en technologies RH",
    "IBM",
    "As an HR Technology Associate Consultant, you will support IBM Consulting HR systems projects. SuccessFactors and techno-functional integration."
  ) === "consulting"
);
check(
  "IBM Enterprise Strategy Consultant Associate is consulting",
  detectRoleFamily("Enterprise Strategy Consultant Associate", "IBM", "IBM Consulting strategy associate consultant client engagement") ===
    "consulting"
);
check(
  "Software Engineer at IBM stays SWE",
  detectRoleFamily("Software Engineer", "IBM", "Java Python Kubernetes microservices") === "swe"
);
check(
  "ZS Strategy Insights & Planning Associate is consulting",
  detectRoleFamily("Strategy Insights & Planning Associate", "ZS", "desk research Excel Confirmit client-first") ===
    "consulting"
);
check(
  "ZS Decision Analytics Associate is consulting",
  detectRoleFamily("Decision Analytics Associate", "ZS", "statistical models Python R Tableau Excel") === "consulting"
);
check("Excel is a claimable analyst tool", isTechTerm("excel"));
check("VLOOKUP is a claimable analyst tool", isTechTerm("vlookup"));
check("Power Query is a claimable analyst tool", isTechTerm("powerquery"));
check("PowerPoint is a claimable analyst tool", isTechTerm("powerpoint"));
check("bare 'word' is not a skill term", !isTechTerm("word"));
check("empty consulting JD does not invent Professional skills", softSkillsFor("", "consulting").length === 0);
check("empty analyst JD does not invent Professional skills", softSkillsFor("", "analyst").length === 0);
check("SWE JD without those words gets no forced consulting skills", softSkillsFor("Python FastAPI PostgreSQL").length === 0);

const masterish = [
  { company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform", title: "Software Engineer Intern (Co-op)" },
  { company: "Seneca Polytechnic — ITS", title: "Student HyFlex Ambassador + Lab Monitor (Contract, Part-time)" },
  { company: "Project Human City", title: "Software Engineer (Co-op)" },
  { company: "Seneca Polytechnic — Student Services", title: "Student Office Assistant & Peer Mentor" },
  { company: "Three of Cups", title: "Software Engineer (Freelance)" },
];
check("ITS is campus-ops", isCampusOpsEntry(masterish[1]));
check("office assistant is campus-ops", isCampusOpsEntry(masterish[3]));
check("INNWIL is not campus-ops", !isCampusOpsEntry(masterish[0]));
check(
  "analyst keeps campus-ops and caps at 4 (drops oldest freelance)",
  keepCampusOps("analyst") && selectExperienceEntries(masterish, "analyst").length === 4
);
check(
  "analyst drops Three of Cups so the page can hold 3 bullets",
  !selectExperienceEntries(masterish, "analyst").some((e) => /three of cups/i.test(e.company))
);
check("SWE drops campus-ops entries", selectExperienceEntries(masterish, "swe").length === 3);
check(
  "SWE still has the freelance software role",
  selectExperienceEntries(masterish, "swe").some((e) => /three of cups/i.test(e.company))
);
check("analyst resumes drop a project to make room", projectSlots(4, { business: true }) === 2);
check(
  "CS bridge is the first non-campus-ops entry (most recent software internship)",
  (() => {
    const picked = selectExperienceEntries(masterish, "analyst");
    return csBridgeEntryIndex(picked) === 0 && /INNWIL/i.test(picked[0].company);
  })()
);

check(
  "Bain-style no-coding JD does not want programming",
  !jdWantsProgramming(
    "Work with client teams on their hardest problems, structure ambiguous questions, build fact-based recommendations, present to senior executives. Strong academic record, leadership, teamwork.",
    "Associate Consultant"
  )
);
check(
  "Python-mentioning consulting JD wants programming",
  jdWantsProgramming("Design custom analyses. Knowledge of programming (e.g., Java/Python/R) is a plus.", "Decision Analytics Associate")
);
check(
  "IBM 'Java Script' typo JD still wants programming",
  jdWantsProgramming("Required: Java Script or Python, knowledge of APIs.", "HR Technology Developer Associate")
);
check(
  "SWE posting wants programming",
  jdWantsProgramming("Build REST services and write automated tests.", "Software Engineer")
);

console.log(failures === 0 ? "\nall role-family checks passed" : `\n${failures} check(s) FAILED`);
if (failures > 0) process.exit(1);
