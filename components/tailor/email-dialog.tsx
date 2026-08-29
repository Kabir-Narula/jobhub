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

  const mailBody = body.replace(/\n/g, "\r\n");
  const mailto = contact
    ? `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`
    : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "followup" ? "Follow-up email" : "Outreach email"}{contact ? ` — to ${contact.name === "Unknown" ? contact.email : `${contact.name} (${contact.role || contact.email})`}` : ""}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Drafting with your research + finalized resume…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Subject</p>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="text-sm" />
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Body</p>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck
                className="field-sizing-fixed min-h-72 resize-y whitespace-pre-wrap font-sans text-[13.5px] leading-6 tracking-normal"
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Recent-grad note, not a student pitch. Spacing is locked to greeting / paragraphs / Thanks + name. Tweak words if needed, attach resume + cover, then send.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={draft} disabled={loading}>
                <RefreshCw className="size-3.5" /> Regenerate
              </Button>
              <Button size="sm" variant="outline" onClick={() => copy(subject, "Subject")}>
                <Copy className="size-3.5" /> Subject
              </Button>
              <Button size="sm" variant="outline" onClick={() => copy(body, "Body")}>
                <Copy className="size-3.5" /> Body
              </Button>
              <Button size="sm" nativeButton={false} render={<a href={mailto} />}>
                <Send className="size-3.5" /> Open in mail app
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
