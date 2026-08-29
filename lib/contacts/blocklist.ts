import { prisma } from "@/lib/db";

const KEY = "bounced_emails";

function parse(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((e) => String(e).toLowerCase().trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function bouncedEmailSet(): Promise<Set<string>> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  return new Set(parse(row?.value ?? "[]"));
}

export async function markEmailBounced(email: string): Promise<string[]> {
  const addr = email.toLowerCase().trim();
  if (!addr) return [...(await bouncedEmailSet())];
  const existing = await bouncedEmailSet();
  existing.add(addr);
  const list = [...existing].sort();
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(list) },
    update: { value: JSON.stringify(list) },
  });
  return list;
}
