import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

export function tectonicPath(): string {
  const file = process.platform === "win32" ? "tectonic.exe" : "tectonic";
  const p = path.join(process.cwd(), "bin", file);
  if (!existsSync(p)) {
    throw new Error(
      `Tectonic binary not found at ${p}. Run \`npm run setup:tectonic\` to download it.`
    );
  }
  return p;
}

export interface CompileResult {
  pdf: Buffer;
  pageCount: number;
  log: string;
}

/**
 * pdfLaTeX recovers from a line break `\\` with no current line (a lone `\\`
 * line, or `\\` right after \vspace at line start); XeTeX/Tectonic halts.
 * Insert an invisible box so the line exists — visually identical output
 * (exactly what pdfLaTeX's recovery produced).
 */
export function fixEmptyLineBreaks(tex: string): string {
  return tex.replace(
    /^([ \t]*(?:(?:\\vspace\*?\{[^}]*\}|\\noindent)[ \t]*)*)\\\\/gm,
    "$1\\mbox{}\\\\"
  );
}

/** Compile a .tex document with Tectonic and return the PDF + page count. */
export async function compileLatex(tex: string): Promise<CompileResult> {
  const bin = tectonicPath();
  const dir = await mkdtemp(path.join(tmpdir(), "jobhub-tex-"));
  try {
    await writeFile(path.join(dir, "main.tex"), fixEmptyLineBreaks(tex), "utf8");
    const log = await new Promise<string>((resolve, reject) => {
      execFile(
        bin,
        ["--outdir", dir, "--keep-logs", "--print", "main.tex"],
        { cwd: dir, timeout: 180_000, maxBuffer: 8 * 1024 * 1024 },
        (err, stdout, stderr) => {
          const out = `${stdout}\n${stderr}`;
          if (err) reject(new Error(`Tectonic failed: ${out.slice(-3000)}`));
          else resolve(out);
        }
      );
    });
    const pdf = await readFile(path.join(dir, "main.pdf"));
    const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
    return { pdf, pageCount: doc.getPageCount(), log };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
