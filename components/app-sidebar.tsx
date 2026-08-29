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
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r-2 border-foreground bg-sidebar text-sidebar-foreground">
      {/* brand */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-7">
        <div className="tilt-l flex size-10 items-center justify-center rounded-none border-2 border-sidebar-foreground bg-sidebar-primary font-display text-lg font-bold text-sidebar-primary-foreground shadow-[3px_3px_0_0_#2137ff]">
          jh
        </div>
        <div>
          <p className="font-display text-lg font-bold uppercase leading-none tracking-tight">jobhub</p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-sidebar-foreground/50">toronto tech</p>
        </div>
      </div>

      {/* main nav */}
      <nav className="flex flex-col gap-1.5 px-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-none border-2 px-3 py-2 font-heading text-xs font-bold uppercase tracking-wider transition-all",
                active
                  ? "translate-x-1 border-sidebar-foreground bg-sidebar-primary text-sidebar-primary-foreground shadow-[3px_3px_0_0_#f6f5f0]"
                  : "border-transparent text-sidebar-foreground/60 hover:border-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* job views */}
      {onJobs && (
        <div className="mt-8 px-4">
          <p className="px-3 pb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-[#9aa2ff]">Views</p>
          <div className="flex flex-col gap-1">
            {VIEWS.map(({ href, label, icon: Icon, match }) => {
              const active = match(searchParams);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-none border-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all",
                    active
                      ? "translate-x-1 border-sidebar-foreground bg-sidebar-accent text-sidebar-accent-foreground"
                      : "border-transparent text-sidebar-foreground/50 hover:border-sidebar-foreground/30 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* footer */}
      <div className="mt-auto border-t-2 border-sidebar-foreground/20 p-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-none border-2 border-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-sidebar-foreground/50 transition-all hover:border-sidebar-foreground/40 hover:text-sidebar-foreground"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
