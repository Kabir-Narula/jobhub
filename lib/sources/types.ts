export interface NormalizedJob {
  title: string;
  company: string;
  /** Location exactly as the source reported it. */
  locationRaw: string;
  /** Remote flag as reported by the source; null = not reported. */
  remote: boolean | null;
  description: string;
  /** Adapter instance name, e.g. "greenhouse:stackadapt" or "remotive". */
  source: string;
  sourceId: string;
  sourceUrl: string;
  applyUrl: string;
  postedAt: Date | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
}

export interface SourceAdapter {
  /** Unique instance name, e.g. "greenhouse:stackadapt". */
  name: string;
  /** Must throw on failure — the orchestrator catches per-source. */
  fetch(): Promise<NormalizedJob[]>;
}

export interface SourceResult {
  source: string;
  ok: boolean;
  count: number;
  newCount: number;
  error?: string;
  durationMs: number;
}
