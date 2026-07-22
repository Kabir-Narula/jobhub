import crypto from "node:crypto";

export const SESSION_COOKIE = "jh_session";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(exp: number): string {
  return crypto.createHmac("sha256", secret()).update(String(exp)).digest("base64url");
}

export function createSessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return `${exp}.${sign(exp)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!exp || !sig || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function checkPassword(pw: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(pw);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
