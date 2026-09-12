/**
 * Slot count and diversity ranking for the project library. No LLM, no DB.
 * Usage: npx tsx scripts/test-projects.ts
 */
import { projectSlots, rankProjects } from "../lib/tailor/projects";

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

const excluded = rankProjects(aiJd, 2, ["bettermind"]).map((p) => p.id);
check("exclude drops the named id", !excluded.includes("bettermind"), excluded.join(", "));

console.log(failures === 0 ? "all project-slot checks passed" : `${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
