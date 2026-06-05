// PATH: vite.config.ts
// UPDATED: Full PWA configuration
//  - Offline app-shell caching (JS/CSS/HTML/fonts)
//  - API calls always go to network (never served stale)
//  - Role-based deep links work after install (start_url: '/')
//  - Auto-updates: new SW activates when user navigates after deploy
//  - Separate maskable icon declared for Android adaptive icons

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // 'autoUpdate' = new service worker activates on next navigation.
      // Users never see a stale version for more than one page view.
      registerType: 'autoUpdate',

      // Files to pre-cache during the build (app shell)
      includeAssets: [
        'icons/icon.svg',
        'icons/icon-16.png',
        'icons/icon-32.png',
        'icons/icon-72.png',
        'icons/icon-96.png',
        'icons/icon-128.png',
        'icons/icon-144.png',
        'icons/icon-152.png',
        'icons/icon-167.png',
        'icons/icon-180.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
      ],

      // ── Web App Manifest ─────────────────────────────────────────────────
      manifest: {
        name:             'FMCG Distribution',
        short_name:       'FMCGDist',
        description:      'Routes · Orders · Warehouse · Settlement',
        start_url:        '/',
        scope:            '/',
        display:          'standalone',      // no browser chrome when installed
        background_color: '#F1F5F9',         // matches --bg in index.css
        theme_color:      '#2563EB',         // matches --primary
        orientation:      'any',             // works portrait and landscape
        lang:             'en-IN',
        categories:       ['business', 'productivity'],

        icons: [
          // Standard icons — used by Android/Chrome and desktop
          { src: '/icons/icon-72.png',  sizes: '72x72',   type: 'image/png' },
          { src: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Maskable — Android adaptive icon (fills the rounded-square shape)
          // This MUST be a separate file with safe-zone padding around the logo
          {
            src:     '/icons/icon-512-maskable.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'maskable',
          },
          // SVG fallback for modern browsers
          {
            src:     '/icons/icon.svg',
            sizes:   'any',
            type:    'image/svg+xml',
            purpose: 'any',
          },
        ],

        // ── Shortcuts — appear on long-press of home screen icon (Android) ──
        shortcuts: [
          {
            name:  'My Routes',
            url:   '/salesman/routes',
            icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }],
          },
          {
            name:  'Orders',
            url:   '/admin/orders',
            icons: [{ src: '/icons/icon-96.png', sizes: '96x96' }],
          },
        ],
      },

      // ── Workbox (service worker caching strategy) ────────────────────────
      workbox: {
        // Pre-cache the complete app shell (all build output)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],

        // Raise the per-file size limit (default 2 MB is too small for JS bundles)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        // ── Runtime caching rules (in priority order) ──────────────────────
        runtimeCaching: [
          // 1. API calls — always network, never stale
          //    Covers both /api/... and the direct backend URL
          {
            urlPattern: /\/api\//,
            handler:    'NetworkOnly',
          },

          // 2. Google Fonts CSS — stale-while-revalidate (fast + fresh)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler:    'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },

          // 3. Google Fonts binary files — cache-first for 1 year (they never change)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler:    'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries:    30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // 4. Everything else (navigation) — network-first with offline fallback
          {
            urlPattern:   ({ request }: { request: Request }) => request.mode === 'navigate',
            handler:      'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
            },
          },
        ],

        // Navigate to index.html for any unmatched URL (SPA fallback)
        navigateFallback:       '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/icons\//],

        // Clean up old caches when SW updates
        cleanupOutdatedCaches: true,

        // Skip waiting — new SW activates immediately
        skipWaiting: true,
        clientsClaim: true,
      },

      // Inject the service-worker registration into the app entry point
      injectRegister: 'auto',

      // Show the generated sw.js source in DevTools
      devOptions: {
        enabled: true,
        type:    'module',
      },
    }),
  ],

  // ── Dev server ───────────────────────────────────────────────────────────
  server: {
    host:         true,
    port:         3000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target:       'http://localhost:5002',
        changeOrigin: true,
      },
    },
  },

  // ── Build ────────────────────────────────────────────────────────────────
  build: {
    // Larger chunk warning threshold (PWA bundles are naturally bigger)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split vendor code into separate cacheable chunks
        manualChunks: {
          'react-vendor':  ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor':     ['lucide-react'],
          'state-vendor':  ['zustand'],
          'http-vendor':   ['axios'],
        },
      },
    },
  },
});