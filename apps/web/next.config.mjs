import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Prisma schema and npm workspace root are shared at the monorepo root.
  experimental: {
    outputFileTracingRoot: path.resolve(webDir, "../.."),
    // Member photos are capped at 2 MB and documents at 10 MB in lib/upload.ts.
    // Next.js Server Actions default to 1 MB, which would reject both before
    // the server-side validation runs.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
