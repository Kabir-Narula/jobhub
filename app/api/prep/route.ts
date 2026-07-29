import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { model, openai, parseJson, type CompanyResearch } from "@/lib/tailor/research";

export const maxDuration = 120;

interface PrepPack {
  themes: string[];
  companyTalkingPoints: string[];
  yourStories: string[];
  questionsToAsk: string[];
}

/** Interview prep pack for an application that reached INTERVIEWING. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const applicationId = String(body?.applicationId ?? "");
  if (!applicationId) return NextResponse.json({ error: "applicationId required" }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { job: true } });
  if (!app) return NextResponse.json({ error: "application not found" }, { status: 404 });

  if (app.researchNotes && !body?.force) {
    // researchNotes is machine-written JSON but user-editable via PATCH — a
    // hand-written note must not 500 the prep route.
    try {
      return NextResponse.json({ prep: JSON.parse(app.researchNotes) as PrepPack, cached: true });
    } catch {
      // fall through and regenerate
    }
  }

  const research = (app.job.companyResearch as unknown as CompanyResearch | null) ?? null;
  const resume = await prisma.documentVersion.findFirst({
    where: { jobId: app.jobId, kind: "RESUME" },
    orderBy: { version: "desc" },
  });

  const bullets: string[] = [];
  if (resume) {
    const re = /\\resumeItem\{((?:[^{}]|\{[^{}]*\})*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(resume.texContent)) && bullets.length < 8) {
      bullets.push(m[1].replace(/\\([&%$#_{}])/g, "$1"));
    }
  }

  const user = {
    task: "Build an interview prep pack for this candidate for this company. Be concrete — everything must come from the provided research, Reddit candidate reports, and the candidate's real resume content.",
    role: { title: app.job.title, company: app.job.company, description: app.job.description.slice(0, 3000) },
    company_research: research,
    candidate_resume_bullets: bullets,
    candidate_notes: app.notes,
    output_schema: {
      themes: ["4-6 likely question themes for THIS role at THIS company (technical + behavioral), each with a one-line reason why"],
      companyTalkingPoints: ["4-5 specific things to say about the company that sound researched (their product, metrics, culture, recent moves)"],
      yourStories: ["4-5 STAR-format stories from the candidate's REAL experience/projects, each mapped to a likely question (situation + the artifact, not invented)"],
      questionsToAsk: ["4-5 smart questions to ask the interviewer that signal genuine engagement with this team"],
    },
  };

  const res = await openai().chat.completions.create({
    model: model("quality"),
    messages: [
      {
        role: "system",
        content:
          "You prepare candidates for interviews. Everything must be grounded in the provided research and the candidate's real resume — never invent projects, metrics, or experiences. Practical, specific, no generic advice. Return the result as JSON.",
      },
      { role: "user", content: JSON.stringify(user) },
    ],
    response_format: { type: "json_object" },
  });

  const prep = parseJson(res.choices[0]?.message?.content ?? "{}") as PrepPack;
  await prisma.application.update({
    where: { id: app.id },
    data: { researchNotes: JSON.stringify(prep) },
  });
  return NextResponse.json({ prep, cached: false });
}
