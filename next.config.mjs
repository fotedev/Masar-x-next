import createNextIntlPlugin from 'next-intl/plugin';
import bundleAnalyzer from '@next/bundle-analyzer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Force cache invalidation: 2026-02-14T04:30:00
    reactStrictMode: true,
    transpilePackages: ['next-intl'],
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
                hostname: 'framerusercontent.com',
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
    webpack: (config, { isServer }) => {
        // Fix next-intl resolution for Next.js 16
        const nextIntlEsm = path.resolve(__dirname, 'node_modules/next-intl/dist/esm/production');

        config.resolve.alias = {
            ...config.resolve.alias,
            'next-intl/server$': isServer 
                ? path.join(nextIntlEsm, 'server.react-server.js')
                : path.join(nextIntlEsm, 'server.react-client.js'),
            'next-intl/navigation$': isServer
                ? path.join(nextIntlEsm, 'navigation.react-server.js')
                : path.join(nextIntlEsm, 'navigation.react-client.js'),
            'next-intl/routing$': path.join(nextIntlEsm, 'routing.js'),
            'next-intl/middleware$': path.join(nextIntlEsm, 'middleware.js'),
            'next-intl$': isServer
                ? path.join(nextIntlEsm, 'index.react-server.js')
                : path.join(nextIntlEsm, 'index.react-client.js'),
        };

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

export default withNextIntl(withBundleAnalyzer(nextConfig));
