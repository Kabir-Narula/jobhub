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
  onMarkApplied?: (job: Job) => void;
}

/* deliberately clashing bucket colors — visual friction is the point */
const BUCKET_STYLE: Record<string, string> = {
  TORONTO: "bg-primary text-primary-foreground",
  REMOTE: "bg-[#0f766e] text-white",
  GTA_COMMUTE: "bg-accent",
};

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-none border-2 border-foreground bg-card px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase leading-none tracking-wider text-foreground", className)}>
      {children}
    </span>
  );
}

const NEW_WINDOW_MS = 48 * 3600 * 1000;

export function JobCard({ job, selected, applied = false, onApply, onToggleSave, onToggleDismiss, onMarkApplied }: Props) {
  const [expanded, setExpanded] = useState(false);
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const posted = job.postedAt ?? job.firstSeenAt;
  const isNew = Date.now() - new Date(job.firstSeenAt).getTime() < NEW_WINDOW_MS;

  return (
    <div
      data-job-id={job.id}
      className={cn(
        "group relative rounded-none border-2 border-foreground bg-card p-4 shadow-hard-sm transition-all duration-150",
        selected
          ? "-translate-x-0.5 -translate-y-0.5 border-ring bg-[#eceaff] shadow-hard"
          : "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard",
        job.dismissedAt && "opacity-55"
      )}
    >
      <div className="flex items-start gap-3.5">
        <CompanyAvatar company={job.company} className="mt-0.5 size-9 rounded-none border-2 border-foreground" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-heading text-[15px] font-bold uppercase tracking-tight text-foreground">{job.title}</h3>
            {applied && (
              <span className="flex items-center gap-1 rounded-none border-2 border-foreground bg-[#0f766e] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                <CheckCircle2 className="size-3" /> applied
              </span>
            )}
            {isNew && !applied && (
              <span className="tilt-r inline-block rounded-none border-2 border-foreground bg-primary px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary-foreground shadow-hard-sm">
                new
              </span>
            )}
            {job.viewedAt && !applied && <Eye className="size-3.5 shrink-0 text-muted-foreground" />}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">{job.company}</span>
            {" · "}{job.locationRaw || "—"}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Tag className={BUCKET_STYLE[job.bucket]}>{BUCKET_LABEL[job.bucket]}</Tag>
            {job.workMode !== "UNKNOWN" && <Tag>{WORKMODE_LABEL[job.workMode]}</Tag>}
            <Tag>{SENIORITY_LABEL[job.seniority]}</Tag>
            <Tag>{CATEGORY_LABEL[job.category]}</Tag>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
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
            <Button size="sm" disabled className="border-[#0f766e] bg-[#0f766e] opacity-100">
              <CheckCircle2 className="size-3" /> Applied
            </Button>
          ) : (
            <Button size="sm" onClick={() => onApply(job)}>
              <ExternalLink className="size-3" /> Apply
            </Button>
          )}
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/tailor/${job.id}`} />}>
            <Sparkles className="size-3" /> Tailor
          </Button>
          {!applied && onMarkApplied && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onMarkApplied(job)}
              title="Mark as applied (m)"
            >
              <CheckCircle2 className="size-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggleSave(job)}
            className={cn(job.savedAt && "bg-accent")}
            title="Save (s)"
          >
            <Bookmark className={cn("size-4", job.savedAt && "fill-current")} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggleDismiss(job)}
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
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn("size-3 transition-transform duration-200", expanded && "rotate-180")} />
            {expanded ? "Hide description" : "Description"}
          </button>
          {expanded && (
            <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-none border-2 border-foreground bg-muted p-3 text-xs leading-relaxed text-foreground">
              {job.description.slice(0, 4000)}
              {job.description.length > 4000 ? "…" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
