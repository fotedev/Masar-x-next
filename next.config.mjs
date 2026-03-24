import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Force cache invalidation: 2026-02-14T04:30:00
    reactStrictMode: true,
    swcMinify: true,
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
            // Next currently injects inline scripts (theme + JSON-LD). We keep 'unsafe-inline' for compatibility.
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' https: data: https://*.ytimg.com https://www.transparenttextures.com",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://res.cloudinary.com https://www.transparenttextures.com https://raw.githubusercontent.com https://*.youtube.com https://*.googlevideo.com https://*.google.com https://api.puter.com wss://api.puter.com ws://localhost:* https://cdn.jsdelivr.net https://lottie.host",
            "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://*.youtube.com",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
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

export default withNextIntl(nextConfig);
