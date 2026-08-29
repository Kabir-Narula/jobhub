/**
 * Additional VERIFIED skills beyond the master resume's four lines —
 * each grounded in the candidate's public repos or declared coursework.
 * These expand the pool the tailor may re-rank into the skills section
 * (all truthful, all checkable).
 *
 * provenance: repo | coursework
 * label: the master skills line this item belongs under — the assembler
 * enforces it, so an item can never drift under a wrong heading
 * (Agile/Scrum under "ML & Infra" was the bug that motivated this).
 *
 * Coursework CONCEPTS (Operating Systems, Parallel Algorithms, etc.) are
 * deliberately absent: they live in the Education coursework line, which
 * ATS parsers already index — duplicating them in Skills is redundant.
 */

/** Master skills labels (must match Resume.tex after unescaping &). */
export type SkillsLabel = "Languages" | "Infra & Tools" | "Frameworks" | "Cloud & Data";

export const EXTRA_SKILLS: { item: string; provenance: string; label: SkillsLabel }[] = [
  { item: "C++", provenance: "repo", label: "Languages" },
  { item: "C", provenance: "repo", label: "Languages" },
  { item: "Java", provenance: "coursework", label: "Languages" },
  { item: "Git", provenance: "repo", label: "Infra & Tools" },
  { item: "Agile/Scrum", provenance: "repo", label: "Infra & Tools" },
  { item: "Jira", provenance: "coursework", label: "Infra & Tools" },
  { item: "Stripe API", provenance: "repo", label: "Frameworks" },
  { item: "Clerk Auth", provenance: "repo", label: "Frameworks" },
  { item: "JWT Authentication", provenance: "repo", label: "Frameworks" },
  { item: "Three.js / R3F", provenance: "repo", label: "Frameworks" },
  { item: "WebSockets", provenance: "repo", label: "Frameworks" },
  { item: "Zod", provenance: "repo", label: "Frameworks" },
  { item: "Express.js", provenance: "repo", label: "Frameworks" },
  { item: "Node.js", provenance: "repo", label: "Frameworks" },
  { item: "Blender bpy", provenance: "repo", label: "Frameworks" },
  { item: "Supabase", provenance: "repo", label: "Cloud & Data" },
  { item: "Vercel", provenance: "repo", label: "Cloud & Data" },
  { item: "Prompt Engineering", provenance: "repo", label: "Cloud & Data" },
  { item: "LLM Evaluation", provenance: "repo", label: "Cloud & Data" },
  { item: "Knowledge Graphs", provenance: "repo", label: "Cloud & Data" },
  { item: "Spaced Repetition (SM-2)", provenance: "repo", label: "Cloud & Data" },
  { item: "GLB/3D Asset Pipelines", provenance: "repo", label: "Cloud & Data" },
  { item: "Database Design", provenance: "repo", label: "Cloud & Data" },
  { item: "Query Optimization", provenance: "repo", label: "Cloud & Data" },
  { item: "API Integration", provenance: "repo", label: "Cloud & Data" },
];

export function extraSkillsPool(): string[] {
  return EXTRA_SKILLS.map((s) => s.item);
}

/** lowercased item -> canonical skills line label. */
export function extraSkillLabels(): Map<string, SkillsLabel> {
  return new Map(EXTRA_SKILLS.map((s) => [s.item.toLowerCase(), s.label]));
}
