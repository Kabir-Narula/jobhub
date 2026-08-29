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
import { ArrowUpDown, ExternalLink, FileText, GraduationCap, Mail, Pencil, Sparkles, Trash2 } from "lucide-react";
import { StatusSelect } from "./status-select";
import { BUCKET_LABEL } from "@/components/jobs/labels";
import { CompanyAvatar } from "@/components/company-avatar";
import { EmailDialog } from "@/components/tailor/email-dialog";
import { PrepDialog } from "./prep-dialog";
import { cn } from "@/lib/utils";
import type { AppWithJob } from "./types";

type SortKey = "company" | "appliedAt" | "status";

/** Aging color for unanswered applications: bold ink at 14d, destructive at 30d. */
export function agingClass(app: { status: AppStatus; appliedAt: Date }): string {
  if (app.status !== "APPLIED") return "text-muted-foreground";
  const days = differenceInDays(new Date(), app.appliedAt);
  if (days >= 30) return "font-bold text-destructive";
  if (days >= 14) return "font-semibold text-foreground";
  return "text-muted-foreground";
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
  const [followUpApp, setFollowUpApp] = useState<AppWithJob | null>(null);
  const [prepApp, setPrepApp] = useState<AppWithJob | null>(null);

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
        className="flex items-center gap-1 hover:text-foreground"
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
      <div className="flex flex-col items-center gap-3 py-16">
        <p className="stamp tilt-l bg-accent">No applications yet</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Apply to a job from the Jobs page and confirm when you return.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-none border-2 border-foreground bg-card shadow-hard-sm">
      <Table>
        <TableHeader>
          <TableRow>
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
              <TableRow key={app.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <CompanyAvatar company={app.job.company} className="size-7 rounded-none border-2 border-foreground text-xs" />
                    <span className="font-heading text-[13px] font-bold uppercase tracking-tight text-foreground">{app.job.company}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">{app.job.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {BUCKET_LABEL[app.job.bucket]}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {format(app.appliedAt, "MMM d")}
                  <span className={cn("ml-2 font-mono text-[10px] uppercase tracking-wider", agingClass(app))}>{days}d ago</span>
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
                        className="h-7 px-2"
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
                        className="h-7 px-2"
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
                    {app.status === "INTERVIEWING" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 border-foreground bg-accent px-2 text-accent-foreground"
                        title="Interview prep pack"
                        onClick={() => setPrepApp(app)}
                      >
                        <GraduationCap className="size-3.5" />
                      </Button>
                    )}
                    {app.status === "APPLIED" && days >= 7 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 border-foreground bg-primary px-2 text-primary-foreground"
                        title="Draft a follow-up email"
                        onClick={() => setFollowUpApp(app)}
                      >
                        <Mail className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-7 px-2 text-muted-foreground hover:text-foreground",
                        (localNotes[app.id] ?? app.notes) && "border-foreground bg-primary text-primary-foreground"
                      )}
                      title={localNotes[app.id] ?? app.notes ?? "Add notes"}
                      onClick={() => {
                        setNotesDraft(localNotes[app.id] ?? app.notes ?? "");
                        setEditing(app);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" nativeButton={false} render={<Link href={`/tailor/${app.jobId}`} />}>
                      <Sparkles className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" nativeButton={false} render={<a href={app.job.applyUrl} target="_blank" rel="noreferrer" />}>
                      <ExternalLink className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground hover:bg-destructive hover:text-white"
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
        <DialogContent className="sm:max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Notes — {editing.job.company}
                </DialogTitle>
              </DialogHeader>
              <Textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Referral? Contact person? Interview prep notes…"
                className="min-h-28"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={saveNotes}>
                  Save notes
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {followUpApp && (
        <EmailDialog
          jobId={followUpApp.jobId}
          contact={firstContact(followUpApp)}
          open={Boolean(followUpApp)}
          onClose={() => setFollowUpApp(null)}
          mode="followup"
          daysSinceApplied={differenceInDays(new Date(), followUpApp.appliedAt)}
        />
      )}

      {prepApp && (
        <PrepDialog
          applicationId={prepApp.id}
          company={prepApp.job.company}
          open={Boolean(prepApp)}
          onClose={() => setPrepApp(null)}
        />
      )}
    </div>
  );
}

function firstContact(app: AppWithJob): { name: string; role: string; email: string } | null {
  const contacts = (app.job as unknown as { contacts?: { contacts?: { name?: string; role?: string; email?: string }[] } }).contacts?.contacts;
  const c = contacts?.[0];
  return c?.email ? { name: c.name ?? "", role: c.role ?? "", email: c.email } : null;
}
