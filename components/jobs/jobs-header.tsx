"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal } from "lucide-react";

export interface FilterState {
  q: string;
  bucket: string;
  workMode: string;
  seniority: string;
  category: string;
  posted: string;
  source: string;
  savedOnly: boolean;
  showDismissed: boolean;
}

const BUCKETS = [
  { value: "", label: "All" },
  { value: "TORONTO", label: "Toronto" },
  { value: "REMOTE", label: "Remote" },
  { value: "GTA_COMMUTE", label: "GTA" },
];

const GROUPS: { key: "seniority" | "category" | "workMode" | "posted"; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: "seniority",
    label: "Level",
    options: [
      { value: "NEW_GRAD", label: "New grad" },
      { value: "MID", label: "Mid" },
      { value: "SENIOR", label: "Senior" },
    ],
  },
  {
    key: "category",
    label: "Category",
    options: [
      { value: "SWE", label: "SWE" },
      { value: "DATA_ML", label: "Data / ML" },
      { value: "INFRA", label: "Infra / Cloud" },
      { value: "CONSULTING_TECH", label: "Consulting-tech" },
      { value: "OTHER", label: "Other" },
    ],
  },
  {
    key: "workMode",
    label: "Work mode",
    options: [
      { value: "REMOTE", label: "Remote" },
      { value: "HYBRID", label: "Hybrid" },
      { value: "ONSITE", label: "On-site" },
    ],
  },
  {
    key: "posted",
    label: "Found",
    options: [
      { value: "24h", label: "24h" },
      { value: "3d", label: "3d" },
      { value: "7d", label: "7d" },
      { value: "30d", label: "30d" },
    ],
  },
];

export function JobsHeader({
  filters,
  bucketCounts,
  searchRef,
}: {
  filters: FilterState;
  bucketCounts: Record<string, number>;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external filter state (render-phase adjustment, no effect needed).
  const [prevQ, setPrevQ] = useState(filters.q);
  if (prevQ !== filters.q) {
    setPrevQ(filters.q);
    setQ(filters.q);
  }

  const push = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      router.push(`/jobs?${params.toString()}`);
    },
    [router, searchParams]
  );

  function onSearch(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: v.trim() }), 350);
  }

  const activeFilters = GROUPS.filter((g) => filters[g.key]).length;
  const total = (bucketCounts.TORONTO ?? 0) + (bucketCounts.REMOTE ?? 0) + (bucketCounts.GTA_COMMUTE ?? 0);
  const countFor = (v: string) => (v === "" ? total : bucketCounts[v] ?? 0);

  return (
    <div className="sticky top-0 z-30 -mx-8 border-b border-[#e6e3db] bg-[#f6f5f1]/85 px-8 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {/* search */}
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#a8a294]" />
          <Input
            ref={searchRef}
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search title, company, keyword…"
            className="h-8 border-[#e6e3db] bg-white pl-8 pr-8 text-[13px] shadow-none focus-visible:border-[#c2410c]/50 focus-visible:ring-[#c2410c]/20"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[#e6e3db] bg-[#f6f5f1] px-1 text-[10px] text-[#a8a294]">/</kbd>
        </div>

        {/* location tabs with counts */}
        <div className="flex items-center rounded-lg border border-[#e6e3db] bg-white p-0.5 shadow-[0_1px_2px_rgba(28,27,23,0.04)]">
          {BUCKETS.map((b) => (
            <button
              key={b.value}
              onClick={() => push({ bucket: b.value })}
              className={cn(
                "rounded-md px-3 py-1 text-[13px] transition-all duration-150",
                filters.bucket === b.value
                  ? "bg-[#1c1b17] font-medium text-[#f6f5f1] shadow-sm"
                  : "text-[#6e6b61] hover:text-[#1c1b17]"
              )}
            >
              {b.label}
              <span className={cn("ml-1.5 text-[11px]", filters.bucket === b.value ? "text-[#f2a86f]" : "text-[#a8a294]")}>
                {countFor(b.value)}
              </span>
            </button>
          ))}
        </div>

        {/* filters popover */}
        <Popover>
          <PopoverTrigger
            render={
              <button
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors",
                  activeFilters > 0
                    ? "border-[#c2410c]/40 bg-[#fdeadd] text-[#9a3412]"
                    : "border-[#e6e3db] bg-white text-[#6e6b61] hover:text-[#1c1b17]"
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                Filters
                {activeFilters > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-[#c2410c] text-[10px] font-bold text-white">
                    {activeFilters}
                  </span>
                )}
              </button>
            }
          />
          <PopoverContent align="end" className="w-80 border-[#e6e3db] bg-white p-4 shadow-[0_16px_40px_-16px_rgba(28,27,23,0.25)]">
            <div className="flex flex-col gap-4">
              {GROUPS.map((g) => (
                <div key={g.key}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#a8a294]">{g.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => push({ [g.key]: "" })}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition-colors",
                        !filters[g.key]
                          ? "border-[#c2410c]/50 bg-[#fdeadd] font-medium text-[#9a3412]"
                          : "border-[#e6e3db] text-[#6e6b61] hover:border-[#d5d1c6] hover:text-[#1c1b17]"
                      )}
                    >
                      Any
                    </button>
                    {g.options.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => push({ [g.key]: filters[g.key] === o.value ? "" : o.value })}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs transition-colors",
                          filters[g.key] === o.value
                            ? "border-[#c2410c]/50 bg-[#fdeadd] font-medium text-[#9a3412]"
                            : "border-[#e6e3db] text-[#6e6b61] hover:border-[#d5d1c6] hover:text-[#1c1b17]"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {activeFilters > 0 && (
                <button
                  onClick={() => push({ seniority: "", category: "", workMode: "", posted: "" })}
                  className="self-start text-xs text-[#8b877a] underline-offset-2 hover:text-[#c2410c] hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
