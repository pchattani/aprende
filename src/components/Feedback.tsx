import { useState } from 'react'
import type { Exercise, GradeResult } from '../engine/types'
import { grammar } from '../engine/loader'
import { Button, SpeakerButton } from './ui/basics'
import { GrammarNoteView } from './GrammarNote'

export function Feedback({ exercise, result, onContinue, last }: { exercise: Exercise; result: GradeResult; onContinue: () => void; last: boolean }) {
  const [explain, setExplain] = useState(false)
  const ok = result.verdict !== 'wrong'
  const almost = result.verdict === 'almost'
  const noteId = exercise.teach ?? exercise.grammar[0]
  const note = noteId ? grammar.get(noteId) : undefined
  const spanishAnswer = exercise.kind !== 'typeEn' && exercise.kind !== 'choiceEs' && exercise.kind !== 'listen' && exercise.kind !== 'match'
  return (
    <div className={`animate-slide-up fixed inset-x-0 bottom-0 z-20 rounded-t-[2rem] border-t ${ok ? 'border-ok-500/40 bg-ok-100 text-ok-700 dark:bg-[#2a3620] dark:text-ok-100' : 'border-bad-500/40 bg-bad-100 text-bad-700 dark:bg-[#3a2321] dark:text-bad-100'}`} style={{ boxShadow: '0 -12px 32px -16px rgba(60,40,20,0.35)' }} role="status">
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
            {ok && !almost && 'translation' in exercise && exercise.translation && exercise.kind !== 'typeEn' && (
              <p className="mt-1 text-sm opacity-80">{exercise.translation}</p>
            )}
            {result.notes.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            {note && (
              <button type="button" className="mt-2 text-sm font-bold underline" onClick={() => setExplain((v) => !v)}>
                {explain ? 'Hide explanation' : `Explain: ${note.title}`}
              </button>
            )}
          </div>
        </div>
        {explain && note && (
          <div className="mt-3 max-h-[45vh] overflow-y-auto rounded-2xl bg-surface p-3 text-[var(--text)]">
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
