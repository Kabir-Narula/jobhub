"use strict";

const { isSecretPath, readStdin, write } = require("./sensitive.cjs");

const DENY = [
  { re: /\bprisma\s+migrate\s+reset\b/i, reason: "prisma migrate reset wipes the database" },
  { re: /\bdb\s+push\s+--force-reset\b/i, reason: "force-reset wipes the database" },
  { re: /\bDROP\s+DATABASE\b/i, reason: "DROP DATABASE is destructive" },
  { re: /\bgit\s+push\b[^&|;]*\s--force\b/i, reason: "git push --force" },
  { re: /\bgit\s+push\b[^&|;]*\s-f\b/i, reason: "git push -f" },
  { re: /\bgit\s+reset\s+--hard\b/i, reason: "git reset --hard" },
  { re: /\bprintenv\b/i, reason: "printenv dumps process secrets" },
];

const ENV_READ = [
  /\bGet-Content\b[\s\S]{0,80}\.env\b/i,
  /\btype\s+(?:\.\\|\.\/)?\.env\b/i,
  /\bcat\s+(?:\.\/)?\.env\b/i,
  /\bGet-Content\b[\s\S]{0,80}\.(?:pem|p12|pfx|key)\b/i,
];

function mentionsSecretFile(cmd) {
  if (ENV_READ.some((re) => re.test(cmd)) && !/\.env\.example\b/i.test(cmd)) {
    return true;
  }
  const quoted = cmd.match(/["']([^"']+)["']/g) || [];
  return quoted.some((q) => isSecretPath(q.slice(1, -1)));
}

(async () => {
  try {
    const raw = await readStdin();
    const input = raw.trim() ? JSON.parse(raw) : {};
    const cmd = String(input.command || "");
    const hit = DENY.find((d) => d.re.test(cmd));
    if (hit || mentionsSecretFile(cmd)) {
      const reason = hit ? hit.reason : "command would dump a secret file";
      write({
        permission: "deny",
        user_message: `Blocked: ${reason}.`,
        agent_message: `Project hook denied this command (${reason}). Ask the user if they truly need it.`,
      });
      return;
    }
    write({ permission: "allow" });
  } catch {
    write({ permission: "allow" });
  }
})();
