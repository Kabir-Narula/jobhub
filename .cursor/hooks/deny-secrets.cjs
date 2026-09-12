"use strict";

const { isSecretPath, readStdin, write } = require("./sensitive.cjs");

function pathsFrom(input) {
  const out = [];
  if (input.file_path) out.push(input.file_path);
  if (input.path) out.push(input.path);
  if (Array.isArray(input.attachments)) {
    for (const a of input.attachments) {
      if (a && a.file_path) out.push(a.file_path);
    }
  }
  return out;
}

(async () => {
  try {
    const raw = await readStdin();
    const input = raw.trim() ? JSON.parse(raw) : {};
    const hit = pathsFrom(input).find(isSecretPath);
    if (hit) {
      write({
        permission: "deny",
        user_message: "Blocked read of a secret file. Use .env.example for variable names.",
        agent_message:
          "Do not read .env, .env.local, key files, or credentials.json. Use .env.example for names only.",
      });
      return;
    }
    write({ permission: "allow" });
  } catch {
    write({ permission: "allow" });
  }
})();
