import type { NextConfig } from "next";

// Rewrites are fixed at build time. On Vercel a missing HERA_API_URL used to
// fall back to localhost, which Vercel refuses to proxy (DNS_HOSTNAME_RESOLVED_PRIVATE).
const PRODUCTION_API = "https://server.heralayer.com";
const apiUrl = (process.env.HERA_API_URL?.trim() || (process.env.VERCEL ? PRODUCTION_API : "http://localhost:4000")).replace(/\/+$/, "");
console.log(`[hera] proxying /api/* to ${apiUrl}`);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser only ever talks to this origin; Next forwards /api/* to the
  // NestJS API so the session cookie stays first-party.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
