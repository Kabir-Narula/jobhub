"use strict";

function normalizePath(p) {
  return String(p || "").replace(/\\/g, "/");
}

function basename(p) {
  const n = normalizePath(p);
  const parts = n.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function isSecretPath(p) {
  const n = normalizePath(p);
  const base = basename(n);
  if (base === ".env.example") return false;
  if (base === ".env" || base.startsWith(".env.")) return true;
  if (/\.(pem|p12|pfx|key)$/i.test(base)) return true;
  if (/^(id_rsa|id_ed25519|id_dsa|credentials\.json)$/i.test(base)) return true;
  return false;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
    process.stdin.on("error", reject);
  });
}

function write(obj) {
  process.stdout.write(JSON.stringify(obj));
}

module.exports = { normalizePath, basename, isSecretPath, readStdin, write };
