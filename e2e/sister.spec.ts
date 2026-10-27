/**
 * Smoke test for any course (VITE_LANG=yue|pt|it|es): first launch, a whole
 * first lesson answered through the test hook, the passport, a region quiz and
 * the sister-course switcher. Language-neutral: everything is read from content.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { enableTestHook, answerCurrent, continueFeedback, readHook } from './helpers'

const LANG = process.env.VITE_LANG ?? 'es'
const journey = load(readFileSync(`content/${LANG}/journey.yaml`, 'utf8')) as { regions: { name: string }[] }
const pack = load(readFileSync(`content/${LANG}/pack.yaml`, 'utf8')) as { name: string }
const syllabus = load(readFileSync(`content/${LANG}/syllabus.yaml`, 'utf8')) as { levels: { units: { id: string }[] }[] }
const firstUnit = syllabus.levels[0]!.units[0]!.id

test.beforeEach(async ({ page }) => {
  await enableTestHook(page)
})

test(`${pack.name}: first launch, first lesson, passport, quiz`, async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('./')
  await page.getByRole('button', { name: new RegExp(`I'm new to ${pack.name}`) }).click()
  await expect(page.getByRole('heading', { name: journey.regions[0]!.name, exact: true })).toBeVisible()
  await page.screenshot({ path: `e2e/__screenshots__/${LANG}-course.png` })

  await expect(page.locator(`#lesson-${firstUnit.replace('.', '\\.')}\\.l2`)).toHaveAttribute('aria-label', /: locked$/)
  await page.locator(`a[href$="/lesson/${firstUnit}.l1"]`).first().click()
  // A first lesson with grammar opens on its teach screen; otherwise exercises start right away.
  const start = page.getByRole('button', { name: 'Start the exercises' })
  await page.waitForFunction(() => Boolean((window as unknown as { __aprende?: unknown }).__aprende) || [...document.querySelectorAll('button')].some((b) => b.textContent === 'Start the exercises'))
  if (await start.isVisible()) await start.click()
  let guard = 0
  while (guard++ < 40) {
    const hook = await readHook(page)
    if (guard === 2) await page.screenshot({ path: `e2e/__screenshots__/${LANG}-exercise.png` })
    await answerCurrent(page, true)
    const last = hook.index + 1 >= hook.total
    await continueFeedback(page)
    if (last) break
  }
  await expect(page.getByText(/^\d+%$/)).toBeVisible({ timeout: 15_000 })
  // the first lesson opens the second (every other lesson stays locked until the one before it is done)
  await expect(page.getByText('Lesson 2 unlocked')).toBeVisible()
  await page.screenshot({ path: `e2e/__screenshots__/${LANG}-done.png` })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator(`#lesson-${firstUnit.replace('.', '\\.')}\\.l1`)).toBeInViewport()
  await expect(page.locator(`#lesson-${firstUnit.replace('.', '\\.')}\\.l2`).getByRole('link', { name: /: new, practice$/ })).toBeVisible()
  await expect(page.locator(`#lesson-${firstUnit.replace('.', '\\.')}\\.l3`)).toHaveAttribute('aria-label', /: locked$/)

  await page.goto('./#/passport')
  await expect(page.getByRole('heading', { name: 'Passport' })).toBeVisible()
  await page.goto('./#/quiz/a1')
  await expect(page.getByRole('radio').first()).toBeVisible({ timeout: 20_000 })
  await page.goto('./#/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})
