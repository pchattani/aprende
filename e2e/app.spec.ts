import { test, expect } from '@playwright/test'
import { enableTestHook, answerCurrent, continueFeedback, readHook, openPath } from './helpers'

test.beforeEach(async ({ page }) => {
  await enableTestHook(page)
})

test('course renders levels, units and the first lesson is unlocked', async ({ page }) => {
  await openPath(page)
  await expect(page.getByText('Saludos y presentaciones')).toBeVisible()
  await expect(page.getByRole('link', { name: /Hola y adiós/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fin del mundo' })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/path.png', fullPage: false })
})

test('complete the first lesson and unlock the next lesson', async ({ page }) => {
  test.setTimeout(180_000)
  await openPath(page)
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
  await expect(page.getByRole('heading', { name: /Olé|Qué bien|Genial|crack|Así se hace|De lujo/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/^\d+%$/)).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/done.png' })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('link', { name: /¿Cómo te llamas\?/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Hola y adiós: learned/ })).toBeVisible()
  // rhythm and minutes visible on the header
  await expect(page.getByText(/of 7 days this week/)).toBeVisible()
})

test('mistakes come back later in the lesson instead of ending it', async ({ page }) => {
  test.setTimeout(120_000)
  await openPath(page)
  await page.getByRole('link', { name: /Hola y adiós/ }).click()
  await page.getByRole('button', { name: 'Start the exercises' }).click()
  const first = await readHook(page)
  // Three wrong answers in a row: the lesson continues and the queue grows.
  for (let i = 0; i < 3; i++) {
    await answerCurrent(page, false)
    await continueFeedback(page)
  }
  const later = await readHook(page)
  expect(later.total).toBeGreaterThan(first.total)
  await expect(page.getByRole('heading', { name: /Session ended|Out of/ })).toHaveCount(0)
})

test('review page, practice session and study tools work', async ({ page }) => {
  test.setTimeout(180_000)
  // seed progress by completing lesson 1 quickly
  await openPath(page)
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
  await expect(page.getByRole('heading', { name: /Olé|Qué bien|Genial|crack|Así se hace|De lujo/ })).toBeVisible({ timeout: 15_000 })
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
  await expect(page.getByText('Rhythm')).toBeVisible()
})

test('pronunciation lesson and settings load', async ({ page }) => {
  await page.goto('/#/pronunciation')
  await page.getByRole('link', { name: /The five vowels/ }).click()
  await expect(page.getByText('Minimal pairs')).toBeVisible()
  await page.goto('/#/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Export' }).click()
})

test('works offline once the service worker has cached the app', async ({ page, context }) => {
  test.setTimeout(120_000)
  await openPath(page)
  // Wait for the service worker to install and finish precaching.
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    if (reg.active?.state !== 'activated') {
      await new Promise<void>((resolve) => {
        reg.active?.addEventListener('statechange', () => reg.active?.state === 'activated' && resolve())
      })
    }
  })
  await page.waitForFunction(async () => {
    const keys = await caches.keys()
    if (keys.length === 0) return false
    const cache = await caches.open(keys[0]!)
    return (await cache.keys()).length > 10
  }, undefined, { timeout: 60_000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Buenos Aires' })).toBeVisible()
  // Base-relative so the URL stays inside the service worker's /aprende/ scope.
  await page.goto('./#/grammar')
  await expect(page.getByRole('heading', { name: 'Grammar' })).toBeVisible()
  await context.setOffline(false)
})

test('placement test places a strong learner at C2 and every level stays open', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await page.getByRole('button', { name: /Take the placement test/ }).click()
  await expect(page.getByText(/Placement test · A1/)).toBeVisible()
  let guard = 0
  while (guard++ < 80) {
    const done = await page.getByRole('heading', { name: /Your level/ }).isVisible()
    if (done) break
    await page.waitForFunction(() => Boolean((window as unknown as { placement?: unknown }).placement))
    const hook = await page.evaluate(() => (window as unknown as { placement: { answer: number; index: number } }).placement)
    await page.getByRole('radio').nth(hook.answer).click()
    await page.waitForFunction((idx) => (window as unknown as { placement: { index: number } }).placement.index !== idx || document.querySelector('h1')?.textContent?.includes('Your level'), hook.index)
  }
  await expect(page.getByRole('heading', { name: 'Your level: C2' })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/placement.png' })
  await page.getByRole('button', { name: 'Start at C2' }).click()
  await expect(page.getByRole('heading', { name: 'Buenos Aires' })).toBeVisible()
  // B1 lessons are open, and an A2 lesson deep in the level is open for practice.
  await expect(page.getByRole('link', { name: /Formas regulares/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Habla, come, escribe/ })).toBeVisible()
})

test('choosing a level manually marks the recommended start; every lesson is open', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /I know my level/ })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/welcome.png' })
  await page.getByRole('button', { name: /I know my level/ }).click()
  await page.getByRole('button', { name: /^A2/ }).click()
  await expect(page.getByRole('heading', { name: 'A1' })).toHaveCount(0)
  await expect(page.getByText('Recommended start')).toBeVisible()
  await expect(page.getByRole('link', { name: /¿Qué hiciste ayer\?/ })).toBeVisible()
  // B1 lessons are open too: the course is never locked.
  await expect(page.getByRole('link', { name: /Formas regulares/ })).toBeVisible()
  // Passport page lists stops and souvenirs.
  await page.getByRole('link', { name: 'Passport' }).click()
  await expect(page.getByRole('heading', { name: 'Passport' })).toBeVisible()
  await expect(page.getByText(/souvenirs of/)).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/passport.png' })
})
