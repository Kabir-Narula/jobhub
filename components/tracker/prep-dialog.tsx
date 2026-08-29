"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

interface PrepPack {
  themes: string[];
  companyTalkingPoints: string[];
  yourStories: string[];
  questionsToAsk: string[];
}

export function PrepDialog({
  applicationId,
  company,
  open,
  onClose,
}: {
  applicationId: string;
  company: string;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [prep, setPrep] = useState<PrepPack | null>(null);

  async function load(force = false) {
    setLoading(true);
    try {
      const res = await fetch("/api/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, force }),
      });
      const data = await res.json();
      if (res.ok) setPrep(data.prep);
      else toast.error(data.error ?? "Prep failed");
    } catch {
      toast.error("Prep failed");
    }
    setLoading(false);
  }

  if (open && !prep && !loading) void load();

  const sections: { title: string; key: keyof PrepPack }[] = [
    { title: "Likely question themes", key: "themes" },
    { title: `What to say about ${company}`, key: "companyTalkingPoints" },
    { title: "Your stories (STAR)", key: "yourStories" },
    { title: "Questions to ask them", key: "questionsToAsk" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Interview prep — {company}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 py-10 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Building your prep pack…
          </div>
        ) : prep ? (
          <div className="flex flex-col gap-4">
            {sections.map((s) => (
              <section key={s.key}>
                <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{s.title}</p>
                <ul className="flex flex-col gap-1.5">
                  {(prep[s.key] ?? []).map((item, i) => (
                    <li key={i} className="rounded-none border-2 border-foreground bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => load(true)} disabled={loading}>
                <RefreshCw className="size-3.5" /> Regenerate
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
