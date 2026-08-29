import { classifyRecipient, polishEmail, projectsFromResumeTex, EMAIL_SIGNATURE } from "../lib/tailor/email";

const cases: [string, string][] = [
  ["University Recruiter", "campus"],
  ["Technical Recruiter", "recruiter"],
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
  ["Hi Sam,", "", "I applied.", "", "Could you take a look at my application?", "", SIG].join("\n")
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
    "Could you take a look at my application?",
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
  ["Hi Sam,", "", "I applied.", "", "Still interested.", "", "Could you take a look at my application?", "", SIG].join("\n")
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
} else if (!jose.body.includes("Could you take a look at my application?")) {
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
} else if (!apology.body.includes("Could you take a look at my application?")) {
  console.log("FAIL apology should become a yes/no\n", apology.body);
  failed++;
} else {
  console.log("ok  apology theater stripped");
}

const softAsk = polishEmail(
  {
    subject: "Role",
    body: "Hi Sam,\n\nI applied for Backend at Acme earlier this week, and figured a short note was worth it.\n\nI just graduated from Seneca in Toronto.\n\nAny chance my application could get a look?\n\nThanks,\nKabir",
  },
  { signOff: "Kabir", recipientFirst: "Sam", company: "Acme" }
);
if (!softAsk.body.includes("Any chance my application could get a look?")) {
  console.log("FAIL soft stranger-aware ask was overwritten\n", softAsk.body);
  failed++;
} else if (softAsk.body.includes("Could you take a look at my application?")) {
  console.log("FAIL fallback question injected despite a real question\n", softAsk.body);
  failed++;
} else {
  console.log("ok  soft stranger-aware ask survives polish");
}

const managerAsk = polishEmail(
  {
    subject: "Role",
    body: "Hi Sam,\n\nI applied for Backend at Acme.\n\nI just graduated from Seneca.\n\nAny chance you could take a look at my application, or point me to whoever owns it?\n\nThanks,\nKabir",
  },
  { signOff: "Kabir", recipientFirst: "Sam", company: "Acme" }
);
if (!managerAsk.body.includes("point me to whoever owns it?")) {
  console.log("FAIL manager look-or-redirect ask was overwritten\n", managerAsk.body);
  failed++;
} else {
  console.log("ok  manager look-or-redirect ask survives polish");
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall good");
