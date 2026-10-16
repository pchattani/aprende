import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface HookExercise {
  kind: string
  options?: string[]
  answer?: number
  answers?: string[]
  tiles?: string[]
  pairs?: { left: string; right: string }[]
  items: string[]
  audio?: string
  review?: { es: string; en: string }
}
export interface Hook {
  exercise: HookExercise
  index: number
  total: number
  finished: boolean
  /** Tiles of the first accepted answer in order (word bank / order exercises). */
  solution?: string[]
}

export async function enableTestHook(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('e2e', '1')
  })
}

export async function readHook(page: Page): Promise<Hook> {
  // Wait for a live exercise: a finished session leaves its hook behind (with no exercise) until the next runner starts.
  await page.waitForFunction(() => Boolean((window as unknown as { __aprende?: Hook }).__aprende?.exercise))
  return page.evaluate(() => (window as unknown as { __aprende: Hook }).__aprende)
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,;:!?¿¡"“”«»'’()[\]{}…\-–—/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Answer the current exercise correctly (or wrongly) and press Check when needed. */
export async function answerCurrent(page: Page, correct = true) {
  const hook = await readHook(page)
  const ex = hook.exercise
  const main = page.locator('main, body')
  switch (ex.kind) {
    case 'choiceEs':
    case 'choiceEn':
    case 'listen':
    case 'fillBlank':
    case 'reply': {
      const idx = correct ? ex.answer! : (ex.answer! + 1) % ex.options!.length
      await page.getByRole('radio').nth(idx).click()
      await page.getByRole('button', { name: 'Check' }).click()
      break
    }
    case 'wordBank':
    case 'order': {
      // `solution` is the app's own tile split (works for languages without spaces too)
      const sol = hook.solution ?? normalize(ex.answers![0]!).split(' ')
      const words = correct ? sol : [...sol].reverse()
      for (const w of words) {
        // tiles are buttons inside the pool; pick the first visible, enabled tile with this word
        const byData = main.locator(`button.tile[data-tile="${cssEscape(w)}"]:not([disabled]):visible`).first()
        const tile = (await byData.count()) ? byData : main.locator('button.tile:not([disabled]):visible', { hasText: new RegExp(`^${escapeRe(w)}$`, 'i') }).first()
        await tile.click()
      }
      await page.getByRole('button', { name: 'Check' }).click()
      break
    }
    case 'orderText': {
      const target = ex.answers![0]!
      const tiles = [...ex.tiles!].sort((a, b) => target.indexOf(a) - target.indexOf(b))
      const order = correct ? tiles : [...tiles].reverse()
      for (const t of order) {
        await main.locator(`button.tile[data-tile="${cssEscape(t)}"]:not([disabled]):visible`).first().click()
      }
      await page.getByRole('button', { name: 'Check' }).click()
      break
    }
    case 'match': {
      const tileFor = (text: string) => main.locator(`button.tile[data-tile="${cssEscape(text)}"]:not([disabled])`).first()
      for (const p of ex.pairs!) {
        if (!correct) break
        await tileFor(p.left).click()
        await tileFor(p.right).click()
      }
      if (!correct) {
        // deliberately mismatch three times then finish properly
        const ps = ex.pairs!
        for (let i = 0; i < 3 && ps.length > 1; i++) {
          await tileFor(ps[0]!.left).click()
          await tileFor(ps[1]!.right).click()
          await page.waitForTimeout(600)
        }
        for (const p of ps) {
          await tileFor(p.left).click()
          await tileFor(p.right).click()
        }
      }
      break
    }
    case 'speak': {
      const said = page.getByRole('button', { name: 'I said it' })
      await said.click()
      break
    }
    default: {
      await page.getByLabel('Your answer').fill(correct ? ex.answers![0]! : 'xyz incorrecto')
      await page.getByRole('button', { name: 'Check' }).click()
    }
  }
  await expect(page.getByRole('status')).toBeVisible()
}

export async function continueFeedback(page: Page) {
  const btn = page.getByRole('status').getByRole('button', { name: /Continue|Finish/ })
  await btn.click()
}

function cssEscape(s: string) {
  return s.replace(/["\\]/g, '\\$&')
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Open the course page (base-relative: /aprende/spanish/). A fresh browser lands on the welcome screen; choose "new to Spanish" to reach A1. */
export async function openPath(page: Page) {
  await page.goto('./')
  // Every test runs in a fresh browser context, so the first launch always redirects to the welcome screen.
  await page.getByRole('button', { name: /I'm new to Spanish/ }).click()
  await expect(page.getByRole('heading', { name: 'Buenos Aires' })).toBeVisible()
}
