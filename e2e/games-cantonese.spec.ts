import { test, expect, type Page } from '@playwright/test'
import { enableTestHook } from './helpers'

// The Cantonese mini games (Measure words, Tone detective). They exist only in the Cantonese
// build, so these run only with VITE_LANG=yue. Speech is stubbed to a silent no-op; the games
// publish their answers on window.__palabras (e2e only).

interface Hooks {
  measure?: { index: number; total: number; noun: string; cl: string; options: string[]; answer: number; phrase: string; phraseJp: string }
  measureSort?: { bins: string[]; nouns: { lemma: string; cl: string }[] }
  tones?: { level: string; index: number; same?: boolean; tones?: number[]; text?: string }
}
type Win = { __palabras?: Hooks; __pawsportDemo?: (o?: { others?: boolean }) => Promise<unknown> }

test.skip((process.env.VITE_LANG ?? 'es') !== 'yue', 'Cantonese course only')

const SHOTS = process.env.CANTONESE_SHOTS
/** Light and dark screenshots when CANTONESE_SHOTS names a folder. */
async function shot(page: Page, name: string) {
  if (!SHOTS) return
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/${name}-light.png`, fullPage: true })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${SHOTS}/${name}-dark.png`, fullPage: true })
  await page.emulateMedia({ colorScheme: 'light' })
}

async function hooks(page: Page): Promise<Hooks> {
  return page.evaluate(() => (window as unknown as Win).__palabras ?? {})
}

async function openGame(page: Page, id: string) {
  await page.goto('./#/games')
  await expect(page.getByRole('heading', { name: 'Mini games' })).toBeVisible()
  await page.waitForFunction(() => Boolean((window as unknown as Win).__pawsportDemo), null, { timeout: 20_000 })
  await page.evaluate(() => (window as unknown as Win).__pawsportDemo!({ others: false }))
  await page.goto(`./#/games/${id}`)
}

/** Wait for question `index` of a game to be live. */
async function waitFor<K extends 'measure' | 'tones'>(page: Page, key: K, index: number): Promise<NonNullable<Hooks[K]>> {
  await page.waitForFunction(([k, i]) => (window as unknown as Win).__palabras?.[k as 'measure' | 'tones']?.index === i, [key, index] as const)
  return (await hooks(page))[key]!
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

test('measure words: twelve counters, then sort six nouns into baskets', async ({ page }) => {
  await openGame(page, 'measure')
  let q = await waitFor(page, 'measure', 0)
  expect(q.total).toBe(12)
  expect(q.options[q.answer]).toBe(q.cl)
  await expect(page.getByText('＿')).toBeVisible()
  await shot(page, 'measure-question')

  // a wrong answer shows the right measure word, the phrase and its family
  await page.locator(`[data-cl="${q.options[(q.answer + 1) % 4]}"]`).click()
  await expect(page.getByRole('status')).toContainText(`It's ${q.cl}`)
  // the phrase with its Jyutping (the characters carry ruby readings, so match the Jyutping line)
  await expect(page.getByRole('status')).toContainText(q.phraseJp)
  await expect(page.getByRole('status')).toContainText('You picked')
  await shot(page, 'measure-answer')
  await page.getByRole('button', { name: 'Next' }).click()

  for (let i = 1; i < 12; i++) {
    q = await waitFor(page, 'measure', i)
    await page.locator(`[data-cl="${q.cl}"]`).click()
    await expect(page.getByRole('status')).toContainText('Yes!')
    await page.getByRole('button', { name: i === 11 ? 'Bonus round' : 'Next' }).click()
  }

  await expect(page.getByRole('heading', { name: 'Bonus: sort them' })).toBeVisible()
  await page.waitForFunction(() => Boolean((window as unknown as Win).__palabras?.measureSort))
  const sort = (await hooks(page)).measureSort!
  expect(sort.bins.length).toBe(3)
  expect(sort.nouns.length).toBe(6)
  await shot(page, 'measure-sort')
  // the first noun is dragged onto its basket, the rest tapped and then the basket tapped
  const [first, ...rest] = sort.nouns
  const chip = page.locator(`[data-noun="${first!.lemma}"]`)
  const bin = page.locator(`[data-bin="${first!.cl}"]`)
  const from = (await chip.boundingBox())!
  const to = (await bin.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 30, from.y + 40, { steps: 4 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(chip).toHaveCount(0)
  for (const n of rest) {
    await page.locator(`[data-noun="${n.lemma}"]`).click()
    await page.locator(`[data-bin="${n.cl}"]`).click()
  }
  await expect(page.getByText(/11 of 12 right · 6 of 6 sorted/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Measure words this round' })).toBeVisible()
  await shot(page, 'measure-done')
})

test('tone detective: same or different, which tone, two-syllable words', async ({ page }) => {
  await openGame(page, 'tones')
  await expect(page.getByRole('heading', { name: 'Tone detective' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Pitch chart of the six tones/ })).toBeVisible()
  await shot(page, 'tones-start')

  // level a: answer every pair from the hook
  await page.getByRole('button', { name: /Same or different\?/ }).click()
  for (let i = 0; i < 10; i++) {
    const t = await waitFor(page, 'tones', i)
    expect(t.level).toBe('same')
    await page.getByRole('button', { name: t.same ? 'Same tone' : 'Different tones' }).click()
    await expect(page.getByRole('status')).toContainText(t.same ? 'Same tone' : 'Different tones')
    if (i === 0) await shot(page, 'tones-same-answer')
    await page.getByRole('button', { name: i === 9 ? 'See score' : 'Next' }).click()
  }
  await expect(page.getByText(/10 of 10 right/)).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // level b: tone buttons announce "tone N, name"; one wrong answer
  await page.getByRole('button', { name: /Which tone\?/ }).click()
  for (let i = 0; i < 10; i++) {
    const t = await waitFor(page, 'tones', i)
    const tone = i === 0 ? (t.tones![0]! % 6) + 1 : t.tones![0]!
    if (i === 0) await shot(page, 'tones-which-question')
    await page.locator(`[data-tone="${tone}"]`).click()
    if (i === 0) {
      await expect(page.getByRole('status')).toContainText(`It's ${t.tones![0]}`)
      await expect(page.getByRole('status')).toContainText(t.text!)
      await shot(page, 'tones-which-answer')
    }
    await page.getByRole('button', { name: i === 9 ? 'See score' : 'Next' }).click()
  }
  await expect(page.getByText(/9 of 10 right/)).toBeVisible()
  await shot(page, 'tones-done')
  await page.getByRole('button', { name: 'Done' }).click()

  // level c: two taps per word
  await page.getByRole('button', { name: /Two-syllable words/ }).click()
  await expect(page.getByRole('button', { name: 'tone 4, low falling' })).toBeVisible()
  for (let i = 0; i < 10; i++) {
    const t = await waitFor(page, 'tones', i)
    expect(t.tones!.length).toBe(2)
    await page.locator(`[data-tone="${t.tones![0]}"]`).click()
    if (i === 0) await shot(page, 'tones-word-half')
    await page.locator(`[data-tone="${t.tones![1]}"]`).click()
    await expect(page.getByRole('status')).toContainText('Yes!')
    await page.getByRole('button', { name: i === 9 ? 'See score' : 'Next' }).click()
  }
  await expect(page.getByText(/10 of 10 right/)).toBeVisible()
})

test('tone detective without a Cantonese voice: explains and plays the reading version', async ({ page }) => {
  // an English voice only: the game says a Cantonese one is needed and defaults to reading
  await page.addInitScript(() => {
    const synth = window.speechSynthesis
    if (!synth) return
    const voice = { name: 'English', lang: 'en-US', voiceURI: 'English', default: true, localService: true } as SpeechSynthesisVoice
    synth.getVoices = () => [voice]
  })
  await openGame(page, 'tones')
  await expect(page.getByText('Tone detective needs a Cantonese voice')).toBeVisible()
  await expect(page.getByRole('radio', { name: /Reading only/ })).toHaveAttribute('aria-checked', 'true')
  await shot(page, 'tones-novoice')
  await page.getByRole('button', { name: /Which tone\?/ }).click()
  const t = await waitFor(page, 'tones', 0)
  // the character is shown, its Jyutping without the tone number, and no play button
  await expect(page.getByRole('button', { name: 'Replay' })).toHaveCount(0)
  await expect(page.getByText(t.text!, { exact: true }).first()).toBeVisible()
  await shot(page, 'tones-reading-question')
  await page.locator(`[data-tone="${t.tones![0]}"]`).click()
  await expect(page.getByRole('status')).toContainText('Yes!')
})
