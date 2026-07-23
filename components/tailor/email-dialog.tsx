"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Loader2, RefreshCw, Send } from "lucide-react";

interface Props {
  jobId: string;
  contact: { name: string; role: string; email: string } | null;
  open: boolean;
  onClose: () => void;
  mode?: "outreach" | "followup";
  daysSinceApplied?: number;
}

export function EmailDialog({ jobId, contact, open, onClose, mode = "outreach", daysSinceApplied = 7 }: Props) {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function draft() {
    setLoading(true);
    setLoaded(false);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, contactEmail: contact?.email ?? "", mode, daysSinceApplied }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubject(data.draft.subject);
        setBody(data.draft.body);
        setLoaded(true);
      } else {
        toast.error(data.error ?? "Draft failed");
      }
    } catch {
      toast.error("Draft failed");
    }
    setLoading(false);
  }

  // Draft on first open
  if (open && !loaded && !loading) {
    void draft();
  }

  function copy(text: string, what: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  }

  const mailto = contact
    ? `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-[#e6e3db] bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            {mode === "followup" ? "Follow-up email" : "Outreach email"}{contact ? ` — to ${contact.name === "Unknown" ? contact.email : `${contact.name} (${contact.role || contact.email})`}` : ""}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[#8b877a]">
            <Loader2 className="size-4 animate-spin" /> Drafting with your research + finalized resume…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#a8a294]">Subject</p>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="border-[#e6e3db] bg-white text-sm" />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#a8a294]">Body</p>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-44 border-[#e6e3db] bg-white text-sm leading-relaxed" />
            </div>
            <p className="text-[11px] text-[#a8a294]">
              Short, specific, no fluff — edit freely. Attach your tailored resume + cover before sending.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="outline" className="border-[#e6e3db]" onClick={draft} disabled={loading}>
                <RefreshCw className="size-3.5" /> Regenerate
              </Button>
              <Button size="sm" variant="outline" className="border-[#e6e3db]" onClick={() => copy(subject, "Subject")}>
                <Copy className="size-3.5" /> Subject
              </Button>
              <Button size="sm" variant="outline" className="border-[#e6e3db]" onClick={() => copy(body, "Body")}>
                <Copy className="size-3.5" /> Body
              </Button>
              <Button size="sm" className="bg-[#c2410c] text-[#fdf8f3] hover:bg-[#9a3412]" nativeButton={false} render={<a href={mailto} />}>
                <Send className="size-3.5" /> Open in mail app
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
