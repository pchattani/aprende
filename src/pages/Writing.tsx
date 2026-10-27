/**
 * A stop's writing prompts (/writing/:unitId), after its lessons: 3–5 short writing tasks at
 * the stop's level, one at a time. Write, "Check my writing", then read the stamp, the four
 * category bars and the text with its issues marked (tap one for the reason and, where it is
 * safe, apply the fix); revise and check again (the best score is kept), see a model answer,
 * go on to the next prompt, and end with a summary of the set. Drafts and best results live
 * in kv `writing:<unitId>`; coins, km and minutes follow the economy (engine/economy.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import type { Unit, WritingPrompt } from '../engine/schema'
import { loadUnit, levelOf, units, grammar, vocab, known } from '../engine/loader'
import { isWritingOpen } from '../engine/unlock'
import { getKv, setKv, awardCoins, bumpDay, totalKm, lessonRows } from '../db/progress'
import { WRITING_PASS, WRITING_CATEGORIES, applySuggestion, stampLabel, issueLabel, type WritingCategory, type WritingIssue, type WritingResult } from '../engine/writing'
import { scoreFor, writingKey, writingSummary, type WritingRecord, type WritingPromptRecord } from '../hooks/useWriting'
import { writingCoins, levelUpCoins } from '../engine/economy'
import { writingXp } from '../engine/xp'
import { levelsCrossed } from '../engine/traveller'
import { todayKey } from '../engine/mastery'
import { stopFor } from '../engine/journey'
import { rememberReturn } from '../engine/returnTo'
import { playSound } from '../engine/sounds'
import { TL, LANGUAGE, SPECIAL_CHARS, FEATURES } from '../engine/course'
import { Button, SpeakerButton } from '../components/ui/basics'
import { IconArrowLeft, IconCheck, IconLock, IconX } from '../components/ui/icons'
import { ChunkyBar } from '../components/map/LegBar'
import { CoinChip, CoinAmount } from '../components/rewards/Coin'
import { Confetti } from '../components/ui/Confetti'
import { TargetText } from '../components/ui/TargetText'
import { HighlightedText } from '../components/compose/HighlightedText'
import { PostcardPenArt, StampStars } from '../components/compose/WritingArt'

const HAN = /\p{Script=Han}/u
const CATEGORY_LABEL: Record<WritingCategory, string> = { task: 'Task', grammar: 'Grammar', spelling: FEATURES.romanization === 'jyutping' ? 'Characters' : 'Spelling', vocabulary: 'Vocabulary' }
const CATEGORY_BLURB: Record<WritingCategory, string> = {
  task: 'did what the prompt asks',
  grammar: 'agreement, verb forms, punctuation',
  spelling: FEATURES.romanization === 'jyutping' ? 'characters the course knows' : 'words and accents',
  vocabulary: "variety and the stop's words",
}

type View = 'write' | 'results' | 'summary'
interface Checked {
  result: WritingResult
  /** The text that was scored; `text` may differ after applying suggestions. */
  text: string
  /** Issues still showing (applied ones are removed, later spans shifted). */
  issues: WritingIssue[]
  edited: boolean
  coins: number
  improved: boolean
}

function blankPrompt(): WritingPromptRecord {
  return { draft: '', checks: 0 }
}

/** The first prompt not yet passed (or the first). */
function firstOpen(record: WritingRecord, count: number): number {
  for (let i = 0; i < count; i++) if ((record.prompts[String(i)]?.best ?? 0) < WRITING_PASS) return i
  return 0
}

export default function WritingPage() {
  const { unitId = '' } = useParams()
  const [params] = useSearchParams()
  const fromArea = params.get('from') === 'area'
  const nav = useNavigate()
  const level = levelOf(unitId)
  const where = stopFor(unitId)
  const stopName = where?.stop.name ?? units.get(unitId)?.title ?? unitId
  const [unit, setUnit] = useState<Unit>()
  const [record, setRecord] = useState<WritingRecord>()
  const [open, setOpen] = useState<{ open: boolean; done: number; total: number }>()
  const [error, setError] = useState<string>()
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState('')
  const [view, setView] = useState<View>('write')
  const [checked, setChecked] = useState<Checked>()
  const [selected, setSelected] = useState<number>()
  const [showModel, setShowModel] = useState(false)
  const [earned, setEarned] = useState(0)
  const lastFlush = useRef(0)
  const checkedOnce = useRef(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    lastFlush.current = Date.now()
    let alive = true
    ;(async () => {
      try {
        const u = await loadUnit(unitId)
        const rec = await getKv<WritingRecord>(writingKey(unitId), { prompts: {} })
        const rows = await lessonRows()
        const done = u.lessons.filter((l) => (rows.get(l.id)?.completions ?? 0) > 0).length
        const attempted = Object.values(rec.prompts).some((p) => p.checks > 0)
        if (!alive) return
        const start = firstOpen(rec, u.writing.length)
        setUnit(u)
        setRecord(rec)
        setOpen({ open: isWritingOpen(unitId, rows, u.lessons.length, attempted), done, total: u.lessons.length })
        setIdx(start)
        setText(rec.prompts[String(start)]?.draft ?? '')
        setShowModel(Boolean(rec.prompts[String(start)]?.seenModel))
      } catch (e) {
        if (alive) setError((e as Error).message)
      }
    })()
    return () => {
      alive = false
    }
  }, [unitId])

  /** Merge a change into the saved record (re-read first: another tab may have saved). */
  const save = useCallback(
    async (i: number, change: (p: WritingPromptRecord, r: WritingRecord) => void): Promise<WritingRecord> => {
      const rec = await getKv<WritingRecord>(writingKey(unitId), { prompts: {} })
      const p = { ...blankPrompt(), ...rec.prompts[String(i)] }
      change(p, rec)
      const next = { ...rec, prompts: { ...rec.prompts, [String(i)]: p } }
      await setKv(writingKey(unitId), next)
      setRecord(next)
      return next
    },
    [unitId],
  )

  // drafts are saved as the learner types
  const onText = (v: string) => {
    setText(v)
    if (checked && v !== checked.text) setChecked({ ...checked, edited: true })
    clearTimeout(saveTimer.current)
    const i = idx
    saveTimer.current = setTimeout(() => void save(i, (p) => (p.draft = v)), 400)
  }
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const back = () => {
    if (fromArea) return nav('/writing')
    rememberReturn(`writing-${unitId}`)
    nav('/', { state: { from: `writing-${unitId}` } })
  }

  const prompt: WritingPrompt | undefined = unit?.writing[idx]
  const promptRec = record?.prompts[String(idx)]

  const check = async () => {
    if (!unit || !prompt || !text.trim()) return
    clearTimeout(saveTimer.current)
    const prev = record?.prompts[String(idx)]
    const result = scoreFor(unit, prompt, text, Boolean(prev?.seenModel || showModel))
    const firstPass = !prev?.passed && result.overall >= WRITING_PASS
    const firstThreeStars = !prev?.starred && result.stars === 3
    const improved = prev?.best !== undefined && result.overall > prev.best
    const next = await save(idx, (p) => {
      p.draft = text
      p.checks += 1
      p.last = result.overall
      if (p.best === undefined || result.overall >= p.best) {
        p.best = result.overall
        p.bestStars = result.stars
        p.bestText = text
      }
      if (result.overall >= WRITING_PASS) p.passed = true
      if (result.stars === 3) p.starred = true
      p.date = todayKey()
    })
    // the whole set done for the first time
    const all = unit.writing.every((_, i) => next.prompts[String(i)]?.passed)
    const setDone = all && !next.setBonus
    if (setDone) {
      next.setBonus = true
      await setKv(writingKey(unitId), next)
      setRecord({ ...next })
    }
    const coins = writingCoins({ firstPass, firstThreeStars, setDone })
    // time spent writing counts for the day (at least a minute for a first check), with km for a pass
    const now = Date.now()
    const minutes = Math.max(checkedOnce.current ? 0 : 1, Math.round((now - lastFlush.current) / 60000))
    lastFlush.current = now
    checkedOnce.current = true
    const kmBefore = await totalKm()
    await bumpDay(todayKey(), { xp: writingXp(result.overall, firstPass, improved), minutes })
    const crossed = levelsCrossed(kmBefore, await totalKm())
    const levelCoins = crossed.reduce((n, l) => n + levelUpCoins(l), 0)
    if (coins) await awardCoins(coins, `writing:${unitId}#${idx + 1}`)
    if (levelCoins) await awardCoins(levelCoins, `level:${crossed.at(-1)}`)
    setEarned((e) => e + coins + levelCoins)
    if (result.overall >= WRITING_PASS) playSound('finish')
    setChecked({ result, text, issues: result.issues, edited: false, coins, improved })
    setSelected(undefined)
    setView('results')
    requestAnimationFrame(() => {
      window.scrollTo(0, 0)
      resultsHeading.current?.focus()
    })
  }

  const goTo = (i: number) => {
    setIdx(i)
    setText(record?.prompts[String(i)]?.draft ?? '')
    setShowModel(Boolean(record?.prompts[String(i)]?.seenModel))
    setChecked(undefined)
    setSelected(undefined)
    setView('write')
    window.scrollTo(0, 0)
  }

  const revealModel = async () => {
    setShowModel(true)
    await save(idx, (p) => (p.seenModel = true))
  }

  const apply = (k: number) => {
    if (!checked) return
    const x = checked.issues[k]
    if (!x?.safe || x.suggestion === undefined) return
    const nextText = applySuggestion(text, x)
    const delta = x.suggestion.length - (x.end - x.start)
    const issues = checked.issues.flatMap((y, j) => (j === k || (y.start < x.end && y.end > x.start) ? [] : y.start >= x.end ? [{ ...y, start: y.start + delta, end: y.end + delta }] : [y]))
    setChecked({ ...checked, issues, edited: true })
    setSelected(undefined)
    setText(nextText)
    clearTimeout(saveTimer.current)
    void save(idx, (p) => (p.draft = nextText))
  }

  if (error)
    return (
      <div className="p-6">
        <p className="font-bold">This writing stop is not available yet.</p>
        <p className="text-sm text-muted">{error}</p>
        <Link to="/" className="btn btn-ghost mt-4">Back to the journey</Link>
      </div>
    )
  if (!unit || !record || !open) return <div className="p-6 text-center text-muted">Preparing your writing desk…</div>

  const shell = (children: React.ReactNode) => (
    <div className={`lvl-${level} animate-rise mx-auto flex min-h-full max-w-xl flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={back} className="flex items-center gap-1 text-sm text-ink-2">
          <IconArrowLeft width={18} height={18} /> {fromArea ? 'Writing' : 'Journey'}
        </button>
        <CoinChip size="sm" />
      </div>
      {children}
    </div>
  )

  if (!unit.writing.length)
    return shell(
      <div className="card text-center">
        <p className="font-bold">No writing prompts here yet</p>
        <p className="mt-1 text-sm text-ink-2">This stop's writing tasks are still being written. Try another stop.</p>
      </div>,
    )

  if (!open.open)
    return shell(
      <div className="card relative overflow-hidden !p-0">
        <div className="airmail h-1.5 w-full" aria-hidden="true" />
        <div className="flex items-start gap-4 p-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--lvl-soft)] text-ink-2"><IconLock width={26} height={26} /></span>
          <div>
            <p className="eyebrow">Writing · {stopName}</p>
            <h1 className="mt-1 text-[1.7rem] leading-tight">Opens after the lessons</h1>
            <p className="mt-1 text-sm text-ink-2">
              Finish this stop's {open.total} lessons first (<span className="font-mono">{open.done}</span>/{open.total} done): the writing prompts use their words and grammar.
            </p>
          </div>
        </div>
      </div>,
    )

  const total = unit.writing.length
  const dots = (
    <ol className="flex items-center gap-1.5" aria-label="Prompts">
      {unit.writing.map((_, i) => {
        const r = record.prompts[String(i)]
        const passed = (r?.best ?? 0) >= WRITING_PASS
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Prompt ${i + 1}${passed ? `, best ${r!.best}%` : ''}`}
              aria-current={i === idx && view !== 'summary' ? 'step' : undefined}
              className={`flex h-7 min-w-7 items-center justify-center rounded-full border-2 px-1 font-mono text-xs font-semibold transition ${i === idx && view !== 'summary' ? 'border-[var(--lvl)] bg-[var(--lvl)] text-white' : passed ? 'border-[var(--lvl)] text-[var(--lvl)]' : 'border-line text-ink-2'}`}
            >
              {passed && !(i === idx && view !== 'summary') ? <IconCheck width={13} height={13} strokeWidth={3.4} /> : i + 1}
            </button>
          </li>
        )
      })}
    </ol>
  )

  // ---- summary of the set
  if (view === 'summary') {
    const sum = writingSummary(record, total, WRITING_PASS)
    return shell(
      <>
        {sum.done === total && <Confetti />}
        <div className="relative mx-auto w-full rounded-2xl border border-line bg-card px-5 pb-6 pt-5 text-center shadow-card">
          <p className="eyebrow">Writing · {stopName}</p>
          <div className="mt-2 flex justify-center"><PostcardPenArt size={64} done={sum.done === total} /></div>
          <h1 className="mt-2 text-[2rem] leading-tight" tabIndex={-1}>{sum.done === total ? 'Postcards sent' : 'Your writing so far'}</h1>
          <p className="mt-1 text-sm text-ink-2">
            <span className="font-mono">{sum.done}</span> of <span className="font-mono">{total}</span> prompts done{sum.best !== undefined ? <> · average best <span className="font-mono text-ink">{sum.best}%</span></> : null}
          </p>
          {earned > 0 && (
            <p className="animate-pop mx-auto mt-3 flex w-fit items-center gap-2 rounded-2xl border border-dashed border-line px-3 py-1.5 text-sm">
              This visit <CoinAmount amount={earned} size={20} className="text-[#b07a0c] dark:text-sun" />
            </p>
          )}
        </div>
        <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2.5" aria-label="Prompts">
          {unit.writing.map((w, i) => {
            const r = record.prompts[String(i)]
            return (
              <li key={i}>
                <button type="button" onClick={() => goTo(i)} className="g-card flex w-full items-center gap-3 p-3.5 text-left">
                  <span className="w-6 shrink-0 font-mono text-sm" style={{ color: 'var(--lvl)' }}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm font-semibold leading-snug">{w.task}</span>
                    {r?.bestText && <span className="mt-0.5 block truncate text-xs text-ink-2" lang={TL}>{r.bestText}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    {r?.best !== undefined ? <><span className="font-mono text-lg leading-none">{r.best}%</span><StampStars n={r.bestStars ?? 0} size={13} /></> : <span className="text-xs text-ink-2">Not yet</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="mt-auto grid gap-3 pt-8">
          {sum.done < total && <Button variant="ghost" onClick={() => goTo(firstOpen(record, total))}>Write the next one</Button>}
          <Button className="py-4" onClick={back}>{fromArea ? 'Back to the writing area' : 'Back to the journey'}</Button>
        </div>
      </>,
    )
  }

  if (!prompt) return null
  const isLast = idx === total - 1
  const nextButton = (
    <Button className="py-4" onClick={() => (isLast || unit.writing.every((_, i) => i === idx || (record.prompts[String(i)]?.best ?? 0) >= WRITING_PASS) ? setView('summary') : goTo(idx + 1))}>
      {isLast ? 'See the summary' : 'Next prompt'}
    </Button>
  )

  // ---- results
  if (view === 'results' && checked) {
    const r = checked.result
    const best = promptRec?.best ?? r.overall
    const sel = selected !== undefined ? checked.issues[selected] : undefined
    const announce = `Score ${r.overall}%, ${r.stars} of 3 stars. ${checked.issues.length ? `${checked.issues.length} ${checked.issues.length === 1 ? 'thing' : 'things'} to check.` : 'Nothing to correct.'}`
    const todo = r.notes.task
    return shell(
      <>
        <p className="sr-only" role="status" aria-live="polite">{announce}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Writing · {stopName}</p>
          {dots}
        </div>
        <section className="relative mt-3 overflow-hidden rounded-2xl border border-line bg-card px-5 pb-5 pt-4 text-center shadow-card" aria-labelledby="w-score">
          <div className="airmail absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
          <h1 id="w-score" ref={resultsHeading} tabIndex={-1} className="eyebrow mt-1 outline-none">Your writing · prompt {idx + 1}</h1>
          <p className="mt-1 font-mono text-[3.2rem] leading-none" aria-label={`Score ${r.overall}%`}>{r.overall}%</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <StampStars n={r.stars} size={26} />
          </div>
          <p className={`inkstamp animate-stamp mx-auto mt-3 w-fit text-base ${r.stars >= 3 ? 'text-ok-500' : r.stars === 2 ? 'text-gold-600' : 'text-red'}`}>{stampLabel(r.stars)}</p>
          <p className="mt-2 text-xs text-ink-2">
            Best <span className="font-mono text-ink">{best}%</span>
            {checked.improved ? ' · a new best' : ''}
            {checked.coins > 0 && <> · <CoinAmount amount={checked.coins} size={16} className="text-[#b07a0c] dark:text-sun" /></>}
          </p>
        </section>

        <dl className="mt-3 grid gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5 shadow-card">
          {WRITING_CATEGORIES.map((c) => (
            <div key={c} className="grid grid-cols-[6.5rem_1fr_2.6rem] items-center gap-x-3">
              <dt className="text-sm font-semibold leading-tight">
                {CATEGORY_LABEL[c]}
                <span className="block text-[10.5px] font-normal leading-tight text-ink-2">{CATEGORY_BLURB[c]}</span>
              </dt>
              <dd className="contents">
                <ChunkyBar value={r.scores[c]} max={100} label={`${CATEGORY_LABEL[c]} ${r.scores[c]}%`} />
                <span className="text-right font-mono text-base">{r.scores[c]}</span>
              </dd>
            </div>
          ))}
        </dl>

        <section className="mt-3 rounded-2xl border border-line bg-card px-4 py-3.5 shadow-card" aria-label="Your text">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="eyebrow">Your text</h2>
            <span className="text-xs text-ink-2">{checked.issues.length ? `${checked.issues.length} to check · tap a mark` : 'Nothing to correct'}</span>
          </div>
          <div className="mt-1.5">
            <HighlightedText text={text} issues={checked.issues} selected={selected} onSelect={(i) => setSelected(i === selected ? undefined : i)} />
          </div>
          {sel && (
            <div className="animate-rise mt-2 rounded-xl border border-line bg-paper px-3 py-2.5" role="region" aria-label="Selected issue">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${sel.category === 'spelling' ? 'bg-[color-mix(in_srgb,var(--sun)_35%,var(--card))] text-ink' : 'bg-[color-mix(in_srgb,var(--red)_14%,var(--card))] text-red'}`}>{issueLabel(sel)}</span>
                <p className="min-w-0 flex-1 text-sm leading-snug">{sel.message}</p>
                <button type="button" className="shrink-0 rounded-full p-1 text-ink-2" aria-label="Close" onClick={() => setSelected(undefined)}><IconX width={16} height={16} /></button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {sel.suggestion && <span className="text-sm">Suggestion: <span className="font-semibold" lang={TL}>{sel.suggestion}</span></span>}
                {sel.safe && sel.suggestion !== undefined && <button type="button" className="g-btn is-soft !px-3 !py-1.5 text-sm" onClick={() => apply(selected!)}>Apply suggestion</button>}
                {sel.grammar && grammar.get(sel.grammar) && <Link to={`/grammar/${sel.grammar}`} className="text-sm font-semibold text-blue underline underline-offset-2">{grammar.get(sel.grammar)!.title}</Link>}
              </div>
              {checked.issues.length > 1 && (
                <div className="mt-2 flex justify-end gap-2 text-xs">
                  <button type="button" className="rounded-full border border-line px-2.5 py-1" onClick={() => setSelected((selected! - 1 + checked.issues.length) % checked.issues.length)}>Previous</button>
                  <button type="button" className="rounded-full border border-line px-2.5 py-1" onClick={() => setSelected((selected! + 1) % checked.issues.length)}>Next issue</button>
                </div>
              )}
            </div>
          )}
          {checked.edited && <p className="mt-2 text-xs font-semibold text-[#b07a0c] dark:text-sun">You've edited the text: revise or check it again to update the score.</p>}
        </section>

        {(r.wentWell.length > 0 || todo.length > 0) && (
          <section className="mt-3 grid gap-3">
            {r.wentWell.length > 0 && (
              <div className="rounded-2xl border border-line bg-card px-4 py-3.5 shadow-card">
                <h2 className="eyebrow">What went well</h2>
                <ul className="mt-1.5 grid gap-1 text-sm">
                  {r.wentWell.map((w) => <li key={w} className="flex gap-2"><IconCheck width={16} height={16} strokeWidth={3} className="mt-0.5 shrink-0 text-ok-500" /><span>{w}</span></li>)}
                </ul>
              </div>
            )}
            {(todo.length > 0 || r.notes.vocabulary.length > 0 || r.notes.grammar.some((n) => n.startsWith('Too short'))) && (
              <div className="rounded-2xl border border-dashed border-line px-4 py-3.5">
                <h2 className="eyebrow">For next time</h2>
                <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-sm">
                  {[...todo, ...r.notes.grammar.filter((n) => n.startsWith('Too short')), ...r.notes.vocabulary, ...r.notes.spelling.filter((n) => n.startsWith('Jyutping'))].map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        <ModelAnswer prompt={prompt} shown={showModel} onShow={() => void revealModel()} />

        <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
          <Button variant="ghost" onClick={() => (checked.edited ? void check() : (setView('write'), requestAnimationFrame(() => area.current?.focus())))}>
            {checked.edited ? 'Check again' : 'Revise'}
          </Button>
          {nextButton}
        </div>
      </>,
    )
  }

  // ---- write
  const len = checked?.result.task.length ?? 0
  return shell(
    <WriteView
      key={idx}
      unit={unit}
      prompt={prompt}
      idx={idx}
      total={total}
      dots={dots}
      stopName={stopName}
      text={text}
      onText={onText}
      area={area}
      best={promptRec}
      onCheck={() => void check()}
      showModel={showModel}
      onShowModel={() => void revealModel()}
      hasChecked={(promptRec?.checks ?? 0) > 0 || len > 0}
    />,
  )
}

/** The model answer: hidden until asked for (after a first check), with audio and English. */
function ModelAnswer({ prompt, shown, onShow }: { prompt: WritingPrompt; shown: boolean; onShow: () => void }) {
  if (!shown)
    return (
      <button type="button" onClick={onShow} className="mt-3 w-full rounded-2xl border-2 border-dashed border-line px-4 py-3 text-sm font-semibold text-ink-2 transition hover:text-ink">
        See a model answer
      </button>
    )
  return (
    <section className="animate-rise mt-3 rounded-2xl border border-line bg-card px-4 py-3.5 shadow-card" aria-label="Model answer">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="eyebrow">A model answer</h2>
          <p className="mt-1 text-lg leading-relaxed"><TargetText text={prompt.model.es} /></p>
          <p className="mt-1 text-sm text-ink-2" lang="en">{prompt.model.en}</p>
        </div>
        <SpeakerButton text={prompt.model.es} size="sm" />
      </div>
      <p className="mt-2 text-xs text-ink-2">Borrow its ideas, then write your own version: a copy doesn't score.</p>
    </section>
  )
}

interface WriteProps {
  unit: Unit
  prompt: WritingPrompt
  idx: number
  total: number
  dots: React.ReactNode
  stopName: string
  text: string
  onText: (v: string) => void
  area: React.RefObject<HTMLTextAreaElement | null>
  best?: WritingPromptRecord
  onCheck: () => void
  showModel: boolean
  onShowModel: () => void
  hasChecked: boolean
}

function WriteView({ unit, prompt, idx, total, dots, stopName, text, onText, area, best, onCheck, showModel, onShowModel, hasChecked }: WriteProps) {
  const han = FEATURES.romanization === 'jyutping'
  /** Where taps from the helper rows go (the textarea's caret, kept while it is not focused). */
  const caret = useRef<number | undefined>(undefined)
  const length = useMemo(() => {
    if (!text.trim()) return 0
    if (han) return [...text].filter((c) => HAN.test(c)).length + (text.match(/[a-z]+[1-6]/gi) ?? []).length
    return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length
  }, [text, han])
  const unitLabel = han ? 'characters' : 'words'
  const tone = length < prompt.min ? 'under' : length > prompt.max ? 'over' : 'ok'
  const useWords = prompt.use.map((id) => vocab.get(id)).filter((v): v is NonNullable<typeof v> => Boolean(v))
  const need = Math.min(prompt.useAtLeast ?? Math.min(3, useWords.length), useWords.length)
  const grammarTitles = prompt.grammar.map((g) => grammar.get(g)?.title).filter(Boolean) as string[]

  const insert = (s: string) => {
    const el = area.current
    const at = caret.current ?? el?.selectionStart ?? text.length
    const pos = Math.min(at, text.length)
    const next = text.slice(0, pos) + s + text.slice(pos)
    onText(next)
    caret.current = pos + s.length
    // keep the caret after the insert, without opening the keyboard on phones
    requestAnimationFrame(() => {
      if (el && document.activeElement === el) el.setSelectionRange(pos + s.length, pos + s.length)
    })
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Writing · {stopName}</p>
        {dots}
      </div>
      <section className="card relative mt-3 overflow-hidden !p-0" aria-labelledby="w-task">
        <div className="airmail h-1.5 w-full" aria-hidden="true" />
        <div className="p-4">
          <p className="it-eyebrow">Prompt {idx + 1} of {total}</p>
          <h1 id="w-task" className="mt-1 font-display text-[1.25rem] leading-snug">{prompt.task}</h1>
          {prompt.es && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-line bg-paper px-3 py-2.5">
              <p className="min-w-0 flex-1 text-lg leading-relaxed"><TargetText text={prompt.es} /></p>
              <SpeakerButton text={prompt.es} size="sm" />
            </div>
          )}
          {useWords.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-ink-2">Use {need === useWords.length ? 'these words' : `at least ${need} of these`}:</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {useWords.map((v) => (
                  <li key={v.id} className="rounded-full border border-line bg-card px-2.5 py-0.5 text-sm" title={v.en.join(', ')}>
                    <span className="font-semibold" lang={TL}>{v.lemma}</span> <span className="text-xs text-ink-2">{v.en[0]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {grammarTitles.length > 0 && <p className="mt-2 text-xs text-ink-2">Grammar: {grammarTitles.join(' · ')}</p>}
        </div>
      </section>

      <label htmlFor="w-text" className="sr-only">Your text in {LANGUAGE}</label>
      <textarea
        id="w-text"
        ref={area}
        value={text}
        onChange={(e) => {
          caret.current = e.target.selectionStart
          onText(e.target.value)
        }}
        onSelect={(e) => (caret.current = (e.target as HTMLTextAreaElement).selectionStart)}
        rows={6}
        lang={TL}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize={han ? 'off' : 'sentences'}
        placeholder={han ? '用廣東話寫…' : `Write in ${LANGUAGE}…`}
        className="mt-3 w-full resize-y rounded-2xl border-2 border-line bg-card p-3 text-lg leading-relaxed outline-none transition focus:border-[var(--lvl)]"
      />
      <div className="mt-1.5 flex items-center gap-3" aria-live="polite">
        <ChunkyBar value={length} max={prompt.max} className="flex-1" label={`${length} ${unitLabel}`} />
        <span className={`shrink-0 text-xs ${tone === 'ok' ? 'text-ok-600 dark:text-ok-500' : 'text-ink-2'}`}>
          <span className="font-mono text-sm font-semibold text-ink">{length}</span> / {prompt.min}–{prompt.max} {unitLabel}
        </span>
      </div>
      {han ? <CharHelper unit={unit} prompt={prompt} onInsert={insert} /> : SPECIAL_CHARS.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Special characters">
          {SPECIAL_CHARS.map((c) => <button key={c} type="button" onClick={() => insert(c)} className="rounded-lg border-2 border-line bg-card px-2.5 py-1 font-bold" lang={TL}>{c}</button>)}
        </div>
      )}
      {best?.best !== undefined && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-2">Best so far <span className="font-mono text-sm text-ink">{best.best}%</span> <StampStars n={best.bestStars ?? 0} size={13} /></p>
      )}
      {hasChecked && <ModelAnswer prompt={prompt} shown={showModel} onShow={onShowModel} />}
      <div className="mt-auto pt-6">
        <Button className="w-full py-4" disabled={!text.trim()} onClick={onCheck}>Check my writing</Button>
      </div>
    </>
  )
}

/**
 * Cantonese without a Chinese keyboard: the stop's words and the everyday characters as tiles
 * to tap into the text (at the caret), with the punctuation.
 */
function CharHelper({ unit, prompt, onInsert }: { unit: Unit; prompt: WritingPrompt; onInsert: (s: string) => void }) {
  const tiles = useMemo(() => {
    const seen = new Set<string>()
    const out: { text: string; jp?: string; en?: string }[] = []
    const add = (text: string, jp?: string, en?: string) => {
      const t = text.replace(/\s+/g, '')
      if (!t || seen.has(t) || !HAN.test(t) || [...t].length > 4) return
      seen.add(t)
      out.push({ text: t, jp, en })
    }
    for (const id of prompt.use) {
      const v = vocab.get(id)
      if (v) add(v.lemma, v.jp, v.en[0])
    }
    for (const l of unit.lessons) for (const id of l.vocab) {
      const v = vocab.get(id)
      if (v) add(v.lemma, v.jp, v.en[0])
    }
    for (const w of known.always) if ([...w].length === 1) add(w)
    return out
  }, [unit, prompt])
  return (
    <div className="mt-2 rounded-2xl border border-line bg-card p-2" role="group" aria-label="Characters to tap in">
      <p className="px-1 pb-1 text-[11px] text-ink-2">No Chinese keyboard? Tap to add:</p>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {['，', '。', '？', '！'].map((c) => (
          <button key={c} type="button" onClick={() => onInsert(c)} className="h-10 min-w-10 rounded-lg border-2 border-line bg-paper px-2 text-lg font-bold" aria-label={`Insert ${c}`}>{c}</button>
        ))}
        {tiles.map((t) => (
          <button key={t.text} type="button" data-char={t.text} onClick={() => onInsert(t.text)} className="flex h-10 min-w-10 flex-col items-center justify-center rounded-lg border-2 border-line bg-paper px-2 leading-none" title={[t.jp, t.en].filter(Boolean).join(' · ')} aria-label={`Insert ${t.text}${t.en ? ` (${t.en})` : ''}`} lang={TL}>
            <span className="text-lg">{t.text}</span>
            {t.jp && <span className="mt-0.5 font-mono text-[9px] text-ink-2">{t.jp}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
