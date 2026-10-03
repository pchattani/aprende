import { test, expect } from '@playwright/test'
import { enableTestHook, answerCurrent, continueFeedback, readHook } from './helpers'

test.beforeEach(async ({ page }) => {
  await enableTestHook(page)
})

test('path renders levels, units and the first lesson is unlocked', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'A1' })).toBeVisible()
  await expect(page.getByText('Saludos y presentaciones')).toBeVisible()
  await expect(page.getByRole('link', { name: /Hola y adiós/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'C2' })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/path.png', fullPage: false })
})

test('complete the first lesson, earn XP and unlock the next lesson', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await page.getByRole('link', { name: /Hola y adiós/ }).click()
  await expect(page.getByRole('heading', { name: 'Hola y adiós' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Greetings and goodbyes' })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/teach.png' })
  await page.getByRole('button', { name: 'Start the exercises' }).click()
  let guard = 0
  while (guard++ < 40) {
    const hook = await readHook(page)
    if (guard === 2) await page.screenshot({ path: 'e2e/__screenshots__/exercise.png' })
    await answerCurrent(page, true)
    const last = hook.index + 1 >= hook.total
    await continueFeedback(page)
    if (last) break
  }
  await expect(page.getByRole('heading', { name: '¡Lección completada!' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/^\+\d+$/)).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/done.png' })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('link', { name: /¿Cómo te llamas\?/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Hola y adiós: learned/ })).toBeVisible()
  // streak and XP visible on the header
  await expect(page.getByText(/\d+ \/ \d+ XP/)).toBeVisible()
})

test('losing three hearts ends the lesson', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.getByRole('link', { name: /Hola y adiós/ }).click()
  await page.getByRole('button', { name: 'Start the exercises' }).click()
  let wrong = 0
  let guard = 0
  while (wrong < 3 && guard++ < 20) {
    const hook = await readHook(page)
    const canFail = hook.exercise.kind !== 'speak'
    await answerCurrent(page, !canFail)
    if (canFail) wrong++
    const last = hook.index + 1 >= hook.total
    await continueFeedback(page)
    if (last) break
  }
  await expect(page.getByRole('heading', { name: 'Out of hearts' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('review page, practice session and study tools work', async ({ page }) => {
  test.setTimeout(180_000)
  // seed progress by completing lesson 1 quickly
  await page.goto('/')
  await page.getByRole('link', { name: /Hola y adiós/ }).click()
  await page.getByRole('button', { name: 'Start the exercises' }).click()
  let guard = 0
  while (guard++ < 40) {
    const hook = await readHook(page)
    await answerCurrent(page, true)
    const last = hook.index + 1 >= hook.total
    await continueFeedback(page)
    if (last) break
  }
  await expect(page.getByRole('heading', { name: '¡Lección completada!' })).toBeVisible({ timeout: 15_000 })
  await page.goto('/#/review')
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
  const practise = page.getByRole('button', { name: /practise anyway|Start review/ })
  await practise.first().click()
  const hook = await readHook(page)
  expect(hook.total).toBeGreaterThan(0)
  await answerCurrent(page, true)
  await page.screenshot({ path: 'e2e/__screenshots__/review.png' })

  await page.goto('/#/grammar')
  await expect(page.getByRole('heading', { name: 'Grammar' })).toBeVisible()
  await page.getByLabel('Search grammar').fill('gustar')
  await page.getByRole('link', { name: /Me gusta — liking things/ }).click()
  await expect(page.getByText('to be pleasing')).toBeVisible()

  await page.goto('/#/verbs')
  await expect(page.getByText('soy')).toBeVisible()
  await page.getByLabel('Verb').fill('tener')
  await page.getByLabel('Verb').press('Enter')
  await expect(page.getByText('tengo')).toBeVisible()

  await page.goto('/#/reader')
  await page.getByRole('link', { name: /Mi familia y yo/ }).click()
  await expect(page.getByText(/You know \d+% of the words/)).toBeVisible()
  await page.locator('article button', { hasText: /^familia$/ }).first().click()
  await expect(page.getByRole('dialog').getByText('family')).toBeVisible()

  await page.goto('/#/profile')
  await expect(page.getByRole('heading', { name: 'Your progress' })).toBeVisible()
  await expect(page.getByText('Day streak')).toBeVisible()
})

test('pronunciation lesson and settings load', async ({ page }) => {
  await page.goto('/#/pronunciation')
  await page.getByRole('link', { name: /The five vowels/ }).click()
  await expect(page.getByText('Minimal pairs')).toBeVisible()
  await page.goto('/#/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Export' }).click()
})
