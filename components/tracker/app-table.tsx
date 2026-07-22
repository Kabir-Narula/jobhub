"use client";

import { useState } from "react";
import Link from "next/link";
import { differenceInDays, format } from "date-fns";
import type { AppStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpDown, ExternalLink, FileText, Pencil, Sparkles, Trash2 } from "lucide-react";
import { StatusSelect } from "./status-select";
import { BUCKET_LABEL } from "@/components/jobs/labels";
import { CompanyAvatar } from "@/components/company-avatar";
import { cn } from "@/lib/utils";
import type { AppWithJob } from "./types";

type SortKey = "company" | "appliedAt" | "status";

/** Aging color for unanswered applications: amber at 14d, red at 30d. */
export function agingClass(app: { status: AppStatus; appliedAt: Date }): string {
  if (app.status !== "APPLIED") return "text-[#a8a294]";
  const days = differenceInDays(new Date(), app.appliedAt);
  if (days >= 30) return "font-semibold text-red-600";
  if (days >= 14) return "font-medium text-amber-700";
  return "text-[#a8a294]";
}

export function AppTable({
  apps,
  onStatusChange,
  onRemove,
}: {
  apps: AppWithJob[];
  onStatusChange: (id: string, status: AppStatus) => void;
  onRemove: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("appliedAt");
  const [asc, setAsc] = useState(false);
  const [editing, setEditing] = useState<AppWithJob | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  async function saveNotes() {
    if (!editing) return;
    const res = await fetch(`/api/applications/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft }),
    });
    if (res.ok) {
      setLocalNotes((n) => ({ ...n, [editing.id]: notesDraft }));
      toast.success("Notes saved");
      setEditing(null);
    } else {
      toast.error("Could not save notes");
    }
  }

  const sorted = [...apps].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "company") cmp = a.job.company.localeCompare(b.job.company);
    if (sortKey === "appliedAt") cmp = a.appliedAt.getTime() - b.appliedAt.getTime();
    if (sortKey === "status") cmp = a.status.localeCompare(b.status);
    return asc ? cmp : -cmp;
  });

  function header(label: string, key: SortKey) {
    return (
      <button
        className="flex items-center gap-1 hover:text-[#1c1b17]"
        onClick={() => {
          if (sortKey === key) setAsc(!asc);
          else {
            setSortKey(key);
            setAsc(true);
          }
        }}
      >
        {label} <ArrowUpDown className="size-3" />
      </button>
    );
  }

  if (apps.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-[#8b877a]">
        No applications yet. Apply to a job from the Jobs page and confirm when you return.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-[#e6e3db]">
      <Table>
        <TableHeader>
          <TableRow className="border-[#e6e3db]">
            <TableHead>{header("Company", "company")}</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>{header("Applied", "appliedAt")}</TableHead>
            <TableHead>{header("Status", "status")}</TableHead>
            <TableHead>Documents</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((app) => {
            const days = differenceInDays(new Date(), app.appliedAt);
            return (
              <TableRow key={app.id} className="border-[#e6e3db]">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <CompanyAvatar company={app.job.company} className="size-7 rounded-md text-xs" />
                    <span className="font-medium text-[#1c1b17]">{app.job.company}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-56 truncate text-[#6e6b61]">{app.job.title}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-[#e6e3db] text-[#6e6b61]">
                    {BUCKET_LABEL[app.job.bucket]}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-[#6e6b61]">
                  {format(app.appliedAt, "MMM d")}
                  <span className={cn("ml-2 text-xs", agingClass(app))}>{days}d ago</span>
                </TableCell>
                <TableCell>
                  <StatusSelect app={app} onChange={onStatusChange} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {app.resumeVersion && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-[#6e6b61]"
                        nativeButton={false}
                        render={<a href={`/api/documents/${app.resumeVersion.id}/pdf?download=1`} target="_blank" rel="noreferrer" />}
                      >
                        <FileText className="size-3.5" /> R v{app.resumeVersion.version}
                      </Button>
                    )}
                    {app.coverVersion && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-[#6e6b61]"
                        nativeButton={false}
                        render={<a href={`/api/documents/${app.coverVersion.id}/pdf?download=1`} target="_blank" rel="noreferrer" />}
                      >
                        <FileText className="size-3.5" /> C v{app.coverVersion.version}
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-7 px-2 text-[#8b877a] hover:text-[#c2410c]",
                        (localNotes[app.id] ?? app.notes) && "text-[#c2410c]"
                      )}
                      title={localNotes[app.id] ?? app.notes ?? "Add notes"}
                      onClick={() => {
                        setNotesDraft(localNotes[app.id] ?? app.notes ?? "");
                        setEditing(app);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[#6e6b61]" nativeButton={false} render={<Link href={`/tailor/${app.jobId}`} />}>
                      <Sparkles className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[#6e6b61]" nativeButton={false} render={<a href={app.job.applyUrl} target="_blank" rel="noreferrer" />}>
                      <ExternalLink className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[#8b877a] hover:text-red-600"
                      onClick={() => onRemove(app.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="border-[#e6e3db] bg-white sm:max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-base">
                  Notes — {editing.job.company}
                </DialogTitle>
              </DialogHeader>
              <Textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Referral? Contact person? Interview prep notes…"
                className="min-h-28 border-[#e6e3db] bg-white"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="border-[#e6e3db]" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button className="bg-[#c2410c] text-[#fdf8f3] hover:bg-[#9a3412]" onClick={saveNotes}>
                  Save notes
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
