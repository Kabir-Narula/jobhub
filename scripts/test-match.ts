/**
 * Deterministic checks for the ATS scoring engine. No LLM, no database, no cost.
 * Run: npx tsx scripts/test-match.ts
 */
import { claimableJdTerms, isTechTerm, matchScore } from "../lib/tailor/match";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

console.log("1) technologies ending in 's' survive normalization");
// norm() de-pluralized these into devop/jenkin/panda/rail, which are not in
// TECH_LEXICON, so isTechTerm rejected them and they vanished from targeting.
const JD_PLURAL = `Requirements: DevOps experience, Jenkins pipelines, Kubernetes, pandas, Rails.
DevOps and Jenkins are required. Kubernetes is required. pandas and Rails are required.
DevOps Jenkins Kubernetes pandas Rails.`;
const plural = claimableJdTerms(JD_PLURAL, 25);
for (const t of ["devops", "jenkins", "kubernetes", "pandas", "rails"]) {
  check(`"${t}" is a target keyword`, plural.includes(t), plural.join(", "));
}
for (const bad of ["devop", "jenkin", "panda", "rail"]) {
  check(`"${bad}" is not emitted`, !plural.includes(bad));
  check(`"${bad}" is not a tech term`, !isTechTerm(bad));
}

console.log("\n2) a JD term is not credited by an unrelated longer word");
const JD_JAVA = `Requirements: strong Java. Java is required. We build in Java.`;
const RESUME_JS = String.raw`\section{Skills}
\begin{itemize}\item \textbf{Languages}{: JavaScript, TypeScript \\}\end{itemize}
\section{Experience}\resumeItem{Built a JavaScript service with TypeScript.}`;
check("JavaScript does not satisfy a Java requirement", matchScore(JD_JAVA, RESUME_JS) === 0, `score=${matchScore(JD_JAVA, RESUME_JS)}`);

const RESUME_JAVA = String.raw`\section{Skills}
\begin{itemize}\item \textbf{Languages}{: Java, Kotlin \\}\end{itemize}
\section{Experience}\resumeItem{Built a Java service.}`;
check("Java does satisfy a Java requirement", matchScore(JD_JAVA, RESUME_JAVA) === 100, `score=${matchScore(JD_JAVA, RESUME_JAVA)}`);

console.log("\n3) genuine subset relationships still count");
const JD_SQL = `Requirements: SQL. SQL is required. Strong SQL skills.`;
const RESUME_PG = String.raw`\section{Skills}
\begin{itemize}\item \textbf{Cloud \& Data}{: PostgreSQL, Prisma \\}\end{itemize}
\section{Experience}\resumeItem{Tuned PostgreSQL indexes.}`;
check("PostgreSQL satisfies a SQL requirement", matchScore(JD_SQL, RESUME_PG) === 100, `score=${matchScore(JD_SQL, RESUME_PG)}`);

console.log("\n4) no JD means no score (displayed as a dash, never 0%)");
check("empty JD scores null", matchScore("", RESUME_PG) === null);

console.log("\n5) consulting analyst tools are claimable");
check("excel is a tech term", isTechTerm("excel"));
check("powerpoint is a tech term", isTechTerm("powerpoint"));
check("bare word is not a tech term", !isTechTerm("word"));
const JD_EXCEL = `Requirements: advanced Excel. Excel models and PowerPoint decks. Excel Excel PowerPoint.`;
const excelTerms = claimableJdTerms(JD_EXCEL, 25);
check("excel is extracted from a consulting JD", excelTerms.includes("excel"), excelTerms.join(", "));
check("powerpoint is extracted from a consulting JD", excelTerms.includes("powerpoint"), excelTerms.join(", "));

console.log("\n6) HTML entities and CSS fragments are not ATS requirements");
check("x27 is not a tech term", !isTechTerm("x27"));
check("h59 is not a tech term", !isTechTerm("h59"));
check("c++ is still a tech term", isTechTerm("c++"));
const JD_ENTITY = `Consulting Business Analyst. You&#x27;ll work in Excel. You&#x27;ll present in PowerPoint. Excel Excel PowerPoint.`;
const entityTerms = claimableJdTerms(JD_ENTITY, 25, [], "Business Analyst");
check("apostrophe entities do not become x27", !entityTerms.includes("x27"), entityTerms.join(", "));
check("excel still extracts from entity-heavy HTML", entityTerms.includes("excel"), entityTerms.join(", "));
const resumeExcel = String.raw`\section{Skills}
\begin{itemize}\item \textbf{Infra \& Tools}{: Excel, PowerPoint \\}\end{itemize}
\section{Experience}\resumeItem{Built an Excel tracker.}`;
check(
  "entity-heavy JD does not score 0% when Excel is on the resume",
  (matchScore(JD_ENTITY, resumeExcel, "McKinsey", "Business Analyst") ?? 0) > 0,
  `score=${matchScore(JD_ENTITY, resumeExcel, "McKinsey", "Business Analyst")}`
);
const JD_SPARK_CHROME = `Associate role. Spark Spark Spark. Data Science and Analytics. Excel Excel PowerPoint.`;
check(
  "spark is not required on a BCG Associate posting",
  !claimableJdTerms(JD_SPARK_CHROME, 25, [], "Associate, Western Canadian Universities").some((t) => t.includes("spark")),
  claimableJdTerms(JD_SPARK_CHROME, 25, [], "Associate, Western Canadian Universities").join(", ")
);

console.log(failures === 0 ? "\nall match checks passed" : `\n${failures} check(s) FAILED`);
if (failures > 0) process.exit(1);
