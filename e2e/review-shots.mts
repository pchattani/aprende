// Screenshot set for the design review (not a test). node --experimental-strip-types e2e/review-shots.mts <outdir>
// Needs the built site served by scripts/serve-dist.mjs on :4173.
import { chromium, type Page } from 'playwright'
import { answerCurrent, readHook } from './helpers.ts'
import { SITE_BASE } from '../scripts/site-base.mjs'
const out = process.argv[2]!
const ROOT = `http://localhost:4173${SITE_BASE}`
const ES = ROOT + 'spanish/'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctxFor = (dark: boolean, width = 390) => browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: width < 600, hasTouch: width < 600, colorScheme: dark ? 'dark' : 'light' })
const shot = async (page: Page, name: string, wait = 1200, full = false) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}.jpg`, quality: 84, fullPage: full }) }
const scrollTo = async (page: Page, sel: string, offset = -70) => { await page.evaluate(([s, o]) => { const el = document.querySelector(s as string); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + (o as number)) }, [sel, offset]) }

// 1. A first-time learner: hub, welcome, first lesson, feedback, done.
{
  const ctx = await ctxFor(false)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  await page.addInitScript(() => sessionStorage.setItem('e2e', '1'))
  await page.goto(ROOT); await shot(page, '01-hub-new', 1500)
  await page.goto(ES); await shot(page, '02-welcome', 1500)
  await page.getByRole('button', { name: /new to/i }).click(); await page.waitForURL(/#\/$/); await shot(page, '03-journey-new', 2500)
  await page.goto(ES + '#/lesson/a1.u01.l1'); await shot(page, '04-guidebook', 1500)
  await page.getByRole('button', { name: 'Start the exercises' }).click()
  let wrongDone = false, rightShot = false, exShots = 0
  for (let i = 0; i < 30; i++) {
    const hook = await readHook(page)
    const k = hook.exercise.kind
    const choice = ['choiceEs', 'choiceEn', 'fillBlank', 'reply'].includes(k)
    if ((choice || k === 'wordBank' || k === 'listen') && exShots < 3) { exShots++; await shot(page, `05-exercise-${exShots}-${k}`, 700) }
    const wrong = choice && !wrongDone && i > 0
    await answerCurrent(page, !wrong)
    if (wrong) { wrongDone = true; await shot(page, '06-wrong', 700) }
    else if (choice && !rightShot && i > 1) { rightShot = true; await shot(page, '07-right', 700) }
    const last = hook.index + 1 >= hook.total
    await page.getByRole('status').getByRole('button', { name: /Continue|Finish/ }).click()
    if (last) break
  }
  await shot(page, '08-done', 2200)
  await ctx.close()
}

// 2. A learner 75 days in (demo data), light and dark.
for (const dark of [false, true]) {
  const t = dark ? 'dark' : 'light'
  const ctx = await ctxFor(dark)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  await page.goto(ES + '?demo#/'); await page.waitForFunction(() => (window as unknown as { __pawsportDemo?: unknown }).__pawsportDemo, null, { timeout: 20000 })
  await page.evaluate(() => (window as unknown as { __pawsportDemo: () => Promise<unknown> }).__pawsportDemo())
  await page.goto(ROOT); await shot(page, `10-hub-${t}`, 2000)
  await page.evaluate(() => window.scrollTo(0, 820)); await shot(page, `11-hub-board-${t}`, 500)
  await scrollTo(page, '#portfolio', -20); await shot(page, `12-hub-portfolio-${t}`, 500)
  await page.goto(ES + '#/'); await shot(page, `13-journey-${t}`, 3000)
  await scrollTo(page, '#region-a1', -70); await shot(page, `14-itinerary-${t}`, 1500)
  await page.evaluate(() => window.scrollBy(0, 760)); await shot(page, `15-itinerary2-${t}`, 1500)
  await page.goto(ES + '#/insights'); await shot(page, `16-insights-${t}`, 2500)
  for (const [id, n] of [['recall', '17'], ['slips', '18'], ['suggestions', '19'], ['nav', '20']]) {
    await page.evaluate((i) => { const h = [...document.querySelectorAll('h2')].find((x) => x.textContent?.toLowerCase().includes(i === 'slips' ? 'where you slip' : i === 'recall' ? 'recall' : i === 'nav' ? 'knowledge nav' : 'suggestions')); if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 60) }, id)
    await shot(page, `${n}-insights-${id}-${t}`, 700)
  }
  if (!dark) {
    await page.goto(ES + '#/review'); await shot(page, '21-review', 1500)
    await page.goto(ES + '#/passport'); await shot(page, '22-passport', 2000)
    await page.goto(ES + '#/profile'); await shot(page, '23-progress', 1500)
  }
  await ctx.close()
}

// 3. Desktop Insights and the art gallery.
{
  const ctx = await ctxFor(false, 1200)
  const page = await ctx.newPage()
  await page.goto(ES + '?demo#/'); await page.waitForFunction(() => (window as unknown as { __pawsportDemo?: unknown }).__pawsportDemo, null, { timeout: 20000 })
  await page.evaluate(() => (window as unknown as { __pawsportDemo: () => Promise<unknown> }).__pawsportDemo())
  await page.goto(ES + '#/insights'); await shot(page, '30-insights-desktop', 2500)
  await page.goto(ROOT); await shot(page, '31-hub-desktop', 2000)
  await page.goto(ES + '#/art'); await shot(page, '32-art', 3000)
  await ctx.close()
}
await browser.close()
