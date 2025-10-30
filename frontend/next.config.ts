// next.config.ts
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-inline' https:;
      style-src 'self' 'unsafe-inline' https:;
      img-src 'self' data: https:;
      font-src 'self' https:;
      connect-src 'self' ws: https:;
      object-src 'none';
      base-uri 'self';
      form-action 'self'
    `.replace(/\n/g, ""), // إزالة newlines
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer-when-downgrade" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
