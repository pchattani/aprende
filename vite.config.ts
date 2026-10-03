import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { load as loadYaml } from 'js-yaml'

/** Turns any imported .yaml/.yml file into an ES module exporting the parsed data. */
function yamlPlugin(): Plugin {
  return {
    name: 'aprende:yaml',
    transform(code, id) {
      if (!/\.ya?ml(\?.*)?$/.test(id)) return null
      const data = loadYaml(code, { filename: id })
      return { code: `export default ${JSON.stringify(data)};`, map: null }
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/aprende/',
  plugins: [
    yamlPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Aprende: Spanish A1 to C2',
        short_name: 'Aprende',
        description: 'A complete, free Spanish course from beginner to advanced: short daily lessons, explicit grammar, spaced repetition, reading, listening and speaking.',
        lang: 'en',
        theme_color: '#cf5f3d',
        background_color: '#faf3e7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': '/src', '@content': '/content' },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['src/**'] },
  },
})
