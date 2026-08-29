import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
async function main() {
  const { createSessionToken, SESSION_COOKIE } = await import("../lib/auth");
  const cookie = `${SESSION_COOKIE}=${createSessionToken()}`;
  // manual mode
  const res = await fetch("http://localhost:3000/api/jobs/add", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      title: "Junior Software Engineer",
      company: "TestCo Manual",
      location: "Toronto, ON (Hybrid)",
      description: "We are looking for a junior software engineer with Python and React experience. You will build REST APIs, write unit tests, and work in Agile sprints with the platform team on CI/CD pipelines.",
    }),
  });
  const data = await res.json();
  console.log("manual:", res.status, JSON.stringify(data));
  // dedupe: same again
  const res2 = await fetch("http://localhost:3000/api/jobs/add", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      title: "Junior Software Engineer",
      company: "TestCo Manual",
      location: "Toronto, ON",
      description: "duplicate check",
    }),
  });
  console.log("dupe:", res2.status, JSON.stringify(await res2.json()));
  // validation
  const res3 = await fetch("http://localhost:3000/api/jobs/add", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ title: "x" }),
  });
  console.log("invalid:", res3.status, JSON.stringify(await res3.json()));
}
main().catch((e) => { console.error(e); process.exit(1); });
