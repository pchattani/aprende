/**
 * The writing stop after a stop's lessons (/writing/:unitId) and the writing area (/writing).
 * Completes the lessons of the first stop that has writing prompts, opens its Writing card on
 * the journey, writes a good answer (the prompt's model answer, before it has been shown) and a
 * broken one, checks scores, highlighted issues and feedback, applies a suggestion, shows the
 * model answer, revises, moves on and ends with the set's summary. Cantonese also taps
 * characters in from the helper row. Screenshots at 390px when WRITING_SHOTS names a folder.
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { load } from 'js-yaml'
import { enableTestHook, syllabusLessons, completeLessonsBefore, readHook, answerCurrent, continueFeedback } from './helpers'

const LANG = process.env.VITE_LANG ?? 'es'
const SHOTS = process.env.WRITING_SHOTS
const NAME = (JSON.parse(readFileSync('courses.json', 'utf8')) as { id: string; name: string }[]).find((c) => c.id === LANG)?.name ?? 'Spanish'

interface Prompt {
  task: string
  min: number
  max: number
  model: { es: string; en: string }
}
interface UnitFile {
  id: string
  lessons: { id: string }[]
  writing?: Prompt[]
}

/** The first stop (syllabus order) with writing prompts, and the lesson after its last one. */
function firstWritingStop(): { unit: UnitFile; next: string } {
  const syllabus = load(readFileSync(`content/${LANG}/syllabus.yaml`, 'utf8')) as { levels: { id: string; units: { id: string }[] }[] }
  const order = syllabusLessons()
  for (const lv of syllabus.levels) {
    for (const u of lv.units) {
      const file = `content/${LANG}/units/${lv.id}/${u.id.split('.')[1]}.yaml`
      if (!existsSync(file)) continue
      const unit = load(readFileSync(file, 'utf8')) as UnitFile
      if (!unit.writing?.length) continue
      const next = order[order.indexOf(unit.lessons.at(-1)!.id) + 1]
      if (next) return { unit, next }
    }
  }
  throw new Error('no stop with writing prompts yet')
}

/** A broken version of a good answer: lower-case start, no final punctuation, a misspelt word (Cantonese: 唔有, a simplified character). */
function broken(text: string): string {
  if (LANG === 'yue') return text.replace(/[。！？]$/, '').replace(/有/, '唔有') + '，这个'
  const t = text.charAt(0).toLowerCase() + text.slice(1).replace(/[.!?]$/, '')
  const long = [...t.matchAll(/\p{L}{6,}/gu)].map((m) => m[0]).find((w) => /^\p{Ll}/u.test(w))
  return long ? t.replace(long, long.slice(0, 3) + long[2] + long.slice(3)) : t + ' xyzzy'
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/${LANG}-${name}.png`, fullPage: true })
}

async function scoreOf(page: Page): Promise<number> {
  const label = await page.getByLabel(/^Score \d+%$/).first().getAttribute('aria-label')
  return Number(label!.match(/\d+/)![0])
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

test('writing stop: check, highlights, model answer, revise, next prompt, summary, writing area', async ({ page }) => {
  test.setTimeout(120_000)
  const { unit, next } = firstWritingStop()
  const prompts = unit.writing!
  await page.goto('./')
  await page.getByRole('button', { name: new RegExp(`I'm new to ${NAME}`) }).click()
  await page.waitForURL(/#\/$/)

  // before the lessons: the card is locked and the page says so
  await page.goto(`./#/writing/${unit.id}`)
  await expect(page.getByRole('heading', { name: 'Opens after the lessons' })).toBeVisible()

  // the stop's lessons done: the journey's Writing card opens it
  await completeLessonsBefore(page, next)
  await page.goto('./#/')
  const card = page.locator(`#writing-${unit.id.replace('.', '\\.')}`)
  await card.scrollIntoViewIfNeeded()
  await expect(card).toHaveAttribute('aria-label', new RegExp(`^Writing · .*: ${prompts.length} prompts`))
  if (SHOTS) {
    await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: 'center' }), `writing-${unit.id}`)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${SHOTS}/${LANG}-itinerary-card.png` })
  }
  await card.click()
  await expect(page).toHaveURL(new RegExp(`#/writing/${unit.id.replace('.', '\\.')}$`))
  const p1 = prompts[0]!
  await expect(page.getByRole('heading', { name: p1.task })).toBeVisible()
  const box = page.getByLabel(`Your text in ${NAME}`)
  await expect(box).toHaveAttribute('spellcheck', 'false')
  await expect(box).toHaveAttribute('lang', /.+/)
  await expect(page.getByRole('button', { name: 'Check my writing' })).toBeDisabled()

  if (LANG === 'yue') {
    // no Chinese keyboard: tap characters in from the helper row
    const helper = page.getByRole('group', { name: 'Characters to tap in' })
    await expect(helper).toBeVisible()
    const tiles = helper.locator('button[data-char]')
    const a = (await tiles.nth(0).getAttribute('data-char'))!
    const b = (await tiles.nth(1).getAttribute('data-char'))!
    await tiles.nth(0).click()
    await tiles.nth(1).click()
    await helper.getByRole('button', { name: 'Insert 。' }).click()
    await expect(box).toHaveValue(`${a}${b}。`)
    await shot(page, 'helper-row')
  }

  // a good answer (the model, which the learner has not seen yet)
  await box.fill(p1.model.es)
  await shot(page, 'prompt')
  await page.getByRole('button', { name: 'Check my writing' }).click()
  await expect(page.getByRole('status')).toContainText(/Score \d+%/)
  const good = await scoreOf(page)
  expect(good).toBeGreaterThanOrEqual(90)
  await expect(page.getByText('Ready to post')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What went well' })).toBeVisible()
  for (const c of ['Task', 'Grammar', LANG === 'yue' ? 'Characters' : 'Spelling', 'Vocabulary']) await expect(page.getByRole('progressbar', { name: new RegExp(`^${c} \\d+%`) })).toBeVisible()

  // revise into a broken answer: lower score, issues marked in the text, best kept
  await page.getByRole('button', { name: 'Revise' }).click()
  await box.fill(broken(p1.model.es))
  await page.getByRole('button', { name: 'Check my writing' }).click()
  await expect(page.getByRole('status')).toContainText(/things? to check/)
  const bad = await scoreOf(page)
  expect(bad).toBeLessThan(good)
  await expect(page.getByText(new RegExp(`Best ${good}%`))).toBeVisible()
  const marks = page.locator('[data-issue]')
  expect(await marks.count()).toBeGreaterThanOrEqual(2)
  await marks.first().click()
  const panel = page.getByRole('region', { name: 'Selected issue' })
  await expect(panel).toBeVisible()
  await expect(panel).toContainText(/Check|Spelling|Accent|simplified|characters/)
  await shot(page, 'results')
  // keyboard: the marks are buttons in reading order
  await marks.nth(1).focus()
  await page.keyboard.press('Enter')
  await expect(marks.nth(1)).toHaveAttribute('aria-pressed', 'true')
  const apply = page.getByRole('button', { name: 'Apply suggestion' })
  if (await apply.isVisible()) {
    await apply.click()
    await expect(page.getByText("You've edited the text")).toBeVisible()
    await page.getByRole('button', { name: 'Check again' }).click()
    await expect(page.getByRole('status')).toContainText(/Score \d+%/)
  }

  // the model answer, with its English
  await page.getByRole('button', { name: 'See a model answer' }).click()
  const model = page.getByRole('region', { name: 'Model answer' })
  await expect(model).toContainText(p1.model.en)
  await model.scrollIntoViewIfNeeded()
  await shot(page, 'model-answer')

  // next prompt: an English answer is recognised
  if (prompts.length > 1) {
    await page.getByRole('button', { name: 'Next prompt' }).click()
    await expect(page.getByRole('heading', { name: prompts[1]!.task })).toBeVisible()
    await box.fill(LANG === 'yue' ? 'I have a phone and a computer, but no car.' : 'My family is small and my father is called John. He is fifty and my mother is nice.')
    await page.getByRole('button', { name: 'Check my writing' }).click()
    await expect(page.getByText(/This looks like English/)).toBeVisible()
    expect(await scoreOf(page)).toBeLessThanOrEqual(25)
  }

  // the last prompt, then the summary of the set
  const last = prompts.length - 1
  await page.getByRole('button', { name: new RegExp(`^Prompt ${last + 1}`) }).click()
  await expect(page.getByRole('heading', { name: prompts[last]!.task })).toBeVisible()
  await box.fill(prompts[last]!.model.es)
  await page.getByRole('button', { name: 'Check my writing' }).click()
  await page.getByRole('button', { name: 'See the summary' }).click()
  await expect(page.getByRole('heading', { name: /Your writing so far|Postcards sent/ })).toBeVisible()
  const list = page.getByRole('list', { name: 'Prompts' }).last()
  await expect(list.getByRole('listitem')).toHaveCount(prompts.length)
  await expect(list).toContainText(`${good}%`)
  await shot(page, 'summary')

  // the writing area lists the stop with its best scores
  await page.goto('./#/writing')
  const row = page.getByRole('link', { name: /^Writing · .*prompts done, best \d+%/ })
  await expect(row).toBeVisible()
  await shot(page, 'area')

  // dark mode renders the results too
  if (SHOTS) {
    await page.emulateMedia({ colorScheme: 'dark' })
    await row.click()
    await expect(page.getByRole('button', { name: 'Check my writing' })).toBeVisible()
    await shot(page, 'prompt-dark')
  }
})

test("the stop's last lesson opens its writing prompts from the done screen", async ({ page }) => {
  test.setTimeout(180_000)
  const { unit } = firstWritingStop()
  const lastLesson = unit.lessons.at(-1)!.id
  await page.goto('./')
  await page.getByRole('button', { name: new RegExp(`I'm new to ${NAME}`) }).click()
  await page.waitForURL(/#\/$/)
  await completeLessonsBefore(page, lastLesson)
  await page.goto(`./#/lesson/${lastLesson}`)
  const start = page.getByRole('button', { name: 'Start the exercises' })
  await page.waitForFunction(() => Boolean((window as unknown as { __aprende?: unknown }).__aprende) || [...document.querySelectorAll('button')].some((b) => b.textContent === 'Start the exercises'))
  if (await start.isVisible()) await start.click()
  for (let guard = 0; guard < 40; guard++) {
    const hook = await readHook(page)
    await answerCurrent(page, true)
    const last = hook.index + 1 >= hook.total
    await continueFeedback(page)
    if (last) break
  }
  const cta = page.getByRole('link', { name: new RegExp(`Writing stop open: ${unit.writing!.length} prompts`) })
  await expect(cta).toBeVisible({ timeout: 15_000 })
  if (SHOTS) {
    await cta.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SHOTS}/${LANG}-done-cta.png` })
  }
  await cta.click()
  await expect(page.getByRole('heading', { name: unit.writing![0]!.task })).toBeVisible()
})
