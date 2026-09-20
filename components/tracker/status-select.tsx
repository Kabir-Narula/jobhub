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

export const STATUS_COLOR: Record<AppStatus, string> = {
  APPLIED: "text-[#4a473f]",
  INTERVIEWING: "text-[#c2410c]",
  OFFER: "text-[#15803d]",
  REJECTED: "text-red-600",
  GHOSTED: "text-[#8b877a]",
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
      <SelectTrigger className={cn("h-7 w-36 bg-white text-xs", STATUS_COLOR[app.status])}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(STATUS_LABEL) as AppStatus[]).map((s) => (
          <SelectItem key={s} value={s} className={STATUS_COLOR[s]}>
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type { Job };
