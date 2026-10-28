/**
 * Slot count and diversity ranking for the project library. No LLM, no DB.
 * Usage: npx tsx scripts/test-projects.ts
 */
import { PROJECTS, projectSlots, rankProjects, resolveProjects } from "../lib/tailor/projects";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

check("4 experience entries → 2 projects", projectSlots(4) === 2);
check("3 experience entries → 3 projects", projectSlots(3) === 3);
check("2 experience entries → 3 projects (fill the page)", projectSlots(2) === 3);
check("shorten always drops to 2", projectSlots(3, { shorten: true }) === 2);
check("shorten with 4 entries stays 2", projectSlots(4, { shorten: true }) === 2);
check("analyst/consulting always 2 projects so campus-ops experience can stay", projectSlots(3, { business: true }) === 2);
check("4 entries (business) still 2 projects", projectSlots(4, { business: true }) === 2);
check("5 entries still 2 projects", projectSlots(5) === 2);

const aiJd =
  "Gen AI Developer: RAG, LangChain, OpenAI, LLM inference, Python, FastAPI, machine learning, knowledge graphs";
const aiPick = rankProjects(aiJd, 2).map((p) => p.id);
check(
  "an AI posting does not take two ML apps as its only two slots",
  !(aiPick.includes("bettermind") && aiPick.includes("axom")),
  aiPick.join(", ")
);
check("an AI posting still leads with an ML project", aiPick[0] === "bettermind" || aiPick[0] === "axom", aiPick.join(", "));

const dataJd =
  "Data Science Associate: Python, SQL, Spark, large data pipelines, PostgreSQL, ETL, analytics dashboards";
const dataPick = rankProjects(dataJd, 3).map((p) => p.id);
check("a data posting returns 3 projects", dataPick.length === 3, dataPick.join(", "));
check(
  "a data posting's first three are not two ML apps plus filler",
  !(dataPick.slice(0, 2).includes("bettermind") && dataPick.slice(0, 2).includes("axom")),
  dataPick.join(", ")
);

const infraJd = "Software Developer Infrastructure: Docker, Kubernetes, Linux, Redis, queues, Python, CI/CD";
const infraPick = rankProjects(infraJd, 2).map((p) => p.id);
check("an infra posting leads with VertexFlow", infraPick[0] === "vertexflow", infraPick.join(", "));

const consultingPick = rankProjects("BCG Associate: Excel PowerPoint stakeholder case interview", 2, [], { business: true }).map(
  (p) => p.id
);
check(
  "consulting ranking prefers Expense Manager or JobHub over VertexFlow",
  consultingPick[0] === "expense_manager" || consultingPick[0] === "jobhub",
  consultingPick.join(", ")
);
check("consulting ranking leads with Expense Manager", consultingPick[0] === "expense_manager", consultingPick.join(", "));
check(
  "business pages never rank Windows Booster in the first two slots",
  !consultingPick.includes("windows_booster") && !consultingPick.includes("vertexflow"),
  consultingPick.join(", ")
);

const pythonHr = rankProjects(
  "Consultant HR System Analytics Python SQL Excel Workday data quality validation",
  2,
  [],
  { business: true }
).map((p) => p.id);
check(
  "a Python-heavy HR posting still prefers Expense Manager/JobHub over Windows Booster",
  pythonHr[0] === "expense_manager" || pythonHr[0] === "jobhub",
  pythonHr.join(", ")
);
check("Windows Booster is not on a business HR page", !pythonHr.includes("windows_booster"), pythonHr.join(", "));

const resolved = resolveProjects(
  [
    { id: "jobhub", bullets: ["Job-search platform that generates a tailored resume for every role.", "PostgreSQL stores status."] },
    { id: "windows_booster", bullets: ["Windows cleanup tool that analyzes files before moving them.", "Python classifies file content."] },
  ],
  2,
  "Consultant HR System Analytics Python SQL Excel data quality",
  true
);
check(
  "business resolveProjects ignores the model's Windows Booster pick",
  !resolved.chosen.includes("windows_booster"),
  resolved.chosen.join(", ")
);
check(
  "business resolveProjects leads with Expense Manager or JobHub",
  resolved.chosen[0] === "expense_manager" || resolved.chosen[0] === "jobhub",
  resolved.chosen.join(", ")
);
const jobhubEntry = resolved.entries.find((e) => /jobhub/i.test(e.name));
check(
  "JobHub business copy never mentions generating a tailored resume",
  Boolean(jobhubEntry) && !/tailored resume|latex/i.test(jobhubEntry!.bullets.join(" ")),
  jobhubEntry?.bullets.join(" | ")
);
check(
  "JobHub fallback second bullet is the status loop, not a second tracker sentence",
  /postgresql|page-visibility|status/i.test(jobhubEntry?.bullets[1] ?? ""),
  jobhubEntry?.bullets.join(" | ")
);

const twins = resolveProjects(
  [
    {
      id: "jobhub",
      bullets: [
        "Application tracker that pulls job postings, records every application, and flags follow-ups so a search stays current.",
        "Application tracker that pulls postings from many boards, records each application, and flags follow-ups so nothing sits stale.",
      ],
    },
  ],
  2,
  "Innovation and Integration Analyst data quality dashboards",
  true
);
const twinJobhub = twins.entries.find((e) => /jobhub/i.test(e.name));
check(
  "two JobHub tracker sentences are not both shipped",
  Boolean(twinJobhub) && /postgresql|page-visibility|status|boards is dropped/i.test(twinJobhub!.bullets[1] ?? "") && !/pulls postings from many boards/i.test(twinJobhub!.bullets[1] ?? ""),
  twinJobhub?.bullets.join(" | ")
);

const expense = PROJECTS.find((p) => p.id === "expense_manager");
const jobhub = PROJECTS.find((p) => p.id === "jobhub");
check(
  "Expense Manager consulting tech line has dashboards, not React/Express",
  Boolean(expense?.businessTechLine?.includes("Dashboard")) && !expense?.businessTechLine?.includes("React") && !expense?.businessTechLine?.includes("Express"),
  expense?.businessTechLine
);
check(
  "JobHub consulting tech line is an application tracker, not Next.js/Prisma/LLM",
  Boolean(jobhub?.businessTechLine?.includes("Application Tracker")) && !jobhub?.businessTechLine?.includes("Next.js") && !jobhub?.businessTechLine?.includes("Prisma"),
  jobhub?.businessTechLine
);

console.log(failures === 0 ? "all project-slot checks passed" : `${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
