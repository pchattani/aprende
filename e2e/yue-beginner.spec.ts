/**
 * Cantonese for complete beginners (VITE_LANG=yue, features.taughtOnly): the first lesson only shows or
 * plays Cantonese made of the words it teaches (一 二 三 四 五); the sums are asked in English. Answers the
 * whole of a1.u13.l1 through the test hook and checks every exercise before it is answered.
 */
import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { load } from 'js-yaml'
import { enableTestHook, readHook, answerCurrent, continueFeedback, type HookExercise } from './helpers'

const LANG = process.env.VITE_LANG ?? 'es'
test.skip(LANG !== 'yue', 'Cantonese only')

const LESSON = 'a1.u13.l1'
const SHOTS = process.env.SHOTS_DIR
const HAN = /\p{Script=Han}/u
// sentence-final particles are not counted by the gate (src/engine/taught.ts FINAL_PARTICLES)
const PARTICLES = '呀啊啦喇嘞嗎呢吖喎囉㗎啫嘛噃啩哦喔咯囖'

/** Characters of the words the first lesson teaches (read from the content, like sister.spec.ts). */
function taughtChars(): Set<string> {
  const unit = load(readFileSync('content/yue/units/a1/u13.yaml', 'utf8')) as { lessons: { id: string; vocab: string[] }[] }
  const ids = new Set(unit.lessons.find((l) => l.id === LESSON)!.vocab)
  const lemmas = readdirSync('content/yue/vocab').flatMap((f) => (load(readFileSync(`content/yue/vocab/${f}`, 'utf8')) as { id: string; lemma: string }[]).filter((v) => ids.has(v.id)).map((v) => v.lemma))
  return new Set(lemmas.flatMap((l) => [...l]))
}

/** Cantonese the exercise shows or plays to be understood before answering (pictograms and characters to write aside). */
function shownCantonese(ex: HookExercise & { prompt?: string; askEn?: boolean }): string[] {
  const out: (string | undefined)[] = []
  if (['pictogram', 'trace', 'writeChar'].includes(ex.kind)) return []
  if (!ex.askEn) out.push(ex.prompt, ex.audio)
  if (['choiceEn', 'reply', 'fillBlank', 'hearChar'].includes(ex.kind)) out.push(...(ex.options ?? []))
  out.push(...(ex.tiles ?? []), ...(ex.pairs ?? []).map((p) => p.left))
  return out.filter((t): t is string => Boolean(t) && HAN.test(t!))
}

test.beforeEach(async ({ page }) => {
  await enableTestHook(page)
})

test('a1.u13.l1 shows only taught Cantonese and asks the sums in English', async ({ page }) => {
  test.setTimeout(240_000)
  const allowed = taughtChars()
  expect([...allowed].sort().join('')).toBe([...'一二三四五'].sort().join(''))
  if (SHOTS) mkdirSync(SHOTS, { recursive: true })
  await page.goto('./')
  await page.getByRole('button', { name: /I'm new to Cantonese/ }).click()
  await page.waitForURL(/#\/$/)
  await page.goto(`./#/lesson/${LESSON}`)
  const start = page.getByRole('button', { name: 'Start the exercises' })
  await page.waitForFunction(() => Boolean((window as unknown as { __aprende?: unknown }).__aprende) || [...document.querySelectorAll('button')].some((b) => b.textContent === 'Start the exercises'))
  if (await start.isVisible()) await start.click()

  const kinds: string[] = []
  const shot = new Set<string>()
  for (let guard = 0; guard < 40; guard++) {
    const hook = await readHook(page)
    const ex = hook.exercise as HookExercise & { prompt?: string; askEn?: boolean }
    kinds.push(ex.askEn ? `${ex.kind}:en` : ex.kind)
    for (const text of shownCantonese(ex)) {
      const untaught = [...text].filter((c) => HAN.test(c) && !allowed.has(c) && !PARTICLES.includes(c))
      expect(untaught, `${ex.kind} shows “${text}”`).toEqual([])
    }
    if (ex.askEn) {
      // an English question: no Cantonese prompt and nothing played before answering
      await expect(page.getByRole('heading', { name: 'Answer in Cantonese' })).toBeVisible()
      await expect(page.getByText(ex.prompt!, { exact: true })).toBeVisible()
    }
    const name = ex.askEn ? 'english-asked' : ex.kind === 'match' ? 'match' : ex.kind === 'hearChar' ? 'sound-to-word' : undefined
    if (SHOTS && name && !shot.has(name)) {
      shot.add(name)
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${SHOTS}/${LESSON}-${name}.png` })
    }
    const last = hook.index + 1 >= hook.total
    await answerCurrent(page, true)
    if (SHOTS && ex.askEn && !shot.has('english-asked-answer')) {
      shot.add('english-asked-answer')
      await page.screenshot({ path: `${SHOTS}/${LESSON}-english-asked-answer.png` })
    }
    await continueFeedback(page)
    if (last) break
  }
  expect(kinds).toContain('match')
  expect(kinds).toContain('hearChar')
  expect(kinds.filter((k) => k.endsWith(':en')).length).toBeGreaterThanOrEqual(1)
  await expect(page.getByText(/^\d+%$/)).toBeVisible({ timeout: 15_000 })
})
