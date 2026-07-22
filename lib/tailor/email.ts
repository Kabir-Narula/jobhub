import { model, openai, parseJson, type CompanyResearch } from "./research";

export interface EmailDraft {
  subject: string;
  body: string;
}

const SYSTEM_PROMPT = `You write cold outreach emails that actually get replies, distilled from thousands of real recruiter and candidate accounts (recruiter AMAs, r/recruitinghell, r/jobs, r/cscareerquestions post-mortems of what worked).

WHAT WORKS (proven, repeatedly):
- TOTAL length: 3-5 sentences, under 110 words. Recruiters give a cold email <15 seconds.
- This is a GENUINE FOLLOW-UP, not an application: the candidate has ALREADY APPLIED online. The email exists to put a human name on the file.
- Subject line: specific, human, references the exact role. Bad: "Job inquiry" / "Application for X". Good: "Applied for {role} - quick note from a new-grad SWE".
- Frame (use this arc, naturally): you applied for {role} and wanted to reach out personally; attach your resume here too in case it's useful; one specific reason THIS company/team genuinely interests you (from the research - never "I love your company"); the ask is small and respectful of their time: "if you get a minute, I'd really appreciate a look at my online application - and if you're not the right person for this one, a forward to whoever owns the role would mean a lot."
- One proof point woven into the company hook (a single clause, real project/experience mapped to the team's world). Not a resume dump.
- Sign-off: first name only.
- If candidate experiences on Reddit mention what this company responds to (referrals, specific teams, process quirks), use that angle.

WHAT FAILS (never do these):
- "Dear Sir/Madam", "I hope this email finds you well", "To whom it may concern".
- Sounding like a template, a sales pitch, or a cover letter condensed. This should read like a real person wrote it in 2 minutes.
- Groveling or double-asking (one ask only), buzzword stacks, exclamation marks, emoji, "passionate", life story.
- Demanding a reply, or implying they owe a response.

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
    task: "Write the genuine follow-up outreach email (subject + body): the candidate has ALREADY APPLIED online for this role and is reaching out personally, resume attached, asking for a look at their online application - or a forward to the right recruiter if this person isn't it.",
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
    rules: "Under 110 words for the body. 3-5 sentences. Sign off as " + input.candidateName.split(" ")[0] + ".",
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
