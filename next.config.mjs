import createNextIntlPlugin from 'next-intl/plugin';
import bundleAnalyzer from '@next/bundle-analyzer';
// import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Force cache invalidation: 2026-02-14T04:30:00
    reactStrictMode: true,
    transpilePackages: ['next-intl'], // Removed @sentry/nextjs
    compiler: {
        removeConsole: {
            exclude: ['error', 'warn'],
        },
    },
    images: {
        unoptimized: process.env.NODE_ENV !== 'production',
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
            {
                protocol: 'https',
                hostname: 'jcufigozkhxazjbwhjjm.supabase.co',
            },
        ],
    },
    webpack: (config) => {
        // Suppress next-intl build dependency warnings
        config.ignoreWarnings = [
            (warning) => {
                const message = warning.message || '';
                return (
                    message.includes('next-intl') && 
                    (message.includes('Parsing of') || message.includes('import(t)'))
                );
            }
        ];
        
        // Also suppress via infrastructure logging for terminal output
        if (config.infrastructureLogging) {
            config.infrastructureLogging.level = 'error';
        } else {
            config.infrastructureLogging = { level: 'error' };
        }

        return config;
    },
    async redirects() {
        return [
            {
                source: '/home',
                destination: '/',
                permanent: true,
            },
            {
                source: '/admin',
                destination: '/admin-dashboard',
                permanent: true,
            },
        ];
    },
    async headers() {
        const csp = [
            "default-src 'self' https://*.youtube.com https://*.googlevideo.com",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' data: https://masar-x.vercel.app https://masarx.vercel.app https://www.youtube.com https://s.ytimg.com",
            "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' data: https://masar-x.vercel.app https://masarx.vercel.app https://www.youtube.com https://s.ytimg.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://masar-x.vercel.app https://masarx.vercel.app",
            "img-src 'self' data: https: blob: https://www.google.com https://masar-x.vercel.app https://masarx.vercel.app https://*.ytimg.com https://www.transparenttextures.com",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://*.googleusercontent.com https://fonts.googleapis.com https://fonts.gstatic.com https://raw.githubusercontent.com https://www.google-analytics.com https://masar-x.vercel.app https://masarx.vercel.app https://res.cloudinary.com https://*.youtube.com https://*.googlevideo.com https://api.puter.com wss://api.puter.com https://*.puter.com wss://*.puter.com https://lottie.host https://cdn.jsdelivr.net https://www.transparenttextures.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://*.youtube.com",
            "worker-src 'self' blob: https://masar-x.vercel.app https://masarx.vercel.app",
            "frame-ancestors 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests",
        ].join('; ');

        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'Content-Security-Policy', value: csp },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                ],
            },
        ];
    },
};

/*
const configWithSentry = withSentryConfig(
    withNextIntl(withBundleAnalyzer(nextConfig)),
    {
        // For all available options, see:
        // https://github.com/getsentry/sentry-javascript/blob/master/packages/nextjs/src/config/types.ts

        org: "aboalayoun",
        project: "javascript-nextjs",

        // Only print logs for uploading source maps in CI
        silent: !process.env.CI,

        // For all available options, see:
        // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

        // Automatically tree-shake Sentry logger statements to reduce bundle size
        widenClientFileUpload: true,

        // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
        // This can increase your server load as well as your hosting bill.
        // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-side errors will fail.
        tunnelRoute: "/monitoring",

        // Hides source maps from visitors
        hideSourceMaps: true,

        // Fixes deprecation warnings by moving options into the webpack object
        webpack: {
            treeshake: {
                removeDebugLogging: true,
            },
            automaticVercelMonitors: true,
        },
    }
);

export default configWithSentry;
*/

export default withNextIntl(withBundleAnalyzer(nextConfig));
