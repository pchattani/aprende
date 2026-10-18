import { test, expect } from '@playwright/test'
import { enableTestHook } from './helpers'

// Listening practice: Read & listen → Listen → the first piece. Audio is a no-op in e2e
// (sessionStorage.e2e): each line "plays" for a moment so auto-advance runs through the piece.

test.beforeEach(async ({ page }) => {
  await enableTestHook(page)
})

test('listen: switch to Listen, play the first piece with the transcript hidden, answer the questions', async ({ page }) => {
  await page.goto('./#/reader')
  await expect(page.getByRole('heading', { name: 'Read & listen' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Read' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Listen' }).click()
  await expect(page.getByRole('tab', { name: 'Listen' })).toHaveAttribute('aria-selected', 'true')

  const first = page.locator('a[href^="#/listen/"]').first()
  await expect(first).toBeVisible()
  const title = (await first.locator('p').first().textContent())!.trim()
  await first.click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  // No text by default: the transcript is hidden behind a switch.
  const toggle = page.getByRole('switch', { name: 'Show transcript' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByTestId('transcript-hidden')).toBeVisible()
  const transcript = page.getByRole('region', { name: 'Transcript' })
  await expect(transcript.locator('[lang^="es"]')).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(transcript.locator('[lang^="es"]').first()).toBeVisible()
  await page.getByRole('switch', { name: 'English translation' }).click()
  await expect(transcript.locator('[lang="en"]').first()).toBeVisible()
  await toggle.click()
  await expect(page.getByTestId('transcript-hidden')).toBeVisible()

  // Play through: the questions open when every line has been heard.
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByText('End of the piece · questions below')).toBeVisible({ timeout: 15_000 })
  const questions = page.getByRole('region', { name: 'Questions' })
  await expect(questions.getByRole('heading', { name: 'Check what you understood' })).toBeVisible()

  const groups = questions.getByRole('radiogroup')
  const n = await groups.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) await groups.nth(i).getByRole('radio').first().click()
  await questions.getByLabel('What you heard').fill('hola')
  await questions.getByRole('button', { name: 'Check' }).click()
  await questions.getByRole('button', { name: 'See my score' }).click()
  const score = page.getByRole('status', { name: 'Score' })
  await expect(score).toBeVisible()
  await expect(score.getByText(new RegExp(`^\\d+/${n + 1}$`))).toBeVisible()

  // The best score shows on the list.
  await page.getByRole('link', { name: 'Back to the list' }).click()
  await expect(page.getByRole('tab', { name: 'Listen' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('a[href^="#/listen/"]').first().getByText(/%/)).toBeVisible()
})

test('listen: the transcript preference is remembered from Settings', async ({ page }) => {
  await page.goto('./#/settings')
  await page.getByRole('switch', { name: /Show transcript while listening/ }).check()
  await page.goto('./#/reader?tab=listen')
  await page.locator('a[href^="#/listen/"]').first().click()
  await expect(page.getByRole('switch', { name: 'Show transcript' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('region', { name: 'Transcript' }).locator('[lang^="es"]').first()).toBeVisible()
})
