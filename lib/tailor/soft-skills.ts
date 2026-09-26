/**
 * Soft skills are safe ATS territory: universally claimed, unverifiable,
 * zero interview risk. Only JD-relevant ones get listed (a "Professional"
 * line tuned per posting) — never the whole generic list.
 */
const SOFT_SKILLS: { item: string; re: RegExp }[] = [
  { item: "Communication", re: /communicat/i },
  { item: "Client Focus", re: /client[- ]first|client relationships|client decision|inform client/i },
  { item: "Cross-functional Collaboration", re: /collaborat|cross[- ]functional|partner|working in teams/i },
  { item: "Problem Solving", re: /problem[- ]solving|solve complex|debug|problem-solving approach/i },
  { item: "Adaptability", re: /adaptab|fast[- ]paced|changing priorities|emotional intelligence/i },
  { item: "Attention to Detail", re: /detail|accuracy|quality[- ]focused/i },
  { item: "Time Management", re: /deadline|prioriti|time management|manage multiple|planning and organizing/i },
  { item: "Stakeholder Communication", re: /stakeholder|non-technical|translate|executive|oral and written/i },
  { item: "Ownership", re: /own(er|ership)|autonom|independen|self[- ]driven|proactive|personal initiative|take responsibility/i },
  { item: "Curiosity & Fast Learning", re: /curious|fast learner|learning agility|growth mindset/i },
  { item: "Analytical Thinking", re: /\banalytical\b|data[- ]driven|critical thinking|analytic and quantitative/i },
  { item: "Mentoring", re: /\bmentor(?:ing|ship)?\b|junior developers?|coach(?:ing)?\b|guide and mentor/i },
  { item: "Presentation & Demos", re: /\bpresent(?:ation|ing)?\b|\bdemos?\b|walkthrough|oral and written presentations/i },
];

/** Soft skills that THIS posting actually asks for, capped at 4. */
export function softSkillsFor(jobDescription: string, _family?: "consulting" | "analyst" | "product"): string[] {
  const fromJd = SOFT_SKILLS.filter((s) => s.re.test(jobDescription)).map((s) => s.item);
  return fromJd.slice(0, 4);
}
