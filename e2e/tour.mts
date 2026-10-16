// Screenshot tour of the main screens (not a test). usage: node --experimental-strip-types e2e/tour.mts <outdir> [base]
import { chromium } from 'playwright'
import { answerCurrent, readHook } from './helpers.ts'
import { SITE_BASE } from '../scripts/site-base.mjs'
const out = process.argv[2]!
const base = process.argv[3] ?? `http://localhost:5173${SITE_BASE}spanish/`
const dark = process.env.DARK === '1'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: dark ? 'dark' : 'light' })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.addInitScript(() => sessionStorage.setItem('e2e', '1'))
const shot = async (name: string, wait = 900) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}.jpg`, quality: 82 }) }
await page.goto(base + '#/welcome'); await shot('01-welcome')
await page.getByRole('button', { name: /new to/i }).click()
await page.waitForURL(/#\/$/); await shot('02-home', 1500)
await page.mouse.wheel(0, 1250); await shot('03-path')
await page.goto(base + '#/lesson/a1.u01.l1'); await shot('04-teach', 1500)
await page.getByRole('button', { name: 'Start the exercises' }).click()
const seen = new Set<string>()
let wrongDone = false
for (let i = 0; i < 30; i++) {
  const hook = await readHook(page)
  if (hook.finished) break
  const k = hook.exercise.kind
  if (!seen.has(k)) { seen.add(k); await shot(`05-ex-${String(i).padStart(2, '0')}-${k}`, 500) }
  const choice = ['choiceEs', 'choiceEn', 'listen', 'fillBlank', 'reply'].includes(k)
  if (choice && !wrongDone) {
    await page.getByRole('radio').nth(hook.exercise.answer!).click(); await shot('06-selected', 300)
  }
  const wrong = choice && !wrongDone && seen.size > 1
  await answerCurrent(page, !wrong)
  if (wrong) wrongDone = true
  await shot(`07-fb-${String(i).padStart(2, '0')}-${wrong ? 'wrong' : 'right'}`, 450)
  const last = hook.index + 1 >= hook.total
  await page.getByRole('status').getByRole('button', { name: /Continue|Finish/ }).click()
  if (last) break
}
await shot('08-done', 1600)
await page.getByRole('button', { name: 'Continue' }).click(); await shot('09-home-after', 1500)
await page.evaluate(() => window.scrollTo(0, 0)); await shot('10-home-top', 600)
for (const [n, path] of [['11-review', 'review'], ['12-profile', 'profile'], ['13-tools', 'study'], ['14-passport', 'passport'], ['15-reader', 'reader']] as const) { await page.goto(base + '#/' + path); await shot(n, 1200) }
await browser.close()
