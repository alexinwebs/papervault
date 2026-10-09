import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy is not set here: it needs a fresh nonce per request,
 * so it is built in src/middleware.ts. Everything below is static and is
 * cheaper to attach at the edge of the framework than in middleware.
 */
const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  serverExternalPackages: ["@sentry/node", "ioredis", "@prisma/client", "unpdf"],
  // Camera captures post a handful of JPEG pages as one server action payload.
  experimental: { serverActions: { bodySizeLimit: "24mb" } },
  poweredByHeader: false,
  // A stack trace naming our own files is a gift to an attacker.
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            // The upload page needs the camera; nothing else is allowed.
            value:
              "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), " +
              "display-capture=(), serial=(), bluetooth=(), idle-detection=()",
          },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
      {
        // Uploaded files are user content: never sniff, never inline as HTML.
        source: "/api/files/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/.well-known/security.txt",
        headers: [{ key: "Content-Type", value: "text/plain; charset=utf-8" }],
      },
    ];
  },
};

export default nextConfig;
