"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Job } from "@prisma/client";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { JobCard } from "./job-card";
import { JobsHeader, type FilterState } from "./jobs-header";
import { ReturnPrompt } from "./return-prompt";
import { Inbox, RefreshCw } from "lucide-react";

interface RunInfo {
  startedAt: string;
  finishedAt: string | null;
  newJobs: number;
  ok: boolean;
  results: { source: string; ok: boolean; error?: string }[];
}

interface Props {
  jobs: Job[];
  lastRun: RunInfo | null;
  bucketCounts: Record<string, number>;
  appliedJobIds: string[];
  filters: FilterState;
}

export function JobsClient({ jobs: initialJobs, lastRun, bucketCounts, appliedJobIds, filters }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [selected, setSelected] = useState(-1); // no highlight until j/k is used
  const [refreshing, setRefreshing] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Sync with new server data (render-phase adjustment, no effect needed).
  const [prevJobs, setPrevJobs] = useState(initialJobs);
  if (prevJobs !== initialJobs) {
    setPrevJobs(initialJobs);
    setJobs(initialJobs);
    setSelected(-1);
  }

  const apply = useCallback((job: Job) => {
    fetch(`/api/jobs/${job.id}/view`, { method: "POST" }).catch(() => {});
    window.open(job.applyUrl, "_blank", "noopener");
    setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, viewedAt: new Date() } : j)));
  }, []);

  const toggleSave = useCallback((job: Job) => {
    const saved = !job.savedAt;
    fetch(`/api/jobs/${job.id}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved }),
    }).catch(() => {});
    setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, savedAt: saved ? new Date() : null } : j)));
  }, []);

  const toggleDismiss = useCallback((job: Job) => {
    const dismissed = !job.dismissedAt;
    fetch(`/api/jobs/${job.id}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed }),
    }).catch(() => {});
    setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, dismissedAt: dismissed ? new Date() : null } : j)));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    toast.loading("Starting poll…", { id: "poll" });
    try {
      await fetch("/api/jobs/refresh", { method: "POST" });
    } catch {
      toast.error("Could not start the poll", { id: "poll" });
      setRefreshing(false);
      return;
    }

    // Watch live progress until the run finishes.
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/jobs/poll-status");
        const { polling, lastRun } = await res.json();
        const done = lastRun?.results?.length ?? 0;
        const total = 38;
        if (polling || (lastRun && !lastRun.finishedAt)) {
          toast.loading(
            `Polling… ${done}/${total} sources, +${lastRun?.newJobs ?? 0} new`,
            { id: "poll" }
          );
        } else {
          clearInterval(timer);
          toast.success(
            `Done: ${lastRun?.totalSeen ?? 0} seen, +${lastRun?.newJobs ?? 0} new, ${lastRun?.results?.filter((r: { ok: boolean }) => !r.ok).length ?? 0} failed`,
            { id: "poll" }
          );
          setRefreshing(false);
          router.refresh();
        }
        if (Date.now() - startedAt > 10 * 60 * 1000) {
          clearInterval(timer);
          toast.error("Poll is taking unusually long — check the server logs", { id: "poll" });
          setRefreshing(false);
        }
      } catch {
        // transient read errors are ignored; next tick retries
      }
    }, 2500);
  }, [router]);

  // Keyboard shortcuts: j/k navigate, a apply, s save, d dismiss, / search, r refresh.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"], [data-slot="popover-content"]')) return;

      const job = selected >= 0 ? jobs[selected] : undefined;
      switch (e.key) {
        case "j":
          setSelected((s) => (s < 0 ? 0 : Math.min(s + 1, jobs.length - 1)));
          break;
        case "k":
          setSelected((s) => (s < 0 ? 0 : Math.max(s - 1, 0)));
          break;
        case "a":
          if (job) apply(job);
          break;
        case "s":
          if (job) toggleSave(job);
          break;
        case "d":
          if (job) toggleDismiss(job);
          break;
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case "r":
          if (!refreshing) refresh();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jobs, selected, apply, toggleSave, toggleDismiss, refreshing, refresh]);

  useEffect(() => {
    if (selected < 0) return;
    const job = jobs[selected];
    if (!job) return;
    document
      .querySelector(`[data-job-id="${job.id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, jobs]);

  const failedSources = lastRun?.results.filter((r) => !r.ok).length ?? 0;
  const appliedSet = new Set(appliedJobIds);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#1c1b17]">Jobs</h1>
          <p className="mt-0.5 text-xs text-[#8b877a]">
            {lastRun ? (
              <>
                {lastRun.newJobs > 0 ? (
                  <span className="font-medium text-[#c2410c]">+{lastRun.newJobs} new last poll · </span>
                ) : null}
                {failedSources > 0 ? (
                  <span className="text-red-600">{failedSources} source{failedSources > 1 ? "s" : ""} failing · </span>
                ) : null}
              </>
            ) : (
              "No poll yet — hit refresh"
            )}
            <span>j/k move · a apply · s save · d dismiss</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          disabled={refreshing}
          className="border-[#e6e3db] bg-white text-[#4a473f] shadow-none hover:border-[#c2410c]/40 hover:text-[#c2410c]"
        >
          <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
          {refreshing ? "Polling…" : "Refresh"}
        </Button>
      </div>

      <JobsHeader filters={filters} bucketCounts={bucketCounts} searchRef={searchRef} />

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-[#e6e3db] bg-white">
            <Inbox className="size-5 text-[#a8a294]" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-[#1c1b17]">Nothing here</p>
            <p className="mt-1 text-xs text-[#8b877a]">Try widening the filters, or refresh to pull new postings.</p>
          </div>
        </div>
      ) : (
        <motion.div
          className="flex flex-col gap-2"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.035 } } }}
        >
          {jobs.map((job, i) => (
            <motion.div
              key={job.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
              }}
            >
              <JobCard
                job={job}
                selected={i === selected}
                applied={appliedSet.has(job.id)}
                onApply={apply}
                onToggleSave={toggleSave}
                onToggleDismiss={toggleDismiss}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <ReturnPrompt />
    </div>
  );
}
