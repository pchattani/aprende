import { test, expect, type Page } from '@playwright/test'
import { enableTestHook } from './helpers'

// The word-spelling mini games: Word search, Fetch! and Scramble. Speech is stubbed to a silent
// no-op; the games publish their answers on window.__palabras (e2e only). Course-agnostic, so the
// same spec runs on the Cantonese build (Jyutping grids and keys, character tiles).

type Cell = [number, number]
interface Hooks {
  wordsearch?: { size: number; placements: { id: string; word: string; cells: Cell[] }[] }
  fetch?: { index: number; answer: string; keys: string[] }
  scramble?: { index: number; tiles: string[]; pool: string[]; decoys: string[] }
}
type Win = { __palabras?: Hooks; __pawsportDemo?: (o?: { others?: boolean }) => Promise<unknown> }

const SHOTS = process.env.GAMES_SHOTS
const LANG = process.env.VITE_LANG ?? 'es'
/** Screenshots (light, then dark) only when GAMES_SHOTS names a folder. */
async function shot(page: Page, name: string, dark = true) {
  if (!SHOTS) return
  const file = (n: string) => `${SHOTS}/${n}${LANG === 'es' ? '' : `-${LANG}`}.png`
  await page.waitForTimeout(450)
  await page.screenshot({ path: file(name), fullPage: true })
  if (!dark) return
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(150)
  await page.screenshot({ path: file(`${name}-dark`), fullPage: true })
  await page.emulateMedia({ colorScheme: 'light' })
}

const hooks = (page: Page) => page.evaluate(() => (window as unknown as Win).__palabras ?? {})

async function openGame(page: Page, title: RegExp) {
  await page.goto('./#/games')
  await expect(page.getByRole('heading', { name: 'Mini games' })).toBeVisible()
  await page.waitForFunction(() => Boolean((window as unknown as Win).__pawsportDemo), null, { timeout: 20_000 })
  await page.evaluate(() => (window as unknown as Win).__pawsportDemo!({ others: false }))
  await page.getByRole('button', { name: title }).click()
}

test.beforeEach(async ({ page }) => {
  await enableTestHook(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.speak = (u: SpeechSynthesisUtterance) => {
      setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 0)
    }
    synth.cancel = () => {}
  })
})

test('word search: swipe, tap-tap and keyboard selections find the words', async ({ page }) => {
  await openGame(page, /^Word search/)
  await expect(page.getByRole('heading', { name: 'Word search' })).toBeVisible()
  await page.waitForFunction(() => Boolean((window as unknown as Win).__palabras?.wordsearch))
  const { placements } = (await hooks(page)).wordsearch!
  const n = placements.length
  expect(n).toBeGreaterThanOrEqual(4)
  expect(n).toBeLessThanOrEqual(8)
  await expect(page.getByText(`0 / ${n} words`)).toBeVisible()
  const cell = (c: Cell) => page.locator(`[data-cell="${c[0]},${c[1]}"]`)
  const centre = async (c: Cell) => {
    const b = (await cell(c).boundingBox())!
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }
  const swipe = async (cells: Cell[]) => {
    const a = await centre(cells[0]!)
    const b = await centre(cells[cells.length - 1]!)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 })
    await page.mouse.move(b.x, b.y, { steps: 4 })
    await page.mouse.up()
  }

  // 1. a swipe (drawn from the last letter back to the first counts too)
  await swipe([...placements[0]!.cells].reverse())
  await expect(page.getByText(`1 / ${n} words`)).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Found')
  // a wrong line is not a word
  const wrong = placements[1]!.cells.slice(0, -1)
  if (wrong.length >= 2) {
    await swipe(wrong)
    await expect(page.getByRole('status')).toContainText('is not one of the words')
  }
  // 2. tap the first and the last letter
  await cell(placements[1]!.cells[0]!).click()
  await expect(page.getByRole('status')).toContainText('now tap the last letter')
  await cell(placements[1]!.cells.at(-1)!).click()
  await expect(page.getByText(`2 / ${n} words`)).toBeVisible()
  // 3. keyboard: Enter on each end
  await cell(placements[2]!.cells[0]!).focus()
  await page.keyboard.press('Enter')
  await cell(placements[2]!.cells.at(-1)!).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(`3 / ${n} words`)).toBeVisible()
  // found clues are struck through and show the word
  await expect(page.locator(`[data-clue="${placements[0]!.id}"] .line-through`)).toBeVisible()
  await shot(page, 'wordsearch-play')

  for (const p of placements.slice(3)) await swipe(p.cells)
  await expect(page.getByText(`${n} / ${n} words`)).toBeVisible()
  await expect(page.getByText(new RegExp(`${n} words in`))).toBeVisible()
  await shot(page, 'wordsearch-done')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: /Word search/ })).toContainText('1 played')
  await expect(page.getByRole('button', { name: /Word search/ })).toContainText('Best:')
})

test('fetch: guess letters, win and lose a ball, finish the round', async ({ page }) => {
  await openGame(page, /Fetch!/)
  await expect(page.getByRole('heading', { name: 'Fetch!' })).toBeVisible()
  const letters = page.getByRole('group', { name: 'Letters' })
  const key = (k: string) => letters.getByRole('button', { name: k.toUpperCase(), exact: true })
  const all = 'abcdefghijklmnopqrstuvwxyz'
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction((n) => (window as unknown as Win).__palabras?.fetch?.index === n, i)
    const { keys } = (await hooks(page)).fetch!
    const misses = [...all].filter((k) => !keys.includes(k))
    if (i === 0) {
      // one miss, then the word with the on-screen keys
      await key(misses[0]!).click()
      await expect(page.getByRole('status')).toContainText('the ball rolls on')
      await expect(page.getByText('🎾 5')).toBeVisible()
      await key(keys[0]!).click()
      await shot(page, 'fetch-play')
      for (const k of keys.slice(1)) await key(k).click()
      await expect(page.getByRole('status')).toContainText('Leo fetched it!')
      await shot(page, 'fetch-won', false)
    } else if (i === 1) {
      // six misses: the ball is gone and the word is shown
      for (const k of misses.slice(0, 6)) await key(k).click()
      await expect(page.getByRole('status')).toContainText('The ball got away')
      await expect(page.getByRole('button', { name: 'Hear the word' })).toBeVisible()
      await shot(page, 'fetch-lost')
    } else {
      // the physical keyboard works too
      for (const k of keys) await page.keyboard.press(k === 'ñ' ? 'ñ' : k)
      await expect(page.getByRole('status')).toContainText('Leo fetched it!')
    }
    await page.getByRole('button', { name: i < 4 ? 'Next' : 'Finish' }).click()
  }
  await expect(page.getByText('4 of 5 fetched')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Words this round' }).getByRole('listitem')).toHaveCount(5)
  await shot(page, 'fetch-done')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: /Fetch!/ })).toContainText('Best:')
})

test('scramble: tap tiles into place, a wrong order, a hint, a skip', async ({ page }) => {
  await openGame(page, /Scramble/)
  await expect(page.getByRole('heading', { name: 'Scramble' })).toBeVisible()
  const tiles = page.getByRole('group', { name: 'Tiles' })
  const tap = (t: string) => tiles.locator(`button[data-tile="${t}"]:not([disabled]):visible`).first().click()
  const at = (n: number) => page.waitForFunction((k) => (window as unknown as Win).__palabras?.scramble?.index === k, n)

  // 1. right first time
  await at(0)
  let h = (await hooks(page)).scramble!
  expect(h.pool.filter((t) => !h.decoys.includes(t)).join('')).not.toBe(h.tiles.join(''))
  // Cantonese: two- and three-character words get decoys from the learner's other words, never one of the answer's
  if (LANG === 'yue' && h.tiles.length <= 3) expect(h.decoys.length).toBeGreaterThan(0)
  for (const d of h.decoys) expect(h.tiles).not.toContain(d)
  expect(h.pool).toHaveLength(h.tiles.length + h.decoys.length)
  await shot(page, 'scramble-start', false)
  const half = Math.ceil(h.tiles.length / 2)
  for (const t of h.tiles.slice(0, half)) await tap(t)
  await shot(page, 'scramble-play')
  for (const t of h.tiles.slice(half)) await tap(t)
  // unused decoys stay in the tray
  for (const d of h.decoys) await expect(tiles.locator(`button[data-tile="${d}"]:visible`)).toHaveCount(1)
  await expect(page.getByRole('status')).toContainText('+')
  // 2. the pool's own order is never the answer: wrong, then a hint and the rest
  await at(1)
  h = (await hooks(page)).scramble!
  for (const t of h.pool.slice(0, h.tiles.length)) await tap(t)
  await expect(page.getByRole('status')).toContainText('Not quite')
  await expect(page.getByRole('group', { name: 'Your answer' }).getByRole('button', { name: /empty/ }).first()).toBeVisible()
  await page.getByRole('button', { name: /Hint/ }).click()
  await expect(page.getByRole('button', { name: /from a hint/ })).toBeVisible()
  for (const t of h.tiles.slice(1)) await tap(t)
  await expect(page.getByRole('status')).toContainText('+')
  // 3. skip shows the answer
  await at(2)
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('status')).toContainText('It was')
  // 4. one more, then stop
  await at(3)
  h = (await hooks(page)).scramble!
  for (const t of h.tiles) await tap(t)
  await expect(page.getByRole('status')).toContainText('+')
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByText(/3 words unscrambled/)).toBeVisible()
  await shot(page, 'scramble-done')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: /Scramble/ })).toContainText('Best:')
})
