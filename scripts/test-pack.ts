/**
 * Deterministic leftover-space packing. No LLM, no DB.
 * Usage: npx tsx scripts/test-pack.ts
 */
import { packClampAttempts } from "../lib/tailor/pack";
import { FILL_TARGET } from "../lib/tailor/fill";
import { insertCoursework, stripCoursework } from "../lib/tailor/latex";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

check("full-page target is 92% so 86% no longer counts as done", FILL_TARGET === 0.92);

const sparse = packClampAttempts({
  hasAchievements: false,
  hasCoursework: true,
  projectCount: 2,
  activeClamps: { compactSkills: 5, achievements: 0 },
  achievementCount: 3,
});
check("sparse 2-project page tries achievements first", sparse[0]?.achievements === 3);
check("sparse 2-project page then tries a third project", sparse[1]?.maxProjects === 3);
check("sparse 2-project page then tries both", sparse[2]?.achievements === 3 && sparse[2]?.maxProjects === 3);
check("restoring achievements does not keep the drop-achievements clamp", sparse[0]?.achievements !== 0);
check("third-project attempt still carries the skills clamp", sparse[1]?.compactSkills === 5);

const noCoursework = packClampAttempts({
  hasAchievements: true,
  hasCoursework: false,
  projectCount: 3,
  activeClamps: { achievements: 0 },
  achievementCount: 3,
});
check("missing coursework is the smallest pack", noCoursework.length === 1 && noCoursework[0]?.coursework === 1);

const full = packClampAttempts({
  hasAchievements: true,
  hasCoursework: true,
  projectCount: 3,
  activeClamps: {},
  achievementCount: 3,
});
check("a full page has nothing to pack", full.length === 0);

const achOnly = packClampAttempts({
  hasAchievements: true,
  hasCoursework: true,
  projectCount: 2,
  activeClamps: { maxExpBullets: 3 },
  achievementCount: 3,
});
check("achievements present → only add a third project", achOnly.length === 1 && achOnly[0]?.maxProjects === 3);
check("third-project pack keeps experience clamp", achOnly[0]?.maxExpBullets === 3);

const edu = `\\section{Education}
  \\resumeSubHeadingListStart
    \\resumeSubheading
      {Seneca Polytechnic}{Toronto, ON}
      {Honours Bachelor of Technology, Software Development}{08/2026}
  \\resumeSubHeadingListEnd
`;
const withCourse = insertCoursework(edu);
check("insertCoursework is idempotent", insertCoursework(withCourse) === withCourse);
check("insertCoursework names Database Design", /Database Design/.test(withCourse));
check("stripCoursework restores a coursework-free Education block", !/Relevant Coursework/.test(stripCoursework(withCourse)));

console.log(failures === 0 ? "all pack checks passed" : `${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
