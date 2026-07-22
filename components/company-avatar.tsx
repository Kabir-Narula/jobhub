import { cn } from "@/lib/utils";

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function CompanyAvatar({ company, className }: { company: string; className?: string }) {
  const hue = hashHue(company);
  const letter = (company.trim()[0] ?? "?").toUpperCase();
  return (
    <div
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white/90", className)}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 55% 45% / 0.9), hsl(${(hue + 40) % 360} 55% 32% / 0.9))`,
      }}
    >
      {letter}
    </div>
  );
}
