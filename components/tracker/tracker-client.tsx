"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AppStatus } from "@prisma/client";
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
        <h1 className="text-lg font-semibold tracking-tight">Tracker</h1>
      </div>

      {/* analytics strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[#e6e3db] bg-white p-3">
          <p className="text-xs text-[#8b877a]">Applications</p>
          <p className="mt-1 text-2xl font-semibold text-[#1c1b17]"><AnimatedNumber value={analytics.total} /></p>
        </div>
        <div className="rounded-lg border border-[#e6e3db] bg-white p-3">
          <p className="text-xs text-[#8b877a]">Response rate</p>
          <p className="mt-1 text-2xl font-semibold text-[#c2410c]"><AnimatedNumber value={analytics.responseRate} />%</p>
        </div>
        <div className="rounded-lg border border-[#e6e3db] bg-white p-3">
          <p className="text-xs text-[#8b877a]">Avg days to response</p>
          <p className="mt-1 text-2xl font-semibold text-[#1c1b17]">
            {analytics.avgDaysToResponse ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-[#e6e3db] bg-white p-3">
          <p className="text-xs text-[#8b877a]">Per week (8w)</p>
          <div className="mt-2 flex h-8 items-end gap-1">
            {analytics.weeks.map((w, i) => (
              <div
                key={i}
                title={`${w.label}: ${w.count}`}
                className="flex-1 rounded-sm bg-[#ea7c3f]"
                style={{ height: `${Math.max(6, (w.count / maxWeek) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="kanban">
        <div className="flex items-center justify-between gap-3">
          <TabsList className="bg-white">
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by company or role…"
            className="h-8 w-56 border-[#e6e3db] bg-white text-[13px]"
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
