"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  sort?: string;
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
  const [scrolled, setScrolled] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external filter state (render-phase adjustment, no effect needed).
  const [prevQ, setPrevQ] = useState(filters.q);
  if (prevQ !== filters.q) {
    setPrevQ(filters.q);
    setQ(filters.q);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <div className={cn(
      "sticky top-0 z-30 -mx-8 border-b-2 border-foreground bg-background px-8 py-3 transition-all duration-300",
      scrolled && "shadow-hard-sm"
    )}>
      <div className="flex items-center gap-3">
        {/* search */}
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search title, company, keyword…"
            className="h-9 pl-8 pr-8 text-[13px]"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-none border-2 border-foreground bg-muted px-1 font-mono text-[10px] font-bold text-foreground">/</kbd>
        </div>

        {/* location tabs with counts */}
        <div className="flex items-center rounded-none border-2 border-foreground bg-card p-0.5 shadow-hard-sm">
          {BUCKETS.map((b) => (
            <button
              key={b.value}
              onClick={() => push({ bucket: b.value })}
              className={cn(
                "rounded-none px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-wider transition-all duration-150",
                filters.bucket === b.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {b.label}
              <span className={cn("ml-1.5 font-mono text-[10px]", filters.bucket === b.value ? "text-primary-foreground/70" : "text-muted-foreground/60")}>
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
                  "flex h-9 items-center gap-1.5 rounded-none border-2 border-foreground px-3 font-heading text-[11px] font-bold uppercase tracking-wider shadow-hard-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard",
                  activeFilters > 0
                    ? "bg-accent text-accent-foreground"
                    : "bg-card text-foreground"
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                Filters
                {activeFilters > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-none border border-foreground bg-primary font-mono text-[10px] font-bold text-primary-foreground">
                    {activeFilters}
                  </span>
                )}
              </button>
            }
          />
          <PopoverContent align="end" className="w-80 p-4">
            <div className="flex flex-col gap-4">
              {GROUPS.map((g) => (
                <div key={g.key}>
                  <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{g.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => push({ [g.key]: "" })}
                      className={cn(
                        "rounded-none border-2 px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                        !filters[g.key]
                          ? "border-foreground bg-primary font-bold text-primary-foreground"
                          : "border-foreground/40 text-muted-foreground hover:border-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      Any
                    </button>
                    {g.options.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => push({ [g.key]: filters[g.key] === o.value ? "" : o.value })}
                        className={cn(
                          "rounded-none border-2 px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                          filters[g.key] === o.value
                            ? "border-foreground bg-primary font-bold text-primary-foreground"
                            : "border-foreground/40 text-muted-foreground hover:border-foreground hover:bg-accent hover:text-accent-foreground"
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
                  className="self-start font-mono text-[11px] uppercase tracking-wider text-[#2137ff] underline decoration-2 underline-offset-2 hover:no-underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* sort toggle */}
        <div className="ml-auto flex items-center rounded-none border-2 border-foreground bg-card p-0.5 shadow-hard-sm">
          {[
            { value: "rec", label: "Recommended" },
            { value: "new", label: "Newest" },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => push({ sort: s.value === "rec" ? "" : s.value })}
              className={cn(
                "rounded-none px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-wider transition-all duration-150",
                (filters.sort ?? "rec") === s.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
