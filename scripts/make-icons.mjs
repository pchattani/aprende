// Renders public/icons/*.png from an inline SVG using the bundled Chromium (no image library needed).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
mkdirSync('public/icons', { recursive: true })
const svg = (size) => `<svg id="s" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset=".6" stop-color="#ff5fa2"/><stop offset="1" stop-color="#ff9f43"/></linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <path d="M20 36a12 12 0 0 1 24 0z" fill="#fff" fill-opacity=".95"/>
  <path d="M18 39h28" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M32 16v5M21 21l3.5 3.5M43 21l-3.5 3.5" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-opacity=".9"/></svg>`
import { existsSync } from 'node:fs'
const exe = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium/chrome'].find((p) => existsSync(p))
const browser = await chromium.launch(exe && !process.env.CI ? { executablePath: exe } : {})
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const size of [512, 192]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0;background:transparent">${svg(size)}</body>`)
  await page.locator('#s').screenshot({ path: `public/icons/icon-${size}.png`, omitBackground: true })
}
await browser.close()
console.log('icons ok')
