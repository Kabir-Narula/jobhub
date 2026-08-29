"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AppStatus } from "@prisma/client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { AppTable } from "./app-table";
import { AppKanban } from "./app-kanban";
import { AnimatedNumber } from "@/components/animated-number";
import type { AppWithJob } from "./types";

export type { AppWithJob };

export interface Analytics {
  total: number;
  responseRate: number;
  avgDaysToResponse: number | null;
  weeks: { label: string; count: number }[];
  atsBuckets?: { label: string; total: number; positive: number; rate: number }[];
  bySource?: { label: string; total: number; positive: number; rate: number }[];
}

export function TrackerClient({
  applications: initial,
  analytics,
}: {
  applications: AppWithJob[];
  analytics: Analytics;
}) {
  const [apps, setApps] = useState(initial);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? apps.filter(
        (a) =>
          a.job.company.toLowerCase().includes(query.trim().toLowerCase()) ||
          a.job.title.toLowerCase().includes(query.trim().toLowerCase())
      )
    : apps;

  async function updateStatus(id: string, status: AppStatus) {
    setApps((as) => as.map((a) => (a.id === id ? { ...a, status } : a)));
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("Status update failed");
      setApps(initial);
    }
  }

  async function remove(id: string) {
    const backup = apps;
    setApps((as) => as.filter((a) => a.id !== id));
    const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      setApps(backup);
    } else {
      toast.success("Application removed");
    }
  }

  const maxWeek = Math.max(1, ...analytics.weeks.map((w) => w.count));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="stamp tilt-l bg-accent">Pipeline</p>
          <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight md:text-5xl">Tracker</h1>
        </div>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<a href="/api/applications/export" download />}
        >
          <Download className="size-3.5" /> Export CSV
        </Button>
      </div>

      {/* analytics strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-none border-2 border-foreground bg-card p-3 shadow-hard-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Applications</p>
          <p className="mt-1 font-display text-2xl font-bold"><AnimatedNumber value={analytics.total} /></p>
        </div>
        <div className="rounded-none border-2 border-foreground bg-card p-3 shadow-hard-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Response rate</p>
          <p className="mt-1 inline-block border-2 border-foreground bg-primary px-1 font-display text-2xl font-bold shadow-hard-sm"><AnimatedNumber value={analytics.responseRate} />%</p>
        </div>
        <div className="rounded-none border-2 border-foreground bg-card p-3 shadow-hard-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Avg days to response</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {analytics.avgDaysToResponse ?? "—"}
          </p>
        </div>
        <div className="rounded-none border-2 border-foreground bg-card p-3 shadow-hard-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Per week (8w)</p>
          <div className="mt-2 flex h-8 items-end gap-1">
            {analytics.weeks.map((w, i) => (
              <div
                key={i}
                title={`${w.label}: ${w.count}`}
                className="flex-1 rounded-none bg-primary"
                style={{ height: `${Math.max(6, (w.count / maxWeek) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* outcome analytics — what actually converts */}
      {((analytics.atsBuckets?.some((b) => b.total > 0) ?? false) || (analytics.bySource?.some((s) => s.total > 0) ?? false)) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {analytics.atsBuckets?.some((b) => b.total > 0) && (
            <div className="rounded-none border-2 border-foreground bg-card p-4 shadow-hard-sm">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Response rate by resume ATS score</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {analytics.atsBuckets.map((b) => (
                  <div key={b.label} className="flex items-center gap-2">
                    <span className="w-20 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{b.label}</span>
                    <div className="h-3 flex-1 rounded-none border-2 border-foreground bg-card">
                      <div className="h-full bg-primary transition-all duration-500" style={{ width: `${b.rate}%` }} />
                    </div>
                    <span className="w-14 text-right font-mono text-[10px] font-bold">{b.rate}% <span className="font-normal text-muted-foreground">({b.positive}/{b.total})</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analytics.bySource?.some((s) => s.total > 0) && (
            <div className="rounded-none border-2 border-foreground bg-card p-4 shadow-hard-sm">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Response rate by source</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {analytics.bySource.map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="w-20 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                    <div className="h-3 flex-1 rounded-none border-2 border-foreground bg-card">
                      <div className="h-full bg-primary transition-all duration-500" style={{ width: `${s.rate}%` }} />
                    </div>
                    <span className="w-14 text-right font-mono text-[10px] font-bold">{s.rate}% <span className="font-normal text-muted-foreground">({s.positive}/{s.total})</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="kanban">
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by company or role…"
            className="h-8 w-56"
          />
        </div>
        <TabsContent value="kanban">
          <AppKanban apps={filtered} onStatusChange={updateStatus} onRemove={remove} />
        </TabsContent>
        <TabsContent value="table">
          <AppTable apps={filtered} onStatusChange={updateStatus} onRemove={remove} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
