import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

// The cloud sandbox ships a Chromium build at a fixed path; CI installs its own via `playwright install`.
const localChromium = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium/chrome', '/opt/pw-browsers/chromium-linux/chrome'].find((p) => existsSync(p))
const launchOptions = process.env.CI || !localChromium ? {} : { executablePath: localChromium }

// The course under test (VITE_LANG) decides the base path: /aprende/ or /aprende/<slug>/.
const LANG = process.env.VITE_LANG ?? 'es'
const slug = LANG === 'es' ? '' : (JSON.parse(readFileSync('courses.json', 'utf8')) as { id: string; slug: string }[]).find((c) => c.id === LANG)?.slug ?? LANG
const BASE = slug ? `/aprende/${slug}/` : '/aprende/'

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
    command: 'npm run preview -- --port 4173 --strictPort',
    url: `http://localhost:4173${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, launchOptions } }],
})
