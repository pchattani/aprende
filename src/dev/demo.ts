/**
 * Demo learner for screenshots, reviews and end-to-end tests. Never imported
 * statically: main.tsx loads it on demand when `?demo` is in the URL or
 * sessionStorage has e2e=1, and exposes `window.__pawsportDemo = seedDemo`.
 *
 * The current course is simulated on its real content (levels, lessons, vocab,
 * grammar ids, sentence ids), so titles resolve in the UI. Sister-course
 * databases get lighter synthetic histories for the cross-language hub.
 *
 * The learner has a latent memory model that the scheduler does not know:
 * recall decays as (1 + t / 14S)^−1 with a personal stability S per item that
 * grows on success and collapses on a lapse; harder grammar points are recalled
 * worse and stabilise slower; listening is a little weaker; evenings are
 * stronger than late nights; accuracy fades after ~12 minutes in a session.
 * The history has lighter weekends, one five-day break and a partial session today.
 */
import { AprendeDB, db as courseDb } from '../db'
import { DB_NAME } from '../engine/course'
import { levels, loadLesson } from '../engine/loader'
import { sentenceId, exchangeId, textId } from '../engine/generate'
import { kindsFor } from '../engine/ladder'
import { newCard, review, Rating } from '../engine/srs'
import { Rng, hashString } from '../engine/random'
import { todayKey } from '../engine/mastery'
import { xpFor } from '../engine/xp'
import type { ItemSpec } from '../db/progress'
import type { CardRow, DayRow, LessonRow, ReviewRow, Stage } from '../engine/types'
import type { ExerciseKind, LevelId } from '../engine/schema'

const DAY = 86_400_000
const MIN = 60_000

export interface SeedOptions {
  /** Days of history for the current course (default 75). */
  days?: number
  seed?: number
  /** Also seed sister-course databases for the hub (default true). */
  others?: boolean
  /** Reference time (default now). */
  now?: number
  /** Lessons after the finished ones that were started and left halfway: cards, but no completion (default 0). */
  started?: number
}

interface SimLesson {
  id: string
  unitId: string
  level: LevelId
  items: ItemSpec[]
}

interface Latent {
  /** True stability in days (R = 0.9 after S days). */
  s: number
  last: number
  ease: number
}

export interface SimResult {
  cards: CardRow[]
  reviews: ReviewRow[]
  days: DayRow[]
  lessons: LessonRow[]
}

interface SimProfile {
  days: number
  /** Five-day break, as days-ago of its first day (undefined for none). */
  breakAt?: number
  lessonRate: number
  reviewCap: number
  hard: ReadonlySet<string>
  seed: number
  now: number
}

/** Lessons of the current course in order, with the items Lesson.tsx creates for each. */
async function courseLessons(limit: number): Promise<SimLesson[]> {
  const out: SimLesson[] = []
  for (const lvl of levels) {
    for (const u of lvl.units) {
      if (!u.authored) continue
      for (let n = 1; n <= 6 && out.length < limit; n++) {
        const id = `${u.id}.l${n}`
        let lesson
        try {
          lesson = (await loadLesson(id)).lesson
        } catch {
          break
        }
        const level = lvl.id
        out.push({
          id, unitId: u.id, level,
          items: [
            ...lesson.vocab.map((v) => ({ id: v, kind: 'word' as const, level, lessonId: id, grammar: [] as string[] })),
            ...lesson.sentences.map((s, i) => ({ id: sentenceId(id, i, s), kind: 'sentence' as const, level, lessonId: id, grammar: s.grammar })),
            ...lesson.exchanges.map((x, i) => ({ id: exchangeId(id, i), kind: 'sentence' as const, level, lessonId: id, grammar: x.grammar })),
            ...lesson.texts.map((t, i) => ({ id: textId(id, i), kind: 'sentence' as const, level, lessonId: id, grammar: t.grammar })),
            ...lesson.teach.map((g) => ({ id: g, kind: 'grammar' as const, level, lessonId: id, grammar: [g] })),
          ],
        })
      }
      if (out.length >= limit) return out
    }
  }
  return out
}

/** Synthetic lessons for a sister course (ids only; enough for the hub's summary). */
function syntheticLessons(code: string, count: number): SimLesson[] {
  return Array.from({ length: count }, (_, i) => {
    const unit = `a1.u${String(Math.floor(i / 4) + 1).padStart(2, '0')}`
    const id = `${unit}.l${(i % 4) + 1}`
    const g = `g.${code}-point-${Math.floor(i / 2) + 1}`
    const items: ItemSpec[] = [
      ...Array.from({ length: 10 }, (_, k) => ({ id: `w.${code}-${i}-${k}`, kind: 'word' as const, level: 'a1' as LevelId, lessonId: id, grammar: [] as string[] })),
      ...Array.from({ length: 8 }, (_, k) => ({ id: `s.${id}.${k + 1}`, kind: 'sentence' as const, level: 'a1' as LevelId, lessonId: id, grammar: [g] })),
      ...(i % 2 === 0 ? [{ id: g, kind: 'grammar' as const, level: 'a1' as LevelId, lessonId: id, grammar: [g] }] : []),
    ]
    return { id, unitId: unit, level: 'a1' as LevelId, items }
  })
}

/** Run the latent learner through `profile.days` days of practice. */
export function simulate(lessonsIn: readonly SimLesson[], profile: SimProfile): SimResult {
  const rng = new Rng(profile.seed)
  const gauss = () => {
    const u = Math.max(1e-9, rng.next())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
  }
  const cards = new Map<string, CardRow>()
  const latent = new Map<string, Latent>()
  const reviews: ReviewRow[] = []
  const days = new Map<string, DayRow>()
  const lessonRows = new Map<string, LessonRow>()
  let nextLesson = 0
  const today = new Date(profile.now)
  const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  const dayRow = (ts: number) => {
    const k = todayKey(new Date(ts))
    let d = days.get(k)
    if (!d) {
      d = { date: k, xp: 0, reviews: 0, lessons: 0, newItems: 0, minutes: 0, perfect: 0 }
      days.set(k, d)
    }
    return d
  }
  const isHard = (c: CardRow) => c.grammar.some((g) => profile.hard.has(g))

  /** Probability that the learner answers this card right now. */
  function pCorrect(c: CardRow, kind: ExerciseKind, ts: number, minuteInSession: number): number {
    const lat = latent.get(c.id)!
    let p: number
    if (c.reps === 0) p = 0.84
    else {
      const t = Math.max(0, (ts - lat.last) / DAY)
      p = 1 / (1 + t / (14 * lat.s))
      p = 0.02 + 0.97 * p
    }
    if (isHard(c)) p -= 0.15
    if (kind === 'listen' || kind === 'dictation') p -= 0.06
    if (kind === 'typeEs' || kind === 'conjugate' || kind === 'transform') p -= 0.02
    const h = new Date(ts).getHours()
    if (h >= 22 || h < 5) p -= 0.07
    else if (h >= 18) p += 0.04
    else if (h < 10) p -= 0.03
    if (minuteInSession > 12) p -= Math.min(0.12, 0.012 * (minuteInSession - 12))
    return Math.min(0.99, Math.max(0.04, p))
  }

  function ensure(spec: ItemSpec, ts: number): CardRow {
    let c = cards.get(spec.id)
    if (!c) {
      c = newCard(spec.id, spec.kind, spec.level, spec.lessonId, spec.grammar, new Date(ts))
      cards.set(spec.id, c)
      const hard = spec.grammar.some((g) => profile.hard.has(g))
      latent.set(spec.id, { s: 1.6 * Math.exp(0.3 * gauss()) * (hard ? 0.6 : 1), last: ts, ease: Math.exp(0.2 * gauss()) * (hard ? 0.75 : 1) })
    }
    return c
  }

  /** One exercise on `primary`: the grammar cards it exercises are credited with the same verdict. */
  function answer(primary: CardRow, ts: number, minuteInSession: number): boolean {
    const kinds = kindsFor(primary.kind, primary.stage as Stage)
    const kind = rng.pick(kinds)
    const correct = rng.next() < pCorrect(primary, kind, ts, minuteInSession)
    const fast = correct && rng.next() < 0.12
    const almost = correct && !fast && rng.next() < 0.06
    const grade = !correct ? Rating.Again : almost ? Rating.Hard : fast ? Rating.Easy : Rating.Good
    const credited = [primary.id, ...primary.grammar.filter((g) => g !== primary.id && cards.has(g))]
    for (const id of credited) {
      const c = cards.get(id)!
      const lat = latent.get(id)!
      const first = c.reps === 0
      if (first) dayRow(ts).newItems++
      // Latent memory update (unknown to the scheduler).
      const t = Math.max(0, (ts - lat.last) / DAY)
      const pm = c.reps === 0 ? 0.5 : 1 / (1 + t / (14 * lat.s))
      // Spaced successes consolidate (more so when recall was effortful); same-day repeats barely do; a lapse loses about half.
      if (correct) lat.s = Math.min(400, t < 0.3 ? lat.s * 1.08 + 0.05 : lat.s * (1.5 + (2.4 * (1 - pm) + 0.4 * rng.next()) * lat.ease))
      else lat.s = Math.max(0.3, lat.s * 0.45)
      lat.last = ts
      cards.set(id, review(c, grade, new Date(ts)))
      reviews.push({ cardId: id, ts, rating: grade as 1 | 2 | 3 | 4, correct, exercise: kind, grammar: c.grammar })
      dayRow(ts).reviews++
    }
    return correct
  }

  function session(start: number, plan: { reviewCap: number; lesson: boolean; maxMinutes: number }): number {
    let ts = start
    // Review answers are quicker than new lesson material.
    let pace = [8, 9]
    const step = () => (ts += (pace[0]! + rng.int(pace[1]!)) * 1000)
    const minute = () => (ts - start) / MIN
    let answered = 0
    let right = 0
    // Reviews first: whatever the scheduler says is due, oldest first.
    const due = [...cards.values()].filter((c) => c.due <= ts).sort((a, b) => a.due - b.due).slice(0, plan.reviewCap)
    for (const c of due) {
      if (minute() > plan.maxMinutes || ts > profile.now - 5 * MIN) break
      answered++
      if (answer(cards.get(c.id)!, step(), minute())) right++
    }
    if (answered) {
      const d = dayRow(start)
      d.xp += xpFor({ correct: right, almost: 0, wrong: answered - right, completed: true })
    }
    // Then the next lesson in course order: every item once, the grammar note first.
    const L = lessonsIn[nextLesson]
    // A diligent learner skips new material while a real backlog remains.
    const stillDue = [...cards.values()].filter((c) => c.due <= ts).length
    if (plan.lesson && L && stillDue <= 40 && ts < profile.now - 20 * MIN) {
      const lStart = ts
      pace = [13, 12]
      let ok = 0
      let wrong = 0
      const items = [...L.items.filter((i) => i.kind === 'grammar'), ...rng.shuffle(L.items.filter((i) => i.kind !== 'grammar'))]
      for (const spec of items) ensure(spec, ts)
      const missed: ItemSpec[] = []
      for (const spec of items.filter((i) => i.kind !== 'grammar')) {
        if (answer(cards.get(spec.id)!, step(), minute())) ok++
        else {
          wrong++
          missed.push(spec)
        }
      }
      // Wrong answers come back once at the end of the lesson, as in the runner.
      for (const spec of missed) answer(cards.get(spec.id)!, step(), minute())
      const row = lessonRows.get(L.id) ?? { id: L.id, unitId: L.unitId, level: L.level, attempts: 0, completions: 0, bestAccuracy: 0, lastAccuracy: 0, xp: 0 }
      const acc = ok / Math.max(1, ok + wrong)
      const xp = xpFor({ correct: ok, almost: 0, wrong, completed: true })
      row.attempts++
      row.completions++
      row.bestAccuracy = Math.max(row.bestAccuracy, acc)
      row.lastAccuracy = acc
      row.firstCompleted ??= ts
      row.lastCompleted = ts
      row.xp += xp
      lessonRows.set(L.id, row)
      const d = dayRow(lStart)
      d.lessons++
      d.xp += xp
      if (wrong === 0) d.perfect = (d.perfect ?? 0) + 1
      nextLesson++
    }
    const minutes = Math.max(1, Math.round((ts - start) / MIN))
    dayRow(start).minutes += minutes
    return ts
  }

  for (let ago = profile.days - 1; ago >= 0; ago--) {
    const dayStart = day0 - ago * DAY
    const date = new Date(dayStart)
    const weekend = date.getDay() === 0 || date.getDay() === 6
    if (profile.breakAt !== undefined && ago <= profile.breakAt && ago > profile.breakAt - 5) continue
    if (ago > 0 && rng.next() > (weekend ? 0.62 : 0.93)) continue
    const nSessions = ago === 0 ? 1 : rng.next() < (weekend ? 0.15 : 0.35) ? 2 : 1
    let earliest = dayStart + 7 * 3600_000
    for (let s = 0; s < nSessions; s++) {
      const r = rng.next()
      const hour = ago === 0 ? 8 + rng.next() : s === 0 && nSessions === 2 ? 7 + rng.next() * 1.5 : r < 0.58 ? 18 + rng.next() * 3 : r < 0.78 ? 22 + rng.next() * 1.5 : r < 0.9 ? 12.5 + rng.next() : 7 + rng.next() * 1.5
      const start = Math.max(earliest, dayStart + hour * 3600_000)
      if (start > profile.now - 25 * MIN) break
      const end = session(start, {
        reviewCap: ago === 0 ? 25 : Math.round(profile.reviewCap * (weekend ? 0.6 : 1) * (0.8 + 0.4 * rng.next())),
        lesson: ago !== 0 && s === nSessions - 1 && rng.next() < profile.lessonRate * (weekend ? 0.6 : 1),
        maxMinutes: weekend ? 16 : 24 + rng.int(10),
      })
      earliest = end + 40 * MIN
    }
  }
  return { cards: [...cards.values()], reviews, days: [...days.values()], lessons: [...lessonRows.values()] }
}

/** Grammar points the latent learner finds hard: the classic stumbling blocks among those taught early. */
function hardGrammar(lessons: readonly SimLesson[]): Set<string> {
  const taught = [...new Set(lessons.flatMap((l) => l.items.filter((i) => i.kind === 'grammar').map((i) => i.id)))]
  const pattern = /(ser-estar|estar|gustar|reflex|por-para|preterit|imperfect|subj|object|pronoun|tones|gender|partitive|clitic)/
  const picked = taught.filter((g) => pattern.test(g)).slice(0, 4)
  for (const g of taught) {
    if (picked.length >= 4) break
    if (!picked.includes(g) && hashString(g) % 4 === 0) picked.push(g)
  }
  return new Set(picked)
}

async function writeDb(target: AprendeDB, sim: SimResult, startLevel: LevelId): Promise<void> {
  const tables = [target.cards, target.reviews, target.lessons, target.days, target.reading, target.exams, target.kv, target.quests, target.souvenirs, target.pins]
  await target.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
    await target.cards.bulkAdd(sim.cards)
    await target.reviews.bulkAdd(sim.reviews)
    await target.days.bulkAdd(sim.days)
    await target.lessons.bulkAdd(sim.lessons)
    await target.kv.bulkPut([
      { key: 'onboarded', value: true },
      { key: 'startLevel', value: startLevel },
    ])
  })
}

/** The next `n` lessons after the finished ones, started and left halfway: their cards exist, the lesson is not completed. */
export function startLessons(sim: SimResult, lessons: readonly SimLesson[], n: number, now: number): void {
  const done = new Set(sim.lessons.map((l) => l.id))
  const have = new Set(sim.cards.map((c) => c.id))
  const ts = now - 2 * 3600_000
  for (const L of lessons.filter((l) => !done.has(l.id)).slice(0, n)) {
    for (const spec of L.items) {
      if (have.has(spec.id)) continue
      have.add(spec.id)
      sim.cards.push(newCard(spec.id, spec.kind, spec.level, spec.lessonId, spec.grammar, new Date(ts)))
    }
    sim.lessons.push({ id: L.id, unitId: L.unitId, level: L.level, attempts: 1, completions: 0, bestAccuracy: 0, lastAccuracy: 0.5, xp: 0 })
  }
}

/** Course databases of the sister courses (Spanish keeps its original name). */
const SISTERS: { code: string; name: string; days: number; lessons: number }[] = [
  { code: 'es', name: 'aprende', days: 45, lessons: 24 },
  { code: 'fr', name: 'aprende-fr', days: 30, lessons: 16 },
  { code: 'it', name: 'aprende-it', days: 8, lessons: 5 },
]

/** Seed the demo learner. Returns a short summary of what was written. */
export async function seedDemo(opts: SeedOptions = {}): Promise<{ db: string; cards: number; reviews: number; days: number; lessons: number; others: string[] }> {
  const now = opts.now ?? Date.now()
  const nDays = opts.days ?? 75
  const lessons = await courseLessons(60)
  const sim = simulate(lessons, { days: nDays, breakAt: Math.round(nDays * 0.5), lessonRate: 0.62, reviewCap: 120, hard: hardGrammar(lessons), seed: opts.seed ?? 20261016, now })
  if (opts.started) startLessons(sim, lessons, opts.started, now)
  await writeDb(courseDb, sim, 'a1')
  const others: string[] = []
  if (opts.others !== false) {
    for (const s of SISTERS) {
      if (s.name === DB_NAME) continue
      const syn = syntheticLessons(s.code, s.lessons)
      const out = simulate(syn, { days: s.days, breakAt: s.days > 20 ? Math.round(s.days * 0.4) : undefined, lessonRate: 0.6, reviewCap: 90, hard: new Set([`g.${s.code}-point-2`]), seed: hashString(s.name), now })
      const target = new AprendeDB(s.name)
      try {
        await writeDb(target, out, 'a1')
        others.push(s.name)
      } finally {
        target.close()
      }
    }
  }
  return { db: DB_NAME, cards: sim.cards.length, reviews: sim.reviews.length, days: sim.days.length, lessons: sim.lessons.length, others }
}
