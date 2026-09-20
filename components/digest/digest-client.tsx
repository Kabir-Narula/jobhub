"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Job } from "@prisma/client";
import { JobCard } from "@/components/jobs/job-card";
import { BUCKET_LABEL } from "@/components/jobs/labels";
import type { LocationBucket } from "@prisma/client";

const ORDER: LocationBucket[] = ["TORONTO", "REMOTE", "GTA_COMMUTE"];

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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Digest</h1>
        <p className="text-xs text-[#8b877a]">
          {jobs.length} new posting{jobs.length === 1 ? "" : "s"} since {new Date(since).toLocaleString()}
          {lastRunAt ? ` · last poll ${new Date(lastRunAt).toLocaleString()}` : ""} · {appCount} applications tracked
        </p>
      </div>

      {jobs.length === 0 ? (
        <p className="py-16 text-center text-sm text-[#8b877a]">
          Nothing new since your last visit. New matches will show up here after the next poll.
        </p>
      ) : (
        grouped.map((g) => (
          <section key={g.bucket}>
            <h2 className="mb-2 text-sm font-medium text-[#4a473f]">
              {BUCKET_LABEL[g.bucket]} <span className="text-[#a8a294]">({g.jobs.length})</span>
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
