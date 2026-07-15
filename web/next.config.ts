import type { NextConfig } from "next";

// The browser always calls same-origin `/api/*`; Next proxies it to the API.
// In production set API_INTERNAL_URL to the deployed API base URL.
const apiBaseUrl = process.env.API_INTERNAL_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  experimental: {
    // With a middleware file present, Next buffers proxied request bodies and
    // caps them at 10MB by default — which truncated STL uploads to
    // /api/model-sets (two jaws can be up to 60MB each, API-side limit).
    middlewareClientMaxBodySize: "130mb",
  },
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
