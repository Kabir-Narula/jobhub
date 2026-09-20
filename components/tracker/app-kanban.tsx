"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { differenceInDays } from "date-fns";
import type { AppStatus } from "@prisma/client";
import { FileText, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_COLOR, STATUS_LABEL } from "./status-select";
import { CompanyAvatar } from "@/components/company-avatar";
import { agingClass } from "./app-table";
import type { AppWithJob } from "./types";

const COLUMNS: AppStatus[] = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "GHOSTED"];

const STATUS_DOT: Record<AppStatus, string> = {
  APPLIED: "bg-[#8b877a]",
  INTERVIEWING: "bg-[#c2410c]",
  OFFER: "bg-emerald-400",
  REJECTED: "bg-red-400",
  GHOSTED: "bg-[#d5d1c6]",
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
        "cursor-grab rounded-lg border border-[#e6e3db] bg-white p-3 transition-colors hover:border-[#e6e3db] active:cursor-grabbing",
        isDragging && "z-50 border-[#c2410c]/60 opacity-90 shadow-lg"
      )}
    >
      <div className="flex items-start gap-2.5">
        <CompanyAvatar company={app.job.company} className="size-7 rounded-md text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-[#1c1b17]">{app.job.company}</p>
          <p className="truncate text-xs text-[#8b877a]">{app.job.title}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(app.id);
          }}
          className="text-[#a8a294] transition-colors hover:text-red-600"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#8b877a]">
        <span className={cn("rounded bg-[#f1efe9] px-1.5 py-0.5", agingClass(app))}>{days}d</span>
        <span className="flex gap-1.5">
          {app.resumeVersion && (
            <a
              href={`/api/documents/${app.resumeVersion.id}/pdf?download=1`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 transition-colors hover:text-[#c2410c]"
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
              className="flex items-center gap-0.5 transition-colors hover:text-[#c2410c]"
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
        "flex min-h-96 w-52 shrink-0 flex-col gap-2 rounded-lg border border-[#e6e3db] bg-[#f6f5f1] p-2 transition-colors",
        isOver && "border-[#c2410c]/50 bg-[#fdeadd]/60"
      )}
    >
      <div className="flex items-center justify-between px-1.5 py-1.5">
        <span className={cn("flex items-center gap-1.5 text-xs font-medium", STATUS_COLOR[status])}>
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
          {STATUS_LABEL[status]}
        </span>
        <span className="rounded bg-[#f1efe9] px-1.5 py-0.5 text-[10px] text-[#8b877a]">{apps.length}</span>
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
      <p className="py-16 text-center text-sm text-[#8b877a]">
        No applications yet. Apply to a job from the Jobs page and confirm when you return.
      </p>
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
