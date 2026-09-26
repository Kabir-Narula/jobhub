/**
 * Verified personal achievements supplied by the user — inserted
 * deterministically (never LLM-reworded, so the facts can't drift).
 */
export const ACHIEVEMENTS: string[] = [
  "Awarded a \\$2{,}000 scholarship for academic excellence by Seneca Polytechnic — received twice.",
  "Reached the finals of the Seneca Polytechnic Hackathon with a working software prototype.",
  "Designed and delivered 10+ freelance and personal software projects for real clients, from web platforms to mobile apps.",
];

/**
 * When the posting itself asks for hackathon / academic / self-directed
 * evidence, keep Achievements through compression instead of dropping them first.
 */
export function jdSignalsAchievements(description: string): boolean {
  return /\b(hackathons?|scholarship|academic excellence|self[- ]directed|competitive pursuits?|extracurricular|dedication and follow[- ]through|relentless effort|rigorous academic projects|intense work ethic|personal initiative|high motivation|client[- ]first)\b/i.test(
    description
  );
}