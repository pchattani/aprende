import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

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
  /** trace / writeChar / pictogram: the character. */
  char?: string
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
    case 'pictogram':
    case 'hearChar': {
      const idx = correct ? ex.answer! : (ex.answer! + 1) % ex.options!.length
      await page.getByRole('radio').nth(idx).click()
      await page.getByRole('button', { name: 'Check' }).click()
      break
    }
    case 'trace':
    case 'writeChar': {
      if (ex.kind === 'trace') await page.getByRole('button', { name: 'Now trace it' }).click()
      if (correct) await writeCharacter(page, ex.char!)
      else await page.getByRole('button', { name: /show me/ }).click()
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

/** Stroke medians of a character from the course's bundled stroke data (src/lang/<lang>/data/strokes.json). */
export function strokeMedians(char: string): number[][][] {
  const file = `src/lang/${process.env.VITE_LANG ?? 'es'}/data/strokes.json`
  const data = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, { medians: number[][][] }>) : {}
  const m = data[char]?.medians
  if (!m) throw new Error(`no stroke data for ${char} in ${file}`)
  return m
}

/**
 * Write a character on the writing pad by dragging the mouse along each stroke's median, in order.
 * hanzi-writer maps its 1024-unit box (y up, from -124 to 900) onto the pad inside `data-padding`.
 */
export async function writeCharacter(page: Page, char: string) {
  const host = page.locator('[data-writer="pad"]')
  await expect(host.locator('svg')).toBeVisible()
  const size = Number(await host.getAttribute('data-size'))
  const pad = Number(await host.getAttribute('data-padding'))
  const box = (await host.locator('svg').first().boundingBox())!
  const scale = (size - 2 * pad) / 1024
  const at = ([x, y]: number[]) => ({ x: box.x + pad + x! * scale, y: box.y + size - pad - (y! + 124) * scale })
  for (const median of strokeMedians(char)) {
    const pts = median.map(at)
    await page.mouse.move(pts[0]!.x, pts[0]!.y)
    await page.mouse.down()
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!
      const b = pts[i]!
      for (let k = 1; k <= 4; k++) await page.mouse.move(a.x + ((b.x - a.x) * k) / 4, a.y + ((b.y - a.y) * k) / 4)
    }
    await page.mouse.up()
    await page.waitForTimeout(120)
  }
}
