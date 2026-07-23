"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BUCKET_LABEL, WORKMODE_LABEL } from "@/components/jobs/labels";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Loader2,
  Mail,
  MailSearch,
  PenLine,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { LocationBucket, WorkMode } from "@prisma/client";
import { DiffView } from "./diff-view";
import { EmailDialog } from "./email-dialog";

interface JobInfo {
  id: string;
  title: string;
  company: string;
  locationRaw: string;
  applyUrl: string;
  description: string;
  bucket: LocationBucket;
  workMode: WorkMode;
}

export interface Research {
  mission: string;
  product: string;
  stack: string[];
  news: string[];
  summary: string;
  homepageUsed: string | null;
}

export interface ContactInfo {
  name: string;
  role: string;
  email: string;
  confidence: number;
  deliverability: "valid" | "accept_all" | "unknown";
  sources: string[];
  patternDerived?: boolean;
}

export interface ContactsData {
  domain: string;
  contacts: ContactInfo[];
  searchedAt: string;
}

export interface DocMeta {
  id: string;
  kind: "RESUME" | "COVER";
  version: number;
  status: string;
  pageCount: number;
  matchScore: number | null;
  createdAt: string;
  titleChangeNote: string;
}

interface GenerateResult {
  resume: { id: string; version: number; pageCount: number; matchScore: number; fillPct?: number; missingKeywords?: string[]; diff: string };
  cover: { id: string; version: number; pageCount: number; diff: string };
  warnings: string[];
  appliedTitleChanges?: { company: string; from: string; to: string }[];
  pendingTitleChanges: { company: string; from: string; to: string }[];
  chosenProjects?: string[];
}

export function TailorClient({
  job,
  initialDocuments,
  initialResearch,
  initialContacts,
  hasApplication,
}: {
  job: JobInfo;
  initialDocuments: DocMeta[];
  initialResearch: Research | null;
  initialContacts: ContactsData | null;
  hasApplication: boolean;
}) {
  const router = useRouter();
  const [research, setResearch] = useState<Research | null>(initialResearch);
  const [contacts, setContacts] = useState<ContactsData | null>(initialContacts);
  const [findingContacts, setFindingContacts] = useState(false);
  const [researching, setResearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [documents, setDocuments] = useState<DocMeta[]>(initialDocuments);
  const [showJd, setShowJd] = useState(false);
  const [diffFor, setDiffFor] = useState<{ id?: string; label: string; diff: string } | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [emailFor, setEmailFor] = useState<{ name: string; role: string; email: string } | null>(null);

  async function findContacts(force: boolean) {
    setFindingContacts(true);
    try {
      const res = await fetch("/api/contacts/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, force }),
      });
      const data = await res.json();
      if (res.ok) setContacts({ domain: data.domain, contacts: data.contacts, searchedAt: data.searchedAt });
      else toast.error(data.error ?? "Contact search failed");
    } catch {
      toast.error("Contact search failed");
    }
    setFindingContacts(false);
  }

  async function runResearch(force: boolean) {
    setResearching(true);
    try {
      const res = await fetch("/api/tailor/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, force }),
      });
      const data = await res.json();
      if (res.ok) setResearch(data.research);
      else toast.error(data.error ?? "Research failed");
    } catch {
      toast.error("Research failed");
    }
    setResearching(false);
  }

  async function generate(opts: { allowTitleChanges?: boolean; deepResearch?: boolean } = {}) {
    setGenerating(true);
    toast.loading(
      opts.deepResearch ? "Deep-researching company, rewriting, compiling… (60–120s)" : "Researching, rewriting, compiling LaTeX… (30–90s)",
      { id: "gen" }
    );
    try {
      const res = await fetch("/api/tailor/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, allowTitleChanges: opts.allowTitleChanges ?? true, deepResearch: opts.deepResearch ?? false }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Generation failed", { id: "gen" });
      } else {
        toast.success("Draft documents generated", { id: "gen" });
        setResult(data);
        setFinalized(false);
        const now = new Date().toISOString();
        setDocuments((ds) => [
          {
            id: data.resume.id,
            kind: "RESUME",
            version: data.resume.version,
            status: "DRAFT",
            pageCount: data.resume.pageCount,
            matchScore: data.resume.matchScore,
            createdAt: now,
            titleChangeNote: "",
          },
          {
            id: data.cover.id,
            kind: "COVER",
            version: data.cover.version,
            status: "DRAFT",
            pageCount: data.cover.pageCount,
            matchScore: null,
            createdAt: now,
            titleChangeNote: "",
          },
          ...ds,
        ]);
        if (data.research) setResearch(data.research);
      }
    } catch {
      toast.error("Generation failed", { id: "gen" });
    }
    setGenerating(false);
  }

  async function finalize() {
    if (!result) return;
    const res = await fetch("/api/tailor/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, resumeId: result.resume.id, coverId: result.cover.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setFinalized(true);
      setDocuments((ds) => ds.map((d) => (d.id === result.resume.id || d.id === result.cover.id ? { ...d, status: "FINAL" } : d)));
      toast.success(
        data.linkedToApplication
          ? "Finalized and attached to your tracked application."
          : "Finalized. They'll attach when you track the application."
      );
    } else {
      toast.error("Finalize failed");
    }
  }

  async function viewDiffForDoc(doc: DocMeta) {
    if (result && (doc.id === result.resume.id || doc.id === result.cover.id)) {
      setDiffFor({
        label: `${doc.kind === "RESUME" ? "Resume" : "Cover letter"} v${doc.version}`,
        diff: doc.id === result.resume.id ? result.resume.diff : result.cover.diff,
      });
      return;
    }
    const res = await fetch(`/api/documents/${doc.id}/tex`);
    const data = await res.json();
    setDiffFor({ label: `${doc.kind === "RESUME" ? "Resume" : "Cover letter"} v${doc.version}`, diff: data.diffFromMaster ?? "" });
  }

  const step = finalized ? 3 : result ? 2 : research ? 1 : 0;
  const steps = ["Research", "Generate", "Review", "Finalize"];

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      {/* back nav — preserves jobs page filters + scroll (browser history) */}
      <button
        onClick={() => router.back()}
        className="flex w-fit items-center gap-1.5 text-xs font-medium text-[#8b877a] transition-colors hover:text-[#c2410c]"
      >
        <ArrowLeft className="size-3.5" /> Back to jobs
      </button>

      {/* job header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#1c1b17]">{job.title}</h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-[#6e6b61]">
          {job.company} · {job.locationRaw || "—"}
          <Badge variant="outline" className="border-[#c2410c]/40 text-[#c2410c]">{BUCKET_LABEL[job.bucket]}</Badge>
          <Badge variant="outline" className="border-[#e6e3db] text-[#6e6b61]">{WORKMODE_LABEL[job.workMode]}</Badge>
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              // mark viewed so the did-you-apply prompt fires on return
              fetch(`/api/jobs/${job.id}/view`, { method: "POST" }).catch(() => {});
              window.dispatchEvent(new CustomEvent("jobhub:viewed", { detail: { jobId: job.id } }));
            }}
            className="flex items-center gap-1 text-xs text-[#c2410c] hover:underline"
          >
            posting <ExternalLink className="size-3" />
          </a>
        </p>
        <button onClick={() => setShowJd((s) => !s)} className="mt-2 text-xs text-[#8b877a] hover:text-[#4a473f]">
          {showJd ? "Hide job description" : "Show job description"}
        </button>
        {showJd && (
          <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-[#e6e3db] bg-[#f6f5f1] p-3 text-xs leading-relaxed text-[#6e6b61]">
            {job.description || "No description stored for this job."}
          </p>
        )}
      </div>

      {/* steps */}
      <div className="flex items-center gap-1 rounded-lg border border-[#e6e3db]/70 bg-white p-1">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
                i < step ? "text-[#15803d]" : i === step ? "bg-[#1c1b17] text-[#f6f5f1]" : "text-[#a8a294]"
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px] font-semibold",
                  i < step ? "bg-[#dcfce7] text-[#15803d]" : i === step ? "bg-[#c2410c] text-[#fdf8f3]" : "bg-[#f1efe9] text-[#a8a294]"
                )}
              >
                {i < step ? "✓" : i + 1}
              </span>
              {s}
            </div>
            {i < steps.length - 1 && <span className="text-[#d5d1c6]">›</span>}
          </div>
        ))}
      </div>

      <Separator className="bg-[#f1efe9]" />

      {/* research */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-[#1c1b17]">
            <Building2 className="size-4 text-[#c2410c]" /> Company research
          </h2>
          <Button size="sm" variant="outline" className="border-[#e6e3db]" disabled={researching} onClick={() => runResearch(Boolean(research))}>
            {researching ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
            {research ? "Refresh research" : "Research company"}
          </Button>
        </div>
        {research ? (
          <div className="mt-3 grid gap-3 rounded-lg border border-[#e6e3db] bg-white p-4 text-sm">
            <p className="text-[#4a473f]">{research.summary}</p>
            <div className="grid gap-2 text-xs text-[#6e6b61] sm:grid-cols-2">
              <p><span className="text-[#8b877a]">Mission: </span>{research.mission}</p>
              <p><span className="text-[#8b877a]">Product: </span>{research.product}</p>
            </div>
            {research.stack?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {research.stack.map((s) => (
                  <Badge key={s} variant="outline" className="border-[#e6e3db] text-[#6e6b61]">{s}</Badge>
                ))}
              </div>
            )}
            {research.news?.length > 0 && (
              <ul className="list-inside list-disc text-xs text-[#8b877a]">
                {research.news.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-[#8b877a]">No research yet — it runs automatically on first generation, or run it now.</p>
        )}
      </section>

      <Separator className="bg-[#f1efe9]" />

      {/* direct contacts */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-[#1c1b17]">
            <Mail className="size-4 text-[#c2410c]" /> Direct contacts
            <span className="text-xs font-normal text-[#a8a294]">verified emails of people at {job.company}</span>
          </h2>
          <Button size="sm" variant="outline" className="border-[#e6e3db]" disabled={findingContacts} onClick={() => findContacts(Boolean(contacts))}>
            {findingContacts ? <Loader2 className="size-3.5 animate-spin" /> : <MailSearch className="size-3.5" />}
            {contacts ? "Re-search" : "Find 2 contacts"}
          </Button>
        </div>
        {contacts ? (
          contacts.contacts.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {contacts.contacts.map((c) => (
                <div key={c.email} className="rounded-lg border border-[#e6e3db] bg-white p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#1c1b17]">
                        {c.name === "Unknown" ? `${job.company} hiring inbox` : c.name}
                      </p>
                      <p className="truncate text-xs text-[#8b877a]">
                        {c.role === "hr" ? "Human Resources / Recruiting" : c.role || "—"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        c.deliverability === "valid" ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#fef3c7] text-[#92400e]"
                      )}
                      title={c.deliverability === "valid" ? "Verified deliverable" : "Domain accepts all mail (unverifiable)"}
                    >
                      {c.deliverability === "valid" ? "verified" : "accept-all"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <code className="min-w-0 flex-1 truncate rounded bg-[#f6f5f1] px-2 py-1 text-xs text-[#4a473f]">{c.email}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(c.email);
                        toast.success("Email copied");
                      }}
                      className="text-[#a8a294] transition-colors hover:text-[#c2410c]"
                      title="Copy email"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <a
                      href={`mailto:${c.email}?subject=${encodeURIComponent(`${job.title} at ${job.company} — Kabir Narula`)}`}
                      className="text-[#a8a294] transition-colors hover:text-[#c2410c]"
                      title="Compose email"
                    >
                      <Send className="size-3.5" />
                    </a>
                    <button
                      onClick={() => setEmailFor({ name: c.name, role: c.role, email: c.email })}
                      className="text-[#a8a294] transition-colors hover:text-[#c2410c]"
                      title="Draft outreach email with AI"
                    >
                      <PenLine className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#a8a294]">
                    <span>
                      {c.patternDerived ? "pattern-matched · " : ""}confidence {c.confidence}%
                    </span>
                    {c.sources.length > 0 && (
                      <span className="flex gap-1.5">
                        {c.sources.map((s, i) => (
                          <a key={i} href={s} target="_blank" rel="noreferrer" className="hover:text-[#c2410c] hover:underline">
                            source {i + 1}
                          </a>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#8b877a]">
              No verified contacts found at {contacts.domain} — this company keeps a low email profile. Try LinkedIn outreach instead.
            </p>
          )
        ) : (
          <p className="mt-2 text-xs text-[#8b877a]">
            Finds 2 verified recruiter/hiring-manager emails at {job.company} (publicly-indexed, deliverability-checked via Hunter.io).
          </p>
        )}
      </section>

      <Separator className="bg-[#f1efe9]" />

      {/* generate */}
      <section className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium text-[#1c1b17]">
            <Sparkles className="size-4 text-[#c2410c]" /> Tailored documents
          </h2>
          <p className="mt-1 text-xs text-[#8b877a]">
            Rewrites experience bullets + cover letter only. Education, projects, company names, and layout are locked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <Button
              variant="outline"
              onClick={() => generate({ deepResearch: true })}
              disabled={generating}
              className="border-[#e6e3db] text-[#6e6b61] hover:border-[#c2410c]/40 hover:text-[#c2410c]"
            >
              <FlaskConical className="size-4" />
              Regenerate with deeper research
            </Button>
          )}
          <Button
            onClick={() => generate({})}
            disabled={generating}
            className="bg-[#c2410c] text-[#fdf8f3] hover:bg-[#9a3412]"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "Generating…" : "Tailor for this job"}
          </Button>
        </div>
      </section>

      {/* applied title optimizations */}
      {result && (result.appliedTitleChanges?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-[#c2410c]/30 bg-[#fdeadd]/60 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-[#9a3412]">
            <CheckCircle2 className="size-4" /> Titles optimized for this posting (applied):
          </p>
          <ul className="mt-2 text-xs text-[#9a3412]/90">
            {result.appliedTitleChanges!.map((t, i) => (
              <li key={i} className="mt-1">
                {t.company}: “{t.from}” → “{t.to}”
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* title-change confirmation (only when title optimization was disabled) */}
      {result && result.pendingTitleChanges.length > 0 && (
        <div className="rounded-lg border border-amber-600/40 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-sm text-amber-800">
            <TriangleAlert className="size-4" /> Proposed title rewordings (not applied yet):
          </p>
          <ul className="mt-2 text-xs text-amber-800/80">
            {result.pendingTitleChanges.map((t, i) => (
              <li key={i} className="mt-1">
                {t.company}: “{t.from}” → “{t.to}”
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="bg-amber-500 text-[#fdf8f3] hover:bg-amber-600" disabled={generating} onClick={() => generate({ allowTitleChanges: true })}>
              Regenerate with these titles
            </Button>
            <Button size="sm" variant="outline" className="border-[#e6e3db]" onClick={() => setResult({ ...result, pendingTitleChanges: [] })}>
              Keep original titles
            </Button>
          </div>
        </div>
      )}

      {/* warnings */}
      {result?.warnings.map((w, i) => (
        <div key={i} className="rounded-lg border border-red-600/40 bg-red-600/5 p-3 text-xs text-red-700">
          {w}
        </div>
      ))}

      {/* latest result */}
      {result && (
        <div className="grid gap-3 sm:grid-cols-2">
          {result.chosenProjects && result.chosenProjects.length > 0 && (
            <p className="text-xs text-[#8b877a] sm:col-span-2">
              Projects on this resume:{" "}
              <span className="text-[#c2410c]">{result.chosenProjects.join(" + ")}</span> — picked as the best fit for this job
            </p>
          )}
          {result.resume.missingKeywords && result.resume.missingKeywords.length > 0 && (
            <p className="text-xs text-[#8b877a] sm:col-span-2">
              Not covered (not in your real background — kept out on purpose):{" "}
              <span className="text-[#a8a294]">{result.resume.missingKeywords.join(", ")}</span>
            </p>
          )}
          {[
            { label: "Resume", id: result.resume.id, version: result.resume.version, pages: result.resume.pageCount, score: result.resume.matchScore, fillPct: result.resume.fillPct, diff: result.resume.diff },
            { label: "Cover letter", id: result.cover.id, version: result.cover.version, pages: result.cover.pageCount, score: null, fillPct: undefined, diff: result.cover.diff },
          ].map((d) => (
            <div key={d.id} className="rounded-lg border border-[#e6e3db] bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#1c1b17]">{d.label} v{d.version}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("border-[#15803d]/40 text-[#15803d]", d.pages !== 1 && "border-red-600/40 text-red-600")}>
                    {d.pages} page{d.pages === 1 ? "" : "s"}
                  </Badge>
                  {d.fillPct !== undefined && (
                    <Badge variant="outline" className={cn("border-[#15803d]/40 text-[#15803d]", d.fillPct < 90 && "border-amber-600/40 text-amber-700")}>
                      fill {d.fillPct}%
                    </Badge>
                  )}
                  {d.label === "Resume" && (
                    <Badge variant="outline" className="border-[#c2410c]/40 text-[#c2410c]">
                      {d.score === null ? "ATS —" : `ATS ${d.score}%`}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="border-[#e6e3db]" nativeButton={false} render={<a href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noreferrer" />}>
                  <FileText className="size-3.5" /> Preview
                </Button>
                <Button size="sm" variant="outline" className="border-[#e6e3db]" nativeButton={false} render={<a href={`/api/documents/${d.id}/pdf?download=1`} />}>
                  <Download className="size-3.5" /> Download
                </Button>
                <Button size="sm" variant="outline" className="border-[#e6e3db]" onClick={() => setDiffFor({ label: `${d.label} v${d.version}`, diff: d.diff })}>
                  Diff vs master
                </Button>
              </div>
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button onClick={finalize} disabled={finalized} className="bg-[#15803d] text-[#fdf8f3] hover:bg-[#166534]">
              <CheckCircle2 className="size-4" />
              {finalized ? "Finalized" : hasApplication ? "Finalize & attach to application" : "Finalize (attach after you track it)"}
            </Button>
          </div>
        </div>
      )}

      {/* diff viewer */}
      {diffFor && (
        <section className="rounded-lg border border-[#e6e3db]">
          <div className="flex items-center justify-between border-b border-[#e6e3db] px-4 py-2">
            <p className="text-sm text-[#1c1b17]">Diff — {diffFor.label} vs master</p>
            <Button size="sm" variant="ghost" onClick={() => setDiffFor(null)}>Close</Button>
          </div>
          <DiffView diff={diffFor.diff} />
        </section>
      )}

      {/* version history */}
      {documents.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-[#1c1b17]">Version history</h2>
          <div className="mt-2 divide-y divide-[#e6e3db] rounded-lg border border-[#e6e3db]">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-28 text-[#1c1b17]">{d.kind === "RESUME" ? "Resume" : "Cover"} v{d.version}</span>
                <Badge variant="outline" className={cn("border-[#e6e3db] text-[#6e6b61]", d.status === "FINAL" && "border-[#15803d]/40 text-[#15803d]")}>
                  {d.status}
                </Badge>
                <span className="text-xs text-[#8b877a]">{d.pageCount}p{d.matchScore !== null ? ` · ATS ${d.matchScore}%` : ""}</span>
                <span className="text-xs text-[#a8a294]">{new Date(d.createdAt).toLocaleString()}</span>
                {d.titleChangeNote && <span className="text-xs text-amber-700">{d.titleChangeNote}</span>}
                <span className="ml-auto flex gap-2">
                  <a href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-[#c2410c] hover:underline">PDF</a>
                  <button onClick={() => viewDiffForDoc(d)} className="text-xs text-[#6e6b61] hover:text-[#1c1b17]">Diff</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <EmailDialog
        jobId={job.id}
        contact={emailFor}
        open={emailFor !== null}
        onClose={() => setEmailFor(null)}
      />
    </div>
  );
}
