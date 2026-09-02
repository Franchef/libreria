import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/libreria/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Model weights are cached by WebLLM itself; books are too large to precache.
        globIgnores: ['**/data/books/**'],
        navigateFallbackDenylist: [/^\/libreria\/data\//],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/libreria/data/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'libreria-books',
              expiration: { maxEntries: 30 },
            },
          },
        ],
      },
      manifest: {
        name: 'librerIA',
        short_name: 'librerIA',
        description: 'Your local AI book expert.',
        theme_color: '#0f766e',
        background_color: '#f7f5ef',
        display: 'standalone',
      },
    }),
  ],
})
