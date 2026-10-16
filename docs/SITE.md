# The site: the Pawsport hub and its courses

Everything is static files on GitHub Pages, one origin (`https://pchattani.github.io`),
under one path (`/aprende/`). There is no server.

```
dist/                         → /aprende/
  index.html, assets/, sw.js    the Pawsport hub (hub/, vite.hub.config.ts)
  manifest.webmanifest          "Pawsport", id and scope /aprende/
  spanish/                    → /aprende/spanish/     (VITE_LANG=es, vite.config.ts)
  cantonese/                  → /aprende/cantonese/   (VITE_LANG=yue)
  portuguese/                 → /aprende/portuguese/  (VITE_LANG=pt)
  italian/                    → /aprende/italian/     (VITE_LANG=it)
  french/                     → /aprende/french/      (VITE_LANG=fr)
```

`npm run build:all` (`scripts/build-all.mjs`) empties `dist/`, builds the hub
(`emptyOutDir: false`, so it never wipes a course) and then each live course from
`courses.json` into `dist/<slug>/` (each course only empties its own folder).
`courses.json` is the source of truth for which courses exist, their slugs and
the hub's pitch and country; `content/<id>/pack.yaml` has the same `slug`.

## The hub (`hub/`)

A separate Vite entry: `hub/index.html`, `hub/src/main.tsx`, `hub/src/App.tsx`.
It uses the shared design system (`src/index.css`, through `hub/src/hub.css`) and
may import pure modules from `src` with the `@/` alias (`@/engine/mastery`,
`@/engine/types`). It must never import `@lang`, `@content` or
`src/engine/loader`: those bake one course into a build. The hub's Vite config
fails the build if anything does.

- `virtual:pawsport-courses` (generated in `vite.hub.config.ts`): every live course
  with its URL, database name, locale, pitch and journey regions (from
  `content/<id>/journey.yaml`).
- `hub/src/progress.ts` reads each course's IndexedDB **read-only** and never creates
  one: it checks `indexedDB.databases()` where available, otherwise opens the
  database with plain `indexedDB.open(name)` and aborts in `onupgradeneeded` (which
  only fires for a database that does not exist). It reads `cards`, `reviews`,
  `days`, `lessons` and the `startLevel` and `onboarded` keys of `kv`.
- `hub/src/summary.ts` computes the per-course summary (lessons done, words learned
  = word cards at stage 2+, days on the road = consecutive active days, minutes,
  km = the sum of each day's XP, last active day, level, the last 30 days) and the
  all-languages totals. `hub/src/analytics.ts` merges in `courseSummary(data)` from
  `src/engine/analytics/index.ts` when that exists, field by field, so a different
  shape can never break the hub.
- A course counts as started once the learner chose a start on its welcome screen
  (`kv.onboarded`) or has any lessons, cards or days.

Courses link back to the hub with `HUB_URL` from `src/courses.ts`.

## Learner data and storage names

Each course keeps its own IndexedDB and settings on the shared origin: Spanish
`aprende` and `aprende-settings` (its original names, so no learner lost progress
when it moved from `/aprende/` to `/aprende/spanish/`), the others
`aprende-<id>` and `aprende-<id>-settings` (`src/engine/course.ts`). Storage is per
origin, not per path, so moving a course between paths keeps its data. **Never
rename these**, not even when the repository is renamed (see below).

## Service workers

- The hub's worker is `/aprende/sw.js` with scope `/aprende/`. Its precache ignores
  every course folder (`globIgnores: <slug>/**`) and it never answers a navigation
  into one (`navigateFallbackDenylist: ^/aprende/<slug>(/|$)`).
- Each course has its own worker at `/aprende/<slug>/sw.js` with scope
  `/aprende/<slug>/`; the more specific scope wins inside a course folder.
- Until this change the Spanish course lived at the root and its worker was
  `/aprende/sw.js`. The hub's worker has the same URL, so browsers replace it on
  their next update check (any visit; `autoUpdate` skips waiting and claims the
  page), and `cleanupOutdatedCaches` drops the old Spanish precache. Until then the
  old worker may still serve the old Spanish app once from its cache; the next
  load gets the hub.

## Old Spanish links

Spanish routes are hashes (`HashRouter`), so the server only ever sees `/aprende/`.
An inline script at the top of `hub/index.html` (before any other resource) sends
any `/aprende/#/…` URL to `/aprende/spanish/#/…`, keeping the query and hash:
`/aprende/#/lesson/a1.u01.l1` → `/aprende/spanish/#/lesson/a1.u01.l1`,
`/aprende/#/review` → `/aprende/spanish/#/review`. The hub itself never uses `#/`
hashes.

## Local preview and tests

`npm run serve:dist` (`scripts/serve-dist.mjs`) serves `dist/` at
`http://localhost:4173/aprende/` exactly like Pages: plain files, `index.html` for
directories, no SPA fallback. Playwright starts it; the course under test
(`VITE_LANG`, default Spanish) is the `baseURL` (`/aprende/<slug>/`), so course specs
use base-relative URLs (`./#/review`) and `e2e/hub.spec.ts` uses absolute ones.

```bash
npm run build:all
npx playwright test e2e/hub.spec.ts                       # the hub
npx playwright test e2e/app.spec.ts                       # Spanish
node scripts/courses.mjs "npx playwright test e2e/sister.spec.ts"   # every course
```

## Renaming the repository

The repository and so the URL path are still `aprende`. To move to
`https://pchattani.github.io/pawsport/`:

1. Rename the repository on GitHub (Settings → General). GitHub redirects the git
   remote, but **not** Pages: the old `/aprende/` URLs will 404.
2. Replace the base path `/aprende/` everywhere it is written: `vite.config.ts`
   (`BASE`), `vite.hub.config.ts` (`BASE`), `src/courses.ts` (`HUB_URL` and the
   course `href`s), `scripts/serve-dist.mjs` (`BASE`), `playwright.config.ts`,
   `e2e/hub.spec.ts` and this documentation. `grep -rn "/aprende/"` finds them.
3. Keep the storage names (`aprende`, `aprende-<id>`, `aprende-settings`, …): the
   origin does not change, so learners keep their progress as long as the names stay.
4. Old links and installed apps point at `/aprende/…`. To keep them working, publish
   a small repository that is still called `aprende` with a `404.html` and an
   `index.html` that redirect `location.pathname`/`hash` from `/aprende/` to
   `/pawsport/` (Pages serves `404.html` for every missing path). The service workers
   registered under `/aprende/` keep serving their cached apps until they update and
   find the redirect, so give that stub its own tiny `sw.js` that unregisters itself.
5. Update the README links, `manifest` ids are derived from the base and change with it
   (installed apps will need to be re-installed once).
