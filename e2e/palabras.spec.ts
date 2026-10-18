import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { enableTestHook } from './helpers'

// Smoke tests for the Palabras word games. Speech is stubbed to a silent no-op: the games
// publish what they would say on window.__palabras (e2e only), so nothing depends on audio.

interface Hooks {
  crossword?: { number: number; dir: 'across' | 'down'; row: number; col: number; answer: string }[]
  listen?: { lemma: string; jp?: string; answer: number; index: number }
  sound?: { speakers: string[]; words: string[] }
}
type Win = { __palabras?: Hooks; __pawsportDemo?: (o?: { others?: boolean }) => Promise<unknown> }

const SHOTS = process.env.PALABRAS_SHOTS
/** Screenshots only when PALABRAS_SHOTS names a folder (after the entry animation settles). */
const shot = async (page: Page, name: string, info: TestInfo = test.info()) => {
  if (!SHOTS) return
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}/${name}${info.project.name === 'chromium' ? '' : `-${info.project.name}`}.png` })
}

/** Accents are optional in the games: type the bare letters (ñ stays ñ). */
const bare = (s: string) => s.normalize('NFD').replace(/[̀-̧̂̈]/g, '').normalize('NFC')

async function hooks(page: Page): Promise<Hooks> {
  return page.evaluate(() => (window as unknown as Win).__palabras ?? {})
}

/** Open Palabras with a demo learner's words. */
async function openWithWords(page: Page) {
  await page.goto('./#/palabras')
  await expect(page.getByRole('heading', { name: 'Palabras' })).toBeVisible()
  await page.waitForFunction(() => Boolean((window as unknown as Win).__pawsportDemo), null, { timeout: 20_000 })
  await page.evaluate(() => (window as unknown as Win).__pawsportDemo!({ others: false }))
}

test.beforeEach(async ({ page }) => {
  await enableTestHook(page)
  await page.addInitScript(() => {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.speak = (u: SpeechSynthesisUtterance) => {
      setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 0)
    }
    synth.cancel = () => {}
  })
})

test('crossword: type answers without accents, check, reveal and finish', async ({ page }) => {
  await openWithWords(page)
  await shot(page, 'picker')
  await page.getByRole('button', { name: /Crucigrama/ }).click()
  await expect(page.getByRole('heading', { name: 'Crucigrama' })).toBeVisible()
  await page.waitForFunction(() => Boolean((window as unknown as Win).__palabras?.crossword))
  const entries = (await hooks(page)).crossword!
  expect(entries.length).toBeGreaterThanOrEqual(4)
  await expect(page.getByText(`0 / ${entries.length} words`)).toBeVisible()
  await shot(page, 'crossword-empty')

  const typeWord = async (e: (typeof entries)[number], text = bare(e.answer)) => {
    // tapping a clue puts the cursor where typing the word starts
    await page.getByRole('region', { name: `${e.dir === 'across' ? 'Across' : 'Down'} clues` }).getByRole('button').filter({ hasText: new RegExp(`^${e.number}(?!\\d)`) }).click()
    await page.keyboard.type(text)
  }

  // first word right, accents left out
  await typeWord(entries[0]!)
  await expect(page.getByText(new RegExp(`^[1-9] / ${entries.length} words$`))).toBeVisible()
  // a wrong letter is flagged by Check
  const second = entries[1]!
  const wrongLetter = second.answer[0] === 'x' ? 'z' : 'x'
  await typeWord(second, wrongLetter)
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByRole('status')).toContainText(/letters? to fix/)
  await shot(page, 'crossword-partial')
  // backspace clears it, and Reveal letter fills that square with the answer
  await page.keyboard.press('Backspace')
  await page.getByRole('button', { name: 'Reveal letter' }).click()

  for (const e of entries.slice(1)) await typeWord(e)
  await expect(page.getByText('¡Lo lograste!')).toBeVisible()
  await expect(page.getByText(`${entries.length} / ${entries.length} words`)).toBeVisible()
  await shot(page, 'crossword-done')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('1 solved')).toBeVisible()
})

test('listening: pick the meaning and type what you hear', async ({ page }) => {
  await openWithWords(page)
  await page.getByRole('button', { name: /Pick the meaning/ }).click()
  await expect(page.getByRole('heading', { name: 'Escucha' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Replay the word' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play slowly' })).toBeVisible()
  for (let i = 0; i < 10; i++) {
    await page.waitForFunction((n) => (window as unknown as Win).__palabras?.listen?.index === n, i)
    const { answer } = (await hooks(page)).listen!
    if (i === 0) await shot(page, 'listen-pick')
    if (i === 1) {
      // a wrong answer shows the word and waits for Continue
      await page.getByRole('radio').nth((answer + 1) % 4).click()
      await expect(page.getByRole('status')).toContainText('It was')
      await page.getByRole('button', { name: 'Continue' }).click()
      continue
    }
    await page.getByRole('radio').nth(answer).click()
  }
  await expect(page.getByText(/points · 9 of 10 right/)).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: /Type what you hear/ }).click()
  const field = page.getByLabel('What you hear')
  for (let i = 0; i < 10; i++) {
    await page.waitForFunction((n) => (window as unknown as Win).__palabras?.listen?.index === n, i)
    const { lemma } = (await hooks(page)).listen!
    await field.fill(i === 0 ? lemma : bare(lemma))
    if (i === 0) await shot(page, 'listen-type')
    await field.press('Enter')
    await expect(page.getByRole('status')).toContainText(/Yes!|Almost!/)
    if (i === 0) await shot(page, 'listen-type-answered')
    await page.getByRole('button', { name: 'Continue' }).click()
  }
  await expect(page.getByText(/points · 10 of 10 right/)).toBeVisible()
})

test('sound match: pair each sound with its word', async ({ page }) => {
  await openWithWords(page)
  await page.getByRole('button', { name: /Empareja por sonido/ }).click()
  for (let b = 0; b < 3; b++) {
    await expect(page.getByText(new RegExp(`^Board ${b + 1} of 3`))).toBeVisible()
    const { speakers } = (await hooks(page)).sound!
    for (let i = 0; i < speakers.length; i++) {
      await page.getByRole('button', { name: `Sound ${i + 1}`, exact: true }).click()
      if (b === 0 && i === 1) await shot(page, 'sound-match')
      await page.locator(`button[data-word="${speakers[i]}"]`).click()
    }
  }
  await expect(page.getByText(/points · 12 of 12 first try/)).toBeVisible()
})

test('listening modes explain when the device cannot speak', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    delete w.speechSynthesis
    delete (Object.getPrototypeOf(window) as Record<string, unknown>).speechSynthesis
    delete (Window.prototype as unknown as Record<string, unknown>).speechSynthesis
  })
  await page.goto('./#/palabras')
  await expect(page.getByRole('heading', { name: 'Palabras' })).toBeVisible()
  await expect(page.getByText('Listening needs speech audio on this device').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Pick the meaning/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Crucigrama/ })).toBeVisible()
  await shot(page, 'no-audio')
})
