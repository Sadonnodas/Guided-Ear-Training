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
      // Register the SW ourselves via the React hook in <OfflineStatus />
      // so we can surface install progress to the user.
      injectRegister: false,
      // Keep the hand-crafted public/manifest.json instead of generating one.
      manifest: false,
      includeAssets: ['icon.png', 'manifest.json'],
      workbox: {
        // Precache ONLY the app shell. We deliberately don't precache the
        // ~135 MB of audio: Workbox's cache.addAll() is fragile (one bad
        // fetch aborts everything) and iOS Safari silently evicts large
        // caches under quota pressure — leaving the precache index intact
        // while the blobs are gone, which produces a SW that thinks it's
        // cached everything but serves nothing. The app prefetches audio
        // explicitly via a user-tapped "Download for offline" button, which
        // populates the runtimeCaching CacheFirst store below; individual
        // fetch failures there don't abort the others.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Skip the unused alternate icons sitting in public/ — they pull
        // ~10 MB into the precache for nothing (only icon.png is referenced).
        globIgnores: ['**/old icon.png', '**/icon2.png'],
        maximumFileSizeToCacheInBytes: MAX_CACHE_FILE_BYTES,
        cleanupOutdatedCaches: true,
        // SPA fallback: every unmatched navigation serves index.html so the
        // app can boot offline regardless of the route the user opened.
        navigateFallback: 'index.html',
        // Activate the new SW immediately and take control of the page
        // without waiting for all tabs to close. Without these flags the
        // first install registers the SW but doesn't intercept fetches —
        // the next offline visit then hits the network and fails.
        skipWaiting: true,
        clientsClaim: true,
        // Runtime cache fallback for any mp3 that didn't end up in the
        // precache (e.g. quota-evicted on a first install). CacheFirst so
        // online visits silently top up the cache for next time.
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'audio' || url.pathname.endsWith('.mp3'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-runtime',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep the SW out of the way during `npm run dev` so local
        // development isn't serving stale cached assets.
        enabled: false,
      },
    }),
  ],
  // FIX: Only use the repo name in production. Use '/' locally.
  base: mode === 'production' ? '/Guided-Ear-Training/' : '/',
}))
