#!/usr/bin/env node
/**
 * Downloads the correct Tectonic static binary for the current platform into bin/.
 * Windows  -> .zip (extracted via bsdtar, bundled with Windows 10+)
 * Linux    -> .tar.gz (musl static build; this is also what Vercel needs)
 * macOS    -> .tar.gz
 *
 * Pin via TECTONIC_VERSION env (default 0.15.0).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const VERSION = process.env.TECTONIC_VERSION || "0.15.0";
const TAG = `tectonic%40${VERSION}`;

function assetFor() {
  if (process.platform === "win32") return `tectonic-${VERSION}-x86_64-pc-windows-msvc.zip`;
  if (process.platform === "linux") return `tectonic-${VERSION}-x86_64-unknown-linux-musl.tar.gz`;
  if (process.platform === "darwin")
    return process.arch === "arm64"
      ? `tectonic-${VERSION}-aarch64-apple-darwin.tar.gz`
      : `tectonic-${VERSION}-x86_64-apple-darwin.tar.gz`;
  throw new Error(`Unsupported platform: ${process.platform}`);
}

async function main() {
  const binDir = path.join(process.cwd(), "bin");
  const binName = process.platform === "win32" ? "tectonic.exe" : "tectonic";
  const binPath = path.join(binDir, binName);
  if (existsSync(binPath)) {
    console.log(`Tectonic already present at bin/${binName} — skipping download.`);
    return;
  }

  const asset = assetFor();
  const url = `https://github.com/tectonic-typesetting/tectonic/releases/download/${TAG}/${asset}`;
  mkdirSync(binDir, { recursive: true });

  const isZip = asset.endsWith(".zip");
  const archive = path.join(tmpdir(), asset);
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${asset}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`Downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(archive, buf);

  const extractDir = path.join(tmpdir(), `tectonic-extract-${Date.now()}`);
  mkdirSync(extractDir, { recursive: true });
  if (isZip && process.platform === "win32") {
    // Deterministic on Windows: GNU tar misreads "C:" as a remote host.
    execFileSync(
      "powershell",
      ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${extractDir}' -Force`],
      { stdio: "inherit" }
    );
  } else {
    execFileSync("tar", [isZip ? "-xf" : "-xzf", archive, "-C", extractDir], { stdio: "inherit" });
  }

  const extracted = path.join(extractDir, binName);
  if (!existsSync(extracted)) throw new Error(`${binName} not found in archive`);
  renameSync(extracted, path.join(binDir, binName));
  if (process.platform !== "win32") chmodSync(path.join(binDir, binName), 0o755);

  rmSync(extractDir, { recursive: true, force: true });
  rmSync(archive, { force: true });

  const out = execFileSync(path.join(binDir, binName), ["--version"]).toString().trim();
  console.log(`Installed: ${out} -> bin/${binName}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
