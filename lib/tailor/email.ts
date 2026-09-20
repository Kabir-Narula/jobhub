import { PROJECTS } from "./projects";
import { model, openai, parseJson, type CompanyResearch } from "./research";

export interface EmailDraft {
  subject: string;
  body: string;
}

export type RecipientKind = "campus" | "recruiter" | "manager" | "engineer" | "unknown";

export interface EmailProject {
  name: string;
  url: string;
  oneLiner: string;
}

export const EMAIL_SIGNATURE = [
  "Kabir Narula",
  "Toronto, ON",
  "Kabirnar10@gmail.com | (647) 410-6699",
  "linkedin.com/in/kabir-narula-19b129260",
  "github.com/Kabir-Narula",
] as const;

const CANDIDATE = {
  fullName: "Kabir Narula",
  signOff: "Kabir",
  city: "Toronto",
  school: "Seneca Polytechnic",
  program: "Honours Bachelor of Technology, Software Development",
  grad: "August 2026",
  standing: "recent graduate, not a student",
  howHeSounds: [
    "Just graduated from Seneca Polytechnic in Toronto (Software Development, August 2026). He is a graduate in the market, never 'a student' or 'currently studying'.",
    "Recent intern: Python/FastAPI services + GitHub Actions at Seneca's INNWIL lab.",
    "Some freelance client work (Kotlin Android + React against shared APIs).",
    "Talks about his own products like a person, never like a resume bullet. VertexFlow = Git for 3D models, with a Linux/Blender worker behind a queue so the web app stays fast. BetterMind = a journaling app with mood tracking and an AI companion that already knows your entries.",
  ],
};

const SYSTEM_PROMPT = `You write a short email as Kabir Narula, 22, software graduate in Toronto. Write like a real person typing on a phone. Not a sales email. Not a cover letter. Not an apology.

WHAT ACTUALLY GETS READ (recruiters who sat through hundreds of these):
- 3 to 5 sentences. Two short paragraphs, then one question. Under 90 words.
- Why you're writing in sentence one (you applied for this exact role).
- One concrete thing you built, in spoken English. That is the only proof.
- Close with a yes/no question they can answer in three words. Not a task. Not permission to ignore you.
- Do not narrate that this is a cold email. Everyone knows.

WHO KABIR IS (do not invent extra biography):
- Graduated August 2026, Seneca Polytechnic, Software Development, Toronto. NOT a student.
- Intern: Python/FastAPI + CI/CD at Seneca's INNWIL lab
- Side products in spoken English: VertexFlow = Git for 3D files, Linux/Blender worker so the site doesn't freeze. BetterMind = journaling app whose companion remembers past entries.

HARD BANS (all of these read as ChatGPT in 2026):
- Apology theater: "out of the blue", "you don't know me", "I know you didn't ask", "no need to reply if this isn't useful", "sorry to bother", "I know you're busy", "silent row in the ATS", "put a name to it"
- Orders: "please glance", "when you have a chance", "a forward is enough", "look at the ATS", "easier than pulling it from the ATS"
- Cover-letter sludge: passionate, excited to contribute, great fit, leverage, utilize, I hope this finds you well, just reaching out
- Fake research: company metrics, "when I saw that you", Reddit, Glassdoor
- Resume bullets, tech lists, em-dashes, markdown, P.S., signing their name

LAYOUT:
Hi {First},

{1-2 sentences: I applied for {exact role} at {company}.}

{1-2 sentences: recent Seneca grad + ONE project in spoken English. GitHub URL only for an engineer, offered not pushed.}

{one yes/no question}

Thanks,

Formatter adds the signature. Do not write LinkedIn/phone/email.

THE QUESTION (pick one, keep it boring):
- "Is this still open?"
- "Are you the right person for this?"
Never "15 minutes of your time". Never "I'd love to chat". Never "let me know if you have any questions".

SUBJECT: "{role} - Kabir Narula"  (flat, not clever)

Copy this VOICE (facts can change, the flatness cannot):

Subject: Software Developer - Kabir Narula

Hi Jose,

I applied for the entry-level Software Developer role at Konrad.

I'm a recent Seneca grad in Toronto. I've been building BetterMind, a journaling app where the chat remembers your past entries instead of starting from scratch each time.

Is this still open?

Thanks,

---

Subject: Backend Engineer - Kabir Narula

Hi Devon,

Applied for Backend Engineer at Northline.

Just finished at Seneca. Side project is VertexFlow - Git for 3D files, with a Linux worker so the web app doesn't freeze. github.com/Kabir-Narula/Vertex_flow if you want a look.

Are you on that team?

Thanks,

Return JSON: {"subject":"...","body":"..."} with real newlines.`;

const FOLLOWUP_PROMPT = `You write a short follow-up as Kabir Narula (Seneca grad, August 2026, not a student). 3-4 sentences. No guilt. No apology theater.

Hi {First},

Applied {N} days ago for {role} at {company}. Still interested.

Is this still open?

Thanks,

BANNED: circling back, touching base, gentle reminder, did you get my email, out of the blue, no need to reply, I know you're busy, em-dashes, markdown, P.S.
Subject: "following up - {role}". Return JSON.`;

export interface DraftInput {
  job: { title: string; company: string; description: string };
  contact: { name: string; role: string; email: string; why?: string } | null;
  research: CompanyResearch | null;
  projects: EmailProject[];
  hasFinalDocs: boolean;
  candidateName: string;
}

export function classifyRecipient(role: string | undefined | null): RecipientKind {
  const t = role ?? "";
  if (/university|campus|early[- ]career|new[- ]?grad|student program|emerging talent|graduate program/i.test(t)) {
    return "campus";
  }
  if (/engineering manager|hiring manager|director|head of|team lead|tech lead|\bvp\b|vice president|\bcto\b|founder|\bmanager\b/i.test(t)) {
    return "manager";
  }
  if (/software|engineer|developer|swe|programmer|architect/i.test(t)) return "engineer";
  if (/recruit|talent|sourcer|staffing|people ops|\bhr\b|human resources/i.test(t)) {
    return "recruiter";
  }
  return "unknown";
}

/** Projects that actually appear on this job's tailored resume — spoken one-liners, not ATS bullets. */
export function projectsFromResumeTex(tex: string | null | undefined): EmailProject[] {
  const source = tex ?? "";
  const found = PROJECTS.filter((p) => source.includes(p.name));
  const picked = (found.length > 0 ? found : PROJECTS.filter((p) => p.id === "vertexflow" || p.id === "bettermind")).slice(0, 2);
  return picked.map((p) => ({ name: p.name, url: p.githubUrl, oneLiner: p.summary }));
}

function recipientFirst(contact: DraftInput["contact"]): string | null {
  const name = contact?.name?.trim();
  if (!name || /^unknown$/i.test(name)) return null;
  const first = name.split(/\s+/)[0];
  return first || null;
}

function researchForEmail(research: CompanyResearch | null) {
  if (!research) return null;
  const product = (research.product || "").trim();
  const hook = (research.hookFact || "").trim();
  const generic = /leading provider|world-class|cutting-edge|passionate about|innovative solutions/i;
  return {
    product: product && !generic.test(product) ? product : null,
    hookFact: hook && !generic.test(hook) && !/\d[\d,.]*\s*(billion|million|%|users|requests)/i.test(hook) ? hook : null,
    tone: research.tone ?? "casual",
  };
}

const CLOSE_BY_KIND: Record<RecipientKind, string> = {
  campus: "Close with: Is this still open?",
  recruiter: "Close with: Is this still open?",
  manager: "Close with: Are you the right person for this? or Is this still open?",
  engineer: "Close with: Are you on that team?",
  unknown: "Close with: Is this still open?",
};

const SIMPLE_QUESTION = "Is this still open?";
const COMMANDING_CLOSE =
  /appreciate a glance|when you have a chance|forward to the right person|if this role is on your team|please take a look|grateful if you took a look|look at the application|easier than (pulling it from )?the ats|easier than the ats|i'd be grateful if you|if you own this role|a glance when you have|15-minute|i'd love to (chat|connect)/i;
const FAKE_HUMILITY =
  /out of the blue|don'?t know me from anyone|you don'?t know me|i know you didn'?t ask|no need to reply if this isn'?t useful|sorry to bother|i know you'?re busy|silent row in the ats|put a name to it|weird to email someone|ignore this if it'?s not your world|anyway, ignore this/i;

function stripClerkTalk(p: string): string {
  let s = p
    .replace(/\s*Resume is attached in case it'?s easier than (pulling it from )?the ATS\.?/gi, "")
    .replace(/\s*in case (that'?s|it's) easier than (pulling it from )?the ATS\.?/gi, "")
    .replace(/\bthis is a bit out of the blue\.?\s*/gi, "")
    .replace(/\bsince you don'?t know me from anyone\.?\s*/gi, "")
    .replace(/,?\s*since you don'?t know me from anyone\.?/gi, "")
    .replace(/\bi know you didn'?t ask for this( note)?\.?\s*/gi, "")
    .replace(/\bno need to reply if this isn'?t useful\.?\s*/gi, "")
    .replace(/\bweird to email someone i'?ve never met\.?\s*/gi, "")
    .replace(/\band wanted to put a name to (it|the application),?\s*/gi, "");
  s = tidyLine(s).replace(/[,;:\s]+$/g, "");
  if (s && !/[.!?]$/.test(s)) s += ".";
  return s;
}
const CLOSE_RE = /^(thanks|thank you|best|cheers|regards|best regards|kind regards|warmly)[,!.]?$/i;
const SIGN_WITH_CLOSE_RE =
  /^(thanks|thank you|best|cheers|regards|best regards|kind regards|warmly)[,!]?\s+[A-Z][a-zA-Z'-]+[,!.]?$/i;

function tidyLine(s: string): string {
  return s
    .replace(/[—–]/g, " - ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,(?!\s|$)/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitParagraphs(text: string): string[] {
  const lines = text.split("\n").map((l) => tidyLine(l));
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks.map((linesInBlock) => tidyLine(linesInBlock.join(" "))).filter(Boolean);
}

function isSignName(para: string, opts: { signOff: string; recipientFirst: string | null }): boolean {
  const t = para.replace(/[,!.]+$/, "").trim();
  if (t.toLowerCase() === opts.signOff.toLowerCase()) return true;
  if (t.toLowerCase() === "kabir narula") return true;
  if (opts.recipientFirst && t.toLowerCase() === opts.recipientFirst.toLowerCase()) return true;
  return false;
}

function isSignatureDebris(para: string): boolean {
  const t = para.trim();
  if (/^kabir(\s+narula)?$/i.test(t.replace(/[,!.]+$/, ""))) return true;
  if (/^toronto,?\s*on$/i.test(t)) return true;
  if (/kabirnar10@gmail\.com/i.test(t) && t.length < 90) return true;
  if (/647[\s).-]*410[\s.-]*6699/.test(t) && t.length < 50) return true;
  if (/linkedin\.com\/in\/kabir-narula/i.test(t)) return true;
  if (/^(https?:\/\/(www\.)?)?github\.com\/Kabir-Narula\/?\s*$/i.test(t)) return true;
  return false;
}

function stripClichés(text: string): string {
  return text
    .replace(/^dear\s+[^,\n]+,?\s*/i, "")
    .replace(/\bi hope this (email )?finds you well[.,!]?\s*/gi, "")
    .replace(/\bjust (wanted to )?reach(?:ing)? out[.,!]?\s*/gi, "")
    .replace(/\b(circling back|touching base|gentle reminder)[.,!]?\s*/gi, "")
    .replace(/\bP\.?\s*S\.?:?[\s\S]*$/i, "")
    .replace(/^[.\s,;:]+$/gm, "");
}

/** If the model dumped one blob, split into apply / who-I-am / ask. */
function splitWall(para: string): string[] {
  const sentences =
    para.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((s) => tidyLine(s)).filter(Boolean) ?? [para];
  if (sentences.length <= 2) return sentences;
  if (sentences.length === 3) return sentences;
  return [sentences[0], sentences.slice(1, -1).join(" "), sentences[sentences.length - 1]];
}

function greetingLine(opts: { recipientFirst: string | null; company: string }): string {
  return opts.recipientFirst ? `Hi ${opts.recipientFirst},` : `Hi ${opts.company} team,`;
}

/**
 * Canonical layout (this is the source of truth, not the model):
 *
 * Hi Name,
 *                ← one blank line
 * paragraph
 *                ← one blank line
 * paragraph
 *                ← one blank line
 * Thanks,
 *
 * Kabir Narula
 * Toronto, ON
 * Kabirnar10@gmail.com | (647) 410-6699
 * linkedin.com/in/kabir-narula-19b129260
 * github.com/Kabir-Narula
 */
export function polishEmail(
  draft: EmailDraft,
  opts: { signOff: string; recipientFirst: string | null; company: string }
): EmailDraft {
  const subject = String(draft.subject ?? "")
    .replace(/^["']|["']$/g, "")
    .replace(/[—–]/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim();

  let text = String(draft.body ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/[*_]{1,2}([^*_\n]+)[*_]{1,2}/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
  text = stripClichés(text);

  const blocks = splitParagraphs(text);
  if (blocks[0] && /^hi\b/i.test(blocks[0])) {
    const rest = blocks[0].replace(/^hi\b[\s\S]*?,\s*/i, "").trim();
    if (rest) blocks[0] = rest;
    else blocks.shift();
  }

  while (blocks.length) {
    const last = blocks[blocks.length - 1];
    if (isSignName(last, opts) || CLOSE_RE.test(last) || SIGN_WITH_CLOSE_RE.test(last) || isSignatureDebris(last)) {
      blocks.pop();
      continue;
    }
    break;
  }

  let paras = blocks.filter((p) => !/^hi\b/i.test(p));
  if (paras.length === 1) paras = splitWall(paras[0]);
  paras = paras.map((p) => stripClerkTalk(p)).filter(Boolean).slice(0, 4);
  if (paras.length && (COMMANDING_CLOSE.test(paras[paras.length - 1]) || FAKE_HUMILITY.test(paras[paras.length - 1]))) {
    paras[paras.length - 1] = SIMPLE_QUESTION;
  }
  if (!paras.some((p) => /\?\s*$/.test(p))) paras.push(SIMPLE_QUESTION);
  if (paras.length === 0) paras = [SIMPLE_QUESTION];

  const parts = [greetingLine(opts)];
  for (const p of paras) {
    parts.push("", p);
  }
  if (paras.length === 0) {
    parts.push("", SIMPLE_QUESTION);
  }
  parts.push("", "Thanks,", "", ...EMAIL_SIGNATURE);

  return { subject, body: parts.join("\n") };
}

function fallbackDraft(input: DraftInput, _kind: RecipientKind, first: string | null): EmailDraft {
  const project = input.projects[0];
  const who = project
    ? `I just graduated from Seneca in Toronto. I've been building ${project.name} - ${project.oneLiner.replace(/\.$/, "")}.`
    : "I just graduated from Seneca in Toronto (Software Development, August 2026).";
  const body = [
    first ? `Hi ${first},` : `Hi ${input.job.company} team,`,
    "",
    `I applied for ${input.job.title} at ${input.job.company}.`,
    "",
    who,
    "",
    SIMPLE_QUESTION,
    "",
    "Thanks,",
    CANDIDATE.signOff,
  ].join("\n");
  return { subject: `${input.job.title} - ${CANDIDATE.fullName}`, body };
}

async function completeJson(system: string, user: unknown, tier: "quality" | "cheap"): Promise<EmailDraft | null> {
  const res = await openai().chat.completions.create({
    model: model(tier),
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    response_format: { type: "json_object" },
  });
  const parsed = parseJson(res.choices[0]?.message?.content ?? "{}");
  const subject = typeof parsed.subject === "string" ? parsed.subject : "";
  const body = typeof parsed.body === "string" ? parsed.body : "";
  if (!body.trim()) return null;
  return { subject, body };
}

function userPayload(input: DraftInput, extra: Record<string, unknown> = {}) {
  const first = recipientFirst(input.contact);
  const kind = classifyRecipient(input.contact?.role);
  return {
    write_as: CANDIDATE,
    never_call_him_a_student: true,
    recipient: input.contact
      ? {
          firstName: first,
          fullName: input.contact.name,
          role: input.contact.role,
          kind,
          whyThisInbox: input.contact.why ?? CLOSE_BY_KIND[kind],
          greeting: first ? `Hi ${first},` : `Hi ${input.job.company} team,`,
        }
      : { kind: "unknown" as const, greeting: `Hi ${input.job.company} team,`, whyThisInbox: CLOSE_BY_KIND.unknown },
    job: { title: input.job.title, company: input.job.company },
    role_in_one_line: input.job.description.replace(/\s+/g, " ").trim().slice(0, 400),
    company_for_optional_interest: researchForEmail(input.research),
    talk_about_at_most_one_of_these_projects: input.projects,
    already_applied_online: true,
    close_is_a_yes_no_question: CLOSE_BY_KIND[kind],
    sign_off_exactly: "Thanks,",
    spacing: "one blank line between greeting / paragraphs / Thanks. Do not write a signature; the formatter appends full name, email, phone, LinkedIn, GitHub.",
    ...extra,
  };
}

export async function draftOutreachEmail(input: DraftInput): Promise<EmailDraft> {
  const first = recipientFirst(input.contact);
  const kind = classifyRecipient(input.contact?.role);
  const generated = await completeJson(SYSTEM_PROMPT, userPayload(input), "quality");
  const raw = generated ?? fallbackDraft(input, kind, first);
  if (!raw.subject.trim()) {
    raw.subject = `${input.job.title} - ${CANDIDATE.fullName}`;
  }
  return polishEmail(raw, { signOff: CANDIDATE.signOff, recipientFirst: first, company: input.job.company });
}

/** Follow-up nudge N days after applying with no response. */
export async function draftFollowUpEmail(input: DraftInput & { daysSinceApplied: number }): Promise<EmailDraft> {
  const first = recipientFirst(input.contact);
  const generated = await completeJson(
    FOLLOWUP_PROMPT,
    userPayload(input, { days_since_applied: input.daysSinceApplied, do_not_invent_new_work: true }),
    "quality"
  );
  const raw =
    generated ??
    ({
      subject: `following up - ${input.job.title}`,
      body: [
        first ? `Hi ${first},` : `Hi ${input.job.company} team,`,
        "",
        `Applied about ${input.daysSinceApplied} days ago for ${input.job.title}. Still interested.`,
        "",
        SIMPLE_QUESTION,
        "",
        "Thanks,",
        CANDIDATE.signOff,
      ].join("\n"),
    } satisfies EmailDraft);
  if (!raw.subject.trim()) raw.subject = `following up - ${input.job.title}`;
  return polishEmail(raw, { signOff: CANDIDATE.signOff, recipientFirst: first, company: input.job.company });
}
