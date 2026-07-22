"use client";

import { useState } from "react";
import Link from "next/link";
import type { Job } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompanyAvatar } from "@/components/company-avatar";
import {
  BUCKET_LABEL,
  CATEGORY_LABEL,
  SENIORITY_LABEL,
  WORKMODE_LABEL,
  formatSalary,
  sourceLabel,
} from "./labels";
import { Bookmark, CheckCircle2, ChevronDown, ExternalLink, Eye, Sparkles, X } from "lucide-react";

interface Props {
  job: Job;
  selected: boolean;
  applied?: boolean;
  onApply: (job: Job) => void;
  onToggleSave: (job: Job) => void;
  onToggleDismiss: (job: Job) => void;
}

const BUCKET_STYLE: Record<string, string> = {
  TORONTO: "bg-[#fdeadd] text-[#9a3412]",
  REMOTE: "bg-[#e0f2fe] text-[#075985]",
  GTA_COMMUTE: "bg-[#fef3c7] text-[#92400e]",
};

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-md bg-[#f1efe9] px-1.5 py-0.5 text-[11px] font-medium leading-none text-[#6e6b61]", className)}>
      {children}
    </span>
  );
}

const NEW_WINDOW_MS = 48 * 3600 * 1000;

export function JobCard({ job, selected, applied = false, onApply, onToggleSave, onToggleDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const posted = job.postedAt ?? job.firstSeenAt;
  const isNew = Date.now() - new Date(job.firstSeenAt).getTime() < NEW_WINDOW_MS;

  return (
    <div
      data-job-id={job.id}
      className={cn(
        "group relative rounded-xl border bg-white p-4 transition-all duration-150",
        selected
          ? "border-[#c2410c]/50 shadow-[0_0_0_3px_rgba(194,65,12,0.12),0_8px_24px_-12px_rgba(28,27,23,0.25)]"
          : "border-[#e6e3db] shadow-[0_1px_2px_rgba(28,27,23,0.05)] hover:-translate-y-px hover:border-[#d5d1c6] hover:shadow-[0_8px_24px_-12px_rgba(28,27,23,0.18)]",
        job.dismissedAt && "opacity-55"
      )}
    >
      <div className="flex items-start gap-3.5">
        <CompanyAvatar company={job.company} className="mt-0.5 size-9 rounded-[10px]" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-[#1c1b17]">{job.title}</h3>
            {applied && (
              <span className="flex items-center gap-1 rounded-md bg-[#dcfce7] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#15803d]">
                <CheckCircle2 className="size-3" /> applied
              </span>
            )}
            {isNew && !applied && (
              <span className="rounded-md bg-[#dcfce7] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#15803d]">
                new
              </span>
            )}
            {job.viewedAt && !applied && <Eye className="size-3.5 shrink-0 text-[#a8a294]" />}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-[#8b877a]">
            <span className="font-medium text-[#4a473f]">{job.company}</span>
            {" · "}{job.locationRaw || "—"}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Tag className={BUCKET_STYLE[job.bucket]}>{BUCKET_LABEL[job.bucket]}</Tag>
            {job.workMode !== "UNKNOWN" && <Tag>{WORKMODE_LABEL[job.workMode]}</Tag>}
            <Tag>{SENIORITY_LABEL[job.seniority]}</Tag>
            <Tag>{CATEGORY_LABEL[job.category]}</Tag>
            <span className="text-[11px] text-[#a8a294]">
              {sourceLabel(job.source)} · {formatDistanceToNow(new Date(posted), { addSuffix: true })}
              {salary ? ` · ${salary}` : ""}
            </span>
          </div>
        </div>

        {/* actions: hover-reveal (always visible when keyboard-selected) */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 transition-opacity duration-150",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          {applied ? (
            <Button size="sm" disabled className="h-7 bg-[#dcfce7] text-xs font-medium text-[#15803d] opacity-100">
              <CheckCircle2 className="size-3" /> Applied
            </Button>
          ) : (
            <Button size="sm" onClick={() => onApply(job)} className="h-7 bg-[#c2410c] text-xs font-medium text-[#fdf8f3] transition-transform duration-100 hover:bg-[#9a3412] active:scale-95">
              <ExternalLink className="size-3" /> Apply
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs text-[#6e6b61] hover:bg-[#fdeadd] hover:text-[#9a3412]" nativeButton={false} render={<Link href={`/tailor/${job.id}`} />}>
            <Sparkles className="size-3" /> Tailor
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggleSave(job)}
            className={cn("h-7 px-1.5 text-[#a8a294] hover:text-[#c2410c]", job.savedAt && "text-[#c2410c]")}
            title="Save (s)"
          >
            <Bookmark className={cn("size-4", job.savedAt && "fill-current")} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggleDismiss(job)}
            className="h-7 px-1.5 text-[#a8a294] hover:text-[#4a473f]"
            title={job.dismissedAt ? "Restore (d)" : "Dismiss (d)"}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {job.description && (
        <div className="mt-1.5 pl-12">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-[11px] text-[#a8a294] transition-colors hover:text-[#c2410c]"
          >
            <ChevronDown className={cn("size-3 transition-transform duration-200", expanded && "rotate-180")} />
            {expanded ? "Hide description" : "Description"}
          </button>
          {expanded && (
            <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#f6f5f1] p-3 text-xs leading-relaxed text-[#4a473f]">
              {job.description.slice(0, 4000)}
              {job.description.length > 4000 ? "…" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
