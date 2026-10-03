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
}
export interface Hook {
  exercise: HookExercise
  index: number
  total: number
  hearts: number
  finished: boolean
}

export async function enableTestHook(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('e2e', '1')
  })
}

export async function readHook(page: Page): Promise<Hook> {
  await page.waitForFunction(() => Boolean((window as unknown as { __aprende?: Hook }).__aprende))
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
    case 'fillBlank': {
      const idx = correct ? ex.answer! : (ex.answer! + 1) % ex.options!.length
      await page.getByRole('radio').nth(idx).click()
      await page.getByRole('button', { name: 'Check' }).click()
      break
    }
    case 'wordBank':
    case 'order': {
      const words = correct ? normalize(ex.answers![0]!).split(' ') : [...normalize(ex.answers![0]!).split(' ')].reverse()
      for (const w of words) {
        // tiles are buttons inside the pool; pick the first visible, enabled tile with this text
        const tile = main.locator('button.tile:not([disabled]):visible', { hasText: new RegExp(`^${escapeRe(w)}$`, 'i') }).first()
        await tile.click()
      }
      await page.getByRole('button', { name: 'Check' }).click()
      break
    }
    case 'match': {
      for (const p of ex.pairs!) {
        if (!correct) break
        await main.locator('button.tile:not([disabled])', { hasText: new RegExp(`^${escapeRe(p.left)}$`) }).first().click()
        await main.locator('button.tile:not([disabled])', { hasText: new RegExp(`^${escapeRe(p.right)}$`) }).first().click()
      }
      if (!correct) {
        // deliberately mismatch three times then finish properly
        const ps = ex.pairs!
        for (let i = 0; i < 3 && ps.length > 1; i++) {
          await main.locator('button.tile:not([disabled])', { hasText: new RegExp(`^${escapeRe(ps[0]!.left)}$`) }).first().click()
          await main.locator('button.tile:not([disabled])', { hasText: new RegExp(`^${escapeRe(ps[1]!.right)}$`) }).first().click()
          await page.waitForTimeout(600)
        }
        for (const p of ps) {
          await main.locator('button.tile:not([disabled])', { hasText: new RegExp(`^${escapeRe(p.left)}$`) }).first().click()
          await main.locator('button.tile:not([disabled])', { hasText: new RegExp(`^${escapeRe(p.right)}$`) }).first().click()
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

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Open the path. A fresh browser lands on the welcome screen; choose "new to Spanish" to reach A1. */
export async function openPath(page: Page) {
  await page.goto('/')
  // Every test runs in a fresh browser context, so the first launch always redirects to the welcome screen.
  await page.getByRole('button', { name: /I'm new to Spanish/ }).click()
  await expect(page.getByRole('heading', { name: 'A1' })).toBeVisible()
}
