import { useMemo, useState } from 'react'
import type { Exercise, GradeResult } from '../engine/types'
import type { Answer } from '../engine/grade'
import { grammar } from '../engine/loader'
import { explainAnswer } from '../engine/explain'
import { getDictionary } from '../hooks/useDeps'
import { lookup } from '../lang/es/inflect'
import { conjugate } from '../lang/es/verbs'
import { Button, SpeakerButton } from './ui/basics'
import { GrammarNoteView } from './GrammarNote'
import { inline } from './ui/inline'

const explainDeps = {
  lookup: (form: string) => lookup(getDictionary(), form.toLowerCase()),
  conjugate,
}

export function Feedback({ exercise, result, answer, onContinue, last }: { exercise: Exercise; result: GradeResult; answer?: Answer; onContinue: () => void; last: boolean }) {
  const [showRule, setShowRule] = useState(false)
  const ok = result.verdict !== 'wrong'
  const almost = result.verdict === 'almost'
  const noteId = exercise.teach ?? exercise.grammar[0]
  const note = noteId ? grammar.get(noteId) : undefined
  const spanishAnswer = exercise.kind !== 'typeEn' && exercise.kind !== 'choiceEs' && exercise.kind !== 'listen' && exercise.kind !== 'match'
  const explanation = useMemo(() => (result.verdict === 'correct' ? { hints: [] } : explainAnswer(exercise, answer, explainDeps)), [exercise, answer, result.verdict])
  // Checker notes and grader notes first (they are the most specific), then diff-based hints, without repeats.
  const hints = [...new Set([...result.notes, ...explanation.hints])].slice(0, 5)
  return (
    <div className={`animate-slide-up fixed inset-x-0 bottom-0 z-20 max-h-[85vh] overflow-y-auto rounded-t-[2rem] border-t ${ok ? 'border-ok-500/40 bg-ok-100 text-ok-700 dark:bg-[#2a3620] dark:text-ok-100' : 'border-bad-500/40 bg-bad-100 text-bad-700 dark:bg-[#3a2321] dark:text-bad-100'}`} style={{ boxShadow: '0 -12px 32px -16px rgba(60,40,20,0.35)' }} role="status">
      <div className="mx-auto max-w-xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ${ok ? 'text-ok-600' : 'text-bad-600'}`} aria-hidden="true">{result.verdict === 'correct' ? '🎉' : almost ? '👀' : '🤔'}</div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold">{result.verdict === 'correct' ? '¡Correcto!' : almost ? '¡Casi! Watch the details' : 'Not quite'}</p>
            {(!ok || almost) && (
              <div className="mt-1 flex items-center gap-2">
                <p className="font-semibold" lang={spanishAnswer ? 'es' : 'en'}>
                  {!ok && <span className="font-normal opacity-80">Correct answer: </span>}
                  {result.correct}
                </p>
                {spanishAnswer && <SpeakerButton text={result.correct} size="sm" />}
              </div>
            )}
            {ok && !almost && 'translation' in exercise && exercise.translation && exercise.kind !== 'typeEn' && <p className="mt-1 text-sm opacity-80">{exercise.translation}</p>}
            {explanation.diff && explanation.diff.some((t) => t.kind !== 'same') && (
              <p className="mt-2 rounded-xl bg-white/70 px-2.5 py-1.5 text-sm leading-relaxed text-[var(--text)] dark:bg-black/20" lang={exercise.kind === 'typeEn' ? 'en' : 'es'} aria-label="Your answer compared with the correct one">
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
              <div className="mt-2 rounded-xl bg-white/60 px-2.5 py-2 text-sm text-[var(--text)] dark:bg-black/20">
                <p><span className="font-extrabold">Rule:</span> {inline(note.summary)}</p>
                <button type="button" className="mt-1 text-xs font-bold underline" onClick={() => setShowRule((v) => !v)}>
                  {showRule ? 'Hide the full explanation' : `Full explanation: ${note.title}`}
                </button>
              </div>
            )}
            {note && ok && almost && (
              <button type="button" className="mt-2 text-sm font-bold underline" onClick={() => setShowRule((v) => !v)}>
                {showRule ? 'Hide the rule' : `Rule: ${note.title}`}
              </button>
            )}
          </div>
        </div>
        {showRule && note && (
          <div className="mt-3 max-h-[40vh] overflow-y-auto rounded-2xl bg-surface p-3 text-[var(--text)]">
            <GrammarNoteView note={note} compact />
          </div>
        )}
        <Button variant={ok ? 'ok' : 'bad'} className="mt-4 w-full" onClick={onContinue} autoFocus>
          {last ? 'Finish' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
