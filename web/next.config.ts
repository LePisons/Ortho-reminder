import type { NextConfig } from "next";

// The browser always calls same-origin `/api/*`; Next proxies it to the API.
// In production set API_INTERNAL_URL to the deployed API base URL.
const apiBaseUrl = process.env.API_INTERNAL_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  images: {
    // We only serve our own trusted logo SVGs from /public.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
