import { chromium } from '@playwright/test'
const out = process.argv[2]
const ES = 'http://localhost:4173/pawsport/spanish/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1 })
let n = 0
const snap = async (k = 1, gap = 90) => { for (let i = 0; i < k; i++) { await p.screenshot({ path: `${out}/t${String(n++).padStart(4, '0')}.png` }); await p.waitForTimeout(gap) } }
await p.goto(ES); await p.getByRole('button', { name: /I'm new to Spanish/ }).click()
await p.getByRole('heading', { name: 'Buenos Aires' }).waitFor()
await p.waitForTimeout(1500); await snap(14)
await p.mouse.wheel(0, 500); await p.waitForTimeout(700); await snap(12)
await p.getByRole('link', { name: /Hola y adiós/ }).first().click()
await p.getByRole('button', { name: 'Start the exercises' }).click()
await p.waitForTimeout(150); await snap(14, 70)
for (let q = 0; q < 4; q++) {
  const ex = await p.evaluate(() => window.__aprende?.exercise)
  if (!ex) break
  await p.evaluate(() => window.__aprende.answerCorrect?.())
  await snap(3, 80)
  const check = p.getByRole('button', { name: /^Check$/ })
  if (await check.count() && await check.isEnabled()) await check.click()
  await snap(14, 80)
  const cont = p.getByRole('button', { name: /Continue|Finish/ })
  if (await cont.count()) await cont.first().click()
  await snap(4, 80)
}
await b.close()
console.log(n)
