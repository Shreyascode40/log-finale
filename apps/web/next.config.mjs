/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Member photos are capped at 2 MB and documents at 10 MB in lib/upload.ts.
    // Next.js Server Actions default to 1 MB, which would reject both before
    // the server-side validation runs.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
