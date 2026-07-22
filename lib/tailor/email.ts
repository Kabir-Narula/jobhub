import { model, openai, type CompanyResearch } from "./research";

export interface EmailDraft {
  subject: string;
  body: string;
}

const SYSTEM_PROMPT = `You write cold outreach emails that actually get replies, distilled from thousands of real recruiter and candidate accounts (recruiter AMAs, r/recruitinghell, r/jobs, r/cscareerquestions post-mortems of what worked).

WHAT WORKS (proven, repeatedly):
- TOTAL length: 3-5 sentences, under 120 words. Recruiters give a cold email <15 seconds.
- Subject line: specific, never generic. Exact role + one concrete differentiator or hook. Bad: "Job inquiry". Good: "new grad SWE - distributed systems project - applying to {role}".
- First line proves you know THEM: one specific, real thing about their team/product/bet (from the research provided). Not "I love your company".
- ONE proof point mapped to the role's top requirement — a real project or experience in a single clause. Not a resume dump.
- State that you applied (or are applying now) with resume attached, then ONE small, easy-to-answer ask (e.g. "is the team still reviewing new-grad applications?" or "happy to send the repo if useful").
- Sign-off: first name only.
- If candidate experiences on Reddit mention what this company responds to (referrals, specific teams, process quirks), use that angle.

WHAT FAILS (never do these):
- "Dear Sir/Madam", "I hope this email finds you well", "To whom it may concern".
- Life story, "passionate", "fast-paced", generic flattery, asking for a referral outright.
- Multiple questions, buzzword stacks, exclamation marks, emoji.
- Repeating the cover letter — the email complements it; the cover letter and resume do the heavy lifting.

Voice: a polite, direct, technically-sharp new-grad engineer who respects the reader's time. Plain text, no markdown. Return the result as JSON.`;

interface DraftInput {
  job: { title: string; company: string; description: string };
  contact: { name: string; role: string; email: string } | null;
  research: CompanyResearch | null;
  resumeHighlights: string[]; // top bullets from the FINAL resume
  hasFinalDocs: boolean;
  candidateName: string;
}

export async function draftOutreachEmail(input: DraftInput): Promise<EmailDraft> {
  const recipientFirst = input.contact?.name && input.contact.name !== "Unknown" ? input.contact.name.split(" ")[0] : null;

  const user = {
    task: "Write the outreach email (subject + body) for this application.",
    recipient: input.contact
      ? { name: input.contact.name, role: input.contact.role, greetByFirstName: Boolean(recipientFirst) }
      : "Hiring team (no specific person)",
    job: { title: input.job.title, company: input.job.company, top_requirements: input.job.description.slice(0, 1500) },
    company_research: input.research
      ? { summary: input.research.summary, mission: input.research.mission, product: input.research.product, news: input.research.news, reddit_candidate_experiences: input.research.redditIntel ?? null }
      : null,
    candidate_proof_points_from_final_resume: input.resumeHighlights,
    candidate_applied_with_tailored_resume_and_cover: input.hasFinalDocs,
    output_schema: { subject: "string", body: "string (plain text, blank line between paragraphs)" },
    rules: "Under 120 words for the body. 3-5 sentences. Sign off as " + input.candidateName.split(" ")[0] + ".",
  };

  const res = await openai().chat.completions.create({
    model: model(),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(user) },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
  return {
    subject: String(parsed.subject ?? `${input.job.title} at ${input.job.company}`),
    body: String(parsed.body ?? ""),
  };
}
