import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { load as loadYaml } from 'js-yaml'
import { readFileSync, existsSync } from 'node:fs'
import { SITE_BASE } from './scripts/site-base.mjs'

/**
 * Turns any imported .yaml/.yml file into an ES module exporting the parsed data.
 * `unit.yaml?dialogues` exports only a unit's id and dialogues (the listening list needs no lessons);
 * `unit.yaml?vocab` only its id, its number of writing prompts and each lesson's id, title, vocab and grammar ids (its `teach` and the grammar of its
 * sentences, exchanges and texts): the lesson index of engine/lessonIndex.ts, behind the taught-words gate
 * (engine/taughtData.ts) and the games' finished-words pool (engine/finishedData.ts).
 */
function yamlPlugin(): Plugin {
  return {
    name: 'aprende:yaml',
    transform(code, id) {
      if (!/\.ya?ml(\?.*)?$/.test(id)) return null
      const data = loadYaml(code, { filename: id }) as Record<string, unknown> | null
      const query = (name: string) => new RegExp(`\\?(?:.*&)?${name}(?:&|$)`).test(id)
      type Graded = { grammar?: string[] }
      const lessons = (data?.lessons ?? []) as ({ id?: string; vocab?: string[]; teach?: string[] } & Record<'sentences' | 'exchanges' | 'texts', Graded[] | undefined>)[]
      const grammarOf = (l: (typeof lessons)[number]) => [...new Set([...(l.teach ?? []), ...[...(l.sentences ?? []), ...(l.exchanges ?? []), ...(l.texts ?? [])].flatMap((x) => x.grammar ?? [])])]
      const out = query('dialogues') ? { id: data?.id, dialogues: data?.dialogues ?? [] } : query('vocab') ? { id: data?.id, writing: ((data?.writing ?? []) as unknown[]).length, lessons: lessons.map((l) => ({ id: l.id, title: (l as { title?: string }).title ?? '', vocab: l.vocab ?? [], grammar: grammarOf(l) })) } : data
      return { code: `export default ${JSON.stringify(out)};`, map: null }
    },
  }
}

// ---------------------------------------------------------------------------
// One codebase, one course per build. VITE_LANG picks the course (default: Spanish).
//   VITE_LANG=yue npm run build   → dist/cantonese, served at /aprende/cantonese/
// Every course lives in its own folder; the site root /aprende/ is the Pawsport hub (vite.hub.config.ts).
const LANG = process.env.VITE_LANG ?? 'es'
type PackYaml = { id: string; name: string; slug?: string; locale: string; features?: { taughtOnly?: boolean } }
type UiYaml = { appName: string; tagline: string }
const readYaml = <T,>(p: string): T => loadYaml(readFileSync(p, 'utf8')) as T
if (!existsSync(`content/${LANG}/pack.yaml`)) throw new Error(`Unknown course VITE_LANG=${LANG}: content/${LANG}/pack.yaml is missing`)
const PACK = readYaml<PackYaml>(`content/${LANG}/pack.yaml`)
const UI = existsSync(`content/${LANG}/ui.yaml`) ? readYaml<UiYaml>(`content/${LANG}/ui.yaml`) : { appName: 'Pawsport', tagline: PACK.name }
const SLUG = PACK.slug ?? ''
// The root belongs to the hub: a course at /aprende/ would fight it for the same service worker (/aprende/sw.js).
if (!SLUG) throw new Error(`content/${LANG}/pack.yaml needs a slug: courses are published at /aprende/<slug>/, the root is the hub`)
const BASE = process.env.VITE_BASE ?? `${SITE_BASE}${SLUG}/`
const TITLE = `${UI.appName} · ${PACK.name}`

/** import.meta.glob ignores aliases: point `@content/` and `@lang/` globs at this course's folders before Vite expands them. */
function contentGlobPlugin(): Plugin {
  return {
    name: 'aprende:content-glob',
    enforce: 'pre',
    transform(code, id) {
      if (!(code.includes("import.meta.glob('@content/") || code.includes("import.meta.glob('@lang/")) || id.includes('node_modules')) return null
      return { code: code.replaceAll("import.meta.glob('@content/", `import.meta.glob('/content/${LANG}/`).replaceAll("import.meta.glob('@lang/", `import.meta.glob('/src/lang/${LANG}/`), map: null }
    },
  }
}

/** Course name and description in index.html. */
function htmlPlugin(): Plugin {
  return {
    name: 'aprende:html',
    transformIndexHtml(html) {
      return html
        .replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`)
        .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${TITLE}: a complete, free ${PACK.name} course from beginner to advanced. Short daily lessons, explicit grammar, spaced repetition, reading, listening and speaking. Works offline."`)
    },
  }
}

export default defineConfig({
  base: BASE,
  define: { __SITE_BASE__: JSON.stringify(SITE_BASE) },
  plugins: [
    yamlPlugin(),
    contentGlobPlugin(),
    htmlPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // registered by main.tsx, so safe mode (index.html) can start without the service worker
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: BASE,
        name: TITLE,
        short_name: UI.appName,
        description: `A complete, free ${PACK.name} course from beginner to advanced: short daily lessons, explicit grammar, spaced repetition, reading, listening and speaking.`,
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
        globPatterns: ['**/*.{js,css,html,svg,png,webp,jpg,jpeg,json,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // the standalone repair page (public/repair.html) must never be swapped for the app
        navigateFallbackDenylist: [/\/repair\.html$/],
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
    outDir: process.env.VITE_OUT ?? `dist/${SLUG}`,
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    // Language-specific suites only run for their own course.
    // tests/course-<code>/ hold tests written in one course's language (they run only for that course);
    // tests/<code>.*.test.ts import their pack directly and run everywhere.
    exclude: ['**/node_modules/**', 'tests/zz*', ...['es', 'yue', 'pt', 'it', 'fr'].filter((l) => l !== LANG).map((l) => `tests/course-${l}/**`)],
    coverage: { provider: 'v8', include: ['src/**'] },
  },
})
