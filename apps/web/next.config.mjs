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
  reactStrictMode: true,
  transpilePackages: ["next-intl"],
  serverExternalPackages: ["pg"],
  // T020.2: switch the web app to Next.js standalone output so the
  // desktop app can ship a self-contained server.js entry point
  // (apps/web/.next/standalone/server.js). This is the documented
  // way to run Next.js inside Electron — the previous in-process
  // 
  //   next({ dir }) approach could not find the react module at
  // runtime because Next's normal webpack chunking does not emit a
  // standalone-friendly layout. See specs/004-multi-platform-expansion/
  // tasks.md §T020.2.
  output: "standalone",
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
    //
    // Most-specific match wins in Next.js, so order in this array is
    // for readability only:
    //   1. /sw.js            — no-store so the browser re-validates on
    //                           every page load and detects the
    //                           build-time-injected CACHE_NAME change
    //   2. HTML catch-all    — no-store for all pages and data routes
    //   3. /dotlottie...wasm — long-lived, Content-Type for streaming
    //   4. /(.*) security    — global baseline (some of these are also
    //                           set by middleware; harmless duplication)
    return [
      // === 1. Service Worker itself: re-validate on every page load ===
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      // === 2. HTML pages: never cache, always revalidate ===
      // Excludes _next/static, _next/image, favicon, and common asset
      // extensions (which are safe to cache via their content-hashed
      // URLs from Next.js's build system).
      {
        source:
          "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm|ico)$).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      // === 3. dotlottie-web WebAssembly module ===
      // dotlottie-web's WebAssembly module. Vercel's default MIME
      // for .wasm is application/octet-stream, which makes
      // WebAssembly.instantiateStreaming() fail and forces the
      // library to fall back to WebAssembly.instantiate() — that
      // path requires 'unsafe-eval' in the CSP. Setting the
      // correct MIME keeps us on the streaming path, which is
      // both faster and CSP-friendly. Rule is applied here (not
      // in vercel.json) because Next.js merges the two and the
      // most-specific match wins, and we want this to take
      // precedence over the global `/(.*)` block below.
      {
        source: "/dotlottie-player.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // === 4. Security baseline (global) ===
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
