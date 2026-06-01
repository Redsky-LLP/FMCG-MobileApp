// PATH: vite.config.ts
// UPDATED: Added vite-plugin-pwa so the app installs on any Android/Apple
//          tablet or phone directly from the browser (no app store needed).
//
// Before running: npm install vite-plugin-pwa -D
// Also place icon-192.png and icon-512.png inside /public/

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'FMCG Distribution',
        short_name: 'FMCGDist',
        description: 'FMCG Distribution Management — Orders, Routes, Warehouse',
        start_url: '/',
        display: 'standalone',       // ← full screen, no browser bar on tablet/phone
        background_color: '#F1F5F9',
        theme_color: '#2563EB',
        orientation: 'any',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache all app pages so the shell loads even on weak connections
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache API calls — always fetch fresh data from server
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      },
    },
  },
});