import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Pin Turbopack to this package even when Cursor opens the parent Jobs_Helper
// folder — otherwise App Router pages under route groups 404.
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: appRoot,
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
