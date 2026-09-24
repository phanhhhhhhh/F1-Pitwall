import type { NextConfig } from "next";

// connect-src is pinned to the API origin (fetch + SockJS/STOMP over http(s) and ws(s)) and
// Supabase Storage (avatar uploads). NEXT_PUBLIC_API_URL is inlined at build time, so the
// policy always matches the deploy it ships with.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const API_ORIGIN = new URL(API_URL).origin;
const API_WS_ORIGIN = API_ORIGIN.replace(/^http/, "ws");

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://*.supabase.co https://lh3.googleusercontent.com data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${API_ORIGIN} ${API_WS_ORIGIN} https://*.supabase.co`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
