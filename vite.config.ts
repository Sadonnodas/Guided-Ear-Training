import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Per-file cache limit needs to exceed the largest precached asset.
// Drone loops are ~7.2 MB each; 12 MB gives comfortable headroom.
const MAX_CACHE_FILE_BYTES = 12 * 1024 * 1024

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      // Auto-update the service worker silently when a new deploy is detected.
      registerType: 'autoUpdate',
      // Inject the SW registration script into index.html automatically.
      injectRegister: 'auto',
      // Keep the hand-crafted public/manifest.json instead of generating one.
      manifest: false,
      // Files in public/ that the SW should make available to the precache
      // manifest (these are referenced from index.html / the running app).
      includeAssets: ['icon.png', 'icon2.png', 'manifest.json'],
      workbox: {
        // Precache the app shell AND every audio asset so the app is fully
        // functional on a plane, in a tunnel, etc. once the SW has installed.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,woff,woff2}'],
        maximumFileSizeToCacheInBytes: MAX_CACHE_FILE_BYTES,
        cleanupOutdatedCaches: true,
        // SPA fallback: every unmatched navigation serves index.html so the
        // app can boot offline regardless of the route the user opened.
        navigateFallback: 'index.html',
      },
      // Keep the SW out of the way during `npm run dev` so local development
      // isn't serving stale cached assets.
      devOptions: {
        enabled: false,
      },
    }),
  ],
  // FIX: Only use the repo name in production. Use '/' locally.
  base: mode === 'production' ? '/Guided-Ear-Training/' : '/',
}))
