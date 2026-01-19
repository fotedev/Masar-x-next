// vite.config.ts
import { defineConfig } from "file:///I:/Desktop/programming/WEB_Development/projects/masarx/node_modules/.pnpm/vite@5.4.21_@types+node@25.0.9_terser@5.46.0/node_modules/vite/dist/node/index.js";
import react from "file:///I:/Desktop/programming/WEB_Development/projects/masarx/node_modules/.pnpm/@vitejs+plugin-react@4.7.0__9acdc51bcfeb11215c95df1f28204d6a/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///I:/Desktop/programming/WEB_Development/projects/masarx/node_modules/.pnpm/vite-plugin-pwa@1.2.0_vite@_ec6fb5e18b852aab1ffa024f76f717a6/node_modules/vite-plugin-pwa/dist/index.js";
import viteCompression from "file:///I:/Desktop/programming/WEB_Development/projects/masarx/node_modules/.pnpm/vite-plugin-compression@0.5_65726adaa9931501e66f86aa13fd202e/node_modules/vite-plugin-compression/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    viteCompression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024,
      // Only compress files larger than 1KB
      deleteOriginFile: false
      // Keep original files
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "Masar X",
        short_name: "Masar X",
        description: "\u0645\u0646\u0635\u0629 \u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0645\u0639\u0631\u0641\u0629 \u0628\u064A\u0646 \u0627\u0644\u0637\u0644\u0627\u0628",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "logo.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "logo.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "supabase-vendor": ["@supabase/supabase-js"],
          "ui-vendor": ["lucide-react"],
          "ai-vendor": ["@google/generative-ai"]
        }
      }
    },
    // Enable minification and compression
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug"],
        // Remove specific console methods
        passes: 3,
        // More passes for better compression
        unsafe: true,
        // Enable unsafe optimizations
        unsafe_comps: true,
        // Optimize comparisons
        unsafe_Function: true,
        // Optimize function calls
        unsafe_math: true,
        // Optimize math operations
        unsafe_symbols: true,
        // Optimize property access
        unsafe_methods: true,
        // Optimize method calls
        unsafe_proto: true,
        // Optimize prototype access
        unsafe_regexp: true,
        // Optimize regular expressions
        unsafe_undefined: true
        // Optimize undefined checks
      },
      mangle: {
        safari10: true,
        // Fix Safari 10/11 bugs
        properties: {
          regex: /^_[A-Za-z]/
          // Mangle private properties
        }
      },
      format: {
        comments: false
        // Remove all comments
      }
    },
    // Optimize CSS
    cssMinify: true,
    // Reduce bundle size
    sourcemap: false,
    // Disable sourcemaps in production for smaller bundles
    // Additional optimizations
    reportCompressedSize: false
    // Don't report compressed sizes to speed up build
  },
  optimizeDeps: {
    // Force pre-bundle React and related packages to prevent duplicate instances
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@supabase/supabase-js",
      "katex",
      "lucide-react"
    ]
  },
  resolve: {
    // Deduplicate React packages to prevent multiple instances
    dedupe: [
      "react",
      "react-dom",
      "react-router-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime"
    ]
  },
  // Ensure .env files are loaded from project root
  envPrefix: "VITE_",
  // Development server configuration
  server: {
    port: 5173,
    host: "localhost",
    hmr: {
      port: 5173,
      host: "localhost"
    },
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJJOlxcXFxEZXNrdG9wXFxcXHByb2dyYW1taW5nXFxcXFdFQl9EZXZlbG9wbWVudFxcXFxwcm9qZWN0c1xcXFxtYXNhcnhcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkk6XFxcXERlc2t0b3BcXFxccHJvZ3JhbW1pbmdcXFxcV0VCX0RldmVsb3BtZW50XFxcXHByb2plY3RzXFxcXG1hc2FyeFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vSTovRGVza3RvcC9wcm9ncmFtbWluZy9XRUJfRGV2ZWxvcG1lbnQvcHJvamVjdHMvbWFzYXJ4L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xyXG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gJ3ZpdGUtcGx1Z2luLWNvbXByZXNzaW9uJztcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIHZpdGVDb21wcmVzc2lvbih7XHJcbiAgICAgIGFsZ29yaXRobTogJ2d6aXAnLFxyXG4gICAgICBleHQ6ICcuZ3onLFxyXG4gICAgICB0aHJlc2hvbGQ6IDEwMjQsIC8vIE9ubHkgY29tcHJlc3MgZmlsZXMgbGFyZ2VyIHRoYW4gMUtCXHJcbiAgICAgIGRlbGV0ZU9yaWdpbkZpbGU6IGZhbHNlLCAvLyBLZWVwIG9yaWdpbmFsIGZpbGVzXHJcbiAgICB9KSxcclxuICAgIFZpdGVQV0Eoe1xyXG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcclxuICAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLmljbycsICdhcHBsZS10b3VjaC1pY29uLnBuZycsICdtYXNrZWQtaWNvbi5zdmcnXSxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBuYW1lOiAnTWFzYXIgWCcsXHJcbiAgICAgICAgc2hvcnRfbmFtZTogJ01hc2FyIFgnLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnXHUwNjQ1XHUwNjQ2XHUwNjM1XHUwNjI5IFx1MDY0NFx1MDY0NVx1MDYzNFx1MDYyN1x1MDYzMVx1MDY0M1x1MDYyOSBcdTA2MjdcdTA2NDRcdTA2NDVcdTA2MzlcdTA2MzFcdTA2NDFcdTA2MjkgXHUwNjI4XHUwNjRBXHUwNjQ2IFx1MDYyN1x1MDY0NFx1MDYzN1x1MDY0NFx1MDYyN1x1MDYyOCcsXHJcbiAgICAgICAgdGhlbWVfY29sb3I6ICcjZmZmZmZmJyxcclxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnI2ZmZmZmZicsXHJcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxyXG4gICAgICAgIG9yaWVudGF0aW9uOiAncG9ydHJhaXQnLFxyXG4gICAgICAgIHNjb3BlOiAnLycsXHJcbiAgICAgICAgc3RhcnRfdXJsOiAnLycsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiAnbG9nby5wbmcnLFxyXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxyXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiAnbG9nby5wbmcnLFxyXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIF1cclxuICAgICAgfVxyXG4gICAgfSlcclxuICBdLFxyXG4gIGJ1aWxkOiB7XHJcbiAgICAvLyBJbmNyZWFzZSBjaHVuayBzaXplIHdhcm5pbmcgbGltaXRcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgJ3N1cGFiYXNlLXZlbmRvcic6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXHJcbiAgICAgICAgICAndWktdmVuZG9yJzogWydsdWNpZGUtcmVhY3QnXSxcclxuICAgICAgICAgICdhaS12ZW5kb3InOiBbJ0Bnb29nbGUvZ2VuZXJhdGl2ZS1haSddXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgLy8gRW5hYmxlIG1pbmlmaWNhdGlvbiBhbmQgY29tcHJlc3Npb25cclxuICAgIG1pbmlmeTogJ3RlcnNlcicsXHJcbiAgICB0ZXJzZXJPcHRpb25zOiB7XHJcbiAgICAgIGNvbXByZXNzOiB7XHJcbiAgICAgICAgZHJvcF9jb25zb2xlOiB0cnVlLCAvLyBSZW1vdmUgY29uc29sZS5sb2cgaW4gcHJvZHVjdGlvblxyXG4gICAgICAgIGRyb3BfZGVidWdnZXI6IHRydWUsXHJcbiAgICAgICAgcHVyZV9mdW5jczogWydjb25zb2xlLmxvZycsICdjb25zb2xlLmluZm8nLCAnY29uc29sZS5kZWJ1ZyddLCAvLyBSZW1vdmUgc3BlY2lmaWMgY29uc29sZSBtZXRob2RzXHJcbiAgICAgICAgcGFzc2VzOiAzLCAvLyBNb3JlIHBhc3NlcyBmb3IgYmV0dGVyIGNvbXByZXNzaW9uXHJcbiAgICAgICAgdW5zYWZlOiB0cnVlLCAvLyBFbmFibGUgdW5zYWZlIG9wdGltaXphdGlvbnNcclxuICAgICAgICB1bnNhZmVfY29tcHM6IHRydWUsIC8vIE9wdGltaXplIGNvbXBhcmlzb25zXHJcbiAgICAgICAgdW5zYWZlX0Z1bmN0aW9uOiB0cnVlLCAvLyBPcHRpbWl6ZSBmdW5jdGlvbiBjYWxsc1xyXG4gICAgICAgIHVuc2FmZV9tYXRoOiB0cnVlLCAvLyBPcHRpbWl6ZSBtYXRoIG9wZXJhdGlvbnNcclxuICAgICAgICB1bnNhZmVfc3ltYm9sczogdHJ1ZSwgLy8gT3B0aW1pemUgcHJvcGVydHkgYWNjZXNzXHJcbiAgICAgICAgdW5zYWZlX21ldGhvZHM6IHRydWUsIC8vIE9wdGltaXplIG1ldGhvZCBjYWxsc1xyXG4gICAgICAgIHVuc2FmZV9wcm90bzogdHJ1ZSwgLy8gT3B0aW1pemUgcHJvdG90eXBlIGFjY2Vzc1xyXG4gICAgICAgIHVuc2FmZV9yZWdleHA6IHRydWUsIC8vIE9wdGltaXplIHJlZ3VsYXIgZXhwcmVzc2lvbnNcclxuICAgICAgICB1bnNhZmVfdW5kZWZpbmVkOiB0cnVlLCAvLyBPcHRpbWl6ZSB1bmRlZmluZWQgY2hlY2tzXHJcbiAgICAgIH0sXHJcbiAgICAgIG1hbmdsZToge1xyXG4gICAgICAgIHNhZmFyaTEwOiB0cnVlLCAvLyBGaXggU2FmYXJpIDEwLzExIGJ1Z3NcclxuICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICByZWdleDogL15fW0EtWmEtel0vLCAvLyBNYW5nbGUgcHJpdmF0ZSBwcm9wZXJ0aWVzXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgZm9ybWF0OiB7XHJcbiAgICAgICAgY29tbWVudHM6IGZhbHNlLCAvLyBSZW1vdmUgYWxsIGNvbW1lbnRzXHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgICAvLyBPcHRpbWl6ZSBDU1NcclxuICAgIGNzc01pbmlmeTogdHJ1ZSxcclxuICAgIC8vIFJlZHVjZSBidW5kbGUgc2l6ZVxyXG4gICAgc291cmNlbWFwOiBmYWxzZSwgLy8gRGlzYWJsZSBzb3VyY2VtYXBzIGluIHByb2R1Y3Rpb24gZm9yIHNtYWxsZXIgYnVuZGxlc1xyXG4gICAgLy8gQWRkaXRpb25hbCBvcHRpbWl6YXRpb25zXHJcbiAgICByZXBvcnRDb21wcmVzc2VkU2l6ZTogZmFsc2UsIC8vIERvbid0IHJlcG9ydCBjb21wcmVzc2VkIHNpemVzIHRvIHNwZWVkIHVwIGJ1aWxkXHJcbiAgfSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIC8vIEZvcmNlIHByZS1idW5kbGUgUmVhY3QgYW5kIHJlbGF0ZWQgcGFja2FnZXMgdG8gcHJldmVudCBkdXBsaWNhdGUgaW5zdGFuY2VzXHJcbiAgICBpbmNsdWRlOiBbXHJcbiAgICAgICdyZWFjdCcsXHJcbiAgICAgICdyZWFjdC1kb20nLFxyXG4gICAgICAncmVhY3Qtcm91dGVyLWRvbScsXHJcbiAgICAgICdAc3VwYWJhc2Uvc3VwYWJhc2UtanMnLFxyXG4gICAgICAna2F0ZXgnLFxyXG4gICAgICAnbHVjaWRlLXJlYWN0J1xyXG4gICAgXVxyXG4gIH0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgLy8gRGVkdXBsaWNhdGUgUmVhY3QgcGFja2FnZXMgdG8gcHJldmVudCBtdWx0aXBsZSBpbnN0YW5jZXNcclxuICAgIGRlZHVwZTogW1xyXG4gICAgICAncmVhY3QnLFxyXG4gICAgICAncmVhY3QtZG9tJyxcclxuICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxyXG4gICAgICAncmVhY3QvanN4LXJ1bnRpbWUnLFxyXG4gICAgICAncmVhY3QvanN4LWRldi1ydW50aW1lJ1xyXG4gICAgXVxyXG4gIH0sXHJcbiAgLy8gRW5zdXJlIC5lbnYgZmlsZXMgYXJlIGxvYWRlZCBmcm9tIHByb2plY3Qgcm9vdFxyXG4gIGVudlByZWZpeDogJ1ZJVEVfJyxcclxuXHJcbiAgLy8gRGV2ZWxvcG1lbnQgc2VydmVyIGNvbmZpZ3VyYXRpb25cclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDUxNzMsXHJcbiAgICBob3N0OiAnbG9jYWxob3N0JyxcclxuICAgIGhtcjoge1xyXG4gICAgICBwb3J0OiA1MTczLFxyXG4gICAgICBob3N0OiAnbG9jYWxob3N0J1xyXG4gICAgfSxcclxuICAgIGhlYWRlcnM6IHtcclxuICAgICAgJ1gtQ29udGVudC1UeXBlLU9wdGlvbnMnOiAnbm9zbmlmZicsXHJcbiAgICAgICdYLUZyYW1lLU9wdGlvbnMnOiAnREVOWScsXHJcbiAgICAgICdYLVhTUy1Qcm90ZWN0aW9uJzogJzE7IG1vZGU9YmxvY2snLFxyXG4gICAgICAnUmVmZXJyZXItUG9saWN5JzogJ3N0cmljdC1vcmlnaW4td2hlbi1jcm9zcy1vcmlnaW4nLFxyXG4gICAgICAnUGVybWlzc2lvbnMtUG9saWN5JzogJ2dlb2xvY2F0aW9uPSgpLCBtaWNyb3Bob25lPSgpLCBjYW1lcmE9KCknXHJcbiAgICB9XHJcbiAgfVxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFnVyxTQUFTLG9CQUFvQjtBQUM3WCxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBQ3hCLE9BQU8scUJBQXFCO0FBRzVCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLGdCQUFnQjtBQUFBLE1BQ2QsV0FBVztBQUFBLE1BQ1gsS0FBSztBQUFBLE1BQ0wsV0FBVztBQUFBO0FBQUEsTUFDWCxrQkFBa0I7QUFBQTtBQUFBLElBQ3BCLENBQUM7QUFBQSxJQUNELFFBQVE7QUFBQSxNQUNOLGNBQWM7QUFBQSxNQUNkLGVBQWUsQ0FBQyxlQUFlLHdCQUF3QixpQkFBaUI7QUFBQSxNQUN4RSxVQUFVO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYixrQkFBa0I7QUFBQSxRQUNsQixTQUFTO0FBQUEsUUFDVCxhQUFhO0FBQUEsUUFDYixPQUFPO0FBQUEsUUFDUCxXQUFXO0FBQUEsUUFDWCxPQUFPO0FBQUEsVUFDTDtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFVBQ1I7QUFBQSxVQUNBO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsVUFDUjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsT0FBTztBQUFBO0FBQUEsSUFFTCx1QkFBdUI7QUFBQSxJQUN2QixlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsVUFDWixnQkFBZ0IsQ0FBQyxTQUFTLGFBQWEsa0JBQWtCO0FBQUEsVUFDekQsbUJBQW1CLENBQUMsdUJBQXVCO0FBQUEsVUFDM0MsYUFBYSxDQUFDLGNBQWM7QUFBQSxVQUM1QixhQUFhLENBQUMsdUJBQXVCO0FBQUEsUUFDdkM7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBO0FBQUEsSUFFQSxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixVQUFVO0FBQUEsUUFDUixjQUFjO0FBQUE7QUFBQSxRQUNkLGVBQWU7QUFBQSxRQUNmLFlBQVksQ0FBQyxlQUFlLGdCQUFnQixlQUFlO0FBQUE7QUFBQSxRQUMzRCxRQUFRO0FBQUE7QUFBQSxRQUNSLFFBQVE7QUFBQTtBQUFBLFFBQ1IsY0FBYztBQUFBO0FBQUEsUUFDZCxpQkFBaUI7QUFBQTtBQUFBLFFBQ2pCLGFBQWE7QUFBQTtBQUFBLFFBQ2IsZ0JBQWdCO0FBQUE7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQTtBQUFBLFFBQ2hCLGNBQWM7QUFBQTtBQUFBLFFBQ2QsZUFBZTtBQUFBO0FBQUEsUUFDZixrQkFBa0I7QUFBQTtBQUFBLE1BQ3BCO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTixVQUFVO0FBQUE7QUFBQSxRQUNWLFlBQVk7QUFBQSxVQUNWLE9BQU87QUFBQTtBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTixVQUFVO0FBQUE7QUFBQSxNQUNaO0FBQUEsSUFDRjtBQUFBO0FBQUEsSUFFQSxXQUFXO0FBQUE7QUFBQSxJQUVYLFdBQVc7QUFBQTtBQUFBO0FBQUEsSUFFWCxzQkFBc0I7QUFBQTtBQUFBLEVBQ3hCO0FBQUEsRUFDQSxjQUFjO0FBQUE7QUFBQSxJQUVaLFNBQVM7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBO0FBQUEsSUFFUCxRQUFRO0FBQUEsTUFDTjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQSxXQUFXO0FBQUE7QUFBQSxFQUdYLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCwwQkFBMEI7QUFBQSxNQUMxQixtQkFBbUI7QUFBQSxNQUNuQixvQkFBb0I7QUFBQSxNQUNwQixtQkFBbUI7QUFBQSxNQUNuQixzQkFBc0I7QUFBQSxJQUN4QjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
