import { test, expect, type Page } from '@playwright/test'
import { enableTestHook } from './helpers'
import { finishedWords } from './finished'

// Smoke tests for the arcade word games: Word rain, Sort it and Word of the day. The games
// publish their answers on window.__palabras (e2e only); e2e runs use calm motion, so the
// rain falls slowly. Language-agnostic: run with VITE_LANG=yue (etc.) against that build.

interface Hooks {
  rain?: { target: string; prompt: string; onScreen: string[] }
  sort?: { index: number; word: string; basket: string; baskets: string[]; mode: string }
  daily?: { answer: string; mode: 'daily' | 'practice'; other?: string }
}
type Win = { __palabras?: Hooks; __pawsportDemo?: (o?: { others?: boolean; started?: number }) => Promise<unknown> }

const LANG = process.env.VITE_LANG ?? 'es'
const SHOTS = process.env.GAMES_SHOTS
/** Light and dark screenshots when GAMES_SHOTS names a folder. */
const shot = async (page: Page, name: string, { dark = true } = {}) => {
  if (!SHOTS) return
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/${LANG}-${name}.png` })
  if (!dark) return
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${SHOTS}/${LANG}-${name}-dark.png` })
  await page.emulateMedia({ colorScheme: 'light' })
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function hooks(page: Page): Promise<Hooks> {
  return page.evaluate(() => (window as unknown as Win).__palabras ?? {})
}

/** A demo learner's words, then the game's page. */
async function openGame(page: Page, id: string, title: string) {
  await page.goto('./#/games')
  await expect(page.getByRole('heading', { name: 'Mini games' })).toBeVisible()
  await page.waitForFunction(() => Boolean((window as unknown as Win).__pawsportDemo), null, { timeout: 20_000 })
  await page.evaluate(() => (window as unknown as Win).__pawsportDemo!({ others: false, started: 1 }))
  await page.getByRole('button', { name: new RegExp(`^${esc(title)}`) }).click()
  await expect(page).toHaveURL(new RegExp(`#/games/${id}$`))
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
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

test('word rain: catch the answer, lose a paw on a wrong word, pause, stop', async ({ page }) => {
  await openGame(page, 'rain', 'Word rain')
  await page.getByRole('button', { name: 'Start' }).click()
  const field = page.getByRole('group', { name: 'Falling words' })
  /** Wait until the answer is falling, then tap it (pointerdown: the words never hold still). */
  const catchTarget = async () => {
    await page.waitForFunction(() => {
      const h = (window as unknown as Win).__palabras?.rain
      return Boolean(h && h.onScreen.includes(h.target))
    }, null, { timeout: 15_000 })
    const { target, prompt, onScreen } = (await hooks(page)).rain!
    seen.push(target, ...onScreen)
    prompts.push(prompt)
    await field.locator(`button[data-word="${target}"]`).first().dispatchEvent('pointerdown')
    return prompt
  }
  const seen: string[] = []
  const prompts: string[] = []
  // the status shows the word caught and its meaning (Cantonese words carry Jyutping readings, so check the English)
  const first = await catchTarget()
  await expect(page.getByRole('status')).toContainText(`= ${first}`)
  await expect(page.getByText(/^10 points · streak 1$/)).toBeVisible()
  await catchTarget()
  await expect(page.getByText(/^20 points · streak 2$/)).toBeVisible()
  if (SHOTS) await page.waitForFunction(() => ((window as unknown as Win).__palabras?.rain?.onScreen.length ?? 0) >= 3, null, { timeout: 20_000 })
  await shot(page, 'rain-play')

  // a word that is not the answer costs a paw and shows what it means
  await page.waitForFunction(() => {
    const h = (window as unknown as Win).__palabras?.rain
    return Boolean(h && h.onScreen.some((w) => w !== h.target))
  }, null, { timeout: 15_000 })
  const { target, onScreen } = (await hooks(page)).rain!
  seen.push(...onScreen)
  // answers and the words falling beside them are all finished words: none from the lesson left halfway
  const fin = await finishedWords(page)
  expect(fin.startedOnly.size).toBeGreaterThan(0)
  for (const w of seen) {
    expect([...fin.lemmas], w).toContain(w)
    expect([...fin.startedOnly], w).not.toContain(w)
  }
  for (const p of prompts) expect([...fin.glosses], p).toContain(p)
  const wrong = onScreen.find((w) => w !== target)!
  await field.locator(`button[data-word="${wrong}"]`).first().dispatchEvent('pointerdown')
  await expect(page.getByRole('img', { name: '2 of 3 paws left' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Not that one:')

  // pausing hides the words and stops the clock
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Paused')).toBeVisible()
  await shot(page, 'rain-paused', { dark: false })
  await page.getByRole('button', { name: 'Resume' }).first().click()
  await expect(page.getByText('Paused')).toHaveCount(0)

  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByText(/points · 2 of \d+ caught/)).toBeVisible()
  await shot(page, 'rain-over')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: /^Word rain.*Best: 20/ })).toBeVisible()
})

test('word rain: the answer landing costs a paw; three paws end the game', async ({ page }) => {
  await openGame(page, 'rain', 'Word rain')
  // speed the fall up: the game reads time from requestAnimationFrame
  await page.evaluate(() => {
    const raf = window.requestAnimationFrame.bind(window)
    let shift = 0
    window.requestAnimationFrame = (cb) => raf((t) => cb(t + (shift += 50)))
  })
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('img', { name: '2 of 3 paws left' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('status')).toContainText('Missed:')
  await expect(page.getByText(/points · 0 of \d+ caught/)).toBeVisible({ timeout: 60_000 })
})

test('sort it: drag, tap and miss a card, then finish the round', async ({ page }) => {
  await openGame(page, 'sort', 'Sort it')
  const baskets = page.getByRole('group', { name: 'Baskets' })
  const basket = (name: string) => baskets.getByRole('button', { name: new RegExp(`^${esc(name)}`) })
  let total = 15
  for (let i = 0; i < total; i++) {
    await page.waitForFunction((n) => (window as unknown as Win).__palabras?.sort?.index === n, i)
    const h = (await hooks(page)).sort!
    if (i === 0) {
      total = Number((await page.getByText(/^Card 1 of \d+/).textContent())!.match(/of (\d+)/)![1])
      await shot(page, 'sort-play')
      // a wrong basket: the right one lights up with the meaning, Next moves on
      await basket(h.baskets.find((b) => b !== h.basket)!).click()
      await expect(page.getByRole('status')).toContainText(`goes in ${h.basket}`)
      await shot(page, 'sort-wrong', { dark: false })
      await page.getByRole('status').getByRole('button').click()
      continue
    }
    if (i === 1) {
      // drag the card onto its basket
      const card = page.locator(`[data-word="${h.word}"]`)
      const from = (await card.boundingBox())!
      const to = (await basket(h.basket).boundingBox())!
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
      await page.mouse.down()
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
      await page.mouse.up()
      await expect(page.getByRole('status')).toContainText('Yes!')
      continue
    }
    await basket(h.basket).click()
    await expect(page.getByRole('status')).toContainText('Yes!')
  }
  await expect(page.getByText(new RegExp(`points · ${total - 1} of ${total} sorted in`))).toBeVisible()
  await expect(page.getByRole('region', { name: 'Words to look at again' })).toBeVisible()
  await shot(page, 'sort-done')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: /^Sort it.*1 played/ })).toBeVisible()
})

test('word of the day: list check, colours, win, come back to the result, practice', async ({ page }) => {
  await openGame(page, 'daily', 'Word of the day')
  await page.waitForFunction(() => Boolean((window as unknown as Win).__palabras?.daily))
  const { answer, other } = (await hooks(page)).daily!
  const n = [...answer].length
  const keyboard = page.getByRole('group', { name: 'Keyboard' })
  const tapWord = async (w: string) => {
    for (const ch of w) await keyboard.getByRole('button', { name: new RegExp(`^${esc(ch)}(,|$)`) }).click()
    await keyboard.getByRole('button', { name: 'Enter guess' }).click()
  }
  // the physical keyboard: a made-up word is gently refused, Backspace clears it
  await page.keyboard.type('q'.repeat(n))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('not in the word list')
  for (let i = 0; i < n; i++) await page.keyboard.press('Backspace')
  // a real word that is not the answer: coloured tiles and keys
  expect(other).toBeTruthy()
  await tapWord(other!)
  const row1 = page.getByRole('row').first()
  await expect(row1.getByRole('gridcell').first()).toHaveAttribute('aria-label', /, (right spot|in the word, wrong spot|not in the word)$/)
  await shot(page, 'daily-play')
  await tapWord(answer)
  await expect(page.getByText('Got it in 2!')).toBeVisible()
  await expect(page.getByText(/Next word in \d+:\d\d:\d\d/)).toBeVisible()
  await expect(page.getByLabel('Streak 1 days')).toBeVisible()
  await shot(page, 'daily-done')

  // coming back the same day shows the result, not a new puzzle
  await page.reload()
  await expect(page.getByText('Got it in 2!')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Keyboard' })).toHaveCount(0)

  // a practice word does not touch the streak
  await page.getByRole('button', { name: 'Practice word' }).click()
  await expect(page.getByText(/Practice word: no streak/)).toBeVisible()
  await page.waitForFunction(() => (window as unknown as Win).__palabras?.daily?.mode === 'practice')
  const practice = (await hooks(page)).daily!.answer
  await tapWord(practice)
  await expect(page.getByText('First try!')).toBeVisible()
  await expect(page.getByLabel('Streak 1 days')).toBeVisible()
  await page.getByRole('button', { name: 'Today’s word' }).click()
  await expect(page.getByText('Got it in 2!')).toBeVisible()
})
