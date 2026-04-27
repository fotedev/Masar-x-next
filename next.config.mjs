import createNextIntlPlugin from "next-intl/plugin";
import bundleAnalyzer from "@next/bundle-analyzer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force cache invalidation: 2026-02-14T04:30:00
  reactStrictMode: true,
  transpilePackages: ["next-intl"],
  compiler: {
    removeConsole: {
      exclude: ["error", "warn"],
    },
  },
  images: {
    unoptimized: process.env.NODE_ENV !== "production",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "framerusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "jcufigozkhxazjbwhjjm.supabase.co",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Fix next-intl resolution for Next.js 16
    const nextIntlEsm = path.resolve(
      __dirname,
      "node_modules/next-intl/dist/esm/production",
    );

    config.resolve.alias = {
      ...config.resolve.alias,
      "next-intl/server$": isServer
        ? path.join(nextIntlEsm, "server.react-server.js")
        : path.join(nextIntlEsm, "server.react-client.js"),
      "next-intl/navigation$": isServer
        ? path.join(nextIntlEsm, "navigation.react-server.js")
        : path.join(nextIntlEsm, "navigation.react-client.js"),
      "next-intl/routing$": path.join(nextIntlEsm, "routing.js"),
      "next-intl/middleware$": path.join(nextIntlEsm, "middleware.js"),
      "next-intl$": isServer
        ? path.join(nextIntlEsm, "index.react-server.js")
        : path.join(nextIntlEsm, "index.react-client.js"),
    };

    return config;
  },
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      {
        source: "/admin",
        destination: "/admin-dashboard",
        permanent: true,
      },
    ];
  },
  async headers() {
    // NOTE: Content-Security-Policy is intentionally omitted here.
    // It is set per-request with a fresh nonce in src/middleware.ts,
    // which takes precedence for all page routes. Having two CSP headers
    // causes the browser to AND them (most-restrictive wins), which
    // breaks nonce-based policies when combined with unsafe-inline policies.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(withBundleAnalyzer(nextConfig));
