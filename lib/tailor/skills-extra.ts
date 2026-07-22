/**
 * Additional VERIFIED skills beyond the master resume's four lines —
 * each grounded in the candidate's public repos or declared coursework.
 * These expand the pool the tailor may re-rank into the skills section
 * (all truthful, all checkable).
 *
 * provenance: repo | coursework
 */
export const EXTRA_SKILLS: { item: string; provenance: string }[] = [
  { item: "C++", provenance: "repo" },
  { item: "C", provenance: "repo" },
  { item: "Java", provenance: "coursework" },
  { item: "Git", provenance: "repo" },
  { item: "Agile/Scrum", provenance: "repo" },
  { item: "Jira", provenance: "coursework" },
  { item: "Stripe API", provenance: "repo" },
  { item: "Supabase", provenance: "repo" },
  { item: "Clerk Auth", provenance: "repo" },
  { item: "JWT Authentication", provenance: "repo" },
  { item: "Three.js / R3F", provenance: "repo" },
  { item: "WebSockets", provenance: "repo" },
  { item: "Zod", provenance: "repo" },
  { item: "Express.js", provenance: "repo" },
  { item: "Node.js", provenance: "repo" },
  { item: "Vercel", provenance: "repo" },
  { item: "Prompt Engineering", provenance: "repo" },
  { item: "LLM Evaluation", provenance: "repo" },
  { item: "Knowledge Graphs", provenance: "repo" },
  { item: "Spaced Repetition (SM-2)", provenance: "repo" },
  { item: "High Performance Computing", provenance: "coursework" },
  { item: "Parallel Algorithms", provenance: "coursework" },
  { item: "Computer Vision", provenance: "coursework" },
  { item: "Operating Systems", provenance: "coursework" },
  { item: "Data Structures & Algorithms", provenance: "coursework" },
  { item: "Blender bpy", provenance: "repo" },
  { item: "GLB/3D Asset Pipelines", provenance: "repo" },
  { item: "Database Design", provenance: "repo" },
  { item: "Query Optimization", provenance: "repo" },
  { item: "API Integration", provenance: "repo" },
];

export function extraSkillsPool(): string[] {
  return EXTRA_SKILLS.map((s) => s.item);
}
