import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

(async () => {
  const { createSessionToken, SESSION_COOKIE } = await import("../lib/auth");
  const cookie = `${SESSION_COOKIE}=${createSessionToken()}`;
  const jobId = process.argv[2];
  const res = await fetch(`http://localhost:3000/tailor/${jobId}`, { headers: { cookie } });
  const html = await res.text();
  const checks = [
    ["Workday cheat sheet", html.includes("Workday application")],
    ["current-title instruction", html.includes("Current Title")],
    ["form-outranks note", html.includes("form fields")],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  const m = html.match(/Set <span[^>]*>Current Title<\/span> to exactly:[^<]*<code[^>]*>([^<]*)<\/code>/);
  if (m) console.log(`  title value: "${m[1]}"`);
  const t = html.match(/skills\/free-text fields:\s*<code[^>]*>([^<]*)<\/code>/);
  if (t) console.log(`  terms: ${t[1]}`);
})();
