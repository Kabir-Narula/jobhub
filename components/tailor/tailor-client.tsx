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
  Ban,
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
  why?: string;
  quality?: "ok" | "catchall" | "guessed";
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
  droppedEntries?: string[];
}

/* deliberately clashing bucket colors — mirrors the jobs list tags */
const BUCKET_STYLE: Record<string, string> = {
  TORONTO: "bg-primary",
  REMOTE: "bg-[#0f766e] text-white",
  GTA_COMMUTE: "bg-accent",
};

export function TailorClient({
  job,
  initialDocuments,
  initialResearch,
  initialContacts,
  hasApplication,
  workdayTips,
}: {
  job: JobInfo;
  initialDocuments: DocMeta[];
  initialResearch: Research | null;
  initialContacts: ContactsData | null;
  hasApplication: boolean;
  workdayTips: { title: string; terms: string[] } | null;
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
        className="flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#2137ff] underline decoration-2 underline-offset-2 transition-colors hover:no-underline"
      >
        <ArrowLeft className="size-3.5" /> Back to jobs
      </button>

      {/* job header */}
      <div>
        <span className="stamp tilt-l bg-accent text-[10px]">tailor</span>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight text-foreground md:text-5xl">{job.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {job.company} · {job.locationRaw || "—"}
          <Badge variant="outline" className={BUCKET_STYLE[job.bucket]}>{BUCKET_LABEL[job.bucket]}</Badge>
          <Badge variant="outline">{WORKMODE_LABEL[job.workMode]}</Badge>
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              // mark viewed so the did-you-apply prompt fires on return
              fetch(`/api/jobs/${job.id}/view`, { method: "POST" }).catch(() => {});
              window.dispatchEvent(new CustomEvent("jobhub:viewed", { detail: { jobId: job.id } }));
            }}
            className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-[#2137ff] underline decoration-2 underline-offset-2 hover:no-underline"
          >
            posting <ExternalLink className="size-3" />
          </a>
        </p>
        <button onClick={() => setShowJd((s) => !s)} className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground">
          {showJd ? "Hide job description" : "Show job description"}
        </button>
        {showJd && (
          <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-none border-2 border-foreground bg-muted p-3 text-xs leading-relaxed text-foreground">
            {job.description || "No description stored for this job."}
          </p>
        )}
      </div>

      {/* Workday form-field cheat sheet: Workday ranks form data above the PDF */}
      {workdayTips && (
        <div className="rounded-none border-2 border-foreground bg-accent p-3 text-xs leading-relaxed text-accent-foreground shadow-hard-sm">
          <p className="font-heading font-bold uppercase tracking-wider">Workday application — the form outranks the PDF</p>
          <p className="mt-1">
            Workday weights what you type into its form fields more than the uploaded resume. When you apply:
          </p>
          <ul className="mt-1.5 list-disc pl-4">
            <li>
              Set <span className="font-medium">Current Title</span> to exactly:{" "}
              <code className="rounded-none border-2 border-foreground bg-card px-1 py-0.5 font-mono font-medium">{workdayTips.title}</code>
            </li>
            <li>
              Paste these exact terms into the skills/free-text fields:{" "}
              <code className="rounded-none border-2 border-foreground bg-card px-1 py-0.5 font-mono">{workdayTips.terms.join(", ")}</code>
            </li>
            <li>Fill every field — blank fields rank below completed ones, even when the PDF has the same info.</li>
          </ul>
        </div>
      )}

      {/* steps */}
      <div className="flex items-center gap-1 rounded-none border-2 border-foreground bg-card p-1 shadow-hard-sm">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex flex-1 items-center gap-2 rounded-none px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-wider transition-colors",
                i < step ? "text-foreground" : i === step ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-none border-2 border-foreground font-mono text-[10px] font-bold",
                  i < step ? "bg-[#0f766e] text-white" : i === step ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? "✓" : i + 1}
              </span>
              {s}
            </div>
            {i < steps.length - 1 && <span className="text-muted-foreground/40">›</span>}
          </div>
        ))}
      </div>

      <Separator />

      {/* research */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wider text-foreground">
            <Building2 className="size-4" /> Company research
          </h2>
          <Button size="sm" variant="outline" disabled={researching} onClick={() => runResearch(Boolean(research))}>
            {researching ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
            {research ? "Refresh research" : "Research company"}
          </Button>
        </div>
        {research ? (
          <div className="mt-3 grid gap-3 rounded-none border-2 border-foreground bg-card p-4 text-sm shadow-hard-sm">
            <p className="text-foreground">{research.summary}</p>
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p><span className="font-mono text-[10px] uppercase tracking-[0.18em]">Mission: </span>{research.mission}</p>
              <p><span className="font-mono text-[10px] uppercase tracking-[0.18em]">Product: </span>{research.product}</p>
            </div>
            {research.stack?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {research.stack.map((s) => (
                  <Badge key={s} variant="outline">{s}</Badge>
                ))}
              </div>
            )}
            {research.news?.length > 0 && (
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {research.news.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No research yet — it runs automatically on first generation, or run it now.</p>
        )}
      </section>

      <Separator />

      {/* direct contacts */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wider text-foreground">
            <Mail className="size-4" /> Direct contacts
            <span className="font-mono text-[10px] font-normal normal-case text-muted-foreground">SMTP-checked people at {job.company} — not a guarantee they still work there</span>
          </h2>
          <Button size="sm" variant="outline" disabled={findingContacts} onClick={() => findContacts(Boolean(contacts))}>
            {findingContacts ? <Loader2 className="size-3.5 animate-spin" /> : <MailSearch className="size-3.5" />}
            {contacts ? "Re-search" : "Find 2 contacts"}
          </Button>
        </div>
        {contacts ? (
          contacts.contacts.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {contacts.contacts.map((c) => (
                <div key={c.email} className="rounded-none border-2 border-foreground bg-card p-3.5 shadow-hard-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {c.name === "Unknown" ? `${job.company} hiring inbox` : c.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.role === "hr" ? "Human Resources / Recruiting" : c.role || "—"}
                      </p>
                      {c.why && <p className="mt-1 w-fit max-w-full truncate rounded-none border-2 border-foreground bg-accent px-1 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-accent-foreground">{c.why}</p>}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-none border-2 border-foreground px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide",
                        (c.quality ?? (c.patternDerived ? "guessed" : c.deliverability === "valid" ? "ok" : "catchall")) === "ok"
                          ? "bg-[#0f766e] text-white"
                          : (c.quality === "guessed" || c.patternDerived)
                            ? "bg-destructive text-white"
                            : "bg-accent text-accent-foreground"
                      )}
                      title={
                        c.patternDerived || c.quality === "guessed"
                          ? "Built from the company email pattern. Higher chance it bounces — confirm on LinkedIn before sending."
                          : c.deliverability === "valid"
                            ? "Hunter SMTP check passed. The person may still have left the company."
                            : "This domain accepts every address, so nobody can prove the inbox exists. High bounce risk."
                      }
                    >
                      {c.patternDerived || c.quality === "guessed"
                        ? "guessed"
                        : c.deliverability === "valid"
                          ? "smtp ok"
                          : "catch-all"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <code className="min-w-0 flex-1 truncate rounded-none border-2 border-foreground bg-muted px-2 py-1 font-mono text-xs text-foreground">{c.email}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(c.email);
                        toast.success("Email copied");
                      }}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      title="Copy email"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <a
                      href={`mailto:${c.email}?subject=${encodeURIComponent(`${job.title} at ${job.company} — Kabir Narula`)}`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      title="Compose email"
                    >
                      <Send className="size-3.5" />
                    </a>
                    <button
                      onClick={() => setEmailFor({ name: c.name, role: c.role, email: c.email })}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      title="Draft outreach email with AI"
                    >
                      <PenLine className="size-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        await fetch("/api/contacts/bounce", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ jobId: job.id, email: c.email }),
                        }).catch(() => {});
                        setContacts((prev) =>
                          prev ? { ...prev, contacts: prev.contacts.filter((x) => x.email !== c.email) } : prev
                        );
                        toast.success(`Removed ${c.email} — it won't come back on re-search`);
                      }}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      title="Bounced? Remove this address at this company"
                    >
                      <Ban className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>
                      {c.patternDerived ? "pattern-matched · " : ""}confidence {c.confidence}%
                    </span>
                    {c.sources.length > 0 && (
                      <span className="flex gap-1.5">
                        {c.sources.map((s, i) => (
                          <a key={i} href={s} target="_blank" rel="noreferrer" className="text-[#2137ff] underline decoration-2 underline-offset-2 hover:no-underline">
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
            <p className="mt-2 text-xs text-muted-foreground">
              No sendable inboxes at {contacts.domain}. Catch-all and guessed addresses are hidden unless they pass SMTP. Try LinkedIn instead.
            </p>
          )
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Looks up people at {job.company} and SMTP-checks each address. Catch-all domains and pattern-guesses are labeled — don&apos;t treat them as confirmed. If one bounces, hit the ban icon so it never comes back.
          </p>
        )}
      </section>

      <Separator />

      {/* generate */}
      <section className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wider text-foreground">
            <Sparkles className="size-4" /> Tailored documents
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Rewrites experience bullets + cover letter only. Education, projects, company names, and layout are locked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <Button
              variant="outline"
              onClick={() => generate({ deepResearch: true })}
              disabled={generating}
            >
              <FlaskConical className="size-4" />
              Regenerate with deeper research
            </Button>
          )}
          <Button
            onClick={() => generate({})}
            disabled={generating}
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "Generating…" : "Tailor for this job"}
          </Button>
        </div>
      </section>

      {/* applied title optimizations */}
      {result && (result.appliedTitleChanges?.length ?? 0) > 0 && (
        <div className="rounded-none border-2 border-foreground bg-primary/40 p-4 shadow-hard-sm">
          <p className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wider text-foreground">
            <CheckCircle2 className="size-4" /> Titles optimized for this posting (applied):
          </p>
          <ul className="mt-2 text-xs text-foreground">
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
        <div className="rounded-none border-2 border-foreground bg-accent p-4 shadow-hard-sm">
          <p className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wider text-accent-foreground">
            <TriangleAlert className="size-4" /> Proposed title rewordings (not applied yet):
          </p>
          <ul className="mt-2 text-xs text-accent-foreground">
            {result.pendingTitleChanges.map((t, i) => (
              <li key={i} className="mt-1">
                {t.company}: “{t.from}” → “{t.to}”
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={generating} onClick={() => generate({ allowTitleChanges: true })}>
              Regenerate with these titles
            </Button>
            <Button size="sm" variant="outline" onClick={() => setResult({ ...result, pendingTitleChanges: [] })}>
              Keep original titles
            </Button>
          </div>
        </div>
      )}

      {/* warnings */}
      {result?.warnings.map((w, i) => (
        <div key={i} className="rounded-none border-2 border-foreground bg-destructive/20 p-3 text-xs text-foreground shadow-hard-sm">
          {w}
        </div>
      ))}

      {/* latest result */}
      {result && (
        <div className="grid gap-3 sm:grid-cols-2">
          {result.droppedEntries && result.droppedEntries.length > 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Hidden for this role (not relevant here): <span className="text-foreground/60">{result.droppedEntries.join(", ")}</span>
            </p>
          )}
          {result.chosenProjects && result.chosenProjects.length > 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Projects on this resume:{" "}
              <span className="font-bold text-foreground">{result.chosenProjects.join(" + ")}</span> — picked as the best fit for this job
            </p>
          )}
          {result.resume.missingKeywords && result.resume.missingKeywords.length > 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Not covered (not in your real background — kept out on purpose):{" "}
              <span className="text-foreground/60">{result.resume.missingKeywords.join(", ")}</span>
            </p>
          )}
          {[
            { label: "Resume", id: result.resume.id, version: result.resume.version, pages: result.resume.pageCount, score: result.resume.matchScore, fillPct: result.resume.fillPct, diff: result.resume.diff },
            { label: "Cover letter", id: result.cover.id, version: result.cover.version, pages: result.cover.pageCount, score: null, fillPct: undefined, diff: result.cover.diff },
          ].map((d) => (
            <div key={d.id} className="rounded-none border-2 border-foreground bg-card p-4 shadow-hard-sm">
              <div className="flex items-center justify-between">
                <p className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">{d.label} v{d.version}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("bg-[#0f766e] text-white", d.pages !== 1 && "bg-destructive text-white")}>
                    {d.pages} page{d.pages === 1 ? "" : "s"}
                  </Badge>
                  {d.fillPct !== undefined && (
                    <Badge variant="outline" className={cn("bg-[#0f766e] text-white", d.fillPct < 90 && "bg-accent text-accent-foreground")}>
                      fill {d.fillPct}%
                    </Badge>
                  )}
                </div>
              </div>
              {d.label === "Resume" && (
                <div className="mt-3 flex items-end gap-3">
                  <span className="font-display text-4xl font-bold leading-none">{d.score === null ? "—" : `${d.score}%`}</span>
                  <span className="stamp tilt-r bg-primary text-[9px]">ATS match</span>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" nativeButton={false} render={<a href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noreferrer" />}>
                  <FileText className="size-3.5" /> Preview
                </Button>
                <Button size="sm" variant="outline" nativeButton={false} render={<a href={`/api/documents/${d.id}/pdf?download=1`} />}>
                  <Download className="size-3.5" /> Download
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDiffFor({ label: `${d.label} v${d.version}`, diff: d.diff })}>
                  Diff vs master
                </Button>
              </div>
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button onClick={finalize} disabled={finalized} className="bg-[#0f766e] text-white">
              <CheckCircle2 className="size-4" />
              {finalized ? "Finalized" : hasApplication ? "Finalize & attach to application" : "Finalize (attach after you track it)"}
            </Button>
          </div>
        </div>
      )}

      {/* diff viewer */}
      {diffFor && (
        <section className="rounded-none border-2 border-foreground bg-card shadow-hard">
          <div className="flex items-center justify-between border-b-2 border-foreground bg-muted px-4 py-2">
            <p className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">Diff — {diffFor.label} vs master</p>
            <Button size="sm" variant="ghost" onClick={() => setDiffFor(null)}>Close</Button>
          </div>
          <DiffView diff={diffFor.diff} />
        </section>
      )}

      {/* version history */}
      {documents.length > 0 && (
        <section>
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">Version history</h2>
          <div className="mt-2 divide-y divide-foreground rounded-none border-2 border-foreground bg-card shadow-hard-sm">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-28 font-medium text-foreground">{d.kind === "RESUME" ? "Resume" : "Cover"} v{d.version}</span>
                <Badge variant="outline" className={cn(d.status === "FINAL" && "bg-[#0f766e] text-white")}>
                  {d.status}
                </Badge>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{d.pageCount}p{d.matchScore !== null ? ` · ATS ${d.matchScore}%` : ""}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</span>
                {d.titleChangeNote && <span className="rounded-none border-2 border-foreground bg-accent px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent-foreground">{d.titleChangeNote}</span>}
                <span className="ml-auto flex gap-2">
                  <a href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noreferrer" className="font-mono text-[11px] uppercase tracking-wider text-[#2137ff] underline decoration-2 underline-offset-2 hover:no-underline">PDF</a>
                  <button onClick={() => viewDiffForDoc(d)} className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">Diff</button>
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
