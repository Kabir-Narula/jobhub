"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PendingJob {
  id: string;
  title: string;
  company: string;
  applyUrl: string;
  viewedAt: string;
}

interface DocOption {
  id: string;
  kind: "RESUME" | "COVER";
  version: number;
  status: string;
  createdAt: string;
}

/**
 * Watches tab visibility/focus. When the user comes back after clicking
 * "Apply", asks once whether they applied. "No" permanently dismisses.
 */
export function ReturnPrompt() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingJob | null>(null);
  const [step, setStep] = useState<"ask" | "form">("ask");
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [resumeId, setResumeId] = useState("none");
  const [coverId, setCoverId] = useState("none");
  const [saving, setSaving] = useState(false);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (Date.now() - lastCheck.current < 10_000) return;
    lastCheck.current = Date.now();
    try {
      const res = await fetch("/api/jobs/pending-return");
      const { job } = await res.json();
      if (job) {
        setPending(job);
        setStep("ask");
      }
    } catch {
      // never break the page over a prompt
    }
  }, []);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") check();
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [check]);

  async function onYes() {
    setStep("form");
    try {
      const res = await fetch(`/api/documents?jobId=${pending!.id}`);
      const { documents } = await res.json();
      setDocs(documents ?? []);
      const latestResume = (documents ?? []).find((d: DocOption) => d.kind === "RESUME");
      const latestCover = (documents ?? []).find((d: DocOption) => d.kind === "COVER");
      if (latestResume) setResumeId(latestResume.id);
      if (latestCover) setCoverId(latestCover.id);
    } catch {
      setDocs([]);
    }
  }

  async function onNo() {
    const id = pending!.id;
    setPending(null);
    setNotes("");
    await fetch(`/api/jobs/${id}/apply-prompt-dismiss`, { method: "POST" });
  }

  async function onSave() {
    if (!pending) return;
    setSaving(true);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: pending.id,
        notes,
        resumeVersionId: resumeId === "none" ? null : resumeId,
        coverVersionId: coverId === "none" ? null : coverId,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(`Tracked: ${pending.title} at ${pending.company}`);
      setPending(null);
      setNotes("");
      router.refresh();
    } else {
      toast.error("Could not save the application.");
    }
  }

  const resumeDocs = docs.filter((d) => d.kind === "RESUME");
  const coverDocs = docs.filter((d) => d.kind === "COVER");

  return (
    <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && onNo()}>
      <DialogContent className="border-[#e6e3db] bg-white sm:max-w-md">
        {pending && step === "ask" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Welcome back</DialogTitle>
              <DialogDescription>
                Did you apply to <span className="font-medium text-[#1c1b17]">{pending.title}</span> at{" "}
                <span className="font-medium text-[#1c1b17]">{pending.company}</span>?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-[#e6e3db]" onClick={onNo}>
                Not yet
              </Button>
              <Button className="bg-[#c2410c] text-[#fdf8f3] hover:bg-[#9a3412]" onClick={onYes}>
                Yes, I applied
              </Button>
            </div>
          </>
        )}
        {pending && step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>Track application</DialogTitle>
              <DialogDescription>
                {pending.title} · {pending.company}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-[#8b877a]">Resume version</Label>
                  <Select value={resumeId} onValueChange={(v) => setResumeId(v ?? "none")}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {resumeDocs.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          v{d.version} ({d.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-[#8b877a]">Cover letter version</Label>
                  <Select value={coverId} onValueChange={(v) => setCoverId(v ?? "none")}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {coverDocs.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          v{d.version} ({d.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-[#8b877a]">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Referral? Contact? Anything to remember…"
                  className="min-h-20 bg-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="border-[#e6e3db]" onClick={() => setStep("ask")}>
                  Back
                </Button>
                <Button
                  className="bg-[#c2410c] text-[#fdf8f3] hover:bg-[#9a3412]"
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save application"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
