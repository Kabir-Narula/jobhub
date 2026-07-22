"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  Briefcase,
  Inbox,
  KanbanSquare,
  LogOut,
  Settings,
  X,
} from "lucide-react";

const NAV = [
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/tracker", label: "Tracker", icon: KanbanSquare },
  { href: "/digest", label: "Digest", icon: Inbox },
  { href: "/settings", label: "Settings", icon: Settings },
];

const VIEWS = [
  { href: "/jobs", label: "All jobs", icon: Briefcase, match: (p: URLSearchParams) => !p.get("saved") && !p.get("dismissed") },
  { href: "/jobs?saved=1", label: "Saved", icon: Bookmark, match: (p: URLSearchParams) => p.get("saved") === "1" },
  { href: "/jobs?dismissed=1", label: "Dismissed", icon: X, match: (p: URLSearchParams) => p.get("dismissed") === "1" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const onJobs = pathname.startsWith("/jobs");

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-[#e6e3db] bg-[#fbfaf7]">
      {/* brand */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-7">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#c2410c] font-display text-base font-bold text-[#fdf8f3] shadow-[0_4px_14px_-4px_rgba(194,65,12,0.5)]">
          jh
        </div>
        <div>
          <p className="font-display text-[15px] font-semibold text-[#1c1b17]">jobhub</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#8b877a]">toronto tech</p>
        </div>
      </div>

      {/* main nav */}
      <nav className="flex flex-col gap-1 px-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-[#fdeadd] text-[#9a3412]"
                  : "text-[#6e6b61] hover:bg-[#f1efe9] hover:text-[#1c1b17]"
              )}
            >
              <Icon className={cn("size-[18px]", active ? "text-[#c2410c]" : "text-[#a8a294] group-hover:text-[#6e6b61]")} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* job views */}
      {onJobs && (
        <div className="mt-7 px-4">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a8a294]">Views</p>
          <div className="flex flex-col gap-0.5">
            {VIEWS.map(({ href, label, icon: Icon, match }) => {
              const active = match(searchParams);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-[#fdeadd] font-medium text-[#9a3412]"
                      : "text-[#6e6b61] hover:bg-[#f1efe9] hover:text-[#1c1b17]"
                  )}
                >
                  <Icon className={cn("size-4", active ? "text-[#c2410c]" : "text-[#a8a294]")} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* footer */}
      <div className="mt-auto border-t border-[#e6e3db] p-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[#8b877a] transition-colors hover:bg-[#f1efe9] hover:text-[#1c1b17]"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
