// Diagnostic: open the live site in WebKit (iPhone) and Chromium, every course, and report errors.
import { chromium, webkit, devices } from 'playwright'
const BASE = process.env.BASE ?? 'https://pchattani.github.io/aprende/'
const courses = ['', 'spanish', 'cantonese', 'portuguese', 'italian', 'french']
for (const [name, type, device] of [['webkit-iphone', webkit, devices['iPhone 13']], ['chromium', chromium, { viewport: { width: 390, height: 844 } }]]) {
  const browser = await type.launch()
  for (const c of courses) {
    const ctx = await browser.newContext({ ...device })
    const p = await ctx.newPage()
    const errs = []
    p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
    p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 300)}`) })
    p.on('crash', () => errs.push('PAGE CRASHED'))
    p.on('response', (r) => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`) })
    const steps = []
    try {
      await p.goto(BASE + (c ? c + '/' : ''), { timeout: 60000 })
      await p.waitForTimeout(4000)
      steps.push('loaded: ' + (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 80))
      if (c) {
        const btn = p.getByRole('button', { name: /I'm new to/ })
        if (await btn.count()) { await btn.click(); await p.waitForTimeout(5000) }
        steps.push('journey: ' + (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 80))
        for (const r of ['#/review', '#/games', '#/reader', '#/insights']) {
          await p.goto(BASE + c + '/' + r); await p.waitForTimeout(3000)
          steps.push(`${r}: ` + (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 60))
        }
        await p.goto(BASE + c + '/#/'); await p.waitForTimeout(3000)
        const practice = p.getByRole('link', { name: /practice/ }).first()
        if (await practice.count()) {
          await practice.click(); await p.waitForTimeout(4000)
          const start = p.getByRole('button', { name: 'Start the exercises' })
          if (await start.count()) { await start.click(); await p.waitForTimeout(4000) }
          steps.push('lesson: ' + (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 80))
        }
      }
    } catch (e) { errs.push('step failed: ' + e.message.split('\n')[0]) }
    console.log(`\n### ${name} ${c || 'hub'}\n  ${steps.join('\n  ')}\n  ERRORS: ${errs.length ? '\n    ' + [...new Set(errs)].join('\n    ') : 'none'}`)
    await ctx.close()
  }
  await browser.close()
}
