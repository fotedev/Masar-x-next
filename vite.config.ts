import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Only compress files larger than 1KB
      deleteOriginFile: false, // Keep original files
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Masar X',
        short_name: 'Masar X',
        description: 'منصة لمشاركة المعرفة بين الطلاب',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ui-vendor': ['lucide-react'],
          'ai-vendor': ['@google/generative-ai']
        }
      }
    },
    // Enable minification and compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Remove specific console methods
        passes: 3, // More passes for better compression
        unsafe: true, // Enable unsafe optimizations
        unsafe_comps: true, // Optimize comparisons
        unsafe_Function: true, // Optimize function calls
        unsafe_math: true, // Optimize math operations
        unsafe_symbols: true, // Optimize property access
        unsafe_methods: true, // Optimize method calls
        unsafe_proto: true, // Optimize prototype access
        unsafe_regexp: true, // Optimize regular expressions
        unsafe_undefined: true, // Optimize undefined checks
      },
      mangle: {
        safari10: true, // Fix Safari 10/11 bugs
        properties: {
          regex: /^_[A-Za-z]/, // Mangle private properties
        },
      },
      format: {
        comments: false, // Remove all comments
      }
    },
    // Optimize CSS
    cssMinify: true,
    // Reduce bundle size
    sourcemap: false, // Disable sourcemaps in production for smaller bundles
    // Additional optimizations
    reportCompressedSize: false, // Don't report compressed sizes to speed up build
  },
  optimizeDeps: {
    // Force pre-bundle React and related packages to prevent duplicate instances
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'katex',
      'lucide-react'
    ]
  },
  resolve: {
    // Deduplicate React packages to prevent multiple instances
    dedupe: [
      'react',
      'react-dom',
      'react-router-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime'
    ]
  },
  // Ensure .env files are loaded from project root
  envPrefix: 'VITE_',

  // Development server configuration
  server: {
    port: 5173,
    host: 'localhost',
    hmr: {
      port: 5173,
      host: 'localhost'
    },
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    }
  }
});
