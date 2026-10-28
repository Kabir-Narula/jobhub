/**
 * Phenom career pages hide the posting in phApp.ddo. The visible HTML is a
 * "no longer active" widget. Run: npx tsx scripts/test-embedded-posting.ts
 */
import { isClosedShell, needsDescriptionFetch, phenomFromHtml } from "../lib/jobs/embedded-posting";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const duty =
  "<p>The Project Analyst, Technology supports the delivery of technology and transformation initiatives within the PMO. This role is execution-focused, with responsibility for leading small to medium projects, and for maintaining RAID logs.</p>";

const payload = {
  siteConfig: { data: { name: "careers" } },
  jobDetail: {
    data: {
      job: {
        title: "Project Analyst, Technology",
        companyName: "Air Canada",
        location: "TORONTO, ONTARIO, CANADA",
        externalDescription: duty.repeat(3) + '<p>He said "scope" stays written down.</p>',
      },
    },
  },
};

const html = `<html><head><script>phApp.ddo = ${JSON.stringify(payload)};</script></head>
<body><p>This job posting is no longer active.</p>
<p>By joining our Talent Network, your resume will be searchable in our database.</p></body></html>`;

console.log("1) closed widget is not a posting");
const widget =
  "This job posting is no longer active. Please explore our current openings or join our Talent Network to be notified when new roles align with your interests. searchable in our database.";
check("widget is a closed shell", isClosedShell(widget));
check("widget needs a refetch", needsDescriptionFetch(widget));
check("short empty needs a refetch", needsDescriptionFetch("   "));
const long = `${"Project planning, RAID logs, and month-end accruals for the PMO. ".repeat(40)} This posting is no longer active.`;
check("a long posting that mentions closing is kept", !isClosedShell(long), `len ${long.length}`);
check("a long posting does not refetch", !needsDescriptionFetch(long));

console.log("\n2) Phenom script body beats the widget");
const parsed = phenomFromHtml(html);
check("parsed", Boolean(parsed));
check("title", parsed?.title === "Project Analyst, Technology", parsed?.title);
check("company", parsed?.company === "Air Canada", parsed?.company);
check("location", parsed?.location === undefined && parsed?.locationRaw.includes("TORONTO"), parsed?.locationRaw);
check("body has RAID", /RAID logs/i.test(parsed?.description ?? ""));
check("body is not the widget", !/no longer active/i.test(parsed?.description ?? ""));
check("quoted word survived", /scope/.test(parsed?.description ?? ""));

console.log("\n3) pages without the script stay untouched");
check("no phenom", phenomFromHtml("<html><p>Hello from a normal board.</p></html>") === null);

console.log(failures ? `\n${failures} failed` : "\nall good");
process.exitCode = failures ? 1 : 0;
