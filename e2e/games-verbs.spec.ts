import { test, expect, type Page } from '@playwright/test'
import { enableTestHook } from './helpers'

// The verb games (Verb slots, Verb blitz, Verb duel). The games publish the right answer on
// window.__palabras.verbs (e2e only), so the spec can answer right or wrong on purpose.
// Cantonese has no conjugation: the games are hidden there.

interface VerbsHook {
  game: 'slots' | 'blitz' | 'duel'
  phase?: string
  answer?: string
  accepts?: string[]
  index?: number
  options?: string[]
  me?: number
  luna?: number
  asked?: number
  spin?: number
}
type Win = { __palabras?: { verbs?: VerbsHook }; __pawsportDemo?: (o?: { others?: boolean; started?: number }) => Promise<unknown> }

const LANG = process.env.VITE_LANG ?? 'es'
const SHOTS = process.env.VERB_SHOTS
test.skip(LANG === 'yue', 'Cantonese verbs do not conjugate')

/** Light and dark screenshots when VERB_SHOTS names a folder. */
async function shot(page: Page, name: string) {
  if (!SHOTS) return
  const suffix = LANG === 'es' ? '' : `-${LANG}`
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/${name}-light${suffix}.png` })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${SHOTS}/${name}-dark${suffix}.png` })
  await page.emulateMedia({ colorScheme: 'light' })
}

async function hook(page: Page): Promise<VerbsHook> {
  return page.evaluate(() => (window as unknown as Win).__palabras?.verbs ?? ({} as VerbsHook))
}
/** Wait until the hook has these values (a new prompt, a phase…). */
const waitHook = (page: Page, want: Partial<VerbsHook>) =>
  page.waitForFunction((w) => {
    const h = (window as unknown as Win).__palabras?.verbs as Record<string, unknown> | undefined
    return Boolean(h && Object.entries(w).every(([k, v]) => h[k] === v))
  }, want as Record<string, unknown>)

async function openGame(page: Page, title: string) {
  await page.goto('./#/games')
  await expect(page.getByRole('heading', { name: 'Mini games' })).toBeVisible()
  await page.waitForFunction(() => Boolean((window as unknown as Win).__pawsportDemo), null, { timeout: 20_000 })
  await page.evaluate(() => (window as unknown as Win).__pawsportDemo!({ others: false, started: 1 }))
  await page.getByRole('button', { name: new RegExp(`^${title}`) }).click()
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

test('verb slots: spin, type the form, hit the jackpot, finish ten spins', async ({ page }) => {
  await openGame(page, 'Verb slots')
  await expect(page.getByText(/Tenses in play: Present/)).toBeVisible()
  const field = page.getByLabel('Conjugated form')
  for (let i = 1; i <= 10; i++) {
    if (i === 1) await page.getByRole('button', { name: 'Pull the lever to spin' }).click()
    else await page.getByRole('button', { name: /^(Spin again|Spin)$/ }).click()
    await waitHook(page, { phase: 'ask', spin: i })
    const { answer } = await hook(page)
    await expect(page.getByRole('img', { name: /^Verb: / })).toBeVisible()
    if (i === 4) {
      // a wrong form: the answer and the verb's table are shown
      await field.fill('zzzz')
      await field.press('Enter')
      await expect(page.getByRole('status').filter({ hasText: 'Not quite' })).toBeVisible()
      await expect(page.getByRole('table')).toContainText(answer!)
      continue
    }
    await field.fill(answer!)
    if (i === 2) await shot(page, 'slots-play')
    await field.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: 'Right!' })).toBeVisible()
    await expect(page.getByRole('table').locator('tr[aria-current="true"]')).toContainText(answer!)
    if (i === 3) {
      await expect(page.getByText(/JACKPOT! \+25/)).toBeVisible()
      await shot(page, 'slots-jackpot')
    }
  }
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByText('9 of 10 right')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Your spins' }).getByRole('listitem')).toHaveCount(10)
  // jackpots at spins 3, 7 and 10 (three in a row each time) go into the real purse
  await expect(page.getByText(/^\+75 \S+ added to your purse$/)).toBeVisible()
  await shot(page, 'slots-done')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: /^Verb slots/ })).toContainText(/Best: \d+ · 1 played/)
})

test('verb slots: the timer runs out', async ({ page }) => {
  await page.clock.install()
  await openGame(page, 'Verb slots')
  await page.getByRole('button', { name: 'Spin', exact: true }).click()
  await expect(page.getByLabel('Conjugated form')).toBeVisible()
  await page.clock.runFor(16_000)
  await expect(page.getByRole('status').filter({ hasText: 'Time’s up!' })).toBeVisible()
})

test('verb blitz: pick with the keyboard, build a multiplier, stop and review', async ({ page }) => {
  await openGame(page, 'Verb blitz')
  await page.getByRole('button', { name: 'Start' }).click()
  for (let i = 0; i < 8; i++) {
    await waitHook(page, { game: 'blitz', asked: i })
    const h = await hook(page)
    expect(h.options).toHaveLength(4)
    expect(new Set(h.options).size).toBe(4)
    expect(h.options![h.index!]).toBe(h.answer)
    const key = i === 5 ? ((h.index! + 1) % 4) + 1 : h.index! + 1
    if (i === 3) await shot(page, 'blitz-play')
    await page.keyboard.press(String(key))
    if (i === 2) await expect(page.getByText('×2 multiplier')).toBeVisible()
  }
  await waitHook(page, { game: 'blitz', asked: 8 })
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByText(/points · 7 of 8 right · best streak 5/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Forms to practise' })).toBeVisible()
  await shot(page, 'blitz-done')
})

test('verb duel: race Luna to ten and win the bone', async ({ page }) => {
  test.setTimeout(120_000)
  await openGame(page, 'Verb duel')
  await page.getByRole('button', { name: 'Start the duel' }).click()
  const field = page.getByLabel('Conjugated form')
  // Luna answers after 1.4 s at the earliest: the spec answers at once, except while taking screenshots
  let me = 0
  for (let turn = 0; me < 10 && turn < 20; turn++) {
    await waitHook(page, { game: 'duel', phase: 'turn' })
    const h = await hook(page)
    if (turn === 5) await page.getByRole('button', { name: '👆 Pick it' }).click()
    if (turn >= 5) {
      if (turn === 6) await shot(page, 'duel-pick')
      await page.getByRole('radio').nth(h.index!).click()
    } else {
      if (turn === 1) {
        await field.fill(h.answer!.slice(0, -1))
        await shot(page, 'duel-play')
      }
      await field.fill(h.answer!)
      await field.press('Enter')
    }
    await expect(page.getByRole('status').filter({ hasText: /Your point!|Luna’s point|No point/ })).toBeVisible()
    me = (await hook(page)).me ?? me
    if (me < 10) {
      expect(turn === 1 || turn === 6 || (await page.getByRole('status').filter({ hasText: 'Your point!' }).count()) === 1).toBe(true)
      await page.getByRole('button', { name: 'Next' }).click()
    }
  }
  await expect(page.getByRole('heading', { name: 'Verb duel' })).toBeVisible()
  await expect(page.getByText('You won the bone!')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/1 win, 0 losses so far/)).toBeVisible()
  await shot(page, 'duel-done')
})
