import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Lesson } from '../engine/schema'
import { grammar, vocab } from '../engine/loader'
import { GrammarNoteView } from './GrammarNote'
import { SpeakerButton, Chip } from './ui/basics'
import { IconX } from './ui/icons'
import { TL } from '../engine/course'
import { charInfo } from '../engine/chars'
import { PICTOGRAMS } from '../engine/pictograms'
import { StrokeOrder } from './writing/hanzi'
import { useStrokeData } from './writing/useHanzi'
import { Pictogram } from './art/Pictogram'

/**
 * The lesson's guidebook: one tab per grammar note, a Writing tab for the characters the lesson teaches
 * to write (lessons with `write`) and a Words tab with the lesson's new vocabulary.
 */
export function GuidebookBody({ lesson }: { lesson: Lesson }) {
  const notes = lesson.teach.map((g) => grammar.get(g)).filter(Boolean)
  const words = lesson.vocab.map((v) => vocab.get(v)).filter(Boolean)
  const chars = lesson.write ?? []
  const [tab, setTab] = useState(0)
  const writingTab = chars.length ? notes.length : -1
  const wordsTab = notes.length + (chars.length ? 1 : 0)
  const tabCls = (on: boolean) => `-mb-px shrink-0 border-b-2 pb-2 text-sm font-semibold transition ${on ? 'border-ink text-ink' : 'border-transparent text-ink-2'}`
  return (
    <>
      <div className="flex gap-5 overflow-x-auto border-b border-line" role="tablist">
        {notes.map((n, i) => (
          <button key={n!.id} type="button" onClick={() => setTab(i)} role="tab" aria-selected={tab === i} className={tabCls(tab === i)}>
            {n!.title}
          </button>
        ))}
        {chars.length > 0 && (
          <button type="button" onClick={() => setTab(writingTab)} role="tab" aria-selected={tab === writingTab} className={tabCls(tab === writingTab)}>
            Writing ({chars.length})
          </button>
        )}
        {words.length > 0 && (
          <button type="button" onClick={() => setTab(wordsTab)} role="tab" aria-selected={tab === wordsTab} className={tabCls(tab === wordsTab)}>
            Words ({words.length})
          </button>
        )}
      </div>
      <div className="card mt-4">
        {tab < notes.length ? (
          <GrammarNoteView note={notes[tab]!} />
        ) : tab === writingTab ? (
          <ul className="divide-y divide-[var(--line)]" data-shot="guide-writing">
            {chars.map((c) => (
              <WritingEntry key={c} char={c} />
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {words.map((w) => (
              <li key={w!.id} className="flex items-center gap-3 py-2">
                <SpeakerButton text={w!.lemma} size="sm" />
                <div className="flex-1">
                  <p className="font-bold" lang={TL}>
                    {w!.pos === 'noun' && w!.gender ? `${w!.gender === 'f' ? 'la' : 'el'} ` : ''}
                    {w!.lemma}
                  </p>
                  <p className="text-sm text-muted">{w!.en.join(', ')}</p>
                </div>
                <Chip>{w!.pos}</Chip>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/** One character to write: its stroke order (replayable), stroke count, reading, meaning and, when it grew from one, its picture. */
function WritingEntry({ char }: { char: string }) {
  const info = charInfo(char, vocab)
  const data = useStrokeData(char)
  const picto = PICTOGRAMS[char]
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <StrokeOrder char={char} size={112} autoPlay={false} />
        <div className="min-w-0 flex-1 pt-1">
          <p className="flex items-center gap-2">
            <span className="text-[2.2rem] font-semibold leading-none" lang={TL}>{char}</span>
            <SpeakerButton text={char} size="sm" />
          </p>
          {info.jp && <p className="mt-1 font-mono text-base font-semibold">{info.jp}</p>}
          <p className="text-sm text-muted">{info.en}</p>
          {data && <p className="mt-1 text-xs font-bold text-ink-2">{data.strokes.length} stroke{data.strokes.length === 1 ? '' : 's'}</p>}
        </div>
      </div>
      {picto && (
        <div className="mt-3">
          <Pictogram char={char} />
          <p className="mt-1.5 text-sm text-ink-2">{picto.story}</p>
        </div>
      )}
    </li>
  )
}

/** The guidebook as a sheet over a running lesson or the done screen; the lesson keeps its place. */
export function GuidebookSheet({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Guidebook: ${lesson.title}`} onClick={onClose}>
      <div className="animate-rise max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-paper px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-float sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Guidebook</p>
            <h2 className="mt-1 text-2xl leading-tight">{lesson.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-ink-2 hover:bg-card" aria-label="Close guidebook">
            <IconX width={24} height={24} />
          </button>
        </div>
        {lesson.tip && <p className="mb-4 -rotate-1 rounded-sm border-l-4 border-sun bg-card px-4 py-2 font-hand text-xl leading-snug shadow-card">{lesson.tip}</p>}
        <GuidebookBody lesson={lesson} />
      </div>
    </div>,
    document.body,
  )
}
