import { classifyRecipient, polishEmail, projectsFromResumeTex, EMAIL_SIGNATURE } from "../lib/tailor/email";
import { gmailComposeUrl, mailtoUrl } from "../lib/email-compose";

const cases: [string, string][] = [
  ["University Recruiter", "campus"],
  ["Technical Recruiter", "recruiter"],
  ["Talent Acquisition Partner", "recruiter"],
  ["Sourcing Specialist", "recruiter"],
  ["HR Business Partner", "recruiter"],
  ["Head of Talent", "recruiter"],
  ["People and Culture", "recruiter"],
  ["Engineering Manager", "manager"],
  ["Hiring Manager", "manager"],
  ["Software Engineer", "engineer"],
  ["People Ops", "recruiter"],
  ["", "unknown"],
];

let failed = 0;
for (const [role, want] of cases) {
  const got = classifyRecipient(role);
  if (got !== want) {
    console.log(`FAIL classify "${role}": got ${got}, want ${want}`);
    failed++;
  } else {
    console.log(`ok  ${role || "(empty)"} -> ${got}`);
  }
}

const SIG = ["Thanks,", "", ...EMAIL_SIGNATURE].join("\n");

function assertBody(name: string, body: string, expected: string) {
  if (body !== expected) {
    console.log(`FAIL ${name}\n--- got ---\n${JSON.stringify(body)}\n--- want ---\n${JSON.stringify(expected)}`);
    failed++;
  } else {
    console.log(`ok  ${name}`);
  }
}

const messy = polishEmail(
  {
    subject: '"quick note re: Role"',
    body: "Dear Sam,\nI hope this finds you well. Just reaching out.\n\nI applied.\n\nP.S. Let me know!\nSam",
  },
  { signOff: "Kabir", recipientFirst: "Sam", company: "Acme" }
);

assertBody(
  "messy clichés + recipient sign-off",
  messy.body,
  ["Hi Sam,", "", "I applied.", "", "Is this still open?", "", SIG].join("\n")
);

const wrapped = polishEmail(
  {
    subject: "applied for Backend",
    body: "Hi Sam,\nI applied this morning\nfor the backend role. Resume is attached.\n\nI just graduated from Seneca.\n\nThanks, Kabir",
  },
  { signOff: "Kabir", recipientFirst: "Sam", company: "Acme" }
);

assertBody(
  "hard wraps joined; Thanks+name split",
  wrapped.body,
  [
    "Hi Sam,",
    "",
    "I applied this morning for the backend role. Resume is attached.",
    "",
    "I just graduated from Seneca.",
    "",
    "Is this still open?",
    "",
    SIG,
  ].join("\n")
);

const extraBlanks = polishEmail(
  {
    subject: "Role - Kabir Narula",
    body: "Hi Sam,\n\n\n\nI applied.\n\n\n\nStill interested.\n\n\nKabir\n",
  },
  { signOff: "Kabir", recipientFirst: "Sam", company: "Acme" }
);

assertBody(
  "extra blank lines collapsed; Thanks inserted",
  extraBlanks.body,
  ["Hi Sam,", "", "I applied.", "", "Still interested.", "", "Is this still open?", "", SIG].join("\n")
);

const wall = polishEmail(
  {
    subject: "Role",
    body: "Hi Sam, I applied for Backend. Resume is attached. I just graduated from Seneca in Toronto. If you own this role, I'd be grateful if you took a look.",
  },
  { signOff: "Kabir", recipientFirst: "Sam", company: "Acme" }
);

if (!wall.body.startsWith("Hi Sam,\n\n")) {
  console.log("FAIL wall: greeting spacing\n", JSON.stringify(wall.body));
  failed++;
} else if (!wall.body.endsWith(SIG)) {
  console.log("FAIL wall: sign-off spacing\n", JSON.stringify(wall.body));
  failed++;
} else if (/\n{3,}/.test(wall.body)) {
  console.log("FAIL wall: triple newline\n", JSON.stringify(wall.body));
  failed++;
} else if (wall.body.split("\n\n").length < 3) {
  console.log("FAIL wall: expected multiple paragraphs\n", JSON.stringify(wall.body));
  failed++;
} else {
  console.log("ok  wall-of-text split + spacing");
}

const team = polishEmail(
  { subject: "Role", body: "I applied for the role." },
  { signOff: "Kabir", recipientFirst: null, company: "Northline" }
);
if (!team.body.startsWith("Hi Northline team,\n\n")) {
  console.log("FAIL team greeting\n", JSON.stringify(team.body));
  failed++;
} else {
  console.log("ok  company-team greeting");
}

const proj = projectsFromResumeTex("\\textbf{VertexFlow} and BetterMind");
console.log("projects:", proj.map((p) => p.name).join(", "));
if (proj.length !== 2 || proj[0].name !== "VertexFlow") {
  console.log("FAIL: expected VertexFlow + BetterMind from tex");
  failed++;
}

const extraSig = polishEmail(
  {
    subject: "Role",
    body: "Hi Sam,\n\nI applied.\n\nThanks,\nKabir Narula\nToronto, ON\nlinkedin.com/in/kabir-narula-19b129260\n",
  },
  { signOff: "Kabir", recipientFirst: "Sam", company: "Acme" }
);
if (extraSig.body.split("linkedin.com/in/kabir-narula-19b129260").length !== 2) {
  console.log("FAIL signature should appear exactly once\n", extraSig.body);
  failed++;
} else if (!extraSig.body.includes("Kabirnar10@gmail.com") || !extraSig.body.includes("(647) 410-6699")) {
  console.log("FAIL missing contact lines\n", extraSig.body);
  failed++;
} else {
  console.log("ok  full signature once (linkedin/name not duplicated)");
}

const jose = polishEmail(
  {
    subject: "Software Developer",
    body: [
      "Hi Jose,",
      "",
      "I applied for the Software Developer (Entry Level) role at Konrad. Resume is attached in case it's easier than pulling it from the ATS.",
      "",
      "I just graduated from Seneca Polytechnic in Toronto.",
      "",
      "If this role is on your team, I'd appreciate a glance when you have a chance. If not, a forward to the right person is enough.",
      "",
      "Thanks,",
      "Kabir",
    ].join("\n"),
  },
  { signOff: "Kabir", recipientFirst: "Jose", company: "Konrad" }
);
if (/appreciate a glance|forward to the right person|easier than pulling/i.test(jose.body)) {
  console.log("FAIL commanding close still present\n", jose.body);
  failed++;
} else if (!jose.body.includes("Is this still open?")) {
  console.log("FAIL expected a simple yes/no close\n", jose.body);
  failed++;
} else if (/Resume is attached in case|out of the blue|didn'?t ask for this|no need to reply/i.test(jose.body)) {
  console.log("FAIL fake or clerk talk still present\n", jose.body);
  failed++;
} else {
  console.log("ok  stranger email: no orders, no apology theater");
}

const apology = polishEmail(
  {
    subject: "Role",
    body: "Hi Sam,\n\nThis is a bit out of the blue. I applied for Backend at Acme, since you don't know me from anyone.\n\nI just graduated from Seneca.\n\nNo need to reply if this isn't useful. I know you didn't ask for this.\n\nThanks,\nKabir",
  },
  { signOff: "Kabir", recipientFirst: "Sam", company: "Acme" }
);
if (/out of the blue|don'?t know me|didn'?t ask for this|no need to reply/i.test(apology.body)) {
  console.log("FAIL apology theater still present\n", apology.body);
  failed++;
} else if (!apology.body.includes("Is this still open?")) {
  console.log("FAIL apology should become a yes/no\n", apology.body);
  failed++;
} else {
  console.log("ok  apology theater stripped");
}

const recruiter = polishEmail(
  {
    subject: "Role",
    body: "Hi Priya,\n\nI'm Kabir, I recently graduated from Seneca Polytechnic.\n\nWhat I like about this team is the data work.\n",
  },
  { signOff: "Kabir", recipientFirst: "Priya", company: "National Bank of Canada", kind: "recruiter", role: "Associate" }
);
if (!/already applied for the associate role/i.test(recruiter.body) || !/highly interested/i.test(recruiter.body)) {
  console.log("FAIL recruiter should say they applied and are highly interested\n", recruiter.body);
  failed++;
} else if (/appreciate a referral|fair shot|coffee chat/i.test(recruiter.body)) {
  console.log("FAIL recruiter should not ask for a referral\n", recruiter.body);
  failed++;
} else if (!/attached my resume/i.test(recruiter.body) || !/connect on LinkedIn/i.test(recruiter.body)) {
  console.log("FAIL recruiter should mention the resume and LinkedIn\n", recruiter.body);
  failed++;
} else {
  console.log("ok  recruiter ask: applied + interested, no referral");
}

const withPosting = polishEmail(
  {
    subject: "Role",
    body: "Hi Priya,\n\nI'm Kabir, I recently graduated from Seneca Polytechnic.\n\nWhat I like about this team is the data work.\n",
  },
  {
    signOff: "Kabir",
    recipientFirst: "Priya",
    company: "BMO",
    kind: "recruiter",
    role: "Associate, KYC Requirements & Outreach",
    postingUrl: "https://bmo.wd3.myworkdayjobs.com/en-US/External/job/Toronto/Associate--KYC_R123",
  }
);
if (!withPosting.body.includes("https://bmo.wd3.myworkdayjobs.com/en-US/External/job/Toronto/Associate--KYC_R123")) {
  console.log("FAIL posting link missing\n", withPosting.body);
  failed++;
} else if (!/here is the posting if you want to take a look/i.test(withPosting.body)) {
  console.log("FAIL posting line missing\n", withPosting.body);
  failed++;
} else {
  console.log("ok  posting link included");
}

const recruiterWithReferral = polishEmail(
  {
    subject: "Role",
    body: "Hi Priya,\n\nI'm Kabir, I recently graduated from Seneca Polytechnic.\n\nIf you think I could be a fit, I would really appreciate a referral.\n",
  },
  { signOff: "Kabir", recipientFirst: "Priya", company: "National Bank of Canada", kind: "recruiter", role: "Associate" }
);
if (/appreciate a referral|coffee chat/i.test(recruiterWithReferral.body)) {
  console.log("FAIL an HR draft that asks for a referral should have that line removed\n", recruiterWithReferral.body);
  failed++;
} else if (!/already applied/i.test(recruiterWithReferral.body)) {
  console.log("FAIL HR closer missing\n", recruiterWithReferral.body);
  failed++;
} else {
  console.log("ok  HR referral line replaced with applied + interested");
}

const manager = polishEmail(
  {
    subject: "Role",
    body: "Hi Julien,\n\nI'm Kabir, I recently graduated from Seneca Polytechnic.\n\nWhat I like about this team is the data work.\n",
  },
  { signOff: "Kabir", recipientFirst: "Julien", company: "National Bank of Canada", kind: "manager", role: "Associate" }
);
if (
  !/coffee chat/i.test(manager.body) ||
  !/appreciate a referral/i.test(manager.body) ||
  !/fit for the associate role/i.test(manager.body) ||
  !/fair shot/i.test(manager.body) ||
  !/attached my resume/i.test(manager.body) ||
  !/connect on LinkedIn/i.test(manager.body)
) {
  console.log("FAIL manager should ask for a coffee chat and a referral for this role\n", manager.body);
  failed++;
} else if (/already applied for/i.test(manager.body)) {
  console.log("FAIL manager should not get the HR closer\n", manager.body);
  failed++;
} else {
  console.log("ok  manager ask: coffee chat + referral for the role");
}

const gmail = gmailComposeUrl("kunal.madhani@colliers.com", "Research role - Kabir Narula", "Hi Kunal,\n\nThanks,");
if (!gmail.startsWith("https://mail.google.com/mail/?") || !gmail.includes("to=kunal.madhani") || !gmail.includes("view=cm")) {
  console.log("FAIL gmail compose URL", gmail);
  failed++;
} else {
  console.log("ok  gmail compose URL");
}
const mt = mailtoUrl("kunal.madhani@colliers.com", "Hi", "Line 1\nLine 2");
if (!mt.startsWith("mailto:kunal.madhani@colliers.com?") || !mt.includes("%0D%0A")) {
  console.log("FAIL mailto URL", mt);
  failed++;
} else {
  console.log("ok  mailto URL uses CRLF");
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall good");
