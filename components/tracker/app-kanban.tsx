"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { differenceInDays } from "date-fns";
import type { AppStatus } from "@prisma/client";
import { FileText, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "./status-select";
import { CompanyAvatar } from "@/components/company-avatar";
import { agingClass } from "./app-table";
import type { AppWithJob } from "./types";

const COLUMNS: AppStatus[] = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "GHOSTED"];

const STATUS_DOT: Record<AppStatus, string> = {
  APPLIED: "bg-[#0f766e]",
  INTERVIEWING: "bg-accent",
  OFFER: "bg-primary",
  REJECTED: "bg-muted",
  GHOSTED: "bg-card",
};

function KanbanCard({ app, onRemove }: { app: AppWithJob; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });
  const days = differenceInDays(new Date(), app.appliedAt);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-grab rounded-none border-2 border-foreground bg-card p-3 shadow-hard-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:cursor-grabbing",
        isDragging && "z-50 opacity-90 shadow-hard-lg"
      )}
    >
      <div className="flex items-start gap-2.5">
        <CompanyAvatar company={app.job.company} className="size-7 rounded-none border-2 border-foreground text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-[13px] font-bold uppercase tracking-tight text-foreground">{app.job.company}</p>
          <p className="truncate text-xs text-muted-foreground">{app.job.title}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(app.id);
          }}
          className="text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className={cn("rounded-none border-2 border-foreground bg-muted px-1.5 py-0.5", agingClass(app))}>{days}d</span>
        <span className="flex gap-1.5">
          {app.resumeVersion && (
            <a
              href={`/api/documents/${app.resumeVersion.id}/pdf?download=1`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 text-[#2137ff] underline decoration-2 underline-offset-2 transition-colors hover:no-underline"
            >
              <FileText className="size-3" />R
            </a>
          )}
          {app.coverVersion && (
            <a
              href={`/api/documents/${app.coverVersion.id}/pdf?download=1`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 text-[#2137ff] underline decoration-2 underline-offset-2 transition-colors hover:no-underline"
            >
              <FileText className="size-3" />C
            </a>
          )}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  apps,
  onRemove,
}: {
  status: AppStatus;
  apps: AppWithJob[];
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-96 w-52 shrink-0 flex-col gap-2 rounded-none border-2 border-foreground bg-muted p-2 shadow-hard-sm transition-all",
        isOver && "border-ring bg-primary/40"
      )}
    >
      <div className="flex items-center justify-between px-1.5 py-1.5">
        <span className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider text-foreground">
          <span className={cn("size-2 rounded-none border-2 border-foreground", STATUS_DOT[status])} />
          {STATUS_LABEL[status]}
        </span>
        <span className="rounded-none border-2 border-foreground bg-card px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">{apps.length}</span>
      </div>
      {apps.map((app) => (
        <KanbanCard key={app.id} app={app} onRemove={onRemove} />
      ))}
    </div>
  );
}

export function AppKanban({
  apps,
  onStatusChange,
  onRemove,
}: {
  apps: AppWithJob[];
  onStatusChange: (id: string, status: AppStatus) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const app = apps.find((a) => a.id === active.id);
    const target = over.id as AppStatus;
    if (app && COLUMNS.includes(target) && app.status !== target) {
      onStatusChange(app.id, target);
    }
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <p className="stamp tilt-r bg-accent">No applications yet</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Apply to a job from the Jobs page and confirm when you return.
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((status) => (
          <KanbanColumn key={status} status={status} apps={apps.filter((a) => a.status === status)} onRemove={onRemove} />
        ))}
      </div>
    </DndContext>
  );
}
