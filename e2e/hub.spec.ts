/**
 * The Pawsport hub at the site root (SITE_BASE, e.g. /pawsport/): lists every language, shows the ones you started, forwards old Spanish
 * links, never creates empty course databases and never caches the course folders.
 * Runs against the whole site (npm run build:all, served by scripts/serve-dist.mjs); URLs are absolute.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { SITE_BASE } from '../scripts/site-base.mjs'

const courses = (JSON.parse(readFileSync('courses.json', 'utf8')) as { id: string; name: string; slug: string; live: boolean }[]).filter((c) => c.live)
const spanishRegion = (load(readFileSync('content/es/journey.yaml', 'utf8')) as { regions: { name: string }[] }).regions[0]!.name
const HUB = SITE_BASE
const at = (path: string) => new RegExp(`${HUB.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}${path}`)

test('the hub lists every language and creates no databases', async ({ page }) => {
  await page.goto(HUB)
  await expect(page).toHaveTitle(/Pawsport/)
  await expect(page.getByRole('heading', { name: 'New routes' }).or(page.getByRole('heading', { name: 'Choose your first route' }))).toBeVisible()
  for (const c of courses) {
    await expect(page.getByRole('heading', { name: c.name, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: `Start ${c.name}` })).toHaveAttribute('href', `${HUB}${c.slug}/`)
  }
  await page.screenshot({ path: 'e2e/__screenshots__/hub.png', fullPage: true })
  // Reading progress must never leave an empty database behind for a course that was never opened.
  const names = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))
  expect(names.filter((n) => n?.startsWith('aprende'))).toEqual([])
})

test('after starting Spanish, the hub shows it under Your languages', async ({ page }) => {
  await page.goto(HUB)
  await page.getByRole('link', { name: 'Start Spanish' }).click()
  await expect(page).toHaveURL(at('spanish/'))
  await page.getByRole('button', { name: /I'm new to Spanish/ }).click()
  await expect(page.getByRole('heading', { name: spanishRegion, exact: true })).toBeVisible()

  await page.goto(HUB)
  const yours = page.locator('section', { has: page.getByRole('heading', { name: 'Your languages' }) })
  const spanish = yours.getByRole('article', { name: 'Spanish' })
  await expect(spanish).toBeVisible()
  await expect(spanish).toContainText('Level A1')
  await expect(spanish.getByRole('link', { name: 'Continue Spanish' })).toHaveAttribute('href', `${HUB}spanish/`)
  await expect(page.getByRole('link', { name: 'Start Spanish' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'All languages' })).toBeVisible()
  // The others are still waiting to be started.
  await expect(page.getByRole('link', { name: 'Start French' })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/hub-started.png', fullPage: true })
})

test('the hub summarises a course from its database', async ({ page }) => {
  await page.goto(`${HUB}spanish/`)
  await page.getByRole('button', { name: /I'm new to Spanish/ }).click()
  await expect(page.getByRole('heading', { name: spanishRegion, exact: true })).toBeVisible()
  // Seed progress as the course stores it: a finished lesson, a learned word and today's distance and minutes.
  await page.evaluate(async () => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('aprende')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const tx = db.transaction(['lessons', 'cards', 'days'], 'readwrite')
    tx.objectStore('lessons').put({ id: 'a2.u01.l1', unitId: 'a2.u01', level: 'a2', attempts: 1, completions: 1, bestAccuracy: 1, lastAccuracy: 1, xp: 0, firstCompleted: Date.now(), lastCompleted: Date.now() })
    tx.objectStore('cards').put({ id: 'w.e2e', kind: 'word', level: 'a1', lessonId: 'a1.u01.l1', grammar: [], stage: 2, streak: 0, due: Date.now(), stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 2, lapses: 0, state: 2 })
    tx.objectStore('days').put({ date: today, xp: 42, reviews: 3, lessons: 1, newItems: 1, minutes: 7 })
    await new Promise((resolve) => (tx.oncomplete = resolve))
    db.close()
  })
  await page.goto(HUB)
  const spanish = page.getByRole('article', { name: 'Spanish' })
  await expect(spanish).toContainText('Level A2')
  await expect(spanish.getByRole('definition').nth(0)).toHaveText('1') // lessons done
  await expect(spanish.getByRole('definition').nth(1)).toHaveText('1') // words learned
  await expect(spanish.getByRole('definition').nth(2)).toHaveText('1') // days on the road
  await expect(spanish).toContainText('Last studied today')
  const all = page.locator('section', { has: page.getByRole('heading', { name: 'All languages' }) })
  await expect(all).toContainText(/42\s*Kilometres/)
  await expect(all).toContainText(/(?<!\d)7\s*Minutes/)
})

test('old Spanish links land in the Spanish course with the route kept', async ({ page }) => {
  await page.goto(`${HUB}#/review`)
  await expect(page).toHaveURL(at('spanish/#/review$'))
  await page.goto(`${HUB}#/lesson/a1.u01.l1`)
  await expect(page).toHaveURL(at('spanish/#/lesson/a1\\.u01\\.l1$'))
})

test("the hub's service worker never caches a course folder", async ({ page }) => {
  await page.goto(HUB)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.waitForFunction(async () => (await caches.keys()).length > 0, undefined, { timeout: 30_000 })
  const urls = await page.evaluate(async () => {
    const out: string[] = []
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname)
    return out
  })
  expect(urls.length).toBeGreaterThan(0)
  for (const c of courses) expect(urls.filter((u) => u.startsWith(`${HUB}${c.slug}/`))).toEqual([])
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)
  expect(new URL(scope!).pathname).toBe(HUB)
})
