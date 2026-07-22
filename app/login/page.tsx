"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/jobs");
      router.refresh();
    } else {
      setError("Wrong password.");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f5f1] p-4">
      {/* ambient warmth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-[pulse_6s_ease-in-out_infinite] bg-[radial-gradient(45%_35%_at_50%_30%,rgba(194,65,12,0.10),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-[pulse_9s_ease-in-out_infinite_reverse] bg-[radial-gradient(30%_25%_at_70%_70%,rgba(194,65,12,0.06),transparent)]"
      />
      <div className="relative w-full max-w-xs">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#c2410c] font-display text-xl font-bold text-[#fdf8f3] shadow-[0_10px_30px_-10px_rgba(194,65,12,0.6)]">
            jh
          </div>
          <div className="text-center">
            <p className="font-display text-xl font-semibold text-[#1c1b17]">jobhub</p>
            <p className="mt-1 text-xs text-[#8b877a]">Toronto tech jobs · tracking · tailored resumes</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-2xl border border-[#e6e3db] bg-white p-5 shadow-[0_16px_40px_-20px_rgba(28,27,23,0.2)]">
          <Input
            type="password"
            autoFocus
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 border-[#e6e3db] bg-white text-center text-sm focus-visible:border-[#c2410c]/50 focus-visible:ring-[#c2410c]/20"
          />
          {error && <p className="text-center text-xs text-red-600">{error}</p>}
          <Button
            type="submit"
            disabled={loading || !password}
            className="h-10 bg-[#c2410c] text-sm font-medium text-[#fdf8f3] hover:bg-[#9a3412]"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
