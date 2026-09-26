/**
 * Verified TRUE numbers from the candidate's real material — every one is
 * defensible in an interview because it comes from the master's own content
 * or user-supplied facts. The writer may use these; the fabrication
 * tripwire whitelists them.
 */
export const VERIFIED_NUMBERS: { fact: string; usage: string }[] = [
  { fact: "4-service Turborepo architecture (VertexFlow)", usage: "a 4-service Turborepo platform" },
  { fact: "13-table Prisma/PostgreSQL schema (BetterMind)", usage: "a 13-table Prisma/PostgreSQL schema" },
  { fact: "4-developer Agile team (Expense Manager)", usage: "in a 4-developer Agile team" },
  { fact: "2 freelance client engagements (Project Human City, Three of Cups)", usage: "across 2 freelance client engagements" },
  { fact: "$2,000 academic excellence scholarship, twice", usage: "a $2,000 scholarship awarded twice" },
  { fact: "10+ freelance and personal software projects", usage: "10+ delivered software projects" },
  { fact: "20+ open departmental requests tracked in Excel (Student Services)", usage: "an Excel tracker covering 20+ open departmental items" },
  { fact: "top 5 recurring process questions standardized into a faculty notice", usage: "the top 5 recurring process questions" },
  { fact: "peer-mentor groups of 8-12 incoming students", usage: "groups of 8-12 incoming students" },
];

export function verifiedNumbersBrief(): string {
  return VERIFIED_NUMBERS.map((n) => `- ${n.fact} (phrase it like: "${n.usage}")`).join("\n");
}

/** Included in the fabrication tripwire's source text so these numbers pass. */
export function verifiedNumbersText(): string {
  return VERIFIED_NUMBERS.map((n) => n.fact).join(" ");
}
