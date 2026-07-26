import { model, openai, parseJson, type CompanyResearch } from "./research";

export interface EmailDraft {
  subject: string;
  body: string;
}

const SYSTEM_PROMPT = `You write cold outreach emails in the EXACT voice of a smart 22-year-old engineer writing quickly but carefully. Not a PR person, not a template — a real person who read about the company for ten minutes and had one genuine reason to write.

FORMAT (exact structure, blank line between every block):
Hi {FirstName or "{Company} team"},

{hook paragraph: 2-3 sentences max}

{proof paragraph: 1-2 sentences max}

{ask: 1-2 sentences}

{FirstName}

{optional single P.S. line}

AUTHENTICITY RULES (what makes it feel written, not generated):
- The hook MUST contain ONE specific true fact about the company from the research (a number, a product detail, a recent move) — e.g. "processing 6 billion API requests a day" — and connect it in one breath to something the candidate actually built. Never paraphrase the job description back at them.
- The proof paragraph names ONE concrete artifact (a service, a queue, a schema, a repo) — never a list of technologies. NEVER use a rule-of-three stack ("X, Y, and Z") anywhere.
- Write like a human: contractions, short direct sentences, one small honest hedge is fine ("I might be wrong, but..."). No em-dash chains, no buzzwords, no adjectives doing a noun's job.
- The ask is small and gives an easy out.
- Subject line: plain, specific, human. "quick note re: {role}" or "applied for {role} - one question". Never "Application for employment".
- Under 100 words total for the body. If it feels long, cut.
- Named recipient: "Hi {FirstName},". Generic inbox: "Hi {Company} team,". Never "Dear", never "To whom it may concern".

Voice: a real new-grad engineer, respectful but not stiff. Plain text, no markdown. Return the result as JSON.`;

const FOLLOWUP_PROMPT = `You write polite follow-up emails in the voice of a real 22-year-old engineer — brief, warm, never needy.

FORMAT (exact structure):
Hi {FirstName or "{Company} team"},

{1-2 sentences: applied {days} days ago for {role}, still very interested, one quick new thing if available}

{1 sentence: soft status check with an easy out}

{FirstName}

RULES:
- Under 70 words. Short sentences, contractions.
- BANNED: "just bumping this", "circling back", "touching base", "gentle reminder", "did you get my email", guilt-tripping, desperation. Return the result as JSON.`;

interface DraftInput {
  job: { title: string; company: string; description: string };
  contact: { name: string; role: string; email: string } | null;
  research: CompanyResearch | null;
  resumeHighlights: string[]; // top bullets from the FINAL resume
  projectLinks?: { name: string; url: string }[];
  hasFinalDocs: boolean;
  candidateName: string;
}

export async function draftOutreachEmail(input: DraftInput): Promise<EmailDraft> {
  const recipientFirst = input.contact?.name && input.contact.name !== "Unknown" ? input.contact.name.split(" ")[0] : null;

  const user = {
    task: "Write the genuine follow-up outreach email (subject + body): the candidate has ALREADY APPLIED online for this role and is reaching out personally, resume attached, asking for a look at their online application - or a forward to the right recruiter if this person isn't it.",
    recipient: input.contact
      ? { name: input.contact.name, role: input.contact.role, greetByFirstName: Boolean(recipientFirst) }
      : "Hiring team (no specific person)",
    job: { title: input.job.title, company: input.job.company, top_requirements: input.job.description.slice(0, 1500) },
    company_research: input.research
      ? { summary: input.research.summary, hookFact: input.research.hookFact ?? null, news: input.research.news, reddit_candidate_experiences: input.research.redditIntel ?? null }
      : null,
    candidate_proof_points_from_final_resume: input.resumeHighlights,
    candidate_project_links: input.projectLinks ?? [],
    candidate_applied_with_tailored_resume_and_cover: input.hasFinalDocs,
    output_schema: { subject: "string", body: "string (exact block structure from the system prompt, blank line between every block)" },
    rules: "Body under 100 words. Sign-off name: " + input.candidateName.split(" ")[0] + ".",
  };

  const res = await openai().chat.completions.create({
    model: model("cheap"),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(user) },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = parseJson(res.choices[0]?.message?.content ?? "{}");
  return {
    subject: String(parsed.subject ?? `${input.job.title} at ${input.job.company}`),
    body: String(parsed.body ?? ""),
  };
}

/** Follow-up nudge N days after applying with no response. */
export async function draftFollowUpEmail(input: DraftInput & { daysSinceApplied: number }): Promise<EmailDraft> {
  const user = {
    task: `Write a short follow-up email: the candidate applied ${input.daysSinceApplied} days ago and has heard nothing. Polite status check.`,
    recipient: input.contact
      ? { name: input.contact.name, role: input.contact.role }
      : "Hiring team (no specific person)",
    job: { title: input.job.title, company: input.job.company },
    company_research_summary: input.research?.summary ?? null,
    candidate_proof_point: input.resumeHighlights[0] ?? null,
    output_schema: { subject: "string", body: "string (plain text)" },
    rules: "Under 80 words. 2-4 sentences. Sign off as " + input.candidateName.split(" ")[0] + ".",
  };

  const res = await openai().chat.completions.create({
    model: model("cheap"),
    messages: [
      { role: "system", content: FOLLOWUP_PROMPT },
      { role: "user", content: JSON.stringify(user) },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = parseJson(res.choices[0]?.message?.content ?? "{}");
  return {
    subject: String(parsed.subject ?? `Following up - ${input.job.title} at ${input.job.company}`),
    body: String(parsed.body ?? ""),
  };
}
