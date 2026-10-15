import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { load as loadYaml } from 'js-yaml'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

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

// ---------------------------------------------------------------------------
// One codebase, one course per build. VITE_LANG picks the course (default: Spanish).
//   VITE_LANG=yue npm run build   → dist/cantonese, served at /aprende/cantonese/
const LANG = process.env.VITE_LANG ?? 'es'
type PackYaml = { id: string; name: string; slug?: string; locale: string }
type UiYaml = { appName: string; tagline: string }
const readYaml = <T,>(p: string): T => loadYaml(readFileSync(p, 'utf8')) as T
if (!existsSync(`content/${LANG}/pack.yaml`)) throw new Error(`Unknown course VITE_LANG=${LANG}: content/${LANG}/pack.yaml is missing`)
const PACK = readYaml<PackYaml>(`content/${LANG}/pack.yaml`)
const UI = existsSync(`content/${LANG}/ui.yaml`) ? readYaml<UiYaml>(`content/${LANG}/ui.yaml`) : { appName: 'Aprende', tagline: PACK.name }
const SLUG = PACK.slug ?? ''
const BASE = process.env.VITE_BASE ?? (SLUG ? `/aprende/${SLUG}/` : '/aprende/')
/** Slugs of the sister courses that live under this course's path (only the root course has any). */
const SISTER_SLUGS = SLUG
  ? []
  : readdirSync('content')
      .filter((d) => existsSync(`content/${d}/pack.yaml`))
      .map((d) => readYaml<PackYaml>(`content/${d}/pack.yaml`).slug ?? '')
      .filter(Boolean)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** import.meta.glob ignores aliases: point `@content/` globs at this course's folder before Vite expands them. */
function contentGlobPlugin(): Plugin {
  return {
    name: 'aprende:content-glob',
    enforce: 'pre',
    transform(code, id) {
      if (!code.includes("import.meta.glob('@content/") || id.includes('node_modules')) return null
      return { code: code.replaceAll("import.meta.glob('@content/", `import.meta.glob('/content/${LANG}/`), map: null }
    },
  }
}

/** Course name and description in index.html. */
function htmlPlugin(): Plugin {
  return {
    name: 'aprende:html',
    transformIndexHtml(html) {
      return html
        .replace(/<title>[^<]*<\/title>/, `<title>${UI.appName}</title>`)
        .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${UI.appName}: a complete, free ${PACK.name} course from beginner to advanced. Short daily lessons, explicit grammar, spaced repetition, reading, listening and speaking. Works offline."`)
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [
    yamlPlugin(),
    contentGlobPlugin(),
    htmlPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: BASE,
        name: `${UI.appName}: ${PACK.name} A1 to C2`,
        short_name: UI.appName,
        description: `A complete, free ${PACK.name} course from beginner to advanced: short daily lessons, explicit grammar, spaced repetition, reading, listening and speaking.`,
        lang: 'en',
        theme_color: '#7c5cff',
        background_color: '#f6f5ff',
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
        // The root course must never cache or answer for the sister courses below it.
        globIgnores: SISTER_SLUGS.map((s) => `${s}/**`),
        navigateFallbackDenylist: SISTER_SLUGS.map((s) => new RegExp(`^${escapeRe(BASE)}${escapeRe(s)}(/|$)`)),
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    // String aliases (not regexes) so that import.meta.glob('@content/…') resolves too.
    alias: { '@content': `/content/${LANG}`, '@lang': `/src/lang/${LANG}`, '@': '/src' },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    outDir: process.env.VITE_OUT ?? (SLUG ? `dist/${SLUG}` : 'dist'),
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    // Language-specific suites only run for their own course.
    exclude: ['**/node_modules/**', ...['es', 'yue', 'pt', 'it'].filter((l) => l !== LANG).map((l) => `tests/course-${l}/**`)],
    coverage: { provider: 'v8', include: ['src/**'] },
  },
})
