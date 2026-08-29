"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link2, Loader2, ClipboardPaste } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Mode = "link" | "details";

const labelClass = "font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground";

export function AddJobDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("link");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "link" ? { url } : { title, company, location, description }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't add the job");
        setLoading(false);
        return;
      }
      toast.success(
        data.existing ? `${data.job.company} — already on your board, opening tailor` : `${data.job.title} @ ${data.job.company} added — opening tailor`
      );
      onClose();
      router.push(`/tailor/${data.job.id}`);
    } catch {
      toast.error("Couldn't add the job");
      setLoading(false);
    }
  }

  const canSubmit = mode === "link" ? url.trim().length > 8 : title.trim() && company.trim() && description.trim().length > 40;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a job</DialogTitle>
        </DialogHeader>

        {/* mode toggle */}
        <div className="flex gap-2">
          {(
            [
              { key: "link", label: "Paste link", icon: Link2 },
              { key: "details", label: "Paste details", icon: ClipboardPaste },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-none border-2 border-foreground px-3 py-2 font-heading text-[11px] font-bold uppercase tracking-wider transition-all",
                mode === key
                  ? "bg-primary text-primary-foreground shadow-hard-sm"
                  : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {mode === "link" ? (
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Posting URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://boards.greenhouse.io/…"
              autoFocus
            />
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              We fetch the page and extract title, company, and the full description.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Software Developer" />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Company</label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Location (optional)</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Toronto, ON (Hybrid)" />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Full description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste the whole posting — requirements, responsibilities, all of it."
                className="min-h-40 resize-y"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading || !canSubmit}>
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {loading ? "Importing…" : "Add + tailor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
