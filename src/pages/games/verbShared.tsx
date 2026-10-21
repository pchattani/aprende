/**
 * Components shared by the verb games (Verb slots, Verb blitz, Verb duel): the prompt card,
 * the typing field, the mini paradigm and the countdown bar. The round's verbs and tenses come
 * from verbRound.ts; the game rules are pure functions in engine/games/verbPrompts.ts.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { TL, SPECIAL_CHARS } from '../../engine/course'
import type { VerbPrompt, ParadigmRow } from '../../engine/games/verbPrompts'
import { shortTense } from './verbRound'

/** The person, verb and tense of a prompt, with the English hint. */
export function PromptCard({ p, children, className = '' }: { p: VerbPrompt; children?: ReactNode; className?: string }) {
  return (
    <div className={`card text-center ${className}`}>
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-lg font-semibold">
        <span lang={TL}>{p.pronoun}</span>
        <span className="text-muted" aria-hidden="true">·</span>
        <span className="font-display text-2xl" lang={TL}>
          {p.verb.lemma}
        </span>
        <span className="text-muted" aria-hidden="true">·</span>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--blue)_14%,var(--card))] px-2.5 py-0.5 text-sm font-bold text-blue">{shortTense(p.tenseLabel)}</span>
      </p>
      <p className="mt-1 text-sm text-muted" lang="en">
        {p.english ? <>“{p.english}”</> : p.verb.en}
        {p.irregular && <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--sun)_25%,var(--card))] px-1.5 py-px text-[11px] font-extrabold text-ink" title="Irregular form">★ irregular</span>}
      </p>
      {children}
    </div>
  )
}

/** The text field for a form, with the course's accented letters under it (inserted at the caret). */
export function FormInput({ value, onChange, onEnter, disabled = false, autoFocus = true, tone }: { value: string; onChange: (v: string) => void; onEnter: () => void; disabled?: boolean; autoFocus?: boolean; tone?: 'ok' | 'bad' }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus({ preventScroll: true })
  }, [autoFocus, disabled])
  const insert = (ch: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    onChange(value.slice(0, start) + ch + value.slice(end))
    requestAnimationFrame(() => {
      el?.focus({ preventScroll: true })
      el?.setSelectionRange(start + ch.length, start + ch.length)
    })
  }
  const border = tone === 'ok' ? 'border-[var(--ok)]' : tone === 'bad' ? 'border-[var(--bad)]' : 'border-line focus:border-blue'
  return (
    <div>
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter()
          }
        }}
        className={`w-full rounded-xl border-2 bg-surface px-3 py-3 text-center text-xl font-semibold outline-none disabled:opacity-80 ${border}`}
        lang={TL}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label="Conjugated form"
        placeholder="Type the form"
      />
      {!disabled && SPECIAL_CHARS.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5" aria-label="Accented letters">
          {SPECIAL_CHARS.filter((c) => !/[¿¡]/.test(c)).slice(0, 10).map((c) => (
            <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(c)} className="tile min-w-9 px-2 py-1 text-center text-base" lang={TL} aria-label={`Insert ${c}`}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** All persons of the verb in the tense, the asked one highlighted and irregular forms starred. */
export function Paradigm({ rows, person, tense }: { rows: ParadigmRow[]; person: number; tense: string }) {
  return (
    <table className="mt-3 w-full text-left text-sm" aria-label={`${tense} forms`}>
      <tbody>
        {rows.map((r) => {
          const on = r.person === person
          return (
            <tr key={r.person} className={`border-t border-line ${on ? 'bg-[color-mix(in_srgb,var(--blue)_10%,var(--card))]' : ''}`} aria-current={on ? 'true' : undefined}>
              <td className="py-1.5 pl-2 pr-2 text-muted" lang={TL}>
                {r.label}
              </td>
              <td className={`py-1.5 pr-2 font-bold ${on ? 'text-blue' : ''}`} lang={TL}>
                {r.form ?? '—'}
                {r.irregular && (
                  <span className="ml-1 text-[var(--sun)]" title="Irregular" aria-label="irregular">
                    ★
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** A thin countdown bar (`left` of `total` ms). */
export function TimerBar({ left, total, label }: { left: number; total: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (left / total) * 100))
  const low = left <= total * 0.25
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={Math.round(total / 1000)} aria-valuenow={Math.ceil(left / 1000)}>
      <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${pct}%`, background: low ? 'var(--bad)' : 'var(--ok)' }} />
    </div>
  )
}

/** "Not enough verbs" fallback (a course without verbs in the learner's reach). */
export function NoVerbs({ onBack }: { onBack: () => void }) {
  return (
    <div className="card text-center">
      <p className="font-semibold">No verbs to play with yet</p>
      <p className="mt-1 text-sm text-muted">Finish a lesson or two and come back.</p>
      <button type="button" className="btn btn-primary mt-3 w-full" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
