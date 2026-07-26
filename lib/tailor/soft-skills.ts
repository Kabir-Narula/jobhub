/**
 * Soft skills are safe ATS territory: universally claimed, unverifiable,
 * zero interview risk. Only JD-relevant ones get listed (a "Professional"
 * line tuned per posting) — never the whole generic list.
 */
const SOFT_SKILLS: { item: string; re: RegExp }[] = [
  { item: "Communication", re: /communicat/i },
  { item: "Cross-functional Collaboration", re: /collaborat|cross[- ]functional|partner/i },
  { item: "Problem Solving", re: /problem[- ]solving|solve complex|debug/i },
  { item: "Adaptability", re: /adaptab|fast[- ]paced|changing priorities/i },
  { item: "Attention to Detail", re: /detail|accuracy|quality/i },
  { item: "Time Management", re: /deadline|prioriti|time management|manage multiple/i },
  { item: "Stakeholder Communication", re: /stakeholder|non-technical|translate|executive/i },
  { item: "Ownership", re: /own(er|ership)|autonom|independen|self[- ]driven|proactive/i },
  { item: "Curiosity & Fast Learning", re: /curious|learn|mentor/i },
  { item: "Analytical Thinking", re: /analytical|analysis|data[- ]driven/i },
  { item: "Mentoring", re: /mentor|junior|guidance/i },
  { item: "Presentation & Demos", re: /present|demo|walkthrough/i },
];

/** Soft skills that THIS posting actually asks for, capped at 5. */
export function softSkillsFor(jobDescription: string): string[] {
  return SOFT_SKILLS.filter((s) => s.re.test(jobDescription)).map((s) => s.item).slice(0, 5);
}
