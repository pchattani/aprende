// Renders public/icons/*.png from an inline SVG using the bundled Chromium (no image library needed).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
mkdirSync('public/icons', { recursive: true })
const svg = (size) => `<svg id="s" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#c2410c"/>
  <text x="32" y="46" font-family="Georgia, 'DejaVu Serif', serif" font-size="40" font-weight="700" text-anchor="middle" fill="#fff7ed">ñ</text></svg>`
const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const size of [512, 192]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0;background:transparent">${svg(size)}</body>`)
  await page.locator('#s').screenshot({ path: `public/icons/icon-${size}.png`, omitBackground: true })
}
await browser.close()
console.log('icons ok')
