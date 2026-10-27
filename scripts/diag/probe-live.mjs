// Diagnostic: the live site in WebKit (iPhone) and Chromium – a fresh visitor and a heavy learner, every course.
import { chromium, webkit, devices } from 'playwright'
const BASE = process.env.BASE ?? 'https://pchattani.github.io/aprende/'
const courses = ['spanish', 'cantonese', 'portuguese', 'italian', 'french']
const routes = ['', '#/review', '#/games', '#/writing', '#/insights', '#/reader', '#/study']
for (const [name, type, device] of [['webkit-iphone', webkit, devices['iPhone 13']], ['chromium', chromium, { viewport: { width: 390, height: 844 } }]]) {
  const browser = await type.launch()
  for (const c of courses) {
    for (const heavy of [false, true]) {
      const ctx = await browser.newContext({ ...device })
      const p = await ctx.newPage()
      const errs = []
      p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
      p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 200)}`) })
      p.on('crash', () => errs.push('PAGE CRASHED'))
      const lines = []
      try {
        await p.goto(BASE + c + '/?demo', { timeout: 60000 })
        await p.waitForTimeout(3000)
        const btn = p.getByRole('button', { name: /I'm new to/ })
        if (await btn.count()) { await btn.click(); await p.waitForTimeout(2500) }
        if (heavy) {
          await p.waitForFunction(() => Boolean(window.__pawsportDemo), null, { timeout: 30000 })
          const s = await p.evaluate(() => window.__pawsportDemo({ days: 365, others: false }))
          lines.push(`seeded ${s.cards} cards, ${s.reviews} reviews, ${s.lessons} lessons`)
        }
        for (const r of routes) {
          const t = Date.now()
          await p.goto(BASE + c + '/?demo' + r, { timeout: 60000 })
          const ok = await p.waitForFunction(() => document.body.innerText.length > 200 && !/Loading/.test(document.body.innerText.slice(0, 300)), null, { timeout: 60000 }).then(() => true, () => false)
          const text = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
          lines.push(`${(r || '#/').padEnd(11)} ${ok ? '' : 'NOT READY '}${Date.now() - t}ms ${/went wrong|taking a while/i.test(text) ? '<<ERROR SCREEN>> ' : ''}${text.slice(0, 70)}`)
        }
        // open the current lesson
        await p.goto(BASE + c + '/?demo#/'); await p.waitForTimeout(3000)
        const board = p.getByRole('link', { name: /practice/ }).first()
        if (await board.count()) {
          await board.click(); await p.waitForTimeout(3000)
          const start = p.getByRole('button', { name: 'Start the exercises' })
          if (await start.count()) { await start.click(); await p.waitForTimeout(3000) }
          lines.push('lesson: ' + (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 70))
        }
      } catch (e) { errs.push('step failed: ' + e.message.split('\n')[0]) }
      console.log(`\n### ${name} ${c} ${heavy ? 'HEAVY' : 'fresh'}\n  ${lines.join('\n  ')}\n  ERRORS: ${errs.length ? '\n    ' + [...new Set(errs)].slice(0, 8).join('\n    ') : 'none'}`)
      await ctx.close()
    }
  }
  await browser.close()
}
