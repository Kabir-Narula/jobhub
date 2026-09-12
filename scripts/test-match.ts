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

console.log(failures === 0 ? "\nall match checks passed" : `\n${failures} check(s) FAILED`);
if (failures > 0) process.exit(1);
