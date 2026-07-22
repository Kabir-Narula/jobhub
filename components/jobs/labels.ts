import type { LocationBucket, RoleCategory, Seniority, WorkMode } from "@prisma/client";

export const BUCKET_LABEL: Record<LocationBucket, string> = {
  TORONTO: "Toronto",
  GTA_COMMUTE: "GTA",
  REMOTE: "Remote",
};

export const WORKMODE_LABEL: Record<WorkMode, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "On-site",
  UNKNOWN: "—",
};

export const SENIORITY_LABEL: Record<Seniority, string> = {
  NEW_GRAD: "New grad",
  MID: "Mid",
  SENIOR: "Senior",
};

export const CATEGORY_LABEL: Record<RoleCategory, string> = {
  SWE: "SWE",
  DATA_ML: "Data/ML",
  INFRA: "Infra",
  CONSULTING_TECH: "Consulting",
  OTHER: "Other",
};

export function sourceLabel(source: string): string {
  const [type, token] = source.split(":");
  if (!token) return type.charAt(0).toUpperCase() + type.slice(1);
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export function formatSalary(min: number | null, max: number | null, currency: string | null): string | null {
  if (!min && !max) return null;
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const cur = currency === "CAD" ? "CA$" : currency === "USD" ? "US$" : "$";
  if (min && max) return `${cur}${k(min)}–${k(max)}`;
  return `${cur}${k(min ?? max!)}${max ? "" : "+"}`;
}
