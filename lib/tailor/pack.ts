/**
 * After a 1-page compile, leftover vertical room should be packed with
 * content we already have — Achievements and a third library project.
 * No LLM: the compress ladder often overshoots (drops Achievements on the
 * first rung) then skips expand, which is what left Intact at 86% fill.
 */

export type FillClamps = {
  compactSkills?: number;
  maxExpBullets?: number;
  maxProjBullets?: number;
  maxProjects?: number;
  achievements?: number;
  coursework?: number;
};

/**
 * Clamp overrides to try, smallest addition first. Caller compiles each and
 * keeps the fullest version that is still one page.
 */
export function packClampAttempts(args: {
  hasAchievements: boolean;
  hasCoursework: boolean;
  projectCount: number;
  activeClamps: FillClamps;
  achievementCount: number;
}): FillClamps[] {
  const { hasAchievements, hasCoursework, projectCount, activeClamps, achievementCount } = args;
  const attempts: FillClamps[] = [];
  if (!hasCoursework) {
    attempts.push({ ...activeClamps, coursework: 1 });
  }
  if (!hasAchievements) {
    attempts.push({ ...activeClamps, achievements: achievementCount });
  }
  if (projectCount < 3) {
    attempts.push({ ...activeClamps, maxProjects: 3 });
  }
  if (!hasAchievements && projectCount < 3) {
    attempts.push({ ...activeClamps, achievements: achievementCount, maxProjects: 3 });
  }
  return attempts;
}
