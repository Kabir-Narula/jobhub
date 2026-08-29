"use client";

import type { Application, AppStatus, Job } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<AppStatus, string> = {
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  GHOSTED: "Ghosted",
};

/* status colors as mono uppercase badges with black 2px borders */
export const STATUS_COLOR: Record<AppStatus, string> = {
  APPLIED: "bg-[#0f766e] text-white",
  INTERVIEWING: "bg-accent text-accent-foreground",
  OFFER: "bg-primary text-primary-foreground",
  REJECTED: "bg-muted text-muted-foreground",
  GHOSTED: "bg-card text-muted-foreground",
};

export function StatusSelect({
  app,
  onChange,
}: {
  app: Application;
  onChange: (id: string, status: AppStatus) => void;
}) {
  return (
    <Select value={app.status} onValueChange={(v) => v && onChange(app.id, v as AppStatus)}>
      <SelectTrigger className={cn("h-7 w-36 font-mono text-[10px] font-bold uppercase tracking-[0.18em]", STATUS_COLOR[app.status])}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(STATUS_LABEL) as AppStatus[]).map((s) => (
          <SelectItem key={s} value={s} className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.18em]", STATUS_COLOR[s])}>
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type { Job };
