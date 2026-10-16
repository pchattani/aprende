// The Pawsport hub: the site root /aprende/, which lists every language and your progress in each.
//   npm run dev:hub         → http://localhost:5173/aprende/
//   npm run build:hub       → dist/index.html (+ dist/assets, dist/sw.js), next to the course folders dist/<slug>/
// Courses are built separately by vite.config.ts (one per VITE_LANG); `npm run build:all` builds everything.
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { load as loadYaml } from 'js-yaml'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SITE_BASE } from './scripts/site-base.mjs'

const BASE = SITE_BASE
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface CourseJson { id: string; name: string; native: string; flag: string; slug: string; live: boolean; country?: string; pitch?: string }
type Journey = { regions: { level: string; name: string }[] }

const COURSES = (JSON.parse(readFileSync(here('./courses.json'), 'utf8')) as CourseJson[]).filter((c) => c.live)
for (const c of COURSES) if (!c.slug) throw new Error(`courses.json: ${c.id} needs a slug (the root ${BASE} is the hub)`)
/** Every course folder under the hub's scope: the hub's service worker must leave them alone. */
const SLUGS = COURSES.map((c) => c.slug)
/** Spanish used to be the root course: its old hash routes now live here. */
const LEGACY_URL = `${BASE}${COURSES.find((c) => c.id === 'es')?.slug ?? 'spanish'}/`

/** `virtual:pawsport-courses`: the live courses with their journey regions, read at build time. */
function coursesPlugin(): Plugin {
  const id = 'virtual:pawsport-courses'
  return {
    name: 'pawsport:courses',
    resolveId: (source) => (source === id ? `\0${id}` : null),
    load(resolved) {
      if (resolved !== `\0${id}`) return null
      const data = COURSES.map((c) => {
        const journey = loadYaml(readFileSync(here(`./content/${c.id}/journey.yaml`), 'utf8')) as Journey
        const pack = loadYaml(readFileSync(here(`./content/${c.id}/pack.yaml`), 'utf8')) as { locale: string }
        return {
          id: c.id, name: c.name, native: c.native, flag: c.flag, slug: c.slug, locale: pack.locale,
          href: `${BASE}${c.slug}/`,
          dbName: c.id === 'es' ? 'aprende' : `aprende-${c.id}`,
          country: c.country ?? '', pitch: c.pitch ?? '',
          regions: journey.regions.map((r) => ({ level: r.level, name: r.name })),
        }
      })
      return `export default ${JSON.stringify(data)};`
    },
    // Old Spanish links (/aprende/#/…) are forwarded to the Spanish course (inline script in hub/index.html).
    transformIndexHtml: (html) => html.replace('__PAWSPORT_LEGACY_URL__', LEGACY_URL),
  }
}

/** The hub must never pull in per-course modules (they bake one language in at build time). */
function noCourseImports(): Plugin {
  return {
    name: 'pawsport:no-course-imports',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      const refuse = () => this.error(`The hub must not import "${source}" (from ${importer ?? '?'}): it is per-course. Import pure modules only.`)
      if (/^@(lang|content)(\/|$)/.test(source)) refuse()
      if (/loader(\.ts)?$/.test(source)) {
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
        if (resolved && resolved.id.replaceAll('\\', '/').endsWith('/src/engine/loader.ts')) refuse()
      }
      return null
    },
  }
}

export default defineConfig({
  root: here('./hub'),
  base: BASE,
  define: { __SITE_BASE__: JSON.stringify(SITE_BASE) },
  publicDir: here('./public'),
  plugins: [
    noCourseImports(),
    coursesPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        // Same id and scope as the old Spanish app that used to live here, so an installed app becomes the hub.
        id: BASE,
        name: 'Pawsport',
        short_name: 'Pawsport',
        description: 'Free language courses that travel: Spanish, Cantonese, Portuguese, Italian and French, from first words to fluency. Works offline.',
        lang: 'en',
        theme_color: '#1c2541',
        background_color: '#f6f4ee',
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
        // dist/ also holds every course: the hub's worker (scope /aprende/) must never cache them or answer
        // their navigations; each course has its own worker at /aprende/<slug>/sw.js.
        globIgnores: SLUGS.map((s) => `${s}/**`),
        navigateFallback: 'index.html',
        navigateFallbackDenylist: SLUGS.map((s) => new RegExp(`^${escapeRe(BASE)}${escapeRe(s)}(/|$)`)),
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: { '@': here('./src') },
  },
  build: {
    target: 'es2022',
    outDir: here('./dist'),
    // Never wipe dist/: the course folders dist/<slug>/ live beside the hub.
    emptyOutDir: false,
  },
})
