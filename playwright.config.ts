import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { SITE_BASE } from './scripts/site-base.mjs'

// The cloud sandbox ships a Chromium build at a fixed path; CI installs its own via `playwright install`.
const localChromium = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium/chrome', '/opt/pw-browsers/chromium-linux/chrome'].find((p) => existsSync(p))
const launchOptions = process.env.CI || !localChromium ? {} : { executablePath: localChromium }

// The whole site is served from dist/ (npm run build:all) the way GitHub Pages serves it: the hub at /aprende/,
// each course at /aprende/<slug>/. The course under test (VITE_LANG, default Spanish) is the baseURL, so
// course specs use relative URLs ('./#/review'); hub specs use absolute ones ('/aprende/').
const LANG = process.env.VITE_LANG ?? 'es'
const slug = (JSON.parse(readFileSync('courses.json', 'utf8')) as { id: string; slug: string }[]).find((c) => c.id === LANG)?.slug ?? LANG
const BASE = `${SITE_BASE}${slug}/`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:4173${BASE}`,
    trace: 'retain-on-failure',
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'node scripts/serve-dist.mjs --port 4173',
    url: `http://localhost:4173${SITE_BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, launchOptions } }],
})
