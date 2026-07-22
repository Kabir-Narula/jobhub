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
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

      {/* company sources */}
      <section>
        <h2 className="text-sm font-medium text-[#1c1b17]">Company sources ({sources.length})</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#8b877a]">
          These are companies whose <span className="font-medium text-[#4a473f]">official career boards</span> we poll
          directly every cycle (their ATS public APIs — the most reliable, ToS-safe source kind).
          This is <span className="font-medium text-[#4a473f]">not</span> a filter on what you see:
          LinkedIn, Simplify, Remotive, RemoteOK and WeWorkRemotely are searched automatically on top of these,
          which is where most postings actually come from. Add any company here to watch its board directly;
          disable without deleting.
        </p>
        <div className="mt-3 divide-y divide-[#e6e3db] rounded-lg border border-[#e6e3db]">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className={cn("w-40", s.enabled ? "text-[#1c1b17]" : "text-[#a8a294] line-through")}>{s.name}</span>
              <Badge variant="outline" className="border-[#e6e3db] text-[#8b877a]">{s.atsType.toLowerCase()}</Badge>
              <span className="font-mono text-xs text-[#a8a294]">{s.boardToken}</span>
              {s.lastError && <span className="truncate text-xs text-red-600" title={s.lastError}>error: {s.lastError}</span>}
              <span className="ml-auto flex items-center gap-2">
                <button onClick={() => toggleSource(s)} className="text-xs text-[#6e6b61] hover:text-[#1c1b17]">
                  {s.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={() => removeSource(s.id)} className="text-[#a8a294] hover:text-red-600">
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[#8b877a]">Company</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" className="h-8 w-44 bg-white" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[#8b877a]">ATS</Label>
            <Select value={atsType} onValueChange={(v) => v && setAtsType(v)}>
              <SelectTrigger className="h-8 w-44 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["GREENHOUSE", "LEVER", "ASHBY", "SMARTRECRUITERS"].map((t) => (
                  <SelectItem key={t} value={t}>{t.toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[#8b877a]">Board token</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="board name from the ATS URL" className="h-8 w-44 bg-white" />
          </div>
          <Button size="sm" onClick={addSource} disabled={!name.trim() || !token.trim()} className="bg-[#c2410c] text-[#fdf8f3] hover:bg-[#9a3412]">
            Add source
          </Button>
        </div>
      </section>

      <Separator className="bg-[#f1efe9]" />

      {/* master templates */}
      <section>
        <h2 className="text-sm font-medium text-[#1c1b17]">Master templates</h2>
        <div className="mt-2 text-xs text-[#8b877a]">
          {masters.map((m) => (
            <p key={m.kind}>{m.kind}: uploaded {new Date(m.uploadedAt).toLocaleString()}</p>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Select value={uploadKind} onValueChange={(v) => v && setUploadKind(v)}>
            <SelectTrigger className="h-8 w-36 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="RESUME">Resume</SelectItem>
              <SelectItem value="COVER">Cover letter</SelectItem>
            </SelectContent>
          </Select>
          <Input ref={fileRef} type="file" accept=".tex" className="h-8 w-64 bg-white text-xs" />
          <Button size="sm" variant="outline" className="border-[#e6e3db]" onClick={uploadMaster}>
            Replace master
          </Button>
        </div>
        <p className="mt-2 text-xs text-[#a8a294]">
          Replacing a master only affects future generations. Previous versions and their diffs are kept.
        </p>
      </section>

      <Separator className="bg-[#f1efe9]" />

      {/* environment + recent polls */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-[#1c1b17]">Environment</h2>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-[#8b877a]">
            <li>OpenAI model: <span className="text-[#4a473f]">{env.openaiModel}</span></li>
            <li>Supabase storage: <span className={env.supabaseConfigured ? "text-[#15803d]" : "text-red-600"}>{env.supabaseConfigured ? "configured" : "NOT configured"}</span></li>
            <li>Adzuna source: <span className={env.adzuna ? "text-[#15803d]" : "text-[#a8a294]"}>{env.adzuna ? "enabled" : "disabled (no API keys)"}</span></li>
            <li>Extra GTA cities: <span className="text-[#4a473f]">{env.gtaExtra || "none"}</span></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium text-[#1c1b17]">Recent polls</h2>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-[#8b877a]">
            {recentRuns.length === 0 && <li>No polls yet.</li>}
            {recentRuns.map((r) => (
              <li key={r.id}>
                <span className={r.ok ? "text-[#15803d]" : "text-red-600"}>{r.ok ? "ok" : "failed"}</span>
                {" · "}{new Date(r.startedAt).toLocaleString()} · {r.trigger} · {r.totalSeen} seen, +{r.newJobs} new
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
