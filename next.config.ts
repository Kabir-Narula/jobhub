import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
