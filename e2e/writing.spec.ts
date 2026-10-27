/**
 * Cantonese writing (VITE_LANG=yue): the starter lessons' character exercises. Traces a character by
 * dragging along the stroke medians from the bundled data, writes one from memory, and answers a
 * pictogram exercise. Lessons: a1.u13.l1 (一 二 三) and a1.u15.l1 (人 口 山, pictograms).
 */
import { test, expect, type Page } from '@playwright/test'
import { enableTestHook, readHook, answerCurrent, continueFeedback, writeCharacter, strokeMedians, completeLessonsBefore, type Hook } from './helpers'

const LANG = process.env.VITE_LANG ?? 'es'
test.skip(LANG !== 'yue', 'Cantonese only')

test.beforeEach(async ({ page }) => {
  await enableTestHook(page)
  await page.goto('./')
  await page.getByRole('button', { name: /I'm new to Cantonese/ }).click()
  await page.waitForURL(/#\/$/)
})

/** Open a lesson, through its first-time guidebook when it has one. */
async function openLesson(page: Page, id: string) {
  // via the journey: the done screen of the same lesson has the same URL
  await page.goto('./#/')
  await page.goto(`./#/lesson/${id}`)
  const start = page.getByRole('button', { name: 'Start the exercises' })
  await page.waitForFunction(() => Boolean((window as unknown as { __aprende?: unknown }).__aprende) || [...document.querySelectorAll('button')].some((b) => b.textContent === 'Start the exercises'))
  if (await start.isVisible()) await start.click()
}

/** Answer exercises (correctly) until one of `kinds` comes up; returns its hook. */
async function skipTo(page: Page, kinds: string[]): Promise<Hook> {
  for (let guard = 0; guard < 30; guard++) {
    const hook = await readHook(page)
    if (kinds.includes(hook.exercise.kind)) return hook
    await answerCurrent(page, true)
    await continueFeedback(page)
  }
  throw new Error(`no ${kinds.join('/')} exercise`)
}

test('trace a character over its outline, then write one from memory', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('./#/lesson/a1.u13.l1')
  // the first time, the guidebook shows the characters to write with their stroke order
  await page.getByRole('tab', { name: /^Writing \(\d+\)$/ }).click()
  await expect(page.locator('[data-shot="guide-writing"] [data-writer="demo"] svg')).toHaveCount(3)
  await page.getByRole('button', { name: 'Start the exercises' }).click()

  const hook = await skipTo(page, ['trace'])
  const char = hook.exercise.char!
  expect(['一', '二', '三']).toContain(char)
  expect(hook.exercise.items).toEqual([`c.${char}`])
  // demo first: the stroke-order chart has one frame per stroke
  await expect(page.getByRole('heading', { name: 'Watch the stroke order' })).toBeVisible()
  await expect(page.getByRole('list', { name: `Stroke order of ${char}` }).getByRole('listitem')).toHaveCount(strokeMedians(char).length)
  await page.getByRole('button', { name: 'Now trace it' }).click()
  await expect(page.getByRole('heading', { name: 'Trace the character' })).toBeVisible()
  await writeCharacter(page, char)
  const sheet = page.getByRole('status')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Postage due')).toHaveCount(0)
  await expect(sheet.getByText('Return to sender')).toHaveCount(0)
  await expect(sheet.getByText(char, { exact: true })).toBeVisible()
  await continueFeedback(page)

  // the rest of the lesson, so the characters count as seen
  for (let guard = 0; guard < 30; guard++) {
    const h = await readHook(page)
    await answerCurrent(page, true)
    await continueFeedback(page)
    if (h.index + 1 >= h.total) break
  }
  await expect(page.getByText(/^\d+%$/)).toBeVisible({ timeout: 15_000 })

  // next time a character already traced is written from memory: no outline, sound and meaning only
  await openLesson(page, 'a1.u13.l1')
  const w = await skipTo(page, ['writeChar'])
  await expect(page.getByRole('heading', { name: 'Write it from memory' })).toBeVisible()
  await expect(page.locator('[data-writer="pad"] svg')).toBeVisible()
  await writeCharacter(page, w.exercise.char!)
  await expect(page.getByRole('status')).toBeVisible()
  await expect(page.getByRole('status').getByText('Return to sender')).toHaveCount(0)
})

test('pictogram: see the picture, pick the character', async ({ page }) => {
  test.setTimeout(120_000)
  // lessons open in order: finish the ones before it first
  await completeLessonsBefore(page, 'a1.u15.l1')
  await openLesson(page, 'a1.u15.l1')
  const hook = await skipTo(page, ['pictogram'])
  const char = hook.exercise.char!
  expect(['人', '口', '山']).toContain(char)
  const strip = page.locator('figure.picto')
  await expect(strip).toBeVisible()
  // the modern character stays hidden until the answer is checked
  await expect(strip).not.toHaveAttribute('data-char', char)
  await page.getByRole('radio', { name: char }).click()
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByRole('status')).toBeVisible()
  await expect(strip).toHaveAttribute('data-char', char)
  await expect(page.getByRole('status').getByText('Return to sender')).toHaveCount(0)
})
