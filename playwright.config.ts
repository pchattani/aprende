import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

// The cloud sandbox ships a Chromium build at a fixed path; CI installs its own via `playwright install`.
const localChromium = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium/chrome', '/opt/pw-browsers/chromium-linux/chrome'].find((p) => existsSync(p))
const launchOptions = process.env.CI || !localChromium ? {} : { executablePath: localChromium }

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/aprende/',
    trace: 'retain-on-failure',
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/aprende/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, launchOptions } }],
})
