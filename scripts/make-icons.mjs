// Renders public/icons/*.png from an inline SVG using the bundled Chromium (no image library needed).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
mkdirSync('public/icons', { recursive: true })
const svg = (size) => `<svg id="s" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9a431"/><stop offset="1" stop-color="#cf5f3d"/></linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="#faf3e7"/>
  <path d="M14 40a18 18 0 0 1 36 0z" fill="url(#g)"/>
  <path d="M12 44h40" stroke="#2b2117" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M32 12v6M18 18l4 4M46 18l-4 4" stroke="#d9a431" stroke-width="3.5" stroke-linecap="round"/></svg>`
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
