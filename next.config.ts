import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cursor opens the parent Jobs_Helper folder; pin Turbopack to this app so
  // it does not infer the wrong workspace root and 404 every App Router page.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // pdfjs-dist loads its worker via dynamic import — serve it from node_modules
  // at runtime instead of bundling (the bundle loses pdf.worker.mjs).
  serverExternalPackages: ["pdfjs-dist"],
  // The Tectonic binary must ship inside the serverless functions that compile LaTeX.
  outputFileTracingIncludes: {
    "/api/tailor/generate": ["./bin/**"],
    "/api/tailor/research": ["./bin/**"],
  },
};

export default nextConfig;
