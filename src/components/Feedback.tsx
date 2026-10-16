import { useState } from 'react'
import type { Exercise, GradeResult } from '../engine/types'
import { grammar, ui, LANGUAGE } from '../engine/loader'
import type { Explanation } from '../engine/explain'
import { stripAccents } from '@lang/normalize'
import { Button, SpeakerButton } from './ui/basics'
import { IconCheck, IconX } from './ui/icons'
import { GrammarNoteView } from './GrammarNote'
import { inline } from './ui/inline'
import { TL } from '../engine/course'
import { TargetText } from './ui/TargetText'

const same = (a: string, b: string) => stripAccents(a.toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === stripAccents(b.toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export interface FeedbackProps {
  exercise: Exercise
  result: GradeResult
  explanation: Explanation
  onContinue: () => void
  last: boolean
  /** Pin state and toggle for wrong answers (absent in pinned practice). */
  pinned?: boolean
  onPin?: () => void
}

export function Feedback({ exercise, result, explanation, onContinue, last, pinned, onPin }: FeedbackProps) {
  const [showRule, setShowRule] = useState(false)
  const ok = result.verdict !== 'wrong'
  const almost = result.verdict === 'almost'
  const noteId = exercise.teach ?? exercise.grammar[0]
  const note = noteId ? grammar.get(noteId) : undefined
  const spanishAnswer = exercise.kind !== 'typeEn' && exercise.kind !== 'choiceEs' && exercise.kind !== 'listen' && exercise.kind !== 'match'
  const review = exercise.review
  // The "correct answer" line only when the answer is not already the Spanish or English line of the card.
  const showCorrect = (!ok || almost) && result.correct && !(review && (same(result.correct, review.es) || same(result.correct, review.en)))
  // Checker notes and grader notes first (they are the most specific), then diff-based hints, without repeats.
  const hints = [...new Set([...result.notes, ...explanation.hints])].slice(0, 5)
  const title = result.verdict === 'correct' ? (result.lenient ? `${ui.feedback.correct} One small slip` : ui.feedback.correct) : almost ? `${ui.feedback.almost} Watch the details` : 'Not quite'
  return (
    <div className="animate-slide-up fixed inset-x-0 bottom-0 z-20 max-h-[85vh] overflow-y-auto border-t border-line bg-card shadow-float" role="status">
      <div className={`h-1.5 w-full ${ok && !almost ? 'bg-ok-500' : almost ? 'bg-sun' : 'bg-bad-500'}`} aria-hidden="true" />
      <div className="mx-auto max-w-xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-start justify-between gap-3">
          <p className={`inkstamp animate-stamp mb-3 mt-1 ${ok && !almost ? 'text-ok-500' : almost ? 'text-gold-600' : 'text-bad-500'}`}>
            {ok && !almost ? <IconCheck width={20} height={20} strokeWidth={3} /> : almost ? null : <IconX width={20} height={20} strokeWidth={3} />}
            {ok && !almost ? ui.feedback.correct.replace(/[!¡]/g, '') : almost ? 'Postage due' : 'Return to sender'}
          </p>
          <p className="mt-1 text-right text-sm text-ink-2">{title}</p>
        </div>
        <div className="mt-1">
            {showCorrect && (
              <div className="mt-1 flex items-center gap-2">
                <p className="font-semibold" lang={spanishAnswer ? TL : 'en'}>
                  <span className="font-normal opacity-80">Correct answer: </span>
                  {spanishAnswer ? <TargetText text={result.correct} /> : result.correct}
                </p>
                {spanishAnswer && <SpeakerButton text={result.correct} size="sm" />}
              </div>
            )}
            {review && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-line bg-paper px-3 py-2.5 text-ink" aria-label={`What you practised, in ${LANGUAGE} and English`}>
                <SpeakerButton text={review.es} size="sm" className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold leading-snug" lang={TL}><TargetText text={review.es} /></p>
                  <p className="text-sm leading-snug opacity-80" lang="en">{review.en}</p>
                </div>
              </div>
            )}
            {explanation.diff && explanation.diff.some((t) => t.kind !== 'same') && (
              <p className="mt-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm leading-relaxed text-ink" lang={exercise.kind === 'typeEn' ? 'en' : TL} aria-label="Your answer compared with the correct one">
                <span className="mr-1 text-xs font-bold opacity-70">You wrote:</span>
                {explanation.diff.map((t, i) => (
                  <span key={i} className="mr-1">
                    {t.kind === 'same' && t.text}
                    {t.kind === 'extra' && <span className="text-bad-600 line-through decoration-2">{t.text}</span>}
                    {t.kind === 'missing' && <span className="rounded bg-ok-500/20 px-1 font-bold text-ok-700 dark:text-ok-100">+{t.text}</span>}
                    {t.kind === 'wrong' && (
                      <>
                        <span className="text-bad-600 line-through decoration-2">{t.text}</span> <span className="rounded bg-ok-500/20 px-1 font-bold text-ok-700 dark:text-ok-100">{t.fix}</span>
                      </>
                    )}
                  </span>
                ))}
              </p>
            )}
            {hints.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {hints.map((n, i) => (
                  <li key={i} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{n}</span></li>
                ))}
              </ul>
            )}
            {note && !ok && (
              <div className="mt-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink">
                <p><span className="font-semibold">Rule:</span> {inline(note.summary)}</p>
                <button type="button" className="mt-1 text-xs font-bold underline" onClick={() => setShowRule((v) => !v)}>
                  {showRule ? 'Hide the full explanation' : `Full explanation: ${note.title}`}
                </button>
              </div>
            )}
            {note && ok && (almost || result.lenient) && (
              <button type="button" className="mt-2 text-sm font-bold underline" onClick={() => setShowRule((v) => !v)}>
                {showRule ? 'Hide the rule' : `Rule: ${note.title}`}
              </button>
            )}
        </div>
        {showRule && note && (
          <div className="mt-3 max-h-[40vh] overflow-y-auto rounded-2xl bg-surface p-3 text-[var(--text)]">
            <GrammarNoteView note={note} compact />
          </div>
        )}
        <div className="mt-4 flex gap-2">
          {!ok && onPin && (
            <Button variant="ghost" className="shrink-0 py-4" onClick={onPin} aria-pressed={pinned}>
              {pinned ? '📌 Pinned' : '📌 Pin'}
            </Button>
          )}
          <Button variant="primary" className="flex-1 py-4" onClick={onContinue} autoFocus>
            {last ? 'Finish' : 'Continue'}
          </Button>
        </div>
        {!ok && pinned && <p className="mt-2 text-center text-xs font-semibold opacity-80">Saved for a focused re-test in Review → Pinned.</p>}
      </div>
    </div>
  )
}
