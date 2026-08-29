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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="tilt-l flex size-14 items-center justify-center rounded-none border-2 border-foreground bg-primary font-display text-2xl font-bold uppercase text-primary-foreground shadow-hard">
            jh
          </div>
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-foreground md:text-5xl">jobhub</h1>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Toronto tech jobs · tracking · tailored resumes</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-none border-2 border-foreground bg-card p-5 shadow-hard-lg">
          <Input
            type="password"
            autoFocus
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 text-center text-sm"
          />
          {error && <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={loading || !password}
            className="h-10"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
