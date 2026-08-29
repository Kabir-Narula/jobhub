"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Job } from "@prisma/client";
import { JobCard } from "@/components/jobs/job-card";
import { BUCKET_LABEL } from "@/components/jobs/labels";
import type { LocationBucket } from "@prisma/client";

const ORDER: LocationBucket[] = ["TORONTO", "REMOTE", "GTA_COMMUTE"];

/* same deliberately clashing bucket colors as the job cards */
const BUCKET_STAMP: Record<LocationBucket, string> = {
  TORONTO: "bg-primary",
  REMOTE: "bg-[#0f766e] text-white",
  GTA_COMMUTE: "bg-accent",
};

export function DigestClient({
  jobs,
  since,
  lastRunAt,
  appCount,
}: {
  jobs: Job[];
  since: string;
  lastRunAt: string | null;
  appCount: number;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(jobs);

  // Mark the digest as seen — next visit shows only what arrived after now.
  useEffect(() => {
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "lastDigestView", value: new Date().toISOString() }),
    }).catch(() => {});
  }, []);

  const grouped = ORDER.map((bucket) => ({
    bucket,
    jobs: local.filter((j) => j.bucket === bucket),
  })).filter((g) => g.jobs.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="stamp tilt-l bg-accent">Fresh off the poll</span>
        <h1 className="font-display mt-3 text-4xl font-bold uppercase tracking-tight md:text-5xl">Digest</h1>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {jobs.length} new posting{jobs.length === 1 ? "" : "s"} since {new Date(since).toLocaleString()}
          {lastRunAt ? ` · last poll ${new Date(lastRunAt).toLocaleString()}` : ""} · {appCount} applications tracked
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-none border-2 border-foreground bg-card px-6 py-16 text-center shadow-hard-sm">
          <span className="stamp tilt-r bg-primary">All caught up</span>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Nothing new since your last visit. New matches will show up here after the next poll.
          </p>
        </div>
      ) : (
        grouped.map((g) => (
          <section key={g.bucket}>
            <h2 className="mb-3 font-heading text-2xl font-bold uppercase tracking-wider">
              {BUCKET_LABEL[g.bucket]}
              <span className={`stamp tilt-r ml-3 align-middle font-bold ${BUCKET_STAMP[g.bucket]}`}>
                {g.jobs.length}
              </span>
            </h2>
            <div className="flex flex-col gap-2">
              {g.jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={false}
                  onApply={(j) => {
                    fetch(`/api/jobs/${j.id}/view`, { method: "POST" }).catch(() => {});
                    window.open(j.applyUrl, "_blank", "noopener");
                  }}
                  onToggleSave={(j) => {
                    fetch(`/api/jobs/${j.id}/save`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ saved: !j.savedAt }),
                    }).then(() => router.refresh());
                  }}
                  onToggleDismiss={(j) => {
                    fetch(`/api/jobs/${j.id}/dismiss`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ dismissed: true }),
                    }).then(() => setLocal((ls) => ls.filter((x) => x.id !== j.id)));
                  }}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
