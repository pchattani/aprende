import { test, expect } from '@playwright/test'
import { enableTestHook, answerCurrent, continueFeedback, readHook, openPath, completeLessonsBefore } from './helpers'
import { SITE_BASE } from '../scripts/site-base.mjs'

test.beforeEach(async ({ page }) => {
  await enableTestHook(page)
})

test('course renders levels, units and the first lesson is unlocked', async ({ page }) => {
  await openPath(page)
  await expect(page.getByText('Saludos y presentaciones')).toBeVisible()
  await expect(page.getByRole('link', { name: /Hola y adiós/ })).toBeVisible()
  // the rest of the route is locked until the lesson before is finished
  await expect(page.getByRole('group', { name: 'Lesson 2, ¿Cómo te llamas?: locked' })).toContainText('Finish Lesson 1 first')
  await expect(page.getByRole('button', { name: /¿Cómo te llamas\?: locked, practice/ })).toBeDisabled()
  await expect(page.getByRole('link', { name: /¿Cómo te llamas\?/ })).toHaveCount(0)
  await expect(page.getByRole('group', { name: /Checkpoint · .*: locked/ }).first()).toContainText('Finish the')
  await expect(page.getByRole('heading', { name: 'Fin del mundo' })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/path.png', fullPage: false })
})

test('complete the first lesson and unlock the next lesson', async ({ page }) => {
  test.setTimeout(180_000)
  await openPath(page)
  await expect(page.getByRole('group', { name: 'Lesson 2, ¿Cómo te llamas?: locked' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Board: lesson 1 of/ })).toBeVisible()
  await page.getByRole('link', { name: /Hola y adiós/ }).click()
  await expect(page.getByRole('heading', { name: 'Hola y adiós' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Greetings and goodbyes' })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/teach.png' })
  await page.getByRole('button', { name: 'Start the exercises' }).click()
  let guard = 0
  let first: Awaited<ReturnType<typeof readHook>> | undefined
  while (guard++ < 40) {
    const hook = await readHook(page)
    first ??= hook
    if (guard === 2) await page.screenshot({ path: 'e2e/__screenshots__/exercise.png' })
    await answerCurrent(page, true)
    if (guard <= 3) {
      // Every answer shows what was practised in Spanish and in English.
      const status = page.getByRole('status')
      await expect(status.locator('[lang^="es"]').first()).toBeVisible()
      await expect(status.locator('[lang="en"]').first()).toBeVisible()
      if (hook.exercise.review) await expect(status.getByText(hook.exercise.review.en, { exact: false }).first()).toBeVisible()
    }
    const last = hook.index + 1 >= hook.total
    await continueFeedback(page)
    if (last) break
  }
  // Normal session length is exactly 12 exercises (plus any re-queued mistakes, none here).
  expect(first!.total).toBe(12)
  await expect(page.getByRole('heading', { name: /Olé|Qué bien|Genial|crack|Así se hace|De lujo/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/^\d+%$/)).toBeVisible()
  // finishing it opens the next lesson
  await expect(page.getByText('Lesson 2 unlocked')).toBeVisible()
  await expect(page.getByText(/¿Cómo te llamas\? is open/)).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/done.png' })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('link', { name: /¿Cómo te llamas\?: new, practice/ })).toBeVisible()
  await expect(page.getByRole('group', { name: /: locked$/ }).first()).toBeAttached()
  // the dogs and the boarding pass move on to lesson 2
  await expect(page.locator('#lesson-a1\\.u01\\.l2').getByRole('group', { name: /are here/ })).toBeAttached()
  await expect(page.getByRole('link', { name: /Board: lesson 2 of/ })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Lesson 3, Soy, eres, es: locked' })).toContainText('Finish Lesson 2 first')
  const row = page.getByRole('link', { name: /Hola y adiós: learned/ })
  await expect(row).toBeVisible()
  // Back on the course we land by the lesson we just finished and the one it opened, not at the top.
  await expect(row).toBeInViewport()
  await expect(page.locator('#lesson-a1\\.u01\\.l2')).toBeInViewport()
  // rhythm and minutes visible on the header
  await expect(page.getByText(/of 7 days this week/)).toBeVisible()
})

test('a locked lesson cannot be started: a deep link shows the way to the lesson that opens it', async ({ page }) => {
  await openPath(page)
  await page.goto('./#/lesson/a1.u01.l3')
  await expect(page.getByRole('heading', { name: 'Soy, eres, es' })).toBeVisible()
  await expect(page.getByText('Finish Lesson 2 first.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start the exercises' })).toHaveCount(0)
  expect(await page.evaluate(() => Boolean((window as unknown as { __aprende?: { exercise?: unknown } }).__aprende?.exercise))).toBe(false)
  // the guidebook is a preview: readable, but it does not board
  await page.getByRole('link', { name: 'Peek at the guidebook' }).click()
  await expect(page.getByText('Guidebook · a preview')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start the exercises' })).toHaveCount(0)
  // the way on: the current lesson (lesson 1 for a new learner)
  await page.getByRole('button', { name: 'Go to Lesson 1' }).click()
  await expect(page).toHaveURL(/#\/lesson\/a1\.u01\.l1$/)
  await expect(page.getByRole('heading', { name: 'Hola y adiós' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start the exercises' })).toBeVisible()
  // a later lesson opens once the one before it is done
  await completeLessonsBefore(page, 'a1.u01.l3')
  await page.goto('./#/lesson/a1.u01.l3')
  await expect(page.getByRole('button', { name: 'Start the exercises' })).toBeVisible()
  await page.goto('./#/lesson/a1.u01.l4')
  await expect(page.getByText('Finish Lesson 3 first.')).toBeVisible()
})

test('the guidebook stays open during a lesson and from the journey', async ({ page }) => {
  await openPath(page)
  await page.getByRole('link', { name: /Hola y adiós/ }).click()
  await page.getByRole('button', { name: 'Start the exercises' }).click()
  const before = await readHook(page)
  await page.getByRole('button', { name: 'Open the guidebook' }).click()
  const sheet = page.getByRole('dialog', { name: /Guidebook/ })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('tab', { name: /Words/ }).click()
  await expect(sheet.getByRole('listitem').first()).toBeVisible()
  await sheet.getByRole('button', { name: 'Close guidebook' }).click()
  await expect(sheet).toBeHidden()
  expect((await readHook(page)).index).toBe(before.index)
  // the journey row's book opens the guidebook before boarding, even for a lesson already started
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Buenos Aires' })).toBeVisible()
  await page.getByRole('link', { name: 'Guidebook, lesson 1' }).first().click()
  await expect(page.getByText('Guidebook · before you board')).toBeVisible()
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
  // Wrong answers are pinned automatically for a focused re-test (speak exercises cannot be answered wrongly, so retry a few times).
  let pinnedSeen = false
  for (let i = 0; i < 6 && !pinnedSeen; i++) {
    await answerCurrent(page, false)
    pinnedSeen = await page.getByRole('status').getByRole('button', { name: /Pinned/ }).isVisible()
    await continueFeedback(page)
  }
  expect(pinnedSeen).toBe(true)
  await page.goto('./#/review?tab=pinned')
  await expect(page.getByText(/pinned mistakes? waiting/)).toBeVisible()
  await page.getByRole('button', { name: 'Practise pinned' }).click()
  const pinned = await readHook(page)
  expect(pinned.total).toBeGreaterThan(0)
  await expect(page.getByText('Pinned: your mistakes')).toBeVisible()
  await answerCurrent(page, true)
  await page.screenshot({ path: 'e2e/__screenshots__/pinned.png' })
})

test('tabs remember their scroll position', async ({ page }) => {
  await openPath(page)
  // The top bar leads back to the Pawsport hub (all languages).
  await expect(page.getByRole('link', { name: /All languages/ })).toHaveAttribute('href', SITE_BASE)
  await expect(page.getByRole('heading', { name: 'Fin del mundo' })).toBeAttached()
  await page.evaluate(() => window.scrollTo(0, 1500))
  await page.waitForFunction(() => window.scrollY > 1000)
  await page.getByRole('link', { name: 'Review' }).click()
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
  await page.getByRole('link', { name: 'Journey', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Buenos Aires' })).toBeAttached()
  await page.waitForFunction(() => window.scrollY > 1000)
})

test('region quiz, vocabulary games and the dogs page load', async ({ page }) => {
  test.setTimeout(180_000)
  await openPath(page)
  await page.goto('./#/quiz/a1')
  await expect(page.getByText(/Region quiz · Buenos Aires/)).toBeVisible()
  await expect(page.getByRole('radio').first()).toBeVisible({ timeout: 20_000 })
  const groups = page.getByRole('radiogroup')
  const n = await groups.count()
  expect(n).toBe(12)
  for (let i = 0; i < n; i++) await groups.nth(i).getByRole('radio').first().click()
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByRole('status')).toContainText(/of 12 correct/)
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.getByRole('heading', { name: /Muy bien|Not yet/ })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/quiz.png' })
  await page.getByRole('button', { name: 'Back to the course' }).click()
  await expect(page.getByRole('heading', { name: 'Buenos Aires' })).toBeVisible()

  await page.goto('./#/perros')
  await expect(page.getByRole('heading', { name: 'Los perros' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Bonchita' })).toBeVisible()
  await expect(page.getByText('Find it on a quest').first()).toBeVisible()
  await page.getByRole('button', { name: /Leo says hello/ }).first().click()
  await page.screenshot({ path: 'e2e/__screenshots__/perros.png' })

  await page.goto('./#/games')
  await expect(page.getByRole('heading', { name: 'Mini games' })).toBeVisible()
  await page.getByRole('button', { name: /Memoria/ }).click()
  await expect(page.getByText(/Not enough words yet|pairs ·/)).toBeVisible()
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
  await page.goto('./#/review')
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
  const practise = page.getByRole('button', { name: /practise anyway|Start review/ })
  await practise.first().click()
  const hook = await readHook(page)
  expect(hook.total).toBeGreaterThan(0)
  await answerCurrent(page, true)
  await page.screenshot({ path: 'e2e/__screenshots__/review.png' })

  await page.goto('./#/grammar')
  await expect(page.getByRole('heading', { name: 'Grammar' })).toBeVisible()
  await page.getByLabel('Search grammar').fill('gustar')
  await page.getByRole('link', { name: /Me gusta — liking things/ }).click()
  await expect(page.getByText('to be pleasing')).toBeVisible()

  await page.goto('./#/verbs')
  await expect(page.getByText('soy')).toBeVisible()
  await page.getByLabel('Verb').fill('tener')
  await page.getByLabel('Verb').press('Enter')
  await expect(page.getByText('tengo')).toBeVisible()

  await page.goto('./#/reader')
  await page.getByRole('link', { name: /Mi familia y yo/ }).click()
  await expect(page.getByText(/You know \d+% of the words/)).toBeVisible()
  await page.locator('article button', { hasText: /^familia$/ }).first().click()
  await expect(page.getByRole('dialog').getByText('family')).toBeVisible()

  await page.goto('./#/profile')
  await expect(page.getByRole('heading', { name: 'Your progress' })).toBeVisible()
  await expect(page.getByText('Rhythm')).toBeVisible()
})

test('pronunciation lesson and settings load', async ({ page }) => {
  await page.goto('./#/pronunciation')
  await page.getByRole('link', { name: /The five vowels/ }).click()
  await expect(page.getByText('Minimal pairs')).toBeVisible()
  await page.goto('./#/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByLabel(/Lesson length/)).toBeVisible()
  await expect(page.getByRole('switch', { name: /Modo picante/ })).not.toBeChecked()
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
  // Base-relative so the URL stays inside the course's service worker scope (/aprende/spanish/).
  await page.goto('./#/grammar')
  await expect(page.getByRole('heading', { name: 'Grammar' })).toBeVisible()
  await context.setOffline(false)
})

test('placement test places a strong learner at C2: earlier levels stay open, C2 starts at its first lesson', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('./')
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
  // only the current level's stops are drawn; the others open on demand
  await expect(page.locator('#lesson-c2\\.u01\\.l1')).toBeAttached()
  await expect(page.locator('#lesson-b1\\.u01\\.l1')).toHaveCount(0)
  for (const lv of ['b1', 'a2']) await page.locator(`#region-${lv}`).getByRole('button', { name: /^Show the \d+ stops of/ }).click()
  // B1 lessons are open, and an A2 lesson deep in the level is open for practice.
  await expect(page.getByRole('link', { name: /Formas regulares/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Habla, come, escribe/ })).toBeVisible()
  // C2 is the established level: its first lesson is open (and up next), the one after it is locked.
  await expect(page.locator('#lesson-c2\\.u01\\.l1').getByRole('link', { name: /, practice$/ })).toBeAttached()
  await expect(page.locator('#lesson-c2\\.u01\\.l2')).toHaveAttribute('aria-label', /: locked$/)
  await expect(page.getByRole('link', { name: /Board: lesson 1 of/ })).toBeVisible()
})

test('choosing a level manually marks the recommended start; earlier levels are open, later ones locked', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('button', { name: /I know my level/ })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/welcome.png' })
  await page.getByRole('button', { name: /I know my level/ }).click()
  await page.getByRole('button', { name: /^A2/ }).click()
  await expect(page.getByRole('heading', { name: 'A1' })).toHaveCount(0)
  await expect(page.getByText('Recommended start')).toBeVisible()
  await expect(page.getByRole('link', { name: /¿Qué hiciste ayer\?/ })).toBeVisible()
  // A1 stays open for practice; A2 is sequential from its first lesson, so B1 waits.
  for (const lv of ['a1', 'b1']) await page.locator(`#region-${lv}`).getByRole('button', { name: /^Show the \d+ stops of/ }).click()
  await expect(page.getByRole('link', { name: /Hola y adiós/ })).toBeAttached()
  await expect(page.locator('#lesson-a2\\.u01\\.l2')).toHaveAttribute('aria-label', /: locked$/)
  await expect(page.getByRole('link', { name: /Formas regulares/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Formas regulares — hable, coma, viva: locked, practice/ })).toBeDisabled()
  // border control is open and passing it skips ahead
  await expect(page.getByRole('link', { name: /Border control, level check A2/ })).toContainText('pass it to skip ahead to B1')
  // Passport page lists stops and souvenirs.
  await page.getByRole('link', { name: 'Passport' }).click()
  await expect(page.getByRole('heading', { name: 'Passport' })).toBeVisible()
  await expect(page.getByText(/souvenirs of/)).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/passport.png' })
})

test('checkpoint quiz after a stop: reading, writing, all correct clears it', async ({ page }) => {
  test.setTimeout(180_000)
  await openPath(page)
  await page.goto('./#/checkpoint/a1.u01')
  await expect(page.getByText('Checkpoint · Stop 1')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Aeropuerto de Ezeiza' })).toBeVisible()
  await expect(page.getByText('Reading', { exact: true })).toBeVisible()
  await expect(page.getByText('Writing', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start the checkpoint' }).click()
  // The first questions are on a passage from the stop.
  const first = await readHook(page)
  expect(first.total).toBeGreaterThanOrEqual(8)
  await expect(page.getByRole('figure', { name: 'Reading passage' })).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/checkpoint-reading.png' })
  let guard = 0
  while (guard++ < 20) {
    const hook = await readHook(page)
    await answerCurrent(page, true)
    const last = hook.index + 1 >= hook.total
    await continueFeedback(page)
    if (last) break
  }
  await expect(page.getByText('Checkpoint cleared')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('100%', { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: 'e2e/__screenshots__/checkpoint.png' })
  await page.getByRole('button', { name: 'Back to the journey' }).click()
  await expect(page.getByRole('heading', { name: 'Buenos Aires' })).toBeVisible()
})

test('after two starts that never finished, the course opens in safe mode and the hub says where it stopped', async ({ page }) => {
  await openPath(page)
  // two earlier starts died while drawing the journey (the phone killed the page)
  await page.evaluate(() => localStorage.setItem('pawsport:boot:spanish', JSON.stringify({ stage: 'journey', failed: 1, at: Date.now() })))
  await page.goto(SITE_BASE)
  await page.getByText("A language won't open?").click()
  await expect(page.getByText(/Last start stopped after drawing the journey · 2 failed starts/)).toBeVisible()
  await page.goto('./')
  await expect(page.getByRole('status').filter({ hasText: 'Safe mode' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Buenos Aires' })).toBeVisible()
  // no service worker in safe mode
  await page.waitForTimeout(1500)
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).filter((r) => r.scope.endsWith('/spanish/')).length)).toBe(0)
  // a start that stays up counts as good, and "Back to normal mode" leaves safe mode
  await page.getByRole('button', { name: 'Back to normal mode' }).click()
  await expect(page.getByRole('heading', { name: 'Buenos Aires' })).toBeVisible()
  await expect(page.getByText('Safe mode')).toHaveCount(0)
})
