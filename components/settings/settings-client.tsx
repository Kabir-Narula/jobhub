"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CompanySource } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MasterInfo {
  kind: string;
  uploadedAt: string;
}

interface RunInfo {
  id: string;
  startedAt: string;
  trigger: string;
  newJobs: number;
  totalSeen: number;
  ok: boolean;
}

interface EnvInfo {
  adzuna: boolean;
  openaiModel: string;
  gtaExtra: string;
  supabaseConfigured: boolean;
}

const labelClass = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";
const statusStamp = "border-2 border-foreground px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider";

export function SettingsClient({
  sources,
  masters,
  recentRuns,
  env,
}: {
  sources: CompanySource[];
  masters: MasterInfo[];
  recentRuns: RunInfo[];
  env: EnvInfo;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [atsType, setAtsType] = useState("GREENHOUSE");
  const [token, setToken] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState("RESUME");

  async function toggleSource(s: CompanySource) {
    await fetch(`/api/sources/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    router.refresh();
  }

  async function removeSource(id: string) {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function addSource() {
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, atsType, boardToken: token }),
    });
    if (res.ok) {
      setName("");
      setToken("");
      toast.success("Source added");
      router.refresh();
    } else {
      const d = await res.json();
      toast.error(d.error ?? "Failed to add source");
    }
  }

  async function uploadMaster() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose a .tex file first");
    const texContent = await file.text();
    const res = await fetch("/api/masters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: uploadKind, texContent }),
    });
    if (res.ok) {
      toast.success(`${uploadKind} master replaced`);
      router.refresh();
    } else {
      const d = await res.json();
      toast.error(d.error ?? "Upload failed");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="stamp tilt-l bg-primary">Control room</span>
        <h1 className="font-display mt-3 text-4xl font-bold uppercase tracking-tight md:text-5xl">Settings</h1>
      </div>

      {/* company sources */}
      <section>
        <h2 className="font-heading text-xl font-bold uppercase tracking-wider">Company sources ({sources.length})</h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          These are companies whose <span className="font-bold text-foreground">official career boards</span> we poll
          directly every cycle (their ATS public APIs — the most reliable, ToS-safe source kind).
          This is <span className="font-bold text-foreground">not</span> a filter on what you see:
          LinkedIn, Simplify, Remotive, RemoteOK and WeWorkRemotely are searched automatically on top of these,
          which is where most postings actually come from. Add any company here to watch its board directly;
          disable without deleting.
        </p>
        <div className="mt-4 divide-y-2 divide-foreground rounded-none border-2 border-foreground bg-card shadow-hard-sm">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className={cn("w-40 font-heading text-xs font-bold uppercase tracking-wider", s.enabled ? "text-foreground" : "text-muted-foreground line-through")}>{s.name}</span>
              <Badge variant="outline" className="bg-muted">{s.atsType.toLowerCase()}</Badge>
              <span className="font-mono text-xs text-muted-foreground">{s.boardToken}</span>
              {s.lastError && <span className="truncate font-mono text-[10px] uppercase tracking-wider text-destructive" title={s.lastError}>error: {s.lastError}</span>}
              <span className="ml-auto flex items-center gap-3">
                <button
                  onClick={() => toggleSource(s)}
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#2137ff] underline decoration-2 underline-offset-2 hover:no-underline"
                >
                  {s.enabled ? "Disable" : "Enable"}
                </button>
                <Button size="icon-xs" variant="destructive" onClick={() => removeSource(s.id)} title="Remove source">
                  <Trash2 />
                </Button>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className={labelClass}>Company</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" className="h-8 w-44" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={labelClass}>ATS</Label>
            <Select value={atsType} onValueChange={(v) => v && setAtsType(v)}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["GREENHOUSE", "LEVER", "ASHBY", "SMARTRECRUITERS", "WORKDAY"].map((t) => (
                  <SelectItem key={t} value={t}>{t.toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={labelClass}>Board token</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="board name from the ATS URL" className="h-8 w-44" />
          </div>
          <Button size="sm" onClick={addSource} disabled={!name.trim() || !token.trim()}>
            Add source
          </Button>
        </div>
      </section>

      <Separator />

      {/* master templates */}
      <section>
        <h2 className="font-heading text-xl font-bold uppercase tracking-wider">Master templates</h2>
        <div className="mt-2 flex flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {masters.map((m) => (
            <p key={m.kind}>{m.kind}: uploaded {new Date(m.uploadedAt).toLocaleString()}</p>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Select value={uploadKind} onValueChange={(v) => v && setUploadKind(v)}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="RESUME">Resume</SelectItem>
              <SelectItem value="COVER">Cover letter</SelectItem>
            </SelectContent>
          </Select>
          <Input ref={fileRef} type="file" accept=".tex" className="h-8 w-64 text-xs" />
          <Button size="sm" onClick={uploadMaster}>
            Replace master
          </Button>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Replacing a master only affects future generations. Previous versions and their diffs are kept.
        </p>
      </section>

      <Separator />

      {/* environment + recent polls */}
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-none border-2 border-foreground bg-card p-4 shadow-hard-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wider">Environment</h2>
          <ul className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
            <li>OpenAI model: <span className="font-bold text-foreground">{env.openaiModel}</span></li>
            <li>
              Supabase storage:{" "}
              <span className={cn(statusStamp, env.supabaseConfigured ? "bg-[#0f766e] text-white" : "bg-destructive text-white")}>
                {env.supabaseConfigured ? "configured" : "NOT configured"}
              </span>
            </li>
            <li>
              Adzuna source:{" "}
              <span className={env.adzuna ? cn(statusStamp, "bg-[#0f766e] text-white") : "text-muted-foreground"}>
                {env.adzuna ? "enabled" : "disabled (no API keys)"}
              </span>
            </li>
            <li>Extra GTA cities: <span className="font-bold text-foreground">{env.gtaExtra || "none"}</span></li>
          </ul>
        </div>
        <div className="rounded-none border-2 border-foreground bg-card p-4 shadow-hard-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wider">Recent polls</h2>
          <ul className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
            {recentRuns.length === 0 && <li>No polls yet.</li>}
            {recentRuns.map((r) => (
              <li key={r.id}>
                <span className={cn(statusStamp, r.ok ? "bg-[#0f766e] text-white" : "bg-destructive text-white")}>
                  {r.ok ? "ok" : "failed"}
                </span>
                {" "}{new Date(r.startedAt).toLocaleString()} · {r.trigger} · {r.totalSeen} seen, +{r.newJobs} new
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
